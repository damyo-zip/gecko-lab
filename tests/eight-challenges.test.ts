import {test,expect} from 'vitest';
import {BREEDING_CHALLENGES,CHALLENGE_REWARD,type CurrentChallengeId} from '@/game/hardcore/challenge-rules';
import {forgeReferenceGecko} from '@/game/hardcore/challenge-previews';
import {inspectChallenge,challengeObservation} from '@/game/hardcore/challenge-observation';
import {currentBreederRankGames} from './helpers/current-challenge-game';
import {withVeilTraits,createVeilTraits} from '@/forge';
import {recordChallengeHatch,challengeFeedSlots,trophySpecimen} from '@/game/hardcore/challenges';
import {breederRank} from '@/game/hardcore/breeder-rank';
import {validateGame} from '@/game/hardcore/validation';
import {exportBackup,parseForgeBackup} from '@/game/hardcore/save';
import {act,newForgeGame} from '@/game/hardcore/play';
import {challengeTurn,challengeClutch} from './helpers/challenge-game';
import {migrateForge} from '@/game/hardcore/migrate-forge';
import {challengeExamples} from '@/game/hardcore/challenge-examples';
import {cachedGenotype} from '@/game/hardcore/genetics';
import {polyScores} from '@/genetics/advanced/polygenic';
import {legacyTraits} from '@/genetics/advanced/phenotype';
const states=currentBreederRankGames();

