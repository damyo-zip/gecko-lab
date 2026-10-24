import type {Gecko,HardcoreGame,TimedEgg} from './model';
import type {Compaction,CompactState,HistoryEntry} from './compact-model';
import {parentFact} from './compact-model';
import {eggsByMating} from './egg-index';
import {seedId} from '@/genetics/random';
import {canonicalJSON} from '@/game/save';
import {unknownKnowledge} from '@/genetics/advanced/inference';

/** Intern only immutable inputs. Public knowledge and live care remain independent.
 * structuredClone/IndexedDB preserve shared references, unlike repeated JSON text. */
export function shareGeneticFacts(game:HardcoreGame):void {
 const values=new Map<string,unknown>();
 const seen=new WeakMap<object,unknown>();
 const intern=<T>(value:T):T=>{if(value===undefined||value===null)return value;if(typeof value==='object'&&seen.has(value))return seen.get(value) as T;const key=canonicalJSON(value);const result=values.has(key)?values.get(key) as T:value;values.set(key,result);if(typeof value==='object')seen.set(value,result);return result;};
 const genetic=(g:Gecko['genetics'])=>{if(g){g.genome=intern(g.genome);if(Object.hasOwn(g,'forge'))g.forge=intern(g.forge);}};
 const gecko=(g:Gecko)=>{g.genotype=intern(g.genotype);g.potential=intern(g.potential);if(Object.hasOwn(g,'healthGenome'))g.healthGenome=intern(g.healthGenome);genetic(g.genetics);};
 Object.values(game.individuals).forEach(gecko);Object.values(game.eggs).forEach(e=>gecko(e.embryo));
 game.breedingChallenges?.completed.forEach(c=>gecko(c.specimen));
 for(const o of Object.values(game.shop.offers)){gecko(o.individual);if(o.family){gecko(o.family.father);gecko(o.family.mother);}}
 const mating=(m:import('./model').Mating)=>{m.fatherGenotype=intern(m.fatherGenotype);m.motherGenotype=intern(m.motherGenotype);m.fatherTraits=intern(m.fatherTraits);m.motherTraits=intern(m.motherTraits);if(m.genetics){genetic(m.genetics.father);genetic(m.genetics.mother);m.genetics.father=intern(m.genetics.father);m.genetics.mother=intern(m.genetics.mother);}if(m.riskModel){m.riskModel.father=intern(m.riskModel.father);m.riskModel.mother=intern(m.riskModel.mother);}m.lifecycle?.offspring.forEach(o=>gecko(o.embryo));};
 Object.values(game.matings).forEach(mating);Object.values(game.compact?.origins??{}).forEach(o=>mating(o.mating));
}
export function compactGame(source:HardcoreGame):Compaction {
 if(source.rulesVersion!==5||source.saveVersion!==10)return {game:source,history:[]};
 const game=structuredClone(source),history:HistoryEntry[]=[],index=eggsByMating(game);
 const old=game.compact;
 const state:CompactState=old??{version:1,historyId:game.gameId+'-'+seedId(game.seed,'compact-history'),parentIds:[],origins:{},births:{},counts:{individual:0,mating:0,egg:0,sale:0},recent:[]};
 game.compact=state;
 const add=(e:Omit<HistoryEntry,'revision'>)=>{history.push({...e,revision:game.revision});state.counts[e.kind]++;};
 const trophies=new Set(game.breedingChallenges?.completed.flatMap(c=>[c.eggId,...(c.trophyEggIds??[])])??[]);
 const complete=new Set(Object.values(game.matings).filter(m=>{
  if(['pending','fertilized'].includes(m.status))return false;
  const eggs=index.get(m.id)??[];
  return eggs.every(e=>e.status!=='incubating'&&(!e.care||e.care.settledTurn!==null)&&(!m.genetics||e.status!=='hatched'||m.genetics.observedIds.includes(e.embryo.id)));
 }).map(m=>m.id));
 const protectedIds=new Set(Object.values(game.individuals).filter(g=>g.status==='owned').map(g=>g.id));
 for(const o of Object.values(game.shop.offers))if(o.purchased)protectedIds.add(o.id);
 for(const id of trophies){const e=game.eggs[id];if(e)protectedIds.add(e.embryo.id);}
 for(const m of Object.values(game.matings))if(!complete.has(m.id)){protectedIds.add(m.parents.fatherId);protectedIds.add(m.parents.motherId);}
 const rememberBirth=(e:TimedEgg)=>{
  const m=e.matingId?game.matings[e.matingId]:undefined;
  if(!m)return;
  const planned=m.lifecycle?.offspring.find(o=>o.embryo.id===e.embryo.id)?.embryo??e.embryo;
  if(!state.origins[m.id]){const receipt={...m};delete receipt.lifecycle;if(receipt.genetics)receipt.genetics={...receipt.genetics,father:{...receipt.genetics.father,knowledge:unknownKnowledge()},mother:{...receipt.genetics.mother,knowledge:unknownKnowledge()},observedIds:[],updates:[]};state.origins[m.id]={mating:receipt,rulesVersion:!m.lifecycle?2:m.timingVersion===2?5:4,startTurn:m.lifecycle?.startTurn??0,maxClutches:m.lifecycle?.maxClutches??1};}
  state.births[e.embryo.id]={originId:m.id,seed:e.seed,name:planned.name,plannedTurn:planned.birthTurn,plannedDate:planned.birthDate,birthTurn:e.embryo.birthTurn,birthDate:e.embryo.birthDate};
 };
 for(const e of Object.values(game.eggs))if(e.matingId&&complete.has(e.matingId)){
  if(protectedIds.has(e.embryo.id)||trophies.has(e.id))rememberBirth(e);
  if(trophies.has(e.id))continue;
  add({kind:'egg',id:e.id,turn:game.turn,date:e.resolvedDate??e.laidDate,name:e.embryo.name,detail:e.status==='hatched'?'새끼 수령 완료':`알 정리 완료 · ${e.lifecycle?.failure??'실패'}`});delete game.eggs[e.id];
 }
 for(const m of Object.values(game.matings))if(complete.has(m.id)){
  add({kind:'mating',id:m.id,turn:game.turn,date:m.date,name:game.individuals[m.parents.motherId]?.name??'번식 기록',detail:`${m.status==='cancelled'?'산란 취소':'번식 완료'} · 알 ${(index.get(m.id)??[]).length}개`});delete game.matings[m.id];
 }
 // Keep only receipts that still authenticate a living animal or a trophy.
 for(const id of Object.keys(state.births))if(!protectedIds.has(id))delete state.births[id];
 const usedOrigins=new Set(Object.values(state.births).map(b=>b.originId));
 for(const id of Object.keys(state.origins))if(!usedOrigins.has(id))delete state.origins[id];
 const parents=new Set<string>();
 const needParents=(g:Gecko)=>{if(g.parents){parents.add(g.parents.fatherId);parents.add(g.parents.motherId);}};
 for(const id of protectedIds){const g=game.individuals[id];if(g)needParents(g);}
 for(const e of Object.values(game.eggs))needParents(e.embryo);
 for(const o of Object.values(state.origins)){parents.add(o.mating.parents.fatherId);parents.add(o.mating.parents.motherId);}
 const previousFacts=new Set(old?.parentIds??[]);
 for(const [id,g] of Object.entries(game.individuals)){
  if(protectedIds.has(id))continue;
  if(!previousFacts.has(id))add({kind:'individual',id,turn:game.turn,date:g.diedDate??game.lastDate,name:g.name,detail:g.status==='sold'?'분양 완료':g.status==='dead'?`폐사 · ${g.deathCause??'기록'}`:'부모 기록 정리'});
  if(parents.has(id))game.individuals[id]=parentFact(g);else delete game.individuals[id];
 }
 state.parentIds=[...parents].filter(id=>!protectedIds.has(id)&&!!game.individuals[id]);
 game.sales=game.sales.filter(s=>{if(game.individuals[s.individualId]?.status==='sold')return true;add({kind:'sale',id:s.id,turn:game.turn,date:s.date,name:s.individualId,detail:`분양 ₩${s.price.toLocaleString('ko-KR')}`});return false;});
 state.recent=[...state.recent,...history].slice(-24);
 shareGeneticFacts(game);
 return {game,history};
}
