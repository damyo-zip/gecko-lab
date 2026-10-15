import type {Individual} from './model';
import {ancestorDistances} from './lineage';

type Records=Record<string,Pick<Individual,'id'|'parents'>>;
export type RelationKind='waiting'|'unknown'|'none'|'same'|'parent'|'sibling'|'halfSibling'|'grandparent'|'lineal'|'avuncular'|'cousin'|'distant';
export interface SearchRelationship {
  kind:RelationKind; label:string; group:'waiting'|'unknown'|'none'|'close'|'distant';
  tone:'green'|'yellow'|'orange'|'red'|'gray'; distance:number|null;
  incomplete:boolean; additional:string[]; note:string;
}
interface Route {ancestor:string; target:number; candidate:number}
const cache=new WeakMap<Records,ReturnType<typeof buildIndex>>();
/** Parent IDs only; no genotypes, ownership filtering, recursion or N² coefficient matrix. */
function buildIndex(records:Records){
  const parents=new Map<string,string[]>(),children=new Map<string,string[]>();
  for(const [id,g] of Object.entries(records)){
    const ids=g.parents?[...new Set([g.parents.fatherId,g.parents.motherId].filter(x=>typeof x==='string'&&x.length>0))]:[];
    parents.set(id,ids);
    for(const p of ids){const list=children.get(p)??[];list.push(id);children.set(p,list);}
  }
  for(const id of children.keys())if(!parents.has(id))parents.set(id,[]);
  const degree=new Map([...parents].map(([id,p])=>[id,p.length]));
  const order=[...parents.keys()].filter(id=>!degree.get(id)),missing=new Map<string,boolean>();
  for(let n=0;n<order.length;n++){
    const id=order[n];missing.set(id,!records[id]||!!records[id].parents&&(parents.get(id)?.length??0)<2||(parents.get(id)??[]).some(p=>missing.get(p)));
    for(const child of children.get(id)??[]){const count=degree.get(child)!-1;degree.set(child,count);if(count===0)order.push(child);}
  }
  // Unprocessed nodes either form a cycle or descend from one.
  const cyclic=new Set([...parents.keys()].filter(id=>degree.get(id)!>0));
  return {parents,children,order,missing,cyclic};
}
const unknown=(note:string):SearchRelationship=>({kind:'unknown',label:'혈통 확인 불가',group:'unknown',tone:'gray',distance:null,incomplete:true,additional:[],note});
/** Build once per opponent: O(records + parent links), then O(1) per candidate.
 * Nearest recorded relationship is a graph distance, NOT F or a disease probability. */
