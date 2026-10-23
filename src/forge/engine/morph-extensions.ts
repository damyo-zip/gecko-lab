import { seededRandom } from './genetics';
import {validateLateralTraits,inheritLateralTraits,type LateralTraits} from './lateral-genetics';
import {validateVeilTraits,inheritVeilTraits,type VeilTraits} from './veil-genetics';

export type PhantomAllele = 'N' | 'ph' | null;
export type PhantomPair = readonly [PhantomAllele, PhantomAllele];
export type EmptyBackAllele = 'N' | 'Eb' | null;
export type EmptyBackPair = readonly [EmptyBackAllele, EmptyBackAllele];
export type WhiteoutAllele = 'N' | 'Wo' | null;
export type WhiteoutPair = readonly [WhiteoutAllele, WhiteoutAllele];
/** Separately versioned locus: original advanced-1's three loci and 60 polygenic loci stay intact. */
export interface MorphExtensions { version: 1 | 2 | 3 | 4 | 5; phantom: PhantomPair; emptyBack?: EmptyBackPair; whiteout?: WhiteoutPair; lateral?:LateralTraits; veil?:VeilTraits }
export function validateMorphExtensions(value: unknown): MorphExtensions {
  const v = value as MorphExtensions;
  if (!v || typeof v !== 'object' || Array.isArray(v) || ![1,2,3,4,5].includes(v.version) || Object.keys(v).sort().join() !== (v.version === 1 ? 'phantom,version' : v.version === 2 ? 'emptyBack,phantom,version' : v.version===3?'emptyBack,phantom,version,whiteout':v.version===4?'emptyBack,lateral,phantom,version,whiteout':'emptyBack,lateral,phantom,veil,version,whiteout') || !Array.isArray(v.phantom) || v.phantom.length !== 2 || v.phantom.some(a => !['N', 'ph', null].includes(a))) throw Error('확장 유전형 버전 또는 팬텀 사본 형식 오류');
  if (v.version >= 2 && (!Array.isArray(v.emptyBack) || v.emptyBack.length !== 2 || v.emptyBack.some(a => !['N','Eb',null].includes(a)))) throw Error('엠티백은 N / Eb / 미기록 사본 두 개여야 합니다.');
  if (v.version >= 3 && (!Array.isArray(v.whiteout) || v.whiteout.length !== 2 || v.whiteout.some(a => !['N','Wo',null].includes(a)))) throw Error('화이트아웃은 N / Wo / 미기록 사본 두 개여야 합니다.');
  if(v.version>=4)validateLateralTraits(v.lateral);
  if(v.version===5)validateVeilTraits(v.veil);
  return { version: v.version, phantom: [...v.phantom] as unknown as PhantomPair, ...(v.version >= 2 ? {emptyBack: [...v.emptyBack!] as unknown as EmptyBackPair} : {}), ...(v.version >= 3 ? {whiteout: [...v.whiteout!] as unknown as WhiteoutPair} : {}),...(v.version>=4?{lateral:validateLateralTraits(v.lateral)}:{}),...(v.version===5?{veil:validateVeilTraits(v.veil)}:{}) };
}
export function phantomPair(value?: MorphExtensions): PhantomPair {
  return value === undefined ? [null, null] : validateMorphExtensions(value).phantom;
}
export function phantomCopies(value?: MorphExtensions): 0 | 1 | 2 | null {
  const pair = phantomPair(value);
  return pair.includes(null) ? null : pair.filter(a => a === 'ph').length as 0 | 1 | 2;
}
export function inheritMorphExtensions(father: MorphExtensions | undefined, mother: MorphExtensions | undefined, seed: string): MorphExtensions | undefined {
  if (father === undefined && mother === undefined) return undefined;
  const f = phantomPair(father), m = phantomPair(mother), rng = seededRandom(seed, 'companion:phantom-inheritance:1');
  const phantom: PhantomPair = [f[rng() < .5 ? 0 : 1], m[rng() < .5 ? 0 : 1]];
  if ((father?.version ?? 0) < 2 && (mother?.version ?? 0) < 2) return { version: 1, phantom };
  const ebFather = emptyBackPair(father), ebMother = emptyBackPair(mother), ebRng = seededRandom(seed, 'companion:empty-back-inheritance:1');
  const emptyBack: EmptyBackPair = [ebFather[ebRng() < .5 ? 0 : 1], ebMother[ebRng() < .5 ? 0 : 1]];
  if ((father?.version??0) < 3 && (mother?.version??0) < 3) return {version:2,phantom,emptyBack};
  const wf=whiteoutPair(father),wm=whiteoutPair(mother),wrng=seededRandom(seed,'companion:whiteout-inheritance:1');
  const whiteout:WhiteoutPair=[wf[wrng()<.5?0:1],wm[wrng()<.5?0:1]];
  if((father?.version??0)<4&&(mother?.version??0)<4)return {version:3,phantom,emptyBack,whiteout};
  const lateral=inheritLateralTraits(father?.lateral,mother?.lateral,seed);
  if(father?.version!==5&&mother?.version!==5)return {version:4,phantom,emptyBack,whiteout,lateral};
  return {version:5,phantom,emptyBack,whiteout,lateral,veil:inheritVeilTraits(father?.veil,mother?.veil,seed)};
}
export function emptyBackPair(value?: MorphExtensions): EmptyBackPair {
  return value === undefined ? [null,null] : validateMorphExtensions(value).emptyBack ?? [null,null];
}
export function emptyBackCopies(value?: MorphExtensions): 0 | 1 | 2 | null {
  const pair = emptyBackPair(value);
  return pair.includes(null) ? null : pair.filter(a => a === 'Eb').length as 0 | 1 | 2;
}
export function withEmptyBackPair(value: MorphExtensions | undefined, emptyBack: EmptyBackPair): MorphExtensions {
  const old=value===undefined?undefined:validateMorphExtensions(value);
  return validateMorphExtensions(old&&old.version>=3?{...old,emptyBack}:{version:2,phantom:phantomPair(value),emptyBack});
}
export function withPhantomPair(value: MorphExtensions | undefined, phantom: PhantomPair): MorphExtensions {
  const old = value === undefined ? undefined : validateMorphExtensions(value);
  return validateMorphExtensions(old && old.version >= 2 ? {...old,phantom} : {version:1,phantom});
}
export function whiteoutPair(value?:MorphExtensions):WhiteoutPair {
  return value===undefined?[null,null]:validateMorphExtensions(value).whiteout??[null,null];
}
export function whiteoutCopies(value?:MorphExtensions):0|1|2|null {
  const pair=whiteoutPair(value);return pair.includes(null)?null:pair.filter(a=>a==='Wo').length as 0|1|2;
}
export function withWhiteoutPair(value:MorphExtensions|undefined,whiteout:WhiteoutPair):MorphExtensions {
  const old=value===undefined?undefined:validateMorphExtensions(value);
  return validateMorphExtensions(old&&(old.version>=4)?{...old,whiteout}:{version:3,phantom:phantomPair(value),emptyBack:emptyBackPair(value),whiteout});
}
export function whiteoutGenotypeLabel(value?:MorphExtensions) {
  const pair=whiteoutPair(value),copies=whiteoutCopies(value);
  return copies===null?pair.every(a=>a===null)?'화이트아웃 미기록':`화이트아웃 ${pair.map(a=>a??'?').join('/')} · 미확정`:copies===2?'화이트아웃 Wo/Wo · 두 사본':copies===1?'화이트아웃 N/Wo · 한 사본':'일반 N/N';
}
export function forecastWhiteout(father?:MorphExtensions,mother?:MorphExtensions) {
  const f=whiteoutPair(father),m=whiteoutPair(mother),possible=(pair:WhiteoutPair)=>Array.from({length:pair.filter(a=>a===null).length+1},(_,n)=>(pair.filter(a=>a==='Wo').length+n)/2);
  const outcomes=possible(f).flatMap(a=>possible(m).map(b=>({normal:(1-a)*(1-b),single:a*(1-b)+(1-a)*b,double:a*b})));
  const bounds=Object.fromEntries((['normal','single','double']as const).map(k=>[k,{minimum:Math.min(...outcomes.map(o=>o[k])),maximum:Math.max(...outcomes.map(o=>o[k]))}]))as Record<'normal'|'single'|'double',{minimum:number;maximum:number}>;
  return {known:!f.includes(null)&&!m.includes(null),bounds,probabilities:Object.fromEntries(Object.entries(bounds).map(([k,b])=>[k,b.minimum===b.maximum?b.minimum:null]))as Record<'normal'|'single'|'double',number|null>};
}
export function emptyBackGenotypeLabel(value?: MorphExtensions) {
  const pair = emptyBackPair(value), copies = emptyBackCopies(value);
  return copies === null ? pair.every(a=>a===null) ? '엠티백 미기록' : `엠티백 ${pair.map(a=>a??'?').join('/')} · 미확정` : copies === 2 ? '슈퍼 엠티백 Eb/Eb' : copies === 1 ? '엠티백 N/Eb' : '일반 N/N';
}
/** Incomplete dominant breeder model; unknown copies yield ranges, not invented odds. */
export function forecastEmptyBack(father?: MorphExtensions, mother?: MorphExtensions) {
  const f=emptyBackPair(father),m=emptyBackPair(mother);
  const possible=(pair:EmptyBackPair)=>Array.from({length:pair.filter(a=>a===null).length+1},(_,n)=>(pair.filter(a=>a==='Eb').length+n)/2);
  const outcomes=possible(f).flatMap(a=>possible(m).map(b=>({normal:(1-a)*(1-b),single:a*(1-b)+(1-a)*b,super:a*b})));
  const bounds=Object.fromEntries((['normal','single','super']as const).map(k=>[k,{minimum:Math.min(...outcomes.map(o=>o[k])),maximum:Math.max(...outcomes.map(o=>o[k]))}]))as Record<'normal'|'single'|'super',{minimum:number;maximum:number}>;
  return {known:!f.includes(null)&&!m.includes(null),bounds,probabilities:Object.fromEntries(Object.entries(bounds).map(([k,b])=>[k,b.minimum===b.maximum?b.minimum:null]))as Record<'normal'|'single'|'super',number|null>};
}
export function phantomGenotypeLabel(value?: MorphExtensions) {
  const pair = phantomPair(value), copies = phantomCopies(value);
  if (copies === null) return pair.every(a => a === null) ? '팬텀 미기록' : `팬텀 ${pair.map(a => a ?? '?').join('/')} · 미확정`;
  return copies === 2 ? '팬텀 ph/ph' : copies === 1 ? '팬텀 het N/ph' : '팬텀 비보인 N/N';
}
export function forecastPhantom(father?: MorphExtensions, mother?: MorphExtensions) {
  const f = phantomPair(father), m = phantomPair(mother);
  const possible = (pair: PhantomPair): number[] => {
    const unknown = pair.filter(a => a === null).length, known = pair.filter(a => a === 'ph').length;
    return Array.from({ length: unknown + 1 }, (_, n) => (known + n) / 2);
  };
  const outcomes = possible(f).flatMap(a => possible(m).map(b => ({ normal: (1-a)*(1-b), het: a*(1-b)+(1-a)*b, phantom: a*b })));
  const bounds = Object.fromEntries((['normal','het','phantom'] as const).map(k => [k, { minimum: Math.min(...outcomes.map(o => o[k])), maximum: Math.max(...outcomes.map(o => o[k])) }])) as Record<'normal'|'het'|'phantom', { minimum: number; maximum: number }>;
  return { known: !f.includes(null) && !m.includes(null), bounds,
    probabilities: Object.fromEntries(Object.entries(bounds).map(([k, b]) => [k, b.minimum === b.maximum ? b.minimum : null])) as Record<'normal'|'het'|'phantom', number | null> };
}

export function lateralTraits(value?:MorphExtensions):LateralTraits|undefined{return value===undefined?undefined:validateMorphExtensions(value).lateral;}
export function withLateralTraits(value:MorphExtensions|undefined,lateral:LateralTraits):MorphExtensions {
  const old=value===undefined?undefined:validateMorphExtensions(value);
  return validateMorphExtensions(old?.version===5?{...old,lateral}:{version:4,phantom:phantomPair(value),emptyBack:emptyBackPair(value),whiteout:whiteoutPair(value),lateral});
}
export function veilTraits(value?:MorphExtensions):VeilTraits|undefined{return value===undefined?undefined:validateMorphExtensions(value).veil;}
export function withVeilTraits(value:MorphExtensions|undefined,veil:VeilTraits):MorphExtensions {
  const old=value===undefined?undefined:validateMorphExtensions(value);
  return validateMorphExtensions({version:5,phantom:phantomPair(value),emptyBack:emptyBackPair(value),whiteout:whiteoutPair(value),lateral:old?.lateral??{version:1,shape:Array.from({length:4},()=>[null,null]),continuity:Array.from({length:4},()=>[null,null])},veil});
}
