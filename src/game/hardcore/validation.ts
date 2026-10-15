import { canonicalJSON } from "@/game/save";
import { cachedGenotype, advancedSafety } from "./genetics";
import { validateKnowledge } from "@/genetics/advanced/inference";
import { validateMendelian, LOCI, pairKey } from "@/genetics/advanced/loci";
import { inherit, risks } from "@/genetics/advanced/inheritance";
import { inheritPoly, polyScores, POLY_IDS, validatePoly } from "@/genetics/advanced/polygenic";
import { legacyTraits } from "@/genetics/advanced/phenotype";
import {seededRandom,seedId} from "@/genetics/random";
import {addDays} from "./time";
import { TRAIT_KEYS } from "@/genetics/traits";
import type { GeneticsRecord } from "@/genetics/advanced/model";
import type { Gecko, HardcoreGame } from "./model";
import { validateV4, validateLifecycleBase, validateGeckoRecord } from "./legacy-validation";
import { validateLifecycle } from "./lifecycle-validation";
import {pedigreeIndex,descendantIds} from './family-album';
import { validateHealth, HEALTH_LOCI, inheritHealth } from '@/genetics/health';
import type { Embryo } from './model';
import {validateRush} from '@/game/rush';
export { validateV3, validateV4, validateRules } from "./legacy-validation";

