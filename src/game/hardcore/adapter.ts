import { phenotypeOf } from "@/game/adapter";
import { axanthicState } from "@/genetics/hardcore";
import type { Gecko } from "./model";
import { carrierProbability } from "@/genetics/advanced/inference";
import { publicKnowledge } from "./genetics";
import { phenotype } from "@/genetics/advanced/phenotype";
import { appearanceProfile } from "./appearance";
import {koreanMorphText,representativeMorphName} from "@/phenotype/display-name";

function legacyView(g: Gecko) {
  return { ...g, genotype: { modelVersion: 1 as const, loci: { "lilly-white": g.genotype.loci["lilly-white"] } } };
}
export function morph(g: Gecko): string {
  const profile=appearanceProfile(g);
  if(profile){const p=carrierProbability(publicKnowledge(g));
    return [profile.names.primary,...profile.names.features].join(" · ")+(p===null?" · 유전 정보 미확인":p>1-1e-9?" · 100% het Ax":p>0?" · "+(p*100).toFixed(1)+"% possible het Ax":"");}
  const lilly = g.genotype.loci["lilly-white"].includes("Lw"), ax = axanthicState(g.genotype);
  if (ax === "visual") return lilly ? "Axanthic + Lilly (복합 외형)" : "Axanthic";
  const label = phenotypeOf(legacyView(g)).description;
  const complex=g.genetics?.genome?phenotype(g.genetics.genome).geneticMorphs.filter(m=>m!=="Lilly White"&&m!=="Axanthic"):[];
  const p=carrierProbability(publicKnowledge(g));
  return [label,...complex].join(" · ") + (p===null?" · 유전 정보 미확인":p>1-1e-9?" · 100% het Ax":p>0?" · "+(p*100).toFixed(1)+"% possible het Ax":"");
}
/** One graphics contract shared by all game screens and target previews. */
export function specimen(g:Gecko,fire:"up"|"down"="up"):import("@/engine/model").GeckoSpecimen {
  const genome=g.genetics?.genome;
  if(!genome)throw new Error('새 외형 엔진을 이용하려면 새 게임을 시작해 주세요.');
  const profile=appearanceProfile(g),t=profile?.traits,n=profile?.names;
  const genetic=visibleGeneticMorphs(g),lilly=genetic.some(m=>m.includes('Lilly')||m==='Frappuccino'||m.startsWith('Sorak'));
  const ax=genotypeAx(g);
  const style:import('@/engine/model').PatternStyle=lilly?'lilly':ax?'axanthic':n?.base.includes('트라이컬러')?'tricolor':n?.base.includes('할리퀸')?'harlequin':n?.base.includes('달마시안')||n?.features.some(f=>f.includes('달마시안'))?'dalmatian':'normal';
  return {schemaVersion:1 as const,id:g.id,name:g.name,seed:g.visualSeed,genome,
    appearance:{bodyColor:t?.color==='회색'?'slate':t?.color==='크림'?'cream':t?.color==='다크'?'brown':'orange',patternStyle:style,
      dorsalCoverage:t?.dorsal??0,flankCoverage:t?.flank??0,spotCount:Math.min(70,profile?.observation.spots??0),...(t?{patterns:t}:{})},state:{fire}};
}
function genotypeAx(g:Gecko){return g.genetics?.genome?.mendelian.loci.axanthic.every(a=>a==='ax')??false;
}
/** Frozen descriptive path also used to generate saved shop individual names.
 * Keep this separate from the changeable player-facing naming policy. */
export function descriptiveVisualName(g:Gecko):string {
  return appearanceProfile(g)?.names.primary??morph(g).replace(/^일반형(?: · (?:반점|할리퀸|트라이컬러) 외형)?|^릴리화이트 이형접합체/,
    {normal:"Normal",lilly:"Lilly White",axanthic:"Axanthic",dalmatian:"Dalmatian",harlequin:"Harlequin",tricolor:"Tricolor Harlequin"}[phenotypeOf(legacyView(g)).visualClass]).split(" · ").filter(s=>!s.includes("het")&&!s.includes("유전 정보")).join(" · ");
}
/** Only expressed morphs: a hidden recessive carrier is never a naming input. */
export function visibleGeneticMorphs(g:Gecko):string[] {
  if(g.genetics?.genome)return phenotype(g.genetics.genome).geneticMorphs;
  return [g.genotype.loci['lilly-white'].includes('Lw')?'Lilly White':'',axanthicState(g.genotype)==='visual'?'Axanthic':''].filter(Boolean);
}
const displayNames=new WeakMap<Gecko,string>();
/** One computed representative for every gameplay screen; no save writes. */
export function visualName(g:Gecko):string {
  let name=displayNames.get(g);if(name!==undefined)return name;
  const profile=appearanceProfile(g),geneticMorphs=visibleGeneticMorphs(g);
  // Older sprites have no measured color/pattern profile. Do not invent those traits.
  const legacyPattern=profile?'':{normal:'',lilly:'',axanthic:'',dalmatian:'달마시안',harlequin:'할리퀸',tricolor:'트라이컬러 할리퀸'}[phenotypeOf(legacyView(g)).visualClass];
  const fallback=profile?.names.primary??(geneticMorphs.length?[geneticMorphs.join(' + '),legacyPattern].filter(Boolean).join(' · '):descriptiveVisualName(g));
  name=representativeMorphName({geneticMorphs,color:profile?.names.color,pattern:profile?.names.base,fallback});
  displayNames.set(g,name);return name;
}
/** Full pre-existing classification and public carrier information remain in details. */
export const morphDescription=(g:Gecko)=>koreanMorphText(morph(g));
export function disclosedSex(g: Gecko): string {
  return g.stage === "adult" ? g.sex === "male" ? "수컷 ♂" : "암컷 ♀" : "미구분 · 성체 때 공개";
}
