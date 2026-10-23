import {test,expect} from 'vitest';
import {newGame,newForgeGame,act} from '@/game/hardcore/play';
import {makeSave,readSave,readForgeSave} from '@/game/hardcore/save';
import {migrateForge} from '@/game/hardcore/migrate-forge';
import {forgeView} from '@/game/hardcore/forge-appearance';
import {forgeReferenceGecko} from '@/game/hardcore/challenge-previews';
import {evaluateBreedingChallenge} from '@/game/hardcore/challenge-evaluator';
import {BREEDING_CHALLENGES} from '@/game/hardcore/challenge-rules';
import {specimen,visualName} from '@/game/hardcore/adapter';
import {forgeSurface} from '@/forge/surface';
import {B_ORIGIN_01 as source} from '@/forge/engine/art/b-origin-01';
import {inheritMorphExtensions} from '@/forge';
import {validateGame} from '@/game/hardcore/validation';
import {inherit} from '@/genetics/advanced/inheritance';
import {inheritPoly} from '@/genetics/advanced/polygenic';
import {actWithTime} from '@/game/hardcore/time-source';
import {breedingRisk} from '@/game/hardcore/breeding-risk';
import {challengeClutch,challengeTurn} from './helpers/challenge-game';
import {publicKnowledge,cachedGenotype} from '@/game/hardcore/genetics';
import {valueGecko} from '@/game/hardcore/market';
import {founderForge} from '@/game/hardcore/forge-genetics';
import {startRush} from '@/game/rush';
import type {HardcoreGame} from '@/game/hardcore/model';
import {referenceHomeGame} from '../e2e/fixtures/reference-home';

const date='2026-10-22';
test('production creates four genuine families with known version-five modifiers and validates/restores them',()=>{
 const g=newForgeGame('forge-smoke',date);expect(g.forge).toEqual({version:1});expect(Object.keys(g.shop.offers)).toHaveLength(4);validateGame(g);expect(readForgeSave(makeSave(g),date)).toEqual(g);
 for(const o of Object.values(g.shop.offers)){expect(o.family!.father.genetics!.forge!.extensions!.version).toBe(5);expect(o.individual.genetics!.forge!.extensions).toEqual(inheritMorphExtensions(o.family!.father.genetics!.forge!.extensions,o.family!.mother.genetics!.forge!.extensions,o.family!.seed));}
});
test('migration keeps the original DNA, IDs, public knowledge, prices, dates and counters and is idempotent',()=>{
 const old=newGame('old-forge-smoke',date),before=structuredClone(old),next=readForgeSave(makeSave(old),date);expect(old).toEqual(before);expect(next.forge).toEqual({version:1});expect(migrateForge(next)).toBe(next);
 const stripped=structuredClone(next);delete stripped.forge;for(const o of Object.values(stripped.shop.offers))for(const p of[o.individual,o.family!.father,o.family!.mother])delete p.genetics!.forge;expect(stripped).toEqual(old);expect(readSave(makeSave(next),date)).toEqual(next);
});
test('native gameplay surfaces paint the approved body, clear only the background and do not mutate game state',()=>{
 const game=newForgeGame('forge-native',date),before=JSON.stringify(game);for(const o of Object.values(game.shop.offers)){const g=o.individual,v=forgeView(g)!,r=forgeSurface(specimen(g))!;expect(r.version).toBe('b-origin-01-companion-lineage-1');for(let i=0;i<9216;i++){if(source.foreground[i])expect(r.pixels.slice(i*4,i*4+4)).toEqual(v.description.sprite.pixels.slice(i*4,i*4+4));else expect([...r.pixels.slice(i*4,i*4+4)]).toEqual([0,0,0,0]);}expect(visualName(g)).toBe(v.displayName);}expect(JSON.stringify(game)).toBe(before);
});
test('each current challenge has a real qualifying native reference, including the attainable tiny-spot target',()=>{
 const evidence=[];for(const c of BREEDING_CHALLENGES){const g=forgeReferenceGecko(c.id),v=forgeView(g)!;evidence.push({id:c.id,qualifies:evaluateBreedingChallenge(g,c.id),base:v.observation.baseArea,white:v.whiteCoverage,color:v.names.color,spots:v.observation.spots,veil:v.description.veilMetrics.strength});}expect(evidence.filter(x=>!x.qualifies)).toEqual([]);
});
test('conception keeps all old RNG domains and fixes the new modifier copies before hatching',()=>{
 let game=newForgeGame('L'.repeat(128),date,{initialMoney:10000000,initialCapacity:20});const offers=Object.values(game.shop.offers);for(const o of offers.slice(0,2))game=act(game,{type:'buyGecko',offerId:o.id},date);game.food=100;
 const father=Object.values(game.individuals).find(g=>g.status==='owned'&&g.sex==='male')!,mother=Object.values(game.individuals).find(g=>g.status==='owned'&&g.sex==='female')!;
 game=act(game,{type:'breed',fatherId:father.id,motherId:mother.id},date);const mating=Object.values(game.matings)[0];for(const[n,o]of mating.lifecycle!.offspring.entries()){const seed=mating.seed+`|clutch:1|egg:${n+1}`;expect(o.embryo.genetics!.genome!.mendelian).toEqual(inherit(father.genetics!.genome!.mendelian,mother.genetics!.genome!.mendelian,seed));expect(o.embryo.genetics!.genome!.polygenic).toEqual(inheritPoly(father.genetics!.genome!.polygenic,mother.genetics!.genome!.polygenic,seed));expect(o.embryo.genetics!.forge!.extensions).toEqual(inheritMorphExtensions(father.genetics!.forge!.extensions,mother.genetics!.forge!.extensions,seed));}expect(readForgeSave(makeSave(game),date)).toEqual(game);
});