function fail():never {throw new Error("저장 유전체·공개 지식·유전 상속 기록이 손상되었습니다.");}
function keys(value:unknown,expected:string):void {
  if(!value||typeof value!=="object"||Array.isArray(value)||Object.keys(value).sort().join()!==expected.split(" ").sort().join())fail();
}
const equal=(a:unknown,b:unknown)=>canonicalJSON(a)===canonicalJSON(b);
export function validateGenetics(record:GeneticsRecord|undefined,allowRisk=false):asserts record is GeneticsRecord {
  keys(record,"version genome knowledge appearanceVersion"+(allowRisk&&Object.hasOwn(record??{},'unresolvedComplex')?' unresolvedComplex':''));if(record!.version!==1)fail();
  validateKnowledge(record!.knowledge);
  if(record!.genome===null){if(record!.appearanceVersion!=="legacy-1")fail();
    if(Object.hasOwn(record!,'unresolvedComplex')&&(!Array.isArray(record!.unresolvedComplex)||record!.unresolvedComplex.length!==2||record!.unresolvedComplex.some(a=>a!==null&&!LOCI[2].alleles.includes(a))))fail();return;}
  if(Object.hasOwn(record!,'unresolvedComplex'))fail();
  if(!["5.0","patterns-1"].includes(record!.appearanceVersion))fail();keys(record!.genome,"version mendelian polygenic");if(record!.genome.version!==1)fail();
  validateMendelian(record!.genome.mendelian);validatePoly(record!.genome.polygenic);
  if(!allowRisk&&risks(record!.genome.mendelian).length)fail();
  for(const l of LOCI){const probabilities=record!.knowledge.loci[l.id].probabilities;
    if(probabilities&&!probabilities[pairKey(record!.genome.mendelian.loci[l.id],l)])fail();}
}
export function validateGame(value:unknown):asserts value is HardcoreGame {
  if(!value||typeof value!=="object"||![5,6,7,8,9].includes((value as HardcoreGame).saveVersion))throw new Error("지원하지 않는 저장 버전입니다.");
  const game=value as HardcoreGame,base=structuredClone(game) as unknown as Record<string,unknown>,advancedIds=new Set<string>();
  if(Object.hasOwn(game,'cafeRush')){
    if(game.saveVersion!==9)fail();validateRush(game.cafeRush,game.seed);delete base.cafeRush;
  }
  const catalog=game.saveVersion>=7;
  if(game.saveVersion>=8){
    const index=pedigreeIndex(game);
    for(const [id,line] of Object.entries(game.lineages)){
      keys(line,'id name createdDate founderId favorite');
      if(typeof line.favorite!=='boolean'||line.founderId!==null&&(typeof line.founderId!=='string'||!Object.hasOwn(game.individuals,line.founderId)))fail();
      if(line.founderId){const family=descendantIds(index,line.founderId);family.add(line.founderId);
        if(!game.individuals[line.founderId].lineageIds.includes(id)||Object.values(game.individuals).some(g=>g.lineageIds.includes(id)&&!family.has(g.id)))fail();}
      const projected=(base.lineages as HardcoreGame['lineages'])[id];delete projected.founderId;delete projected.favorite;
    }
  }
  const relatives=Object.values(game.shop?.offers??{}).flatMap(o=>o.family?[o.family.father,o.family.mother]:[]);
  const individuals={...Object.fromEntries(relatives.map(p=>[p.id,p])),...game.individuals};
  const all=[...relatives,...Object.values(game.individuals??{}),...Object.values(game.eggs??{}).map(e=>e.embryo),...Object.values(game.shop?.offers??{}).map(o=>o.individual),...Object.values(game.matings??{}).flatMap(m=>m.lifecycle?.offspring.map(o=>o.embryo)??[])];
  for(const g of all){
    if(!Object.hasOwn(g,"genetics"))fail();validateGenetics(g.genetics,game.saveVersion>=9);
    if(game.saveVersion>=9){
      validateHealth(g.healthGenome!);
      if(g.parents){const f=individuals[g.parents.fatherId],m=individuals[g.parents.motherId];
        if(!f?.healthGenome||!m?.healthGenome)fail();
        for(const l of HEALTH_LOCI){const [a,b]=g.healthGenome!.loci[l.id];if(!f.healthGenome.loci[l.id].includes(a)||!m.healthGenome.loci[l.id].includes(b))fail();}}
    }
    if(g.genetics.genome){advancedIds.add(g.id);const expected=legacyTraits(polyScores(g.genetics.genome.polygenic));
      if(!equal(cachedGenotype(g.genetics,g.genotype),g.genotype)||TRAIT_KEYS.some(k=>!Number.isFinite(g.potential[k])||Math.abs(expected[k]-g.potential[k])>1e-12))fail();}
    if(g.parents){const f=individuals[g.parents.fatherId],m=individuals[g.parents.motherId];if(!f||!m)fail();
      if(g.genetics.genome){const fp=f.genetics?.genome?.polygenic,mp=m.genetics?.genome?.polygenic;if(!fp||!mp)fail();
        if((f.genetics!.appearanceVersion==="patterns-1"||m.genetics!.appearanceVersion==="patterns-1")&&g.genetics.appearanceVersion!=="patterns-1")fail();
        for(const id of POLY_IDS){const [a,b]=g.genetics.genome.polygenic.loci[id];if(!fp.loci[id].includes(a)||!mp.loci[id].includes(b))fail();}}
    }
  }
  if(catalog){
    validateShop(game);
    const projected=base as unknown as HardcoreGame;
    for(const parent of relatives)if(!projected.individuals[parent.id])projected.individuals[parent.id]=structuredClone(parent);
    delete projected.shop.batch;
    for(const [id,offer] of Object.entries(projected.shop.offers)){
      if(offer.purchased){delete projected.shop.offers[id];continue;}
      delete offer.family;delete offer.purchased;
    }
  }
  // Reuse the established care/calendar/ID/kinship/sale/egg structural contract.
  // Only advanced children bypass the obsolete mean-plus-variation check.
  const strip=(g:Embryo)=>{delete g.genetics;if(game.saveVersion>=9){delete g.healthGenome;delete g.development;}};
  for(const g of Object.values(base.individuals as Record<string,Gecko>))strip(g);
  for(const e of Object.values(base.eggs as HardcoreGame["eggs"]))strip(e.embryo);
  for(const o of Object.values((base.shop as HardcoreGame["shop"]).offers))strip(o.individual);
  for(const m of Object.values(base.matings as HardcoreGame["matings"])){delete m.genetics;if(game.saveVersion>=9)delete m.riskModel;for(const o of m.lifecycle?.offspring??[])strip(o.embryo);}
  base.saveVersion=4;if(game.saveVersion>=6){validateLifecycle(game);validateLifecycleBase(base,advancedIds,catalog,game.saveVersion>=9);}else validateV4(base,advancedIds);
  for(const m of Object.values(game.matings)){
    if(game.saveVersion>=9){if(!Object.hasOwn(m,'riskModel')||m.riskModel===undefined)fail();if(m.riskModel!==null){keys(m.riskModel,'version father mother');validateHealth(m.riskModel.father);validateHealth(m.riskModel.mother);if(m.riskModel.version!==1||!m.lifecycle||!equal(game.individuals[m.parents.fatherId]?.healthGenome,m.riskModel.father)||!equal(game.individuals[m.parents.motherId]?.healthGenome,m.riskModel.mother))fail();}}
    if(!Object.hasOwn(m,"genetics"))fail();if(m.genetics===null)continue;
    keys(m.genetics,"father mother observedIds updates");validateGenetics(m.genetics!.father,game.saveVersion>=9);validateGenetics(m.genetics!.mother,game.saveVersion>=9);
    const f=game.individuals[m.parents.fatherId],mo=game.individuals[m.parents.motherId];
    if(!equal(f.genetics?.genome,m.genetics!.father.genome)||!equal(mo.genetics?.genome,m.genetics!.mother.genome)||game.saveVersion<9&&advancedSafety(f,mo).length)fail();
    const observed=m.genetics!.observedIds,eggs=Object.values(game.eggs).filter(e=>e.matingId===m.id),maxObserved=m.lifecycle?.offspring.length??2;
    if(!Array.isArray(observed)||new Set(observed).size!==observed.length||observed.length>maxObserved||observed.some(id=>!eggs.some(e=>e.embryo.id===id&&e.status==="hatched")))fail();
    if(!Array.isArray(m.genetics!.updates)||m.genetics!.updates.length>maxObserved*2)fail();
    for(const u of m.genetics!.updates){keys(u,"id before after");if(u.id!==f.id&&u.id!==mo.id)fail();validateKnowledge(u.before);validateKnowledge(u.after);}
    const fg=m.genetics!.father.genome,mg=m.genetics!.mother.genome;
    for(const e of eggs){const child=e.embryo.genetics!.genome;
      if(fg&&mg){if(!child||!equal(child.mendelian,inherit(fg.mendelian,mg.mendelian,e.seed))||!equal(child.polygenic,inheritPoly(fg.polygenic,mg.polygenic,e.seed)))fail();}
      else if(child!==null)fail();
    }
  }
  for(const e of Object.values(game.eggs)){const child=game.individuals[e.embryo.id];if(child&&!equal(child.genetics?.genome,e.embryo.genetics?.genome))fail();}
  if(game.saveVersion>=9){
    for(const g of [...Object.values(game.individuals),...Object.values(game.shop.offers).map(o=>o.individual)]){
      if(Object.hasOwn(g,'development')||g.genotype.loci['lilly-white'].every(a=>a==='Lw'))fail();
    }
    for(const e of Object.values(game.eggs)){
      const d=e.embryo.development;if(d){keys(d,'version viable causes');if(d.version!==1||typeof d.viable!=='boolean'||!Array.isArray(d.causes))fail();
        const causes=e.embryo.genotype.loci['lilly-white'].every(a=>a==='Lw')?['lilly-white']:[];
        if(!equal(d.causes,causes)||d.viable!==!causes.length)fail();}
      if(Object.hasOwn(e.embryo,'development')!==!!(e.matingId&&game.matings[e.matingId].riskModel))fail();
      const child=game.individuals[e.embryo.id];if(child&&(!equal(child.healthGenome,e.embryo.healthGenome)||!equal(child.genetics?.unresolvedComplex,e.embryo.genetics?.unresolvedComplex)||d?.viable===false))fail();
    }
  }
}

