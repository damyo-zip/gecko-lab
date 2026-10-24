import type {HardcoreGame} from './model';

/** Copy only containers the historical structural projection edits. Large DNA,
 * health and pixel inputs are validated on the original and are read-only here.
 * Never normalize malformed arrays into valid records while copying them. */
function record<T extends object>(value:T):T {
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('저장 기록 구조가 손상되었습니다.');
 return {...value};
}
function records<T extends object>(value:Record<string,T>,copy:(value:T)=>T=record):Record<string,T> {
 record(value);return Object.fromEntries(Object.entries(value).map(([id,v])=>[id,copy(v)]));
}
export function validationProjection(game:HardcoreGame):HardcoreGame {
 const base=record(game);
 base.individuals=records(game.individuals);
 base.lineages=records(game.lineages);
 base.eggs=records(game.eggs,e=>({...record(e),embryo:record(e.embryo)}));
 base.matings=records(game.matings,m=>{
  const next=record(m);
  if(m.lifecycle){
   if(!Array.isArray(m.lifecycle.offspring))throw new Error('저장 산란 기록이 손상되었습니다.');
   next.lifecycle={...record(m.lifecycle),offspring:m.lifecycle.offspring.map(o=>({...record(o),embryo:record(o.embryo)}))};
  }
  return next;
 });
 base.shop={...record(game.shop),offers:records(game.shop.offers,o=>({...record(o),individual:record(o.individual)}))};
 return base;
}
