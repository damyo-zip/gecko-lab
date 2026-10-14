import {createNewGame} from '../../src/game/play';
import {makeSave as phase2Save} from '../../src/game/save';
import {readSave} from '../../src/game/hardcore/save';
import {breedingRisk} from '../../src/game/hardcore/breeding-risk';
import {act} from '../../src/game/hardcore/play';
import {actWithTime} from '../../src/game/hardcore/time-source';
import {seededRandom} from '../../src/genetics/random';
import {seasonEggSeed} from '../../src/game/hardcore/season';
import {HEALTH_LOCI} from '../../src/genetics/health';
const DATE='2026-10-14';
/** Fixed review seed selected from genuine outcomes; played sibling clutch + 12 growth turns.
 * No edited ancestry, Mendelian alleles or hatch outcomes; no searching/rerolling during tests. */
export function breedingRiskFixture(){
 for(const n of [89]){
  const original=readSave(phase2Save(createNewGame('real-risk-family-'+n)),DATE);original.capacity=20;original.food=1000;
  // A known fictional wild-type fixture isolates Lilly/pedigree mechanics from hidden health effects.
  for(const g of Object.values(original.individuals))g.healthGenome={version:1,loci:Object.fromEntries(HEALTH_LOCI.map(l=>[l.id,['N','N'] as const]))};
  const [f,m,,,lillyMale]=Object.values(original.individuals);let game=act(original,{type:'breed',fatherId:f.id,motherId:m.id},DATE);
  const mating=Object.values(game.matings)[0],pending=mating.lifecycle!.offspring;
  if(pending[0].embryo.sex===pending[1].embryo.sex||pending.some((o,i)=>!o.fertilized||!o.embryo.development!.viable||!o.embryo.genotype.loci['lilly-white'].includes('Lw')||seededRandom(seasonEggSeed(mating,1,i+1),'hatch')()>=.95))continue;
  for(let i=0;i<18;i++)game=actWithTime(game,{type:'endTurn'},DATE);
  const siblings=Object.values(game.individuals).filter(g=>g.parents?.fatherId===f.id),male=siblings.find(g=>g.sex==='male'),female=siblings.find(g=>g.sex==='female');
  if(!male||!female)continue;
  const trial=act(game,{type:'breed',fatherId:male.id,motherId:female.id,riskAcknowledgement:breedingRisk(game,male,female).acknowledgement},game.lastDate),future=Object.values(trial.matings).at(-1)!;
  if(!future.lifecycle!.offspring.some(o=>o.fertilized&&!o.embryo.development!.viable)||!future.lifecycle!.offspring.some((o,i)=>o.fertilized&&o.embryo.development!.viable&&seededRandom(seasonEggSeed(future,1,i+1),'hatch')()<.95))continue;
  if(male.genotype.loci['lilly-white'].includes('Lw')&&female.genotype.loci['lilly-white'].includes('Lw'))return {game,fatherId:male.id,motherId:female.id,normalId:f.id,lillyMaleId:lillyMale.id,lillyFemaleId:m.id};
 }
 throw new Error('Played Lilly sibling fixture unavailable');
}
