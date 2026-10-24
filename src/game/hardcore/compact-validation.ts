import type {Gecko,HardcoreGame,Mating} from './model';
import {canonicalJSON} from '@/game/save';
import {HARDCORE_LOCI,expandedGenotype} from '@/genetics/hardcore';
import {TRAIT_KEYS} from '@/genetics/traits';
import {validateGeckoRecord} from './legacy-validation';
import {validateGenetics} from './validation';
import {dateNumber,addDays} from './time';
import {createEmbryo} from './offspring';
import {seasonEggSeed} from './season';
import {V12,MONTHLY} from './lifecycle';
import type {HistoryEntry} from './compact-model';
import {eggsByMating} from './egg-index';

const fail=():never=>{throw Error('경량 저장·출생 증거가 손상되었습니다.');};
function assert(value:unknown):asserts value {if(!value)fail();}
function keys(value:unknown,names:string){assert(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join()===names.split(' ').sort().join());}
const equal=(a:unknown,b:unknown)=>canonicalJSON(a)===canonicalJSON(b);
const integer=(v:number,max=1e7)=>Number.isSafeInteger(v)&&v>=0&&v<=max;
const text=(v:unknown,max=512)=>typeof v==='string'&&v.length>0&&v.length<=max;
const validId=(v:unknown)=>text(v,128)&&/^[a-zA-Z0-9_-]+$/.test(v as string)&&!['constructor','prototype','__proto__'].includes(v as string);
export function validateHistoryEntry(e:HistoryEntry):void {
 keys(e,'kind id turn revision date name detail');assert(['individual','mating','egg','sale'].includes(e.kind)&&validId(e.id)&&integer(e.turn)&&integer(e.revision,1e12)&&text(e.name,128)&&text(e.detail,1024));dateNumber(e.date);
}
export function compactMating(game:HardcoreGame,id:string):Mating|undefined {return game.matings[id]??game.compact?.origins[id]?.mating;}
function matingFacts(game:HardcoreGame,m:Mating,active:boolean,legacy=false){
 keys(m,'id ordinal date parents fatherGenotype motherGenotype fatherTraits motherTraits generation lineageIds seed fertilizationChance hatchChance status resolvedDate genetics riskModel'+(Object.hasOwn(m,'timingVersion')?' timingVersion':'')+(active?' lifecycle':''));
 keys(m.parents,'fatherId motherId');
 assert(validId(m.id)&&integer(m.ordinal,game.nextClutch-1)&&m.ordinal>0&&text(m.seed,512)&&['pending','fertilized','laid','failed','cancelled'].includes(m.status));
 dateNumber(m.date);assert(m.date<=game.lastDate);if(m.resolvedDate!==null){dateNumber(m.resolvedDate);assert(m.resolvedDate>=m.date&&m.resolvedDate<=game.lastDate);}
 const f=game.individuals[m.parents.fatherId],mo=game.individuals[m.parents.motherId];
 assert(f?.sex==='male'&&mo?.sex==='female'&&m.generation===Math.max(f.generation,mo.generation)+1);
 assert(equal(m.fatherGenotype,f.genotype)&&equal(m.motherGenotype,mo.genotype)&&equal(m.fatherTraits,f.potential)&&equal(m.motherTraits,mo.potential));
 assert((!legacy&&(m.lifecycle||!active)?m.fertilizationChance===.95&&m.hatchChance===.95:m.fertilizationChance>=0&&m.fertilizationChance<=1&&m.hatchChance>=0&&m.hatchChance<=1)&&Array.isArray(m.lineageIds)&&m.lineageIds.every(id=>!!game.lineages[id]));
 if(Object.hasOwn(m,'timingVersion'))assert(m.timingVersion===2);
 if(m.genetics){keys(m.genetics,'father mother observedIds updates'+(Object.hasOwn(m.genetics,'paletteVersion')?' paletteVersion':''));if(!active)assert(Array.isArray(m.genetics.observedIds)&&m.genetics.observedIds.length===0&&Array.isArray(m.genetics.updates)&&m.genetics.updates.length===0);validateGenetics(m.genetics.father,true);validateGenetics(m.genetics.mother,true);assert(equal(m.genetics.father.genome,f.genetics?.genome)&&equal(m.genetics.mother.genome,mo.genetics?.genome)&&equal(m.genetics.father.forge,f.genetics?.forge)&&equal(m.genetics.mother.forge,mo.genetics?.forge));}
 if(m.riskModel){keys(m.riskModel,'version father mother');assert(m.riskModel.version===1&&equal(m.riskModel.father,f.healthGenome)&&equal(m.riskModel.mother,mo.healthGenome));}
}
/** The legacy structural checker receives no genealogy projection. These checks
 * retain real immediate-parent inheritance and every active breeding transition. */