export function relationshipSearch(records:Records,opponentId:string){
  let index=cache.get(records);if(!index){index=buildIndex(records);cache.set(records,index);}
  const {parents,order,missing,cyclic}=index,target=records[opponentId];
  if(!opponentId)return (_id:string):SearchRelationship=>({kind:'waiting',label:'상대 선택 대기',group:'waiting',tone:'gray',distance:null,incomplete:true,additional:[],note:''});
  if(!target)return (_id:string)=>unknown('선택된 상대의 기록이 없습니다.');
  if(cyclic.has(opponentId))return (_id:string)=>unknown('상대 혈통에 순환 기록이 있습니다.');
  const targetAncestors=ancestorDistances(opponentId,records as Record<string,Individual>);targetAncestors.set(opponentId,0);
  const routes=new Map<string,Route>(),descendants=new Map<string,number>();descendants.set(opponentId,0);
  const cost=(r:Route)=>r.target+r.candidate;
  for(const id of order){
    let best:Route|undefined=targetAncestors.has(id)?{ancestor:id,target:targetAncestors.get(id)!,candidate:0}:undefined;
    for(const p of parents.get(id)??[]){
      const prior=routes.get(p);
      if(prior){const next={...prior,candidate:prior.candidate+1};if(!best||cost(next)<cost(best)||(cost(next)===cost(best)&&next.ancestor<best.ancestor))best=next;}
      const distance=descendants.get(p);if(distance!==undefined&&(!descendants.has(id)||distance+1<descendants.get(id)!))descendants.set(id,distance+1);
    }
    if(best)routes.set(id,best);
  }
  const targetParents=parents.get(opponentId)??[];
  const siblings=(a:string,b:string)=>a!==b&&(parents.get(a)??[]).some(p=>(parents.get(b)??[]).includes(p));
  return (id:string):SearchRelationship=>{
    const candidate=records[id];if(!candidate)return unknown('후보의 기록이 없습니다.');
    if(cyclic.has(id))return unknown('후보 혈통에 순환 기록이 있습니다.');
    const partial=!!missing.get(id)||!!missing.get(opponentId);
    const found:{kind:RelationKind;label:string;distance:number;priority:number}[]=[];
    const add=(kind:RelationKind,label:string,distance:number,priority:number)=>found.push({kind,label,distance,priority});
    if(id===opponentId)return {kind:'same',label:'동일 개체',group:'close',tone:'orange',distance:0,incomplete:partial,additional:[],note:'같은 고유 ID'};
    const ancestor=targetAncestors.get(id),descendant=descendants.get(id),lineal=Math.min(ancestor??Infinity,descendant??Infinity);
    if(lineal===1)add('parent','부모 ↔ 자식',1,0);
    else if(lineal===2)add('grandparent','조부모 ↔ 손자녀',2,3);
    else if(lineal>2&&Number.isFinite(lineal))add('lineal','직계 조상 ↔ 후손',lineal,4);
    const cp=parents.get(id)??[],sharedParents=cp.filter(p=>targetParents.includes(p));
    if(sharedParents.length>=2)add('sibling','친형제자매',2,1);
    else if(sharedParents.length===1)add('halfSibling',cp.length===2&&targetParents.length===2?'이복형제자매':'형제자매 · 공통 부모 1명 확인',2,2);
    if(targetParents.some(p=>siblings(id,p))||cp.some(p=>siblings(opponentId,p)))add('avuncular','삼촌·고모·이모 ↔ 조카',3,5);
    if(cp.some(p=>targetParents.some(t=>siblings(p,t))))add('cousin','사촌',4,6);
    const route=routes.get(id);
    if(route&&(!found.length||cost(route)<Math.min(...found.map(r=>r.distance))))add('distant','먼 공통 조상',cost(route),7);
    found.sort((a,b)=>a.distance-b.distance||a.priority-b.priority);
    if(found.length){
      const first=found[0],distant=['cousin','distant','lineal'].includes(first.kind);
      return {kind:first.kind,label:first.label,group:distant?'distant':'close',tone:first.kind==='parent'?'red':distant?'yellow':'orange',distance:first.distance,
        incomplete:partial,additional:[...new Set(found.slice(1).map(x=>x.label))],note:partial?'일부 조상 기록 누락 · 확인된 관계만 표시':'등록된 부모 관계 기준'};
    }
    if(partial||!cp.length||!targetParents.length)return unknown(partial?'일부 부모·조상 기록이 없습니다.':'부모 기록 없음 · 확인된 공통 조상 없음');
    return {kind:'none',label:'기록상 공통 조상 없음',group:'none',tone:'green',distance:null,incomplete:false,additional:[],note:'등록된 혈통 범위만 확인 · 시조 이전의 실제 비혈연을 보장하지 않습니다.'};
  };
}
/** Unknown/partial pedigrees are placed last, never promoted as distant relatives. */
export function compareRelationshipDistance(a:SearchRelationship,b:SearchRelationship){
  const uncertain=(r:SearchRelationship)=>r.incomplete||r.group==='waiting'||r.group==='unknown';
  if(uncertain(a)!==uncertain(b))return uncertain(a)?1:-1;
  if(a.group==='none'||b.group==='none')return a.group===b.group?0:a.group==='none'?-1:1;
  return (b.distance??-1)-(a.distance??-1);
}
