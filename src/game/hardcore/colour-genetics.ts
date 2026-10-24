import {seededRandom} from '@/genetics/random';

/** Fictional quantitative GAME modifiers, not identified biological loci.
 * Unknown old copies stay null; no DNA is inferred from a displayed colour. */
export interface PatternColourTraits {version:1;warmth:readonly (readonly [number|null,number|null])[]}
export function founderPatternColour(seed:string):PatternColourTraits {
 const random=seededRandom(seed,'geckolab:pattern-colour-founder:1'),copies=Array<number>(12).fill(0);
 const total=Math.round(random()*48);
 for(let n=0;n<total;n++){
  const available=copies.flatMap((value,i)=>value<4?[i]:[]);
  copies[available[Math.floor(random()*available.length)]]++;
 }
 return{version:1,warmth:Array.from({length:6},(_,n)=>[copies[n*2],copies[n*2+1]]as const)};
}
export function inheritPatternColour(father:PatternColourTraits|undefined,mother:PatternColourTraits|undefined,seed:string):PatternColourTraits {
 const random=seededRandom(seed,'geckolab:pattern-colour-inherit:1');
 return{version:1,warmth:Array.from({length:6},(_,n)=>[
  father?.warmth[n][Math.floor(random()*2)]??null,mother?.warmth[n][Math.floor(random()*2)]??null,
 ]as const)};
}
/** Neutral cream is a render-only fallback for an unrecorded copy. */
export function patternColourWarmth(traits:PatternColourTraits|undefined):number {
 return traits?traits.warmth.flat().reduce<number>((sum,value)=>sum+(value??1.5),0)/48:.375;
}
export function validatePatternColour(value:unknown):asserts value is PatternColourTraits {
 const v=value as PatternColourTraits|undefined;
 if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).sort().join()!=='version,warmth'||v.version!==1||!Array.isArray(v.warmth)||v.warmth.length!==6||v.warmth.some(pair=>!Array.isArray(pair)||pair.length!==2||pair.some(copy=>copy!==null&&(!Number.isInteger(copy)||copy<0||copy>4))))throw Error('무늬 발색 상속 기록이 손상되었습니다.');
}
export function validatePatternColourChild(child:PatternColourTraits|undefined,father:PatternColourTraits|undefined,mother:PatternColourTraits|undefined):void {
 if(!child)throw Error('자손의 무늬 발색 상속 기록이 없습니다.');
 for(let n=0;n<6;n++)if(!(father?.warmth[n]??[null,null]).includes(child.warmth[n][0])||!(mother?.warmth[n]??[null,null]).includes(child.warmth[n][1]))throw Error('자손의 무늬 발색 사본이 부모와 일치하지 않습니다.');
}