function withoutForge(value:unknown):unknown {
 if(Array.isArray(value))return value.map(withoutForge);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([k])=>k!=='forge').map(([k,v])=>[k,withoutForge(v)]));
 return value;
}
const turn=(g:HardcoreGame)=>actWithTime(g,{type:'endTurn'},g.lastDate);
function pair(current:boolean,seed:string){
 let g=(current?newForgeGame:newGame)(seed,date,{initialMoney:3_000_000,initialCapacity:12});
 const [fatherId,motherId]=Object.keys(g.shop.offers);
 for(const offerId of[fatherId,motherId])g=act(g,{type:'buyGecko',offerId},date);
 g=act(g,{type:'buyFood',amount:200},date);
 const risk=breedingRisk(g,g.individuals[fatherId],g.individuals[motherId]);
 return act(g,{type:'breed',fatherId,motherId,riskAcknowledgement:risk.acknowledgement},date);
}
test('pending conceptions, eggs, historical sale and Rush state migrate without rerolls, even after a later hatch',()=>{
 let old=turn(turn(pair(false,'forge-pending')));startRush(old,3);
 const motherId=Object.values(old.matings)[0].parents.motherId;old=act(old,{type:'sell',id:motherId},old.lastDate);
 const before=structuredClone(old),current=readForgeSave(makeSave(old),date);
 expect(old).toEqual(before);expect(withoutForge(current)).toEqual(old);expect(current.cafeRush).toEqual(old.cafeRush);
 const matingId=Object.keys(old.matings)[0];old=act(old,{type:'collectEggs',matingId},date);let next=act(current,{type:'collectEggs',matingId},date);
 for(let n=0;n<4;n++){old=turn(old);next=turn(readForgeSave(makeSave(next),next.lastDate));}
 // Later refreshed catalogs intentionally use the new founder profiles/prices.
 // Every existing animal, recorded sale, embryo and lifecycle result stays exact.
 expect({...withoutForge(next) as object,shop:old.shop}).toEqual(old);expect(next.eggs).not.toEqual(before.eggs);
});
test('completed version-one challenges keep their immutable birth evidence, reward and completion history',()=>{
 let old=challengeClutch('sun').game;old=act(old,{type:'selectChallenge',challengeId:'sun'},old.lastDate);
 for(let n=0;n<4;n++)old=challengeTurn(old);
 expect(old.breedingChallenges!.completed).toHaveLength(1);
 const next=readForgeSave(makeSave(old),old.lastDate);expect(withoutForge(next)).toEqual(old);
 expect(next.breedingChallenges!.completed[0].evaluatorVersion).toBe(1);validateGame(next);
});
test('new embryo copies, pixels and hatch results survive collection, growth and every backup roundtrip',()=>{
 let g=pair(true,'forge-growth'),mating=Object.values(g.matings)[0];
 const fixed=mating.lifecycle!.offspring.map(o=>structuredClone(o.embryo));
 g=turn(turn(g));g=act(g,{type:'collectEggs',matingId:mating.id},g.lastDate);
 for(let n=0;n<4;n++)g=turn(readForgeSave(makeSave(g),g.lastDate));
 const successes=Object.values(g.eggs).filter(e=>e.status==='hatched');expect(successes.length).toBeGreaterThan(0);
 for(const e of successes){
  const original=fixed.find(o=>o.id===e.embryo.id)!;
  expect(e.embryo.genetics).toEqual(original.genetics);expect(e.embryo.sex).toBe(original.sex);expect(e.embryo.visualSeed).toBe(original.visualSeed);
  g=act(g,{type:'receiveHatchling',eggId:e.id},g.lastDate);
 }
 const childId=successes[0].embryo.id,art=forgeView(g.individuals[childId])!.description.sprite.pixels.slice();
 for(let n=0;n<12;n++)g=turn(readForgeSave(makeSave(g),g.lastDate));
 expect(g.individuals[childId].stage).toBe('adult');expect(forgeView(g.individuals[childId])!.description.sprite.pixels).toEqual(art);
 expect(g.individuals[childId].genetics).toEqual(successes[0].embryo.genetics);validateGame(g);
},20_000);
test('modifier tampering cannot bypass family, snapshot and deterministic conception validation',()=>{
 const original=pair(true,'forge-corruption');
 for(const field of['embryo','snapshot','individual','offer']as const){
  const g=structuredClone(original),m=Object.values(g.matings)[0],o=Object.values(g.shop.offers)[2];
  const record=field==='embryo'?m.lifecycle!.offspring[0].embryo.genetics!:field==='snapshot'?m.genetics!.father:field==='individual'?g.individuals[m.parents.fatherId].genetics!:o.individual.genetics!;
  const veil=record.forge!.extensions!.veil!;record.forge!.extensions!.veil={...veil,density:veil.density.map((p,n)=>n===0?[4,4] as const:p)};
  expect(()=>validateGame(g),field).toThrow();
 }
});
test('hidden recessive and silent veil copies never leak into labels, native pixels, prices or public beliefs',()=>{
 const a=forgeReferenceGecko('sun');a.genetics!.forge=founderForge('forge-secret',0,true);
 const b=structuredClone(a);b.genetics!.genome!.mendelian.loci.axanthic=['A','ax'];b.genetics!.forge!.extensions!.phantom=['N','ph'];
 b.genetics!.forge!.extensions!.veil!.density=b.genetics!.forge!.extensions!.veil!.density.map(()=>[4,4]);
 b.genotype=cachedGenotype(b.genetics!,b.genotype);
 expect(visualName(a)).toBe(visualName(b));expect(forgeView(a)!.description.sprite.pixels).toEqual(forgeView(b)!.description.sprite.pixels);
 expect(valueGecko(a)).toEqual(valueGecko(b));expect(publicKnowledge(a)).toEqual(publicKnowledge(b));
});
test('unchanged render inputs reuse one compact view across immutable action clones',()=>{
 const a=forgeReferenceGecko('sun'),v=forgeView(a)!;const b=structuredClone(a);b.name='이름 변경';b.hearts=3;
 expect(forgeView(b)).toBe(v);expect(v.description.sprite.layers).toHaveLength(0);
 b.visualSeed+='-different';expect(forgeView(b)).not.toBe(v);
});
test('legacy unknown core DNA stays null when rendered or crossed with a recorded modifier parent',()=>{
 let game=migrateForge(referenceHomeGame());game.capacity=20;game.food=100;
 const mother=Object.values(game.individuals).find(g=>g.sex==='female'&&g.genotype.loci['lilly-white'].includes('Lw'))!;
 expect(mother.genetics!.genome).toBeNull();const before=structuredClone(mother);
 expect(forgeView(mother)!.legacyProjection).toBe(true);expect(mother).toEqual(before);
 const known=structuredClone(Object.values(newForgeGame('forge-known-parent',date).shop.offers)[0].family!.father);
 known.parents=null;known.status='owned';known.sex='male';known.nextBreedTurn=0;known.lastProcessedTurn=game.turn;game.individuals[known.id]=known;
 const risk=breedingRisk(game,known,mother);
 game=act(game,{type:'breed',fatherId:known.id,motherId:mother.id,riskAcknowledgement:risk.acknowledgement},game.lastDate);
 for(const o of Object.values(game.matings)[0].lifecycle!.offspring){
  const record=o.embryo.genetics!;expect(record.genome).toBeNull();expect(record.appearanceVersion).toBe('legacy-1');
  expect(record.forge!.extensions!.version).toBe(5);expect(record.forge!.extensions!.veil!.density.every(p=>p[0]!==null&&p[1]===null)).toBe(true);
 }
 expect(readForgeSave(makeSave(game),game.lastDate)).toEqual(game);
});
