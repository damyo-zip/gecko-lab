import type {Gecko} from "@/game/hardcore/model";
import {morph,specimen,visualName} from "@/game/hardcore/adapter";
import {appearanceProfile} from "@/game/hardcore/appearance";
import {valueGecko} from "@/game/hardcore/market";

export const COLLECTION_MORPHS={normal:"Normal",lilly:"Lilly White",axanthic:"Axanthic",dalmatian:"Dalmatian",harlequin:"Harlequin",tricolor:"Tricolor Harlequin"};
export const COLLECTION_SORTS={default:"기본순",name:"이름순",generation:"세대순",hearts:"하트순",priceDesc:"가격 높은순",priceAsc:"가격 낮은순"};
export type CollectionSort=keyof typeof COLLECTION_SORTS;
export interface CollectionQuery {morph:string;sort:CollectionSort;stage:string;sex?:string;search?:string}
// UI caches follow immutable game-record identities; nothing is written to a save.
const names=new WeakMap<Gecko,string>(),prices=new WeakMap<Gecko,number>();
export function collectionMorph(g:Gecko) {
  let name=names.get(g);if(name!==undefined)return name;
  const profile=appearanceProfile(g);
  name=profile?[visualName(g),...morph(g).split(" · ").filter(s=>s.includes("het")||s.includes("유전 정보"))].join(" · "):
    morph(g).replace(/^일반형(?: · (?:반점|할리퀸|트라이컬러) 외형)?|^릴리화이트 이형접합체/,COLLECTION_MORPHS[specimen(g).appearance.patternStyle]);
  names.set(g,name);return name;
}
export function collectionPrice(g:Gecko) {
  let price=prices.get(g);if(price===undefined){price=valueGecko(g).sell;prices.set(g,price);}return price;
}
export function collectionEntries(animals:readonly Gecko[],q:CollectionQuery) {
  const search=q.search?.trim().toLocaleLowerCase("ko-KR");
  const entries=animals.filter(g=>{
    if(q.stage!=="all"&&g.stage!==q.stage)return false;
    // Hatchling/juvenile sex remains private, including in filters.
    const sex=g.stage==="adult"?g.sex:"unknown";
    if(q.sex&&q.sex!=="all"&&sex!==q.sex)return false;
    if(search&&!`${g.name} ${g.id}`.toLocaleLowerCase("ko-KR").includes(search))return false;
    if(q.morph==="all")return true;
    if(q.morph.startsWith("pattern:")){
      const p=appearanceProfile(g);return !!p&&[p.names.base,p.names.color,...p.names.features].some(n=>n.includes(q.morph.slice(8)));
    }
    return specimen(g).appearance.patternStyle===q.morph;
  });
  if(q.sort==="name")entries.sort((a,b)=>a.name.localeCompare(b.name,"ko"));
  if(q.sort==="generation")entries.sort((a,b)=>b.generation-a.generation);
  if(q.sort==="hearts")entries.sort((a,b)=>a.hearts-b.hearts);
  if(q.sort==="priceDesc")entries.sort((a,b)=>collectionPrice(b)-collectionPrice(a));
  if(q.sort==="priceAsc")entries.sort((a,b)=>collectionPrice(a)-collectionPrice(b));
  return entries;
}
