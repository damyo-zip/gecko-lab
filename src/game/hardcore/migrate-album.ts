import type {HardcoreGame} from './model';
import {descendantIds,pedigreeIndex} from './family-album';

/** Do not guess a founder when old memberships have multiple unrelated roots. */
export function migrateAlbum(game:HardcoreGame):HardcoreGame {
 if(game.saveVersion>=8)return game;
 const next=structuredClone(game),index=pedigreeIndex(next);next.saveVersion=8;
 const members=new Map<string,string[]>();
 for(const g of Object.values(next.individuals))for(const id of g.lineageIds){
  let list=members.get(id);if(!list){list=[];members.set(id,list);}list.push(g.id);
 }
 for(const line of Object.values(next.lineages)){
  const ids=new Set(members.get(line.id)??[]);
  const roots=[...ids].filter(id=>{const p=next.individuals[id].parents;return !p||!ids.has(p.fatherId)&&!ids.has(p.motherId);});
  let founderId:string|null=null;
  if(roots.length===1){const descendants=descendantIds(index,roots[0]);if([...ids].every(id=>id===roots[0]||descendants.has(id)))founderId=roots[0];}
  line.founderId=founderId;line.favorite=true;
 }
 return next;
}
