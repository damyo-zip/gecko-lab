import type {Gecko} from '@/game/hardcore/model';
import {MARKET,valuationFactors,type PriceTable} from '@/game/hardcore/market';

export interface SalePriceTag {id:string;label:string;tone:'positive'|'negative'}
/** Explain applied terms, never infer extra premiums from names or hidden genes.
 * Appearance is shown as its NET multiplier, so a small positive contribution
 * cannot be mistaken for excellent quality. Neutral terms create no tags.
 */
export function salePriceTags(g:Gecko,table:PriceTable=MARKET):SalePriceTag[] {
 const f=valuationFactors(g,table),tags:SalePriceTag[]=[];
 const add=(id:string,factor:number,positive:string,negative:string)=>{
  if(factor!==1)tags.push({id,label:factor>1?positive:negative,tone:factor>1?'positive':'negative'});
 };
 const category:Record<string,string>={lilly:'릴리화이트',axanthic:'아잔틱','axanthic-lilly':'릴잔틱',harlequin:'할리퀸',dalmatian:'달마시안',tricolor:'트라이컬러'};
 // A base-price tag has an explicit reference: the normal base in THIS table.
 add('base',f.marketBase/table.bases.normal,(category[f.bucket]??'모프')+' 기준가','모프 기준가');
 add('appearance',f.appearance,'외형 가산','외형 감산');
 add('carrier',f.carrier,'공개 보인 정보','공개 보인 정보');
 add('sex',f.sex,'성체 암컷','성별 계수');
 add('age',f.age,'성장 단계',g.stage==='juvenile'?'아성체 단계':'해칭 단계');
 add('pedigree',f.pedigree,'부모 기록','부모 기록');
 return tags;
}