// A passing name, genotype or hidden score is insufficient: the native visible
// observation and every required range must also pass.
test.each(BREEDING_CHALLENGES)('$id sample passes only its intended target; renaming and serialization cannot change pixels or judgement',c=>{
 const g=forgeReferenceGecko(c.id),before=JSON.stringify(g),o=challengeObservation(g)!;
 expect(inspectChallenge(g,c.id).passed).toBe(true);
 expect(BREEDING_CHALLENGES.filter(x=>inspectChallenge(g,x.id).passed).map(x=>x.id)).toEqual([c.id]);
 g.name='최상급 '+c.target;expect(inspectChallenge(g,c.id)).toEqual(inspectChallenge(JSON.parse(before),c.id));
 expect(challengeObservation(g)).toBe(o);
});
function change(id:CurrentChallengeId,feature:string,allele:number){const g=forgeReferenceGecko(id);for(let n=0;n<6;n++)g.genetics!.genome!.polygenic.loci[feature+'-'+n]=[allele,allele];g.potential=legacyTraits(polyScores(g.genetics!.genome!.polygenic));return g;}
test('high white without spots, red without high spots, grey tricolor and disconnected bands fail the visible goal',()=>{
 for(const id of ['lilly-dalmatian','red-superdalmatian'] as const)expect(inspectChallenge(change(id,'spots',0),id).passed).toBe(false);
 const grey=forgeReferenceGecko('red-tricolor');grey.genetics!.genome!.mendelian.loci.axanthic=['ax','ax'];grey.genotype=cachedGenotype(grey.genetics!,grey.genotype);expect(inspectChallenge(grey,'red-tricolor').passed).toBe(false);
 expect(inspectChallenge(change('gold-tiger','dorsal',0),'gold-tiger').passed).toBe(false);
 expect(inspectChallenge(change('tricolor-superstripe','pinstripe',0),'tricolor-superstripe').passed).toBe(false);
 const wrong=change('red-superdalmatian','red',0);for(let n=0;n<6;n++)wrong.genetics!.genome!.polygenic.loci['orange-'+n]=[0,0];expect(inspectChallenge(wrong,'red-superdalmatian').passed).toBe(false);
});
test('veil threshold uses its actual strength and a white veil cannot hide the required sable/frappuccino contrast',()=>{
 const g=forgeReferenceGecko('lilly-dalmatian');let below=0,above=0;
 for(let sum=0;sum<=48;sum++){
  const t=structuredClone(g);t.genetics!.forge!.extensions=withVeilTraits(t.genetics!.forge!.extensions,createVeilTraits('boundary',sum/48));
  const r=inspectChallenge(t,'lilly-dalmatian'),strength=challengeObservation(t)!.v.description.veilMetrics.strength;
  if(strength<.9){expect(r.passed).toBe(false);below++;}else{expect(r.passed).toBe(true);above++;}
 }
 expect(below).toBeGreaterThan(0);expect(above).toBeGreaterThan(0);
 for(const id of ['sable-lilly','frappuccino'] as const){const t=forgeReferenceGecko(id);t.genetics!.forge!.extensions=withVeilTraits(t.genetics!.forge!.extensions,createVeilTraits('washed-out',1));expect(inspectChallenge(t,id).passed).toBe(false);}
});
test.each([0,1,2,3,4,5,6,7,8])('%i actual accomplishments pay once, preserve the game and activate correct milestones after the hatch turn',n=>{
 const g=states[n];validateGame(g);expect(challengeFeedSlots(g)).toBe(Math.floor(n/2));expect(breederRank(g).legendary).toBe(n===8);
 expect(g.money).toBe(1_000_000+n*150_000+(n===8?300_000:0));
 expect(parseForgeBackup(exportBackup(g),g.lastDate)).toEqual(g);
 if(!n)return;
 const previous=states[n-1];expect(g.food).toBe(previous.food-6*(16-Math.floor((n-1)/2))+30);
 const c=g.breedingChallenges!.completed[n-1];expect(c.reward).toEqual({money:CHALLENGE_REWARD.money,food:30,bonus:n===8?300_000:0,titleId:c.challengeId,feedExemptionSlots:n%2===0?1:0});
 const replay=structuredClone(g),before=exportBackup(replay);for(const e of Object.values(replay.eggs))recordChallengeHatch(replay,e);expect(exportBackup(replay)).toBe(before);
});
test('matching sibling hatches populate trophy choices without a second payment; switching survives rename, sale, death and backup',()=>{
 let g=structuredClone(states[2]);const c=g.breedingChallenges!.completed[1];expect(c.trophyEggIds!.length).toBeGreaterThan(1);
 const eggId=c.trophyEggIds!.at(-1)!,money=g.money,food=g.food;
 g=act(g,{type:'setChallengeRepresentative',challengeId:c.challengeId,eggId},g.lastDate);expect(trophySpecimen(g,g.breedingChallenges!.completed[1]).id).toBe(g.eggs[eggId].embryo.id);expect(g.money).toBe(money);expect(g.food).toBe(food);
 expect(()=>act(g,{type:'setChallengeRepresentative',challengeId:c.challengeId,eggId:'invented'},g.lastDate)).toThrow('대표');
 g=act(g,{type:'receiveHatchling',eggId},g.lastDate);const id=g.eggs[eggId].embryo.id;
 g=act(g,{type:'rename',id,name:'트로피 이름 변경'},g.lastDate);g=act(g,{type:'sell',id},g.lastDate);
 const snapshot=JSON.stringify(g.breedingChallenges);g.food=0;for(let n=0;n<5;n++)g=challengeTurn(g);expect(JSON.stringify(g.breedingChallenges)).toBe(snapshot);expect(parseForgeBackup(exportBackup(g),g.lastDate)).toEqual(g);
});
test('fabricated rewards, duplicate trophy eggs, wrong representatives and wrong-colour trophy evidence are rejected',()=>{
 const source=states[2];
 const mutations=[(g:typeof source)=>g.breedingChallenges!.completed[0].reward.money=300000,(g:typeof source)=>g.breedingChallenges!.completed[0].reward.bonus=300000,(g:typeof source)=>g.breedingChallenges!.completed[0].representativeEggId='invented',(g:typeof source)=>g.breedingChallenges!.completed[0].trophyEggIds!.push(g.breedingChallenges!.completed[0].eggId),(g:typeof source)=>g.breedingChallenges!.completed[0].trophyEggIds!.push(g.breedingChallenges!.completed[1].eggId)];
 for(const mutate of mutations){const g=structuredClone(source);mutate(g);expect(()=>validateGame(g)).toThrow('도전');}
});
test('production migration resets only old challenge progress, once, preserving livestock, eggs, money, food and all other records',()=>{
 let old=challengeClutch('sun').game;old=act(old,{type:'selectChallenge',challengeId:'sun'},old.lastDate);for(let n=0;n<4;n++)old=challengeTurn(old);
 const raw=exportBackup(old),next=migrateForge(old);expect(exportBackup(old)).toBe(raw);expect(next.breedingChallenges).toMatchObject({version:2,activeId:'lilly-dalmatian',initialSelection:true,unlockTurn:old.turn,completed:[]});expect(next.money).toBe(old.money);expect(next.food).toBe(old.food);expect(next.individuals).toMatchObject(old.individuals);expect(next.eggs).toMatchObject(old.eggs);expect(migrateForge(next)).toBe(next);
 const selected=act(next,{type:'selectChallenge',challengeId:'halloween'},next.lastDate);expect(selected.breedingChallenges?.version).toBe(2);expect(()=>act(next,{type:'selectChallenge',challengeId:'sun'},next.lastDate)).toThrow('현재 도전');
});

