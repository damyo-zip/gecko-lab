import {B_ORIGIN_01 as source} from '@/forge/engine/art/b-origin-01';
import {forgeView} from './forge-appearance';
import type {Gecko,Embryo} from './model';
import type {CurrentChallengeId} from './challenge-rules';

export interface ChallengeCheck {label:string;value:number;minimum:number;maximum?:number;passed:boolean}
const lum=(c:readonly number[])=>c[0]*.2126+c[1]*.7152+c[2]*.0722;
function colour(c:number[]){
 const max=Math.max(...c),min=Math.min(...c),delta=max-min;
 const hue=delta?((max===c[0]?(c[1]-c[2])/delta:max===c[1]?2+(c[2]-c[0])/delta:4+(c[0]-c[1])/delta)*60+360)%360:0;
 return {rgb:c,l:lum(c),h:hue,s:max?delta/max:0,white:min>=200&&delta<=60};
}
/** Native visible pixels, fired up, with authored lighting undone once. Eyes,
 * outlines and spot pixels never contribute to body/pattern colour coverage. */
function measure(g:Gecko){
 const v=forgeView(g);if(!v||!g.genetics?.genome)return null;
 const d=v.description,pixels=d.sprite.pixels;
 const c=(i:number)=>colour([0,1,2].map(n=>Math.max(0,Math.min(255,source.shading[i]===1?(pixels[i*4+n]-255*.18)/.82:source.shading[i]===3?pixels[i*4+n]/.72:pixels[i*4+n]))));
 const body:number[]=[],side:number[]=[],spots:number[][]=[];
 for(let i=0;i<9216;i++){
  if(!source.foreground[i]||source.protection[i]||!pixels[i*4+3])continue;
  if(d.spotMask[i])continue;
  body.push(i);if(source.labels[i]===3||source.labels[i]===4)side.push(i);
 }
 const visited=new Set<number>();
 for(let i=0;i<9216;i++)if(d.spotMask[i]&&!visited.has(i)){
  const ids=[i];visited.add(i);
  for(let n=0;n<ids.length;n++)for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
   const x=ids[n]%96+dx,y=Math.floor(ids[n]/96)+dy,j=y*96+x;
   if(x>=0&&x<96&&y>=0&&y<96&&d.spotMask[j]&&!visited.has(j)){visited.add(j);ids.push(j);}
  }spots.push(ids);
 }
 const all=new Map(body.map(i=>[i,c(i)]));
 const fraction=(ids:number[],test:(x:ReturnType<typeof colour>,i:number)=>boolean)=>ids.length?ids.filter(i=>test(all.get(i)!,i)).length/ids.length:0;
 const visibleSpots=spots.filter(ids=>ids.some(i=>{
  if(c(i).l>70)return false;
  for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){
   const x=i%96+dx,y=Math.floor(i/96)+dy,j=y*96+x;
   if(x>=0&&x<96&&y>=0&&y<96&&all.has(j)&&all.get(j)!.l-c(i).l>=18)return true;
  }return false;
 }));
 const regions=[1,3,7].map(label=>visibleSpots.filter(ids=>ids.some(i=>label===3?[2,3,4].includes(source.labels[i]):source.labels[i]===label)).length);
 const isRed=(x:ReturnType<typeof colour>)=>(x.h<=18||x.h>=350)&&x.s>=.35&&x.l>=60&&x.l<=200;
 const isOrange=(x:ReturnType<typeof colour>)=>x.h>=18&&x.h<=48&&x.s>=.4&&x.l>=80;
 const isCream=(x:ReturnType<typeof colour>)=>x.white||(x.h>=18&&x.h<=70&&x.s<.4&&x.l>=165);
 const dark=side.filter(i=>!all.get(i)!.white),light=side.filter(i=>all.get(i)!.white);
 const mean=(ids:number[])=>ids.length?ids.reduce((s,i)=>s+all.get(i)!.l,0)/ids.length:0;
 const exposed=(x:ReturnType<typeof colour>,i:number)=>d.visibleTricolorMaterials[i]===1&&!d.pinMask[i]&&!d.whiteMask[i]&&!d.superStripeBandMask[i];
 const orangeIds=side.filter(i=>isOrange(all.get(i)!)),creamIds=side.filter(i=>isCream(all.get(i)!)),baseIds=side.filter(i=>exposed(all.get(i)!,i));
 const meanRGB=(ids:number[])=>[0,1,2].map(n=>ids.length?ids.reduce((s,i)=>s+all.get(i)!.rgb[n],0)/ids.length:0);
 const means=[meanRGB(baseIds),meanRGB(orangeIds),meanRGB(creamIds)];
 const threeColourDistance=baseIds.length&&orangeIds.length&&creamIds.length?Math.min(...[[0,1],[0,2],[1,2]].map(([a,b])=>Math.hypot(...means[a].map((x,n)=>x-means[b][n])))):0;
 const orangeContrast=orangeIds.length&&baseIds.length?mean(orangeIds)-mean(baseIds):0;
 const stripes=body.filter(i=>d.visibleStripeMask[i]&&lum(d.pigment.skin.resolved)-all.get(i)!.l>=25);
 return {v,threeColourDistance,orangeContrast,spots:visibleSpots.length,regions,white:fraction(body,x=>x.white),sideWhite:fraction(side,x=>x.white),
  sideDark:fraction(side,x=>x.l<=75),sideShade:fraction(side,x=>x.l<=190),contrast:light.length&&dark.length?mean(light)-mean(dark):0,
  redBody:fraction(side,(x,i)=>exposed(x,i)&&isRed(x)),redSide:fraction(side,(x,i)=>exposed(x,i)&&isRed(x)),
  orange:fraction(side,isOrange),cream:fraction(side,isCream),darkBase:fraction(side,(x,i)=>exposed(x,i)&&x.l<=100),
  gold:fraction(side,(x,i)=>exposed(x,i)&&x.h>=35&&x.h<=70&&x.s>=.35&&x.l>=95&&x.l<=210),
  warmShade:fraction(side,x=>x.h>=10&&x.h<=75&&x.s>=.08&&x.l>=80&&x.l<=205&&!x.white),
  stripeArea:stripes.length/(body.length||1),bars:d.patternMetrics.tracks.filter(t=>t.rows>=5).length};
}

