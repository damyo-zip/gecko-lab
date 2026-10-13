import { cross } from "./inheritance";
import { LOCI, locusById, pairKey } from "./loci";
import type { AllelePair } from "../mendel";
import type { Belief, Knowledge, KnowledgeSource, Locus } from "./model";

export type Distribution = Record<string,number>;
export function normalize(values:Distribution):Distribution {
  const total=Object.values(values).reduce((s,p)=>s+p,0);
  if(!Number.isFinite(total)||total<=0)throw new Error("관찰과 사전 정보가 모순됩니다.");
  return Object.fromEntries(Object.entries(values).filter(([,p])=>p>0).map(([k,p])=>[k,p/total]));
}
export function condition(prior:Distribution,locus:Locus,observed:string):Distribution {
  return normalize(Object.fromEntries(Object.entries(prior).map(([k,p])=>[k,locus.phenotypes[k]===observed?p:0])));
}
export function priorCross(father:Distribution,mother:Distribution,locus:Locus):Distribution {
  const result:Distribution={};
  for(const [f,pf]of Object.entries(father))for(const[m,pm]of Object.entries(mother)){
    const outcomes=cross({version:1,loci:{[locus.id]:f.split("/") as unknown as AllelePair}},
      {version:1,loci:{[locus.id]:m.split("/") as unknown as AllelePair}},[locus]).outcomes;
    for(const o of outcomes){const key=pairKey(o.loci[locus.id],locus);result[key]=(result[key]??0)+pf*pm*o.probability;}
  }return normalize(result);
}
/** Exact enumeration of BOTH shared parental latent states for an observed family.
 * Sibling observations multiply likelihoods inside each latent-parent state, never
 * independent marginal guesses. This does not claim global pedigree inference.
 */
export function inferFamily(father:Distribution,mother:Distribution,locus:Locus,observed:readonly string[]) {
  const joint:{father:string;mother:string;probability:number}[]=[];
  for(const[f,pf]of Object.entries(father))for(const[m,pm]of Object.entries(mother)){
    const offspring=priorCross({[f]:1},{[m]:1},locus);
    const likelihood=observed.reduce((product,label)=>product*Object.entries(offspring).reduce((s,[k,p])=>s+(locus.phenotypes[k]===label?p:0),0),1);
    joint.push({father:f,mother:m,probability:pf*pm*likelihood});
  }
  const total=joint.reduce((s,j)=>s+j.probability,0);if(total<=0)throw new Error("관찰과 부모 정보가 모순됩니다.");
  const f:Distribution={},m:Distribution={};for(const j of joint){j.probability/=total;f[j.father]=(f[j.father]??0)+j.probability;m[j.mother]=(m[j.mother]??0)+j.probability;}
  return {father:normalize(f),mother:normalize(m),joint:joint.filter(j=>j.probability>0)};
}
export const belief = (probabilities:Distribution|null,source:KnowledgeSource,note:string,evidenceIds:string[]=[]):Belief => ({probabilities,source,note,evidenceIds});
export function unknownKnowledge():Knowledge {return {version:1,loci:Object.fromEntries(LOCI.map(l=>[l.id,belief(null,"unknown","확률을 계산할 근거가 없습니다.")]))};}
export function childKnowledge(father:Knowledge,mother:Knowledge,observed:Record<string,string>,id:string):Knowledge {
  const result=unknownKnowledge();for(const l of LOCI){const f=father.loci[l.id]?.probabilities,m=mother.loci[l.id]?.probabilities;
    if(f&&m){const probabilities=condition(priorCross(f,m,l),l,observed[l.id]);result.loci[l.id]=belief(probabilities,"parents","부모 공개 정보와 외형으로 조건부 계산",[id]);}
    else if(l.id==="axanthic"&&observed[l.id]==="Axanthic")result.loci[l.id]=belief({"ax/ax":1},"appearance","열성 외형 발현",[id]);
    else if(l.id==="lilly-white")result.loci[l.id]=belief({[observed[l.id]==="Lilly White"?"n/Lw":"n/n"]:1},"appearance","안전 유전형의 외형 발현",[id]);
  }return result;
}
export function carrierProbability(knowledge:Knowledge):number|null {
  const p=knowledge.loci.axanthic.probabilities;return p?p["A/ax"]??0:null;
}
export const SOURCE_LABELS:Record<KnowledgeSource,string>={appearance:"외형 확인",parents:"부모 정보·혈통",offspring:"자손 검증",seller:"판매자 제공 정보",legacy:"이전 게임 기록",unknown:"정보 부족"};
export function beliefLabel(id:string,b:Belief):string {
  if(!b.probabilities)return "유전형 미확인";
  const entries=Object.entries(b.probabilities);
  if(id==="axanthic"){
    if((b.probabilities["ax/ax"]??0)>1-1e-9)return "Axanthic · aa";
    const p=b.probabilities["A/ax"]??0;
    if(p>1-1e-9)return "100% het Axanthic · Aa";
    if(p>0)return (p*100).toFixed(1)+"% possible het Axanthic";
    return "비보인자 · AA";
  }
  return entries.map(([k,p])=>locusById(id).phenotypes[k]+(entries.length>1?" "+(p*100).toFixed(1)+"%":"")).join(" / ");
}
export function knowledgeLabel(k:Knowledge):string {return LOCI.filter(l=>l.id!=="cappuccino-complex"||k.loci[l.id].probabilities===null||!k.loci[l.id].probabilities?.["n/n"]).map(l=>beliefLabel(l.id,k.loci[l.id])).join(" · ");}
export function validateKnowledge(k:Knowledge):void {
  if(!k||k.version!==1||Object.keys(k).sort().join()!=="loci,version"||!k.loci||Object.keys(k.loci).length!==LOCI.length)throw new Error("공개 유전 정보 오류");
  for(const l of LOCI){const b=k.loci[l.id];if(!b||Object.keys(b).sort().join()!=="evidenceIds,note,probabilities,source"||!Object.hasOwn(SOURCE_LABELS,b.source)||typeof b.note!=="string"||b.note.length>500||!Array.isArray(b.evidenceIds)||b.evidenceIds.length>1000||b.evidenceIds.some(id=>typeof id!=="string"||id.length>128)||new Set(b.evidenceIds).size!==b.evidenceIds.length)throw new Error("유전 증거 오류");
    if(b.probabilities!==null){if(typeof b.probabilities!=="object"||Array.isArray(b.probabilities)||!Object.keys(b.probabilities).length||Object.entries(b.probabilities).some(([key,p])=>!Object.hasOwn(l.phenotypes,key)||!Number.isFinite(p)||p<=0||p>1)||Math.abs(Object.values(b.probabilities).reduce((s,p)=>s+p,0)-1)>1e-8)throw new Error("공개 유전 확률 오류");}
  }
}