export function validateCompact(game:HardcoreGame):void {
 const s=game.compact!;keys(s,'version historyId parentIds origins births counts recent');
 assert(game.saveVersion===10&&game.rulesVersion===5&&s.version===1&&validId(s.historyId));
 keys(s.counts,'individual mating egg sale');assert(Object.values(s.counts).every(v=>integer(v,1e9))&&Array.isArray(s.recent)&&s.recent.length<=24);
 for(const e of s.recent){validateHistoryEntry(e);assert(e.turn<=game.turn&&e.revision<=game.revision&&e.date<=game.lastDate);}
 assert(Array.isArray(s.parentIds)&&new Set(s.parentIds).size===s.parentIds.length);
 const facts=new Set(s.parentIds);
 assert(s.origins&&typeof s.origins==='object'&&!Array.isArray(s.origins)&&s.births&&typeof s.births==='object'&&!Array.isArray(s.births));
 const eggIndex=eggsByMating(game),children=new Map<string,Gecko[]>();
 for(const e of Object.values(game.eggs)){const list=children.get(e.embryo.id)??[];list.push(e.embryo);children.set(e.embryo.id,list);}
 for(const id of facts){const g=game.individuals[id];assert(g&&g.status==='pedigree'&&g.parents===null);}
 for(const g of [...Object.values(game.individuals),...Object.values(game.eggs).map(e=>e.embryo),...Object.values(game.matings).flatMap(m=>m.lifecycle?.offspring.map(o=>o.embryo)??[])]){
  const projected={...g};delete projected.genetics;delete projected.healthGenome;delete (projected as import('./model').Embryo).development;
  validateGeckoRecord(projected,true,true,(g as import('./model').Embryo).development?.viable===false);
  assert(g.lineageIds.every(id=>!!game.lineages[id]));
  if(!g.parents){assert(g.generation===1||facts.has(g.id));continue;}
  const f=game.individuals[g.parents.fatherId],m=game.individuals[g.parents.motherId];assert(f?.sex==='male'&&m?.sex==='female'&&g.generation===Math.max(f.generation,m.generation)+1);
  const child=expandedGenotype(g.genotype),father=expandedGenotype(f.genotype),mother=expandedGenotype(m.genotype);
  for(const l of HARDCORE_LOCI){const [a,b]=child.loci[l.id];assert(father.loci[l.id].includes(a)&&mother.loci[l.id].includes(b)||father.loci[l.id].includes(b)&&mother.loci[l.id].includes(a));}
  if(!g.genetics?.genome)for(const k of TRAIT_KEYS)assert(Math.abs(g.potential[k]-(f.potential[k]+m.potential[k])/2)<=game.rules.traitVariation[k]+1e-9);
 }
 const ordinals=new Set<number>();
 for(const [id,m] of Object.entries(game.matings)){assert(id===m.id&&!ordinals.has(m.ordinal));ordinals.add(m.ordinal);matingFacts(game,m,true);}
 for(const [id,o] of Object.entries(s.origins)){
  keys(o,'mating rulesVersion startTurn maxClutches');assert(id===o.mating.id&&!game.matings[id]&&!ordinals.has(o.mating.ordinal)&&[2,4,5].includes(o.rulesVersion)&&integer(o.startTurn,game.turn)&&[1,2,3].includes(o.maxClutches));ordinals.add(o.mating.ordinal);matingFacts(game,o.mating,false,o.rulesVersion===2);
 }
 for(const [id,b] of Object.entries(s.births)){
  keys(b,'originId seed name plannedTurn plannedDate birthTurn birthDate');const o=s.origins[b.originId];assert(o&&text(b.name,24)&&Number.isSafeInteger(b.birthTurn)&&b.birthTurn>=-100000&&b.birthTurn<=game.turn&&b.birthTurn>=b.plannedTurn);
  const m=o.mating,t=o.rulesVersion===5?MONTHLY:V12;
  const prefix=game.gameId+'-c'+m.ordinal+'-',tail=id.startsWith(prefix)?id.slice(prefix.length).match(o.rulesVersion===2?/^([12])$/:/^([123])-([12])$/):null;assert(tail);
  if(o.rulesVersion===2){assert(b.seed===m.seed+'|egg:'+tail[1]);dateNumber(b.plannedDate);}
  else{const clutch=Number(tail[1]),n=Number(tail[2]);assert(clutch<=o.maxClutches&&b.seed===seasonEggSeed(m,clutch,n)&&b.plannedTurn===o.startTurn+t.firstLayAfter+(clutch-1)*t.restAfter+t.hatchAfter&&b.plannedDate===addDays(m.date,(b.plannedTurn-o.startTurn)*t.daysPerTurn));}dateNumber(b.birthDate);
  const replay={...game,rulesVersion:o.rulesVersion===5?5 as const:4 as const,rules:{...game.rules,adultAfter:t.adultAfter}};
  const actual=[game.individuals[id],...(children.get(id)??[])].filter((g):g is Gecko=>!!g);
  assert(actual.length>0);
  const expected=createEmbryo(replay,m,b.seed,id,b.name,b.plannedTurn,b.plannedDate,actual[0].genetics?.appearanceVersion==='patterns-1');
  if(o.rulesVersion===2&&!expected.genetics?.forge&&equal(actual[0].genetics?.forge,{version:1}))expected.genetics!.forge={version:1};
  for(const g of actual){
   assert(g.birthTurn===b.birthTurn&&g.birthDate===b.birthDate&&g.sex===expected.sex&&g.generation===expected.generation&&g.visualSeed===expected.visualSeed&&equal(g.parents,expected.parents)&&equal(g.genotype,expected.genotype));
   assert(TRAIT_KEYS.every(k=>Math.abs(g.potential[k]-expected.potential[k])<=1e-12));
   assert(equal(g.genetics?.genome,expected.genetics?.genome)&&equal(g.genetics?.forge,expected.genetics?.forge)&&g.genetics?.appearanceVersion===expected.genetics?.appearanceVersion&&equal(g.genetics?.unresolvedComplex,expected.genetics?.unresolvedComplex));
   if(m.riskModel)assert(equal(g.healthGenome,expected.healthGenome));
  }
 }
 for(const [id,e] of Object.entries(game.eggs)){
  keys(e,'id matingId laidDate dueDate embryo hatchChance seed status resolvedDate lifecycle'+(Object.hasOwn(e,'timing')?' timing':'')+(Object.hasOwn(e,'care')?' care':''));
  assert(id===e.id&&validId(id)&&['incubating','hatched','failed'].includes(e.status)&&text(e.seed,512));dateNumber(e.laidDate);dateNumber(e.dueDate);assert(e.laidDate<=game.lastDate&&e.dueDate>=e.laidDate);
  if(e.resolvedDate!==null){dateNumber(e.resolvedDate);assert(e.resolvedDate===e.dueDate);}
  if(e.matingId){assert(compactMating(game,e.matingId));if(!game.matings[e.matingId])assert(s.births[e.embryo.id]?.originId===e.matingId);}
 }
 for(const m of Object.values(game.matings))assert((eggIndex.get(m.id)?.length??0)===(m.lifecycle?m.lifecycle.clutchesLaid*2:m.status==='laid'?2:0));
 for(const l of Object.values(game.lineages)){keys(l,'id name createdDate founderId favorite');assert(validId(l.id)&&text(l.name,40)&&typeof l.favorite==='boolean'&&(l.founderId===null||validId(l.founderId)));dateNumber(l.createdDate);}
}