/** Closed v7 catalog schema and reproducible family evidence. No secret truth becomes public knowledge. */
function validateShop(game:HardcoreGame):void {
  keys(game.shop,"date offers batch");
  if(!Number.isSafeInteger(game.shop.batch)||game.shop.batch!<0||Object.keys(game.shop.offers).length!==4)fail();
  for(const [id,o] of Object.entries(game.shop.offers)){
    keys(o,"id individual askPrice marketBase marketVersion family purchased");
    if(id!==o.id||id!==o.individual.id||typeof o.purchased!=="boolean")fail();
    if(!Number.isSafeInteger(o.askPrice)||o.askPrice<1||!Number.isSafeInteger(o.marketBase)||o.marketBase<1||typeof o.marketVersion!=="string"||!o.marketVersion||o.marketVersion.length>128)fail();
    for(const original of [o.individual,...(o.family?[o.family.father,o.family.mother]:[])]){
      const snapshot={...original};delete snapshot.genetics;if(game.saveVersion>=9)delete snapshot.healthGenome;validateGeckoRecord(snapshot,true,true);
    }
    const child=game.individuals[id];
    if(o.purchased){
      if(!child||!equal(child.genetics?.genome,o.individual.genetics?.genome)||!equal(child.genotype,o.individual.genotype)||
        (!equal(child.parents,o.individual.parents)||game.saveVersion>=9&&!equal(child.healthGenome,o.individual.healthGenome))||child.visualSeed!==o.individual.visualSeed||child.birthTurn!==o.individual.birthTurn||child.birthDate!==o.individual.birthDate||child.generation!==o.individual.generation||child.sex!==o.individual.sex)fail();
    }else if(child)fail();
    if(o.individual.status!=="owned")fail();
    if(o.family===null){if(o.individual.parents)fail();continue;}
    const f=o.family;if(!f)fail();keys(f,"version seed matingTurn father mother");
    if(f.version!==1||typeof f.seed!=="string"||f.seed.length>512||!Number.isSafeInteger(f.matingTurn)||f.matingTurn!==o.individual.birthTurn-6)fail();
    if(o.individual.sex!==(seededRandom(f.seed,"sex")()<.5?"male":"female")||
      o.individual.visualSeed!==id+"-"+seedId(f.seed,"visual")||o.individual.birthDate!==addDays(game.lastDate,(o.individual.birthTurn-game.turn)*7))fail();
    for(const p of [f.father,f.mother]){
      if(p.status!=="pedigree"||p.parents!==null||p.generation!==1||f.matingTurn-p.birthTurn<12||f.matingTurn-p.birthTurn>=60)fail();
      const archived=game.individuals[p.id];if(archived&&(!equal(archived.genetics?.genome,p.genetics?.genome)||game.saveVersion>=9&&!equal(archived.healthGenome,p.healthGenome)||archived.visualSeed!==p.visualSeed||archived.sex!==p.sex||archived.birthTurn!==p.birthTurn))fail();
      if(o.purchased&&!archived)fail();
    }
    if(f.father.sex!=="male"||f.mother.sex!=="female"||!equal(o.individual.parents,{fatherId:f.father.id,motherId:f.mother.id})||advancedSafety(f.father,f.mother).length)fail();
    const fg=f.father.genetics?.genome,mg=f.mother.genetics?.genome,cg=o.individual.genetics?.genome;
    if(!fg||!mg||!cg||!equal(cg.mendelian,inherit(fg.mendelian,mg.mendelian,f.seed))||!equal(cg.polygenic,inheritPoly(fg.polygenic,mg.polygenic,f.seed)))fail();
  }
}
