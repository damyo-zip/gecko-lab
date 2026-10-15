import {koreanMorphText,morphSearchText} from "@/phenotype/display-name";
import {morph as fullMorph} from "@/game/hardcore/adapter";
import type {Gecko,HardcoreGame,Mating} from '@/game/hardcore/model';
import {publicKnowledge} from '@/game/hardcore/genetics';
import {LOCI} from '@/genetics/advanced/loci';
import {carrierProbability} from '@/genetics/advanced/inference';
import {ageTurns} from '@/game/hardcore/lifecycle';
import {freeSlots} from '@/game/hardcore/survival';
import {relationshipSearch,compareRelationshipDistance,type SearchRelationship} from '@/game/relative-search';
import {collectionStatus,type CollectionStatus} from './collection-status';
import {collectionEntries,collectionMorph,COLLECTION_MORPHS} from './collection-query';

export interface PublicGeneticTag {id:string;label:string}
/** Only the existing public beliefs enter genetic filters. Never read true alleles. */
export function publicGeneticTags(g:Gecko){
  const knowledge=publicKnowledge(g),confirmed:PublicGeneticTag[]=[],possible:PublicGeneticTag[]=[];
  for(const locus of LOCI){
    const p=knowledge.loci[locus.id].probabilities;if(!p)continue;
    const labels=[...new Set(Object.entries(p).filter(([,v])=>v>0).map(([k])=>locus.phenotypes[k]))];
    if(labels.length===1&&labels[0]!=='Normal')confirmed.push({id:locus.id+':'+labels[0],label:koreanMorphText(labels[0])});
  }
  const carrier=carrierProbability(knowledge);
  if(carrier!==null){
    if(carrier>1-1e-9)confirmed.push({id:'axanthic:carrier',label:'100% het 아잔틱'});
    else if(carrier>0)possible.push({id:'axanthic',label:(carrier*100).toFixed(1)+'% possible het 아잔틱'});
    else if((knowledge.loci.axanthic.probabilities?.['A/A']??0)>1-1e-9)confirmed.push({id:'axanthic:noncarrier',label:'아잔틱 비보인자 확인'});
  }
  return {confirmed,possible};
}
export const PARENT_SORTS={ready:'교배 가능 우선',name:'이름순',age:'나이순',generation:'세대순',acquired:'최근 획득순',distant:'혈연이 먼순'};
export const COMPLEX_MORPHS=[...new Set(LOCI.filter(l=>l.id==='cappuccino-complex').flatMap(l=>Object.values(l.phenotypes).filter(n=>n!=='Normal')))];
export interface ParentQuery {search:string;morph:string;stage:string;status:string;generation:string;confirmed:string;possible:string;relation:string;sort:keyof typeof PARENT_SORTS}
export const DEFAULT_PARENT_QUERY:ParentQuery={search:'',morph:'all',stage:'all',status:'all',generation:'all',confirmed:'all',possible:'all',relation:'all',sort:'ready'};
export interface ParentCandidate {
  gecko:Gecko;morph:string;visibleMorphs:string[];age:number;acquired:number;status:CollectionStatus;relationship:SearchRelationship;
  confirmed:PublicGeneticTag[];possible:PublicGeneticTag[];selectable:boolean;searchText:string;
}
// Keep an anatomical morph filter from rerunning the appearance adapter on every keystroke.
const morphMembership=new WeakMap<readonly ParentCandidate[],Map<string,Set<string>>>();
const normalize=(s:string)=>s.toLocaleLowerCase('ko-KR').replace(/\s+/g,'');
/** Built once per immutable game/opponent. Queries and ordering never re-read secret loci. */
export function parentCandidates(game:HardcoreGame,sex:'male'|'female',opponentId:string):ParentCandidate[]{
  const relation=relationshipSearch(game.individuals,opponentId);
  const matings=new Map<string,Mating[]>(),slots=freeSlots(game),recordCount=Object.keys(game.individuals).length+Object.keys(game.eggs).length;
  for(const m of Object.values(game.matings)){const list=matings.get(m.parents.motherId)??[];list.push(m);matings.set(m.parents.motherId,list);}
  return Object.values(game.individuals).flatMap((g,acquired)=>{
    if(g.status!=='owned'||g.stage==='adult'&&g.sex!==sex)return [];
    // Unknown juvenile sex must not be inferred by inclusion in one gender list.
    // Low hearts are a care warning, not an engine breeding prohibition while alive.
    const morph=collectionMorph(g),tags=publicGeneticTags(g),status=collectionStatus(game,g,false,{matings:matings.get(g.id)??[],slots,recordCount});
    const visibleMorphs=tags.confirmed.filter(t=>t.id.startsWith('cappuccino-complex:')).map(t=>t.id.slice('cappuccino-complex:'.length));
    return [{gecko:g,morph,visibleMorphs,age:ageTurns(game,g),acquired,status,relationship:relation(g.id),...tags,selectable:g.stage==='adult',
      searchText:normalize([g.name,g.id,morph,morphSearchText(fullMorph(g)),...tags.confirmed.flatMap(t=>[t.label,t.id.slice(t.id.indexOf(':')+1)]),...tags.possible.map(t=>t.label)].join(' '))}];
  });
}
export function filterParents(rows:readonly ParentCandidate[],q:ParentQuery){
  const query=normalize(q.search),visibleMorph=q.morph.startsWith('visible:')?q.morph.slice(8):null;
  let morphIds:Set<string>|undefined;
  if(q.morph!=='all'&&!visibleMorph){
    let byMorph=morphMembership.get(rows);if(!byMorph){byMorph=new Map();morphMembership.set(rows,byMorph);}
    morphIds=byMorph.get(q.morph);
    if(!morphIds){morphIds=new Set(collectionEntries(rows.map(r=>r.gecko),{morph:q.morph,stage:'all',sort:'default'}).map(g=>g.id));byMorph.set(q.morph,morphIds);}
  }
  const result=rows.filter(r=>{
    if(query&&!r.searchText.includes(query))return false;
    if(morphIds&&!morphIds.has(r.gecko.id))return false;
    if(visibleMorph&&!r.visibleMorphs.includes(visibleMorph))return false;
    if(q.stage!=='all'&&(q.stage==='adult')!==(r.gecko.stage==='adult'))return false;
    if(q.status==='ready'&&!r.status.ready||q.status==='rest'&&r.status.kind!=='rest'||q.status==='blocked'&&(r.status.ready||r.status.kind==='rest'))return false;
    if(q.generation!=='all'&&String(r.gecko.generation)!==q.generation)return false;
    if(q.confirmed!=='all'&&!r.confirmed.some(t=>t.id===q.confirmed))return false;
    if(q.possible!=='all'&&!r.possible.some(t=>t.id===q.possible))return false;
    if(q.relation!=='all'&&r.relationship.group!==q.relation)return false;
    return true;
  });
  const name=(a:ParentCandidate,b:ParentCandidate)=>a.gecko.name.localeCompare(b.gecko.name,'ko')||a.gecko.id.localeCompare(b.gecko.id);
  result.sort((a,b)=>{
    if(q.sort==='ready')return Number(b.status.ready)-Number(a.status.ready)||name(a,b);
    if(q.sort==='age')return b.age-a.age||name(a,b);
    if(q.sort==='generation')return b.gecko.generation-a.gecko.generation||name(a,b);
    if(q.sort==='acquired')return b.acquired-a.acquired;
    if(q.sort==='distant')return compareRelationshipDistance(a.relationship,b.relationship)||name(a,b);
    return name(a,b);
  });return result;
}
export {COLLECTION_MORPHS};