const observations=new WeakMap<object,NonNullable<ReturnType<typeof measure>>>();
export function challengeObservation(g:Gecko){
 const view=forgeView(g);if(!view||!g.genetics?.genome)return null;
 let result=observations.get(view);if(!result){result=measure(g)!;observations.set(view,result);}return result;
}

/** Frozen evaluator v3. Labels and the goal UI share these exact checks. */
function evaluate(g:Gecko,id:CurrentChallengeId){
 const o=challengeObservation(g),checks:ChallengeCheck[]=[];
 const check=(label:string,value:number,minimum:number,maximum?:number)=>checks.push({label,value,minimum,...(maximum===undefined?{}:{maximum}),passed:Number.isFinite(value)&&value>=minimum&&(maximum===undefined||value<=maximum)});
 if(!o)return {passed:false,checks:[{label:'현재 외형 관찰 가능',value:0,minimum:1,passed:false}]};
 const d=o.v.description,p=d.parameters;
 check('생존 가능한 발현',(g as Embryo).development?.viable===false||d.complexMetrics.restricted?0:1,1);
 const ordinary=()=>check('릴리·아잔틱·복합 발현 없음',!p.lilly&&!p.axanthic&&!p.cappuccinoCopies&&!p.sableCopies&&!p.highwayCopies?1:0,1);
 const distributed=()=>{check('선명한 검은 점',o.spots,40);['머리','몸','꼬리'].forEach((name,n)=>check(name+'의 검은 점',o.regions[n],3));};
 switch(id){
  case 'lilly-dalmatian':check('릴리화이트 발현',p.lilly?1:0,1);check('베일 발현',d.veilMetrics.strength,.90);check('흰색 면적',o.white,.60);distributed();break;
  case 'halloween':ordinary();check('어두운 옆구리 면적',o.sideDark,.18);check('주황 옆무늬 면적',o.orange,.25);check('크림 옆무늬 면적',o.cream,0,.15);check('바탕·주황 밝기 차이',o.orangeContrast,40);break;
  case 'red-tricolor':ordinary();check('할리퀸 옆무늬 면적',d.patternMetrics.lateralCoverage,.45);check('붉은 바탕 면적',o.redSide,.12);check('주황 면적',o.orange,.16);check('크림 면적',o.cream,.16);check('삼색 구별',o.threeColourDistance,35);break;
  case 'sable-lilly':check('세이블·릴리화이트 발현',p.sableCopies===1&&!p.highwayCopies&&!p.cappuccinoCopies&&p.lilly&&!p.axanthic?1:0,1);check('짙은 옆구리 면적',o.sideShade,.10);check('화이트 옆구리 면적',o.sideWhite,.25);check('밝고 어두운 부분의 차이',o.contrast,45);break;
  case 'gold-tiger':ordinary();check('황금색 바탕 면적',o.gold,.40);check('타이거 줄무늬',d.patternMetrics.stripeClass==='tiger'?1:0,1);check('길이 5픽셀 이상 세로 무늬',o.bars,3);check('선명한 어두운 줄 면적',o.stripeArea,.04);break;
  case 'red-superdalmatian':ordinary();check('붉은 바탕 면적',o.redBody,.55);distributed();break;
  case 'frappuccino':check('카푸치노·릴리화이트 발현',p.cappuccinoCopies===1&&p.lilly&&!p.sableCopies&&!p.highwayCopies&&!p.axanthic?1:0,1);check('커피빛 옆구리 면적',o.warmShade,.10);check('밀크빛 옆구리 면적',o.sideWhite,.25);check('밝고 어두운 부분의 차이',o.contrast,30);break;
  case 'tricolor-superstripe':ordinary();check('연결·대비를 갖춘 슈퍼스트라이프',d.dorsalMetrics.superstripe.qualified?1:0,1);check('풀 핀스트라이프',d.pinMetrics.classification==='full'?1:0,1);check('어두운 바탕 면적',o.darkBase,.12);check('주황 면적',o.orange,.15);check('크림 면적',o.cream,.15);check('삼색 구별',o.threeColourDistance,35);break;
 }
 return {passed:checks.every(c=>c.passed),checks};
}

// Historical egg evidence is immutable across cloned actions. Cache only the
// compact verdict, never a sprite or a game, to keep trophy-heavy saves cheap.
const verdicts=new Map<string,ReturnType<typeof evaluate>>();
export function inspectChallenge(g:Gecko,id:CurrentChallengeId):ReturnType<typeof evaluate>{
 const key=JSON.stringify([3,id,g.visualSeed,g.genetics?.genome,g.genetics?.forge,(g as Embryo).development?.viable]);
 const previous=verdicts.get(key);if(previous){verdicts.delete(key);verdicts.set(key,previous);return previous;}
 const result=evaluate(g,id);verdicts.set(key,result);if(verdicts.size>512)verdicts.delete(verdicts.keys().next().value!);return result;
}
