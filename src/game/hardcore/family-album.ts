import type {Gecko,HardcoreGame,NamedLineage} from './model';
import {dateTurn} from './monthly-calendar';
import {daysBetween} from './time';
import {ageTurns,isV12,lifecycleRules,isMonthly,formatAgeMonths} from './lifecycle';

/** Derived lookup only. Every displayed node is the original game.individuals record. */
export function pedigreeIndex(game:Pick<HardcoreGame,'individuals'>){
 const children=new Map<string,string[]>();
 for(const g of Object.values(game.individuals))if(g.parents){
  for(const id of [g.parents.fatherId,g.parents.motherId]){
   let list=children.get(id);if(!list){list=[];children.set(id,list);}list.push(g.id);
  }
 }
 return {children};
}
export type PedigreeIndex=ReturnType<typeof pedigreeIndex>;
export function descendantIds(index:PedigreeIndex,id:string):Set<string>{
 const found=new Set<string>(),queue=[id];
 for(let n=0;n<queue.length;n++)for(const child of index.children.get(queue[n])??[]){
  if(child!==id&&!found.has(child)){found.add(child);queue.push(child);}
 }
 return found;
}
export function familyTree(game:HardcoreGame,id:string){
 const current=game.individuals[id],father=current?.parents?game.individuals[current.parents.fatherId]:undefined,
  mother=current?.parents?game.individuals[current.parents.motherId]:undefined;
 const parent=(g:Gecko|undefined,side:'fatherId'|'motherId')=>g?.parents?game.individuals[g.parents[side]]:undefined;
 return {current,father,mother,paternalGrandfather:parent(father,'fatherId'),paternalGrandmother:parent(father,'motherId'),
  maternalGrandfather:parent(mother,'fatherId'),maternalGrandmother:parent(mother,'motherId')};
}
export function familySummary(game:HardcoreGame,line:NamedLineage,index=pedigreeIndex(game)){
 const founder=line.founderId?game.individuals[line.founderId]:undefined;
 const members=founder?[founder.id,...descendantIds(index,founder.id)]:Object.values(game.individuals).filter(g=>g.lineageIds.includes(line.id)).map(g=>g.id);
 const representative=founder??members.map(id=>game.individuals[id]).sort((a,b)=>a.generation-b.generation||a.id.localeCompare(b.id))[0];
 const maxGeneration=members.reduce((max,id)=>Math.max(max,game.individuals[id].generation),representative?.generation??0);
 return {founder,representative,members,maxGeneration,descendantCount:founder?members.length-1:null};
}
/** Searching is bounded before any sprites are rendered, including archived/external records. */
export function searchIndividuals(game:HardcoreGame,query:string,offset=0,limit=24,ids?:readonly string[]){
 const q=query.trim().toLocaleLowerCase('ko-KR'),source=ids?ids.map(id=>game.individuals[id]).filter(Boolean):Object.values(game.individuals);
 const matches=source.filter(g=>!q||g.name.toLocaleLowerCase('ko-KR').includes(q)||g.id.toLowerCase().includes(q));
 return {total:matches.length,items:matches.slice(offset,offset+limit)};
}
/** Archived animals stop ageing at their actual death/sale date; outside parents have no current health record. */
export function recordedAge(game:HardcoreGame,g:Gecko){
 const archived=g.status==='dead'||g.status==='sold',daysPerTurn=isV12(game)?lifecycleRules(game).daysPerTurn:1;
 // Historical migration preserves birth dates but can normalize a living adult's
 // birthTurn. Current animals must show the same age as the breeding/lifespan engine.
 if(!archived){const turns=ageTurns(game,g);return {days:turns*daysPerTurn,turns,months:isMonthly(game)?turns:Math.floor(turns*daysPerTurn/30),archived};}
 const end=g.diedDate??game.sales.find(s=>s.individualId===g.id)?.date??game.lastDate;
 const days=Math.max(0,daysBetween(g.birthDate,end));const turns=isMonthly(game)?Math.max(0,dateTurn(game,end)-g.birthTurn):Math.floor(days/daysPerTurn);
 return {days,turns,months:isMonthly(game)?turns:Math.floor(days/30),archived};
}

export const displayAge=(game:HardcoreGame,g:Gecko)=>formatAgeMonths(recordedAge(game,g).months);
