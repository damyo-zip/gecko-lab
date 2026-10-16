import { wildGenome } from '@/genetics/advanced/loci';
import { FEATURES, type Feature, type Genome } from '@/genetics/advanced/model';
import { legacyTraits } from '@/genetics/advanced/phenotype';
import { polyScores } from '@/genetics/advanced/polygenic';
import { unknownKnowledge } from '@/genetics/advanced/inference';
import { specimen } from '@/game/hardcore/adapter';
import type { Gecko } from '@/game/hardcore/model';
import { renderSprite } from '@/engine/render';
import { renderAppearancePrototype,renderAppearanceRelief } from './render';

export const MORPHS = [
  {id:'normal',label:'노멀 · 대조군'}, {id:'lilly',label:'릴리화이트'},
  {id:'axanthic',label:'아잔틱'}, {id:'cappuccino',label:'카푸치노'},
  {id:'highway',label:'하이웨이'}, {id:'sable',label:'세이블'},
  {id:'lilly-axanthic',label:'릴리 아잔틱'}, {id:'frappuccino',label:'프라푸치노'},
  {id:'lilly-sable',label:'릴리 세이블'}, {id:'axanthic-highway',label:'아잔틱 + 하이웨이'},
] as const;
export type MorphId = typeof MORPHS[number]['id'];
export const PROFILES = [
  {id:'low',label:'낮은 패턴 발현'}, {id:'typical',label:'일반 발현'}, {id:'high',label:'극단적 고발현'},
  {id:'dark',label:'어두운 명도'}, {id:'bright',label:'밝은 명도'},
] as const;
export type ProfileId = typeof PROFILES[number]['id'];
/** Legal existing virtual alleles, not engineered shop/offspring data. A profile
 * is shared across ALL morphs: no per-morph background or visual-seed substitution. */
const recipes:Record<ProfileId,Record<Feature,number>> = {
  low:{red:1,orange:2,brightness:2,cream:0,dorsal:1,flank:0,harlequin:0,contrast:1,pinstripe:0,spots:0},
  typical:{red:2,orange:3,brightness:2,cream:2,dorsal:3,flank:2,harlequin:2,contrast:2,pinstripe:2,spots:0},
  high:{red:1,orange:2,brightness:3,cream:4,dorsal:4,flank:4,harlequin:4,contrast:4,pinstripe:4,spots:0},
  dark:{red:0,orange:0,brightness:0,cream:2,dorsal:3,flank:2,harlequin:2,contrast:3,pinstripe:2,spots:0},
  bright:{red:0,orange:0,brightness:4,cream:2,dorsal:3,flank:2,harlequin:2,contrast:3,pinstripe:2,spots:0},
};
export function fixtureGenome(profile:ProfileId,morph:MorphId):Genome {
  const mendelian=wildGenome();
  if(['lilly','lilly-axanthic','frappuccino','lilly-sable'].includes(morph))mendelian.loci['lilly-white']=['n','Lw'];
  if(['axanthic','lilly-axanthic','axanthic-highway'].includes(morph))mendelian.loci.axanthic=['ax','ax'];
  if(['cappuccino','frappuccino'].includes(morph))mendelian.loci['cappuccino-complex']=['n','C'];
  if(['highway','axanthic-highway'].includes(morph))mendelian.loci['cappuccino-complex']=['n','H'];
  if(['sable','lilly-sable'].includes(morph))mendelian.loci['cappuccino-complex']=['n','S'];
  return {version:1,mendelian,polygenic:{version:1,loci:Object.fromEntries(FEATURES.flatMap(f=>
    Array.from({length:6},(_,n)=>[f+'-'+n,[recipes[profile][f],recipes[profile][f]]])))}};
}
/** Transient old-adapter subject. Never inserted into a game, save or collection. */
export function comparisonSubject(genome:Genome,seed:string):Gecko {
  return {id:'prototype-comparison',name:'비교 개체',sex:'female',birthTurn:-12,birthDate:'2000-01-01',stage:'adult',parents:null,generation:1,
    genotype:{modelVersion:1,loci:{'lilly-white':genome.mendelian.loci['lilly-white'],axanthic:genome.mendelian.loci.axanthic}},
    genetics:{version:1,genome,knowledge:unknownKnowledge(),appearanceVersion:'patterns-1'},
    potential:legacyTraits(polyScores(genome.polygenic)),visualSeed:seed,nextBreedTurn:0,status:'pedigree',hearts:5,lastFedDate:null,diedDate:null,
    cycleAnchor:'2000-01-01',recoverUntil:'2000-01-01',lineageIds:[],provenance:'known'};
}
export function comparison(profile:ProfileId,morph:MorphId,seed:string,fire:'up'|'down'='up') {
  const genome=fixtureGenome(profile,morph),old=renderSprite(specimen(comparisonSubject(genome,seed),fire));
  return {genome,old,improved:renderAppearancePrototype({genome,seed,fire}),relief:renderAppearanceRelief({genome,seed,fire})};
}
