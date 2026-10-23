import {seededRandom} from './genetics';

export type LateralAlleles = readonly [number|null,number|null];
/** Game-only quantitative model; these are not identified biological loci. */
export interface LateralTraits {version:1;shape:readonly LateralAlleles[];continuity:readonly LateralAlleles[]}
export const LATERAL_TRAIT_MODEL={version:1,lociPerTrait:4,maximumAllele:4,
  meaning:{shape:'0 = longitudinal lateral stripes, 1 = rounded portholes',continuity:'connection and regularity of lateral markings'},
  evidence:'Experimental game model. Porthole/striping inheritance is not established as these eight loci. Whiteout remains separately inherited.',
  inheritanceDomain:'companion:lateral-traits-inheritance:1'}as const;
const keys=['shape','continuity']as const;
export function validateLateralTraits(value:unknown):LateralTraits {
  const v=value as LateralTraits;
  if(!v||typeof v!=='object'||Array.isArray(v)||v.version!==1||Object.keys(v).sort().join()!=='continuity,shape,version')throw Error('옆무늬 형질 형식 오류');
  for(const key of keys)if(!Array.isArray(v[key])||v[key].length!==4||v[key].some(p=>!Array.isArray(p)||p.length!==2||p.some(a=>a!==null&&(!Number.isInteger(a)||a<0||a>4))))throw Error('옆무늬 형질은 각 4쌍의 0~4 또는 미기록 사본이어야 합니다.');
  return {version:1,shape:v.shape.map(p=>[...p]as unknown as LateralAlleles),continuity:v.continuity.map(p=>[...p]as unknown as LateralAlleles)};
}
export function unknownLateralTraits():LateralTraits{return{version:1,shape:Array.from({length:4},()=>[null,null]),continuity:Array.from({length:4},()=>[null,null])};}
export function lateralTraitScores(value?:LateralTraits) {
  const v=value?validateLateralTraits(value):unknownLateralTraits();
  const score=(key:typeof keys[number])=>v[key].flat().some(a=>a===null)?null:v[key].flat().reduce<number>((s,a)=>s+a!,0)/32;
  return{shape:score('shape'),continuity:score('continuity')};
}
export function createLateralTraits(seed:string,shape:number,continuity:number):LateralTraits {
  for(const v of[shape,continuity])if(typeof v!=='number'||!Number.isFinite(v)||v<0||v>1)throw Error('옆무늬 형질은 0~1이어야 합니다.');
  const make=(key:string,mean:number):LateralAlleles[]=>{
    const rng=seededRandom(seed,`companion:lateral-founder:${key}:1`),total=Math.round(mean*32),low=Math.floor(total/8),values=Array.from({length:8},(_,n)=>low+(n<total%8?1:0));
    // Preserve the requested total while retaining segregation within a line.
    for(let n=0;n<12;n++){const a=Math.floor(rng()*8),b=Math.floor(rng()*8);if(a!==b&&values[a]>0&&values[b]<4){values[a]--;values[b]++;}}
    return Array.from({length:4},(_,n)=>[values[n*2],values[n*2+1]]);
  };
  return{version:1,shape:make('shape',shape),continuity:make('continuity',continuity)};
}
export function inheritLateralTraits(father:LateralTraits|undefined,mother:LateralTraits|undefined,seed:string):LateralTraits {
  const f=father?validateLateralTraits(father):unknownLateralTraits(),m=mother?validateLateralTraits(mother):unknownLateralTraits(),rng=seededRandom(seed,LATERAL_TRAIT_MODEL.inheritanceDomain);
  const inherit=(key:typeof keys[number]):LateralAlleles[]=>f[key].map((p,n)=>[p[rng()<.5?0:1],m[key][n][rng()<.5?0:1]]);
  return{version:1,shape:inherit('shape'),continuity:inherit('continuity')};
}
/** Expected inherited score and exact attainable bounds, not visual-morph odds. */
export function forecastLateralTraits(father?:LateralTraits,mother?:LateralTraits) {
  const f=father?validateLateralTraits(father):unknownLateralTraits(),m=mother?validateLateralTraits(mother):unknownLateralTraits();
  return Object.fromEntries(keys.map(key=>{const pairs=[...f[key],...m[key]],known=pairs.every(p=>!p.includes(null));
    return[key,{known,mean:known?pairs.reduce((s,p)=>s+(p[0]!+p[1]!)/2,0)/32:null,
      minimum:pairs.reduce((s,p)=>s+Math.min(...p.map(a=>a??0)),0)/32,
      maximum:pairs.reduce((s,p)=>s+Math.max(...p.map(a=>a??4)),0)/32}];
  }))as Record<typeof keys[number],{known:boolean;mean:number|null;minimum:number;maximum:number}>;
}
