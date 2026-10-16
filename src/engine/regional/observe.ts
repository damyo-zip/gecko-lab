import {PART} from '../art';
import {buildPatternPlan,PATTERN_ROUTES} from '../pattern-plan';
import {patternTraits} from '@/genetics/advanced/pattern-traits';
import type {PatternObservation,PatternTraits,LineObservation,RGB} from '@/phenotype/model';
import type {RegionalInput,RegionalResult} from './model';
import {anatomy as A,sourceBase as B} from './anatomy';

const clamp=(v:number)=>Math.max(0,Math.min(1,v));
const light=(c:ArrayLike<number>)=>c[0]*.30+c[1]*.59+c[2]*.11;
const lit=(r:RegionalResult,i:number)=>light(r.sprite.pixels.subarray(i*4,i*4+3));
export interface RegionalObservation extends PatternObservation {
  /** All fractions use structure-excluded skin, not the former plan's face mask. */
  whiteArea:number;headWhite:number;meanLuminance:number;baseLuminance:number;
  contrast:number;spotRegions:Record<number,number>;expression:RegionalResult['phenotype']['strength'];
}
/** Measure only the materials that reached the final 96px image. The original
 * PatternPlan is geometry intent, never a substitute for this observation. */
export function observeRegional(input:RegionalInput,r:RegionalResult){
  const p=r.phenotype,s=p.scores;
  const background=patternTraits({...input.genome,mendelian:{version:1,loci:{'lilly-white':['n','n'],axanthic:['A','A'],'cappuccino-complex':['n','n']}}});
  const plan=buildPatternPlan(background,input.seed),materials=r.materials;
  const counts=[0,0,0,0,0,0],sums=Array.from({length:6},()=>[0,0,0]);
  let n=0,mean=0,baseL=0,baseN=0;
  const isLight=(i:number)=>!!A.skin[i]&&(materials[i]===2||materials[i]===4);
  for(let i=0;i<9216;i++)if(A.skin[i]){
    const m=materials[i];counts[m]++;n++;mean+=lit(r,i);
    for(let k=0;k<3;k++)sums[m][k]+=r.sprite.pixels[i*4+k];
    if(m===1){baseL+=lit(r,i);baseN++;}
  }
  const average=(roles:number[],fallback:RGB):RGB=>{
    const count=roles.reduce((a,m)=>a+counts[m],0);
    return count?([0,1,2].map(k=>Math.round(roles.reduce((a,m)=>a+sums[m][k],0)/count)) as unknown as RGB):fallback;
  };
  const fraction=(region:(i:number)=>boolean,predicate:(i:number)=>boolean=isLight)=>{
    let total=0,marked=0;for(let i=0;i<9216;i++)if(A.skin[i]&&region(i)){total++;marked+=Number(predicate(i));}
    return marked/Math.max(1,total);
  };
  const lineObservation=(route:typeof PATTERN_ROUTES[number]):LineObservation=>{
    let covered=0,longestRun=0,run=0,gapCount=0,previous=true;
    const bits=route.map(([x,y])=>!!plan.pins[y*96+x]&&materials[y*96+x]===2);
    const edges=route.filter(([x,y])=>{const i=y*96+x;return !!plan.pins[i]&&materials[i]===2&&[i-96,i+96].some(j=>A.skin[j]&&(materials[j]===1||materials[j]===3)&&Math.abs(lit(r,i)-lit(r,j))>=10);}).length;
    const readable=edges/route.length>=.25;
    for(const bit of bits){
      const present=readable&&bit;
      if(present){covered++;longestRun=Math.max(longestRun,++run);}else{if(previous)gapCount++;run=0;}previous=present;
    }
    return {coverage:covered/route.length,longestRun,gapCount,length:route.length};
  };
  const retained=(mask:Uint8Array,predicate:(i:number)=>boolean)=>{
    let total=0,shown=0;for(let i=0;i<9216;i++)if(mask[i]&&A.skin[i]){total++;shown+=Number(predicate(i));}
    return total>=8&&shown/total>=.65;
  };
  const readableDrip=(mask:Uint8Array)=>{
    if(!retained(mask,isLight))return false;
    // A white blanket can cover an intended drip without retaining its contour.
    // Require visible lateral edges; coverage alone would award a hidden trait.
    let boundary=0,separated=0;
    for(let i=0;i<9216;i++)if(mask[i]&&A.skin[i])for(const j of [i%96?i-1:-1,i%96<95?i+1:-1]){
      if(j<0||mask[j]||!A.skin[j])continue;
      boundary++;if(isLight(i)&&!isLight(j)&&Math.abs(lit(r,i)-lit(r,j))>=10)separated++;
    }
    return boundary>=4&&separated/boundary>=.25;
  };
  // Count separated, actually rendered spot components. Overwritten or clipped
  // intended marks cannot earn spot names, premiums or challenge credit.
  const visited=new Uint8Array(9216),spotRegions:Record<number,number>={};let spots=0;
  for(let i=0;i<9216;i++)if(materials[i]===5&&!visited[i]){
    const queue=[i];visited[i]=1;let sumX=0,sumY=0;
    for(let q=0;q<queue.length;q++){
      const j=queue[q],x=j%96;sumX+=x;sumY+=Math.floor(j/96);
      for(const k of [x?j-1:-1,x<95?j+1:-1,j-96,j+96])if(k>=0&&k<9216&&!visited[k]&&materials[k]===5){visited[k]=1;queue.push(k);}
    }
    const center=Math.round(sumY/queue.length)*96+Math.round(sumX/queue.length),part=B.parts[center];
    spots++;spotRegions[part]=(spotRegions[part]??0)+1;
  }
  const palette={base:average([1],p.palette.base),secondary:average([3],p.palette.secondary),cream:average([2,4],p.palette.cream)};
  const vals=[counts[1]?light(palette.base):null,counts[3]?light(palette.secondary):null,counts[2]+counts[4]?light(palette.cream):null].filter((v):v is number=>v!==null);
  const contrast=clamp((Math.max(...vals)-Math.min(...vals))/190);
  const color:PatternTraits['color']=p.expressed.axanthic?'회색':light(p.palette.base)<75?'다크':background.color;
  const observation:RegionalObservation={
    dorsal:fraction(i=>B.parts[i]===PART.body&&A.dorsalDepth[i]<.94),
    flank:fraction(i=>B.parts[i]===PART.body&&A.dorsalDepth[i]>=.94),
    limbs:fraction(i=>[PART.frontLeg,PART.hindLeg,PART.farLeg].includes(B.parts[i] as 2|5|6)),
    baseArea:counts[1]/n,creamArea:(counts[2]+counts[4])/n,secondaryArea:counts[3]/n,
    pin:[lineObservation(PATTERN_ROUTES[0]),lineObservation(PATTERN_ROUTES[1])],
    side:[lineObservation(PATTERN_ROUTES[2]),lineObservation(PATTERN_ROUTES[3])],
    drips:plan.shapes.drips.filter(readableDrip).length,
    wall:fraction(i=>B.parts[i]===PART.body,i=>!!plan.shapes.wall[i]&&isLight(i)),
    bars:plan.shapes.bars.filter(m=>retained(m,i=>materials[i]===3)).length,
    brokenBars:background.brindle>.88,spots,
    whiteArea:counts[4]/n,headWhite:r.metrics.headWhite/Math.max(1,r.metrics.headSkin),
    meanLuminance:mean/n,baseLuminance:baseN?baseL/baseN:light(p.palette.base),contrast,spotRegions,expression:p.strength,
  };
  const traits:PatternTraits={...background,color,palette,contrast,cream:observation.creamArea,
    dorsal:observation.dorsal,flank:observation.flank,limbs:observation.limbs,spots:{...background.spots,count:spots}};
  return {traits,observation};
}