test('all 32 displayed acceptance/rejection examples use the same evaluator and keep the source specimens unchanged',()=>{
 for(const c of BREEDING_CHALLENGES){
  const examples=challengeExamples(c.id);expect(examples).toHaveLength(4);expect(examples.map(e=>e.accepted)).toEqual([true,true,false,false]);
  for(const e of examples){const raw=JSON.stringify(e.gecko);expect(inspectChallenge(e.gecko,c.id).passed).toBe(e.accepted);expect(JSON.stringify(e.gecko)).toBe(raw);}
  expect(challengeExamples(c.id)).toBe(examples);
 }
});

test('new games default to an immediately replaceable goal, manual replacement locks five turns and the initial state never reappears on reload',()=>{
 let g=newForgeGame('default-eight-target','2026-10-24');
 expect(g.breedingChallenges).toMatchObject({version:2,activeId:'lilly-dalmatian',initialSelection:true,selectedTurn:0,unlockTurn:0,completed:[]});
 const unchanged=act(g,{type:'selectChallenge',challengeId:'lilly-dalmatian'},g.lastDate);expect(unchanged.breedingChallenges).toEqual(g.breedingChallenges);
 g=act(g,{type:'selectChallenge',challengeId:'halloween'},g.lastDate);expect(g.breedingChallenges).toMatchObject({activeId:'halloween',initialSelection:false,unlockTurn:5});
 for(let n=0;n<4;n++)g=challengeTurn(g);expect(()=>act(g,{type:'selectChallenge',challengeId:'gold-tiger'},g.lastDate)).toThrow('1턴');
 g=challengeTurn(g);g=act(g,{type:'selectChallenge',challengeId:'gold-tiger'},g.lastDate);expect(g.breedingChallenges).toMatchObject({activeId:'gold-tiger',selectedTurn:5,unlockTurn:10,initialSelection:false});expect(parseForgeBackup(exportBackup(g),g.lastDate)).toEqual(g);
 const corrupt=structuredClone(g);corrupt.breedingChallenges!.initialSelection=true;expect(()=>validateGame(corrupt)).toThrow('도전');
});

test('an existing Forge game without challenge state can actually save the first default goal selection',()=>{
 const old=newForgeGame('missing-challenge-state','2026-10-24');delete old.breedingChallenges;
 const selected=act(old,{type:'selectChallenge',challengeId:'lilly-dalmatian'},old.lastDate);
 expect(old.breedingChallenges).toBeUndefined();expect(selected.breedingChallenges).toMatchObject({version:2,activeId:'lilly-dalmatian',initialSelection:true,unlockTurn:0});
 expect(parseForgeBackup(exportBackup(selected),selected.lastDate)).toEqual(selected);
 const switched=act(selected,{type:'selectChallenge',challengeId:'halloween'},selected.lastDate);expect(switched.breedingChallenges).toMatchObject({activeId:'halloween',initialSelection:false,unlockTurn:5});
});

test('dark tiger markings cannot count as Halloween base colour and vertical bars need a continuous five-pixel run',()=>{
 const tiger=forgeReferenceGecko('gold-tiger'),o=challengeObservation(tiger)!;
 expect(o.stripeArea).toBeGreaterThan(.04);expect(o.sideDark).toBe(0);
 const baseCheck=inspectChallenge(tiger,'halloween').checks.find(c=>c.label==='어두운 바탕 면적')!;expect(baseCheck.value).toBe(0);expect(baseCheck.passed).toBe(false);
 const tracks=o.v.description.patternMetrics.tracks;expect(tracks.filter(t=>t.longest>=5)).toHaveLength(6);expect(o.bars).toBe(6);
});
