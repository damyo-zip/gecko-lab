import { founderHealth, inheritHealth } from '@/genetics/health';
import type { Gecko, HardcoreGame } from './model';

/** Only adds fictional loci; all saved genomes, pixels, embryos, rolls and historical failures survive.
 * Existing conception schedules keep riskModel=null so their fixed outcomes never change. */
export function migrateRisk(source:HardcoreGame):HardcoreGame {
  if(source.saveVersion>=9)return source;
  const game=structuredClone(source);game.saveVersion=9;
  const copies=new Map<string,Gecko[]>();
  const all=[...Object.values(game.individuals),...Object.values(game.shop.offers).flatMap(o=>[o.individual,...(o.family?[o.family.father,o.family.mother]:[])]),
    ...Object.values(game.eggs).map(e=>e.embryo),...Object.values(game.matings).flatMap(m=>m.lifecycle?.offspring.map(o=>o.embryo)??[])];
  for(const g of all){const group=copies.get(g.id)??[];group.push(g);copies.set(g.id,group);}
  for(const groups of [...copies.values()].sort((a,b)=>a[0].generation-b[0].generation||a[0].id.localeCompare(b[0].id))){
    const g=groups[0],p=g.parents;
    const genome=p?inheritHealth(copies.get(p.fatherId)![0].healthGenome!,copies.get(p.motherId)![0].healthGenome!,game.seed+'|health-migration:'+g.id):
      founderHealth(game.seed+'|health-migration:'+g.id);
    for(const copy of groups)copy.healthGenome=structuredClone(genome);
  }
  for(const m of Object.values(game.matings))m.riskModel=null;
  return game;
}
