import { canonicalJSON } from "@/game/save";
import { cachedGenotype, advancedSafety } from "./genetics";
import { validateKnowledge } from "@/genetics/advanced/inference";
import { validateMendelian, LOCI, pairKey } from "@/genetics/advanced/loci";
import { inherit, risks } from "@/genetics/advanced/inheritance";
import { inheritPoly, polyScores, POLY_IDS, validatePoly } from "@/genetics/advanced/polygenic";
import { legacyTraits } from "@/genetics/advanced/phenotype";
import { TRAIT_KEYS } from "@/genetics/traits";
import type { GeneticsRecord } from "@/genetics/advanced/model";
import type { Gecko, HardcoreGame } from "./model";
import { validateV4, validateLifecycleBase } from "./legacy-validation";
import { validateLifecycle } from "./lifecycle-validation";
export { validateV3, validateV4, validateRules } from "./legacy-validation";

function fail():never {throw new Error("저장 유전체·공개 지식·유전 상속 기록이 손상되었습니다.");}
function keys(value:unknown,expected:string):void {
  if(!value||typeof value!=="object"||Array.isArray(value)||Object.keys(value).sort().join()!==expected.split(" ").sort().join())fail();
}
const equal=(a:unknown,b:unknown)=>canonicalJSON(a)===canonicalJSON(b);
export function validateGenetics(record:GeneticsRecord|undefined):asserts record is GeneticsRecord {
  keys(record,"version genome knowledge appearanceVersion");if(record!.version!==1)fail();
  validateKnowledge(record!.knowledge);
  if(record!.genome===null){if(record!.appearanceVersion!=="legacy-1")fail();return;}
  if(record!.appearanceVersion!=="5.0")fail();keys(record!.genome,"version mendelian polygenic");if(record!.genome.version!==1)fail();
  validateMendelian(record!.genome.mendelian);validatePoly(record!.genome.polygenic);
  if(risks(record!.genome.mendelian).length)fail();
  for(const l of LOCI){const probabilities=record!.knowledge.loci[l.id].probabilities;
    if(probabilities&&!probabilities[pairKey(record!.genome.mendelian.loci[l.id],l)])fail();}
}
export function validateGame(value:unknown):asserts value is HardcoreGame {
  if(!value||typeof value!=="object"||![5,6].includes((value as HardcoreGame).saveVersion))throw new Error("지원하지 않는 저장 버전입니다.");
  const game=value as HardcoreGame,base=structuredClone(game) as unknown as Record<string,unknown>,advancedIds=new Set<string>();
  const all=[...Object.values(game.individuals??{}),...Object.values(game.eggs??{}).map(e=>e.embryo),...Object.values(game.shop?.offers??{}).map(o=>o.individual),...Object.values(game.matings??{}).flatMap(m=>m.lifecycle?.offspring.map(o=>o.embryo)??[])];
  for(const g of all){
    if(!Object.hasOwn(g,"genetics"))fail();validateGenetics(g.genetics);
    if(g.genetics.genome){advancedIds.add(g.id);const expected=legacyTraits(polyScores(g.genetics.genome.polygenic));
      if(!equal(cachedGenotype(g.genetics,g.genotype),g.genotype)||TRAIT_KEYS.some(k=>!Number.isFinite(g.potential[k])||Math.abs(expected[k]-g.potential[k])>1e-12))fail();}
    if(g.parents){const f=game.individuals[g.parents.fatherId],m=game.individuals[g.parents.motherId];if(!f||!m)fail();
      if(g.genetics.genome){const fp=f.genetics?.genome?.polygenic,mp=m.genetics?.genome?.polygenic;if(!fp||!mp)fail();
        for(const id of POLY_IDS){const [a,b]=g.genetics.genome.polygenic.loci[id];if(!fp.loci[id].includes(a)||!mp.loci[id].includes(b))fail();}}
    }
  }
  // Reuse the established care/calendar/ID/kinship/sale/egg structural contract.
  // Only advanced children bypass the obsolete mean-plus-variation check.
  for(const g of Object.values(base.individuals as Record<string,Gecko>))delete g.genetics;
  for(const e of Object.values(base.eggs as HardcoreGame["eggs"]))delete e.embryo.genetics;
  for(const o of Object.values((base.shop as HardcoreGame["shop"]).offers))delete o.individual.genetics;
  for(const m of Object.values(base.matings as HardcoreGame["matings"])){delete m.genetics;for(const o of m.lifecycle?.offspring??[])delete o.embryo.genetics;}
  base.saveVersion=4;if(game.saveVersion===6){validateLifecycle(game);validateLifecycleBase(base,advancedIds);}else validateV4(base,advancedIds);
  for(const m of Object.values(game.matings)){
    if(!Object.hasOwn(m,"genetics"))fail();if(m.genetics===null)continue;
    keys(m.genetics,"father mother observedIds updates");validateGenetics(m.genetics!.father);validateGenetics(m.genetics!.mother);
    const f=game.individuals[m.parents.fatherId],mo=game.individuals[m.parents.motherId];
    if(!equal(f.genetics?.genome,m.genetics!.father.genome)||!equal(mo.genetics?.genome,m.genetics!.mother.genome)||advancedSafety(f,mo).length)fail();
    const observed=m.genetics!.observedIds,eggs=Object.values(game.eggs).filter(e=>e.matingId===m.id);
    if(!Array.isArray(observed)||new Set(observed).size!==observed.length||observed.length>(m.lifecycle?6:2)||observed.some(id=>!eggs.some(e=>e.embryo.id===id&&e.status==="hatched")))fail();
    if(!Array.isArray(m.genetics!.updates)||m.genetics!.updates.length>(m.lifecycle?12:4))fail();
    for(const u of m.genetics!.updates){keys(u,"id before after");if(u.id!==f.id&&u.id!==mo.id)fail();validateKnowledge(u.before);validateKnowledge(u.after);}
    const fg=m.genetics!.father.genome,mg=m.genetics!.mother.genome;
    for(const e of eggs){const child=e.embryo.genetics!.genome;
      if(fg&&mg){if(!child||!equal(child.mendelian,inherit(fg.mendelian,mg.mendelian,e.seed))||!equal(child.polygenic,inheritPoly(fg.polygenic,mg.polygenic,e.seed)))fail();}
      else if(child!==null)fail();
    }
  }
  for(const e of Object.values(game.eggs)){const child=game.individuals[e.embryo.id];if(child&&!equal(child.genetics?.genome,e.embryo.genetics?.genome))fail();}
}
