import {seededRandom} from '@/genetics/random';
import {createVeilTraits,createLateralTraits,inheritMorphExtensions,validateMorphExtensions,type MorphExtensions} from '@/forge';
import type {ForgeGenetics} from './forge-model';
import {founderPatternColour,inheritPatternColour,validatePatternColour,validatePatternColourChild} from './colour-genetics';

/** Actual founder copies, drawn only in a new catalog. Never reconstruct old DNA
 * from numeric traits, price or a displayed morph label. */
export function founderForge(seed:string,profile=0,subdued=false):ForgeGenetics {
  const rng=seededRandom(seed,'geckolab:forge-founder:1');
  const density=profile===12?.85+.15*rng():.20+.65*rng();
  const shape=profile===10?1:profile===11?0:rng();
  const continuity=profile===11?1:subdued?.25+.35*rng():.35+.6*rng();
  const extensions:MorphExtensions={version:5,phantom:profile===7?['ph','ph']:['N','N'],emptyBack:profile===8?['N','Eb']:['N','N'],whiteout:profile===9?['N','Wo']:['N','N'],
    lateral:createLateralTraits(seed,shape,continuity),veil:createVeilTraits(seed,density)};
  return{version:1,extensions,paletteVersion:2,patternColour:founderPatternColour(seed)};
}
/** Separate domains leave the original 63 loci and every saved conception seed intact. */
export function inheritForge(father:ForgeGenetics|undefined,mother:ForgeGenetics|undefined,seed:string,paletteVersion:2|null=father?.paletteVersion??mother?.paletteVersion??null):ForgeGenetics|undefined {
  if(!father&&!mother)return undefined;
  const extensions=inheritMorphExtensions(father?.extensions,mother?.extensions,seed);
  return{version:1,...(extensions?{extensions}:{}),...(paletteVersion===2?{paletteVersion,patternColour:inheritPatternColour(father?.patternColour,mother?.patternColour,seed)}:{})};
}
export function validateForge(value:unknown):asserts value is ForgeGenetics {
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('새 외형 유전 기록이 손상되었습니다.');
  const v=value as ForgeGenetics,expected=['version',...(v.extensions===undefined?[]:['extensions']),...(Object.hasOwn(v,'paletteVersion')?['paletteVersion']:[]),...(Object.hasOwn(v,'patternColour')?['patternColour']:[])].sort().join();
  if(v.version!==1||Object.keys(v).sort().join()!==expected||Object.hasOwn(v,'paletteVersion')&&v.paletteVersion!==2)throw Error('새 외형 유전 기록 버전이 손상되었습니다.');
  if(v.extensions!==undefined)validateMorphExtensions(v.extensions);
  if(Object.hasOwn(v,'patternColour')){if(v.paletteVersion!==2)throw Error('무늬 발색 버전이 손상되었습니다.');validatePatternColour(v.patternColour);}
}
export function validateForgeChild(child:ForgeGenetics|undefined,father:ForgeGenetics|undefined,mother:ForgeGenetics|undefined):void {
  if((father?.paletteVersion===2||mother?.paletteVersion===2)&&child?.paletteVersion!==2)throw Error('자손의 발색 버전이 부모 기록과 일치하지 않습니다.');
  if(child?.paletteVersion===2)validatePatternColourChild(child.patternColour,father?.patternColour,mother?.patternColour);
  const c=child?.extensions,f=father?.extensions,m=mother?.extensions,expected=Math.max(f?.version??0,m?.version??0);
  if((c?.version??0)!==expected)throw Error('자손의 새 모프 상속 기록이 손상되었습니다.');
  if(!c)return;
  const pairs=(e:MorphExtensions|undefined):Record<string,readonly (number|string|null)[]>=>Object.fromEntries([
    ['phantom',e?.phantom??[null,null]],['emptyBack',e?.emptyBack??[null,null]],['whiteout',e?.whiteout??[null,null]],
    ...Array.from({length:4},(_,n)=>['shape-'+n,e?.lateral?.shape[n]??[null,null]]),
    ...Array.from({length:4},(_,n)=>['continuity-'+n,e?.lateral?.continuity[n]??[null,null]]),
    ...Array.from({length:6},(_,n)=>['veil-'+n,e?.veil?.density[n]??[null,null]]),
  ]);
  const cp=pairs(c),fp=pairs(f),mp=pairs(m);
  for(const[key,pair]of Object.entries(cp))if(!fp[key].includes(pair[0])||!mp[key].includes(pair[1]))throw Error('자손의 새 모프 사본이 부모와 일치하지 않습니다.');
}
