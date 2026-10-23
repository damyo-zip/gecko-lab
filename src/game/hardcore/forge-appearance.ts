import {calculatePhenotype,describeCompanionLineage,type RenderInput} from '@/forge';
import {B_ORIGIN_01 as source} from '@/forge/engine/art/b-origin-01';
import {patternlessTones} from '@/forge/engine/patternless';
import {PATTERN_LABELS} from '@/forge/engine/companion-patterns';
import {LOCI,pairKey} from '@/genetics/advanced/loci';
import type {Scores} from '@/genetics/advanced/model';
import type {PatternTraits,PatternName,PatternObservation,LineObservation} from '@/phenotype/model';
import type {Gecko} from './model';

const clamp=(v:number)=>Math.max(0,Math.min(1,v));
/** A render-only projection of old visible values. This creates no Genome,
 * claims no previously unknown alleles and never participates in inheritance. */
function legacyInput(g:Gecko,fire:'up'|'down'):RenderInput {
 const t=g.potential;
 const s:Scores={red:t.redIntensity,orange:t.redIntensity*.65,brightness:t.bodyTone,cream:t.creamCoverage,dorsal:t.dorsalIntensity,flank:t.flankIntensity,harlequin:t.flankIntensity,spots:t.spotDensity,pinstripe:t.dorsalIntensity,contrast:.5};
 const observed=Object.fromEntries(LOCI.map(l=>{const pair=g.genotype.loci[l.id]??(l.id==='cappuccino-complex'&&g.genetics?.unresolvedComplex?.every(a=>a!==null)?g.genetics.unresolvedComplex as readonly[string,string]:null);return[l.id,pair?l.phenotypes[pairKey(pair,l)]:'Normal'];}));
 const lilly=observed['lilly-white']==='Lilly White',ax=observed.axanthic==='Axanthic';
 const expressed={...s,...(ax?{red:0,orange:0}:{}),...(lilly?{cream:.75+s.cream*.25}:{})};
 const traits:PatternTraits={version:1,dorsal:s.dorsal,flank:s.flank,limbs:s.flank,complexity:.5,cream:s.cream,contrast:s.contrast,drippy:0,wall:0,tiger:0,brindle:.5,pin:[s.pinstripe,s.pinstripe],side:[0,0],spots:{count:s.spots*48,size:.25},palette:{base:[100,70,40],secondary:[200,135,70],cream:[255,235,205]},color:ax?'회색':'오렌지'};
 return {phenotype:{inheritedScores:s,genetics:{scores:expressed,geneticMorphs:[],visualClasses:[],environment:{stage:'adult',fire}},traits,observed},seed:g.visualSeed,fire,...(g.genetics?.forge?.extensions?{extensions:g.genetics.forge.extensions}:{})};
}
export function forgeInput(g:Gecko,fire:'up'|'down'='up'):RenderInput {
 return g.genetics?.genome?{phenotype:calculatePhenotype(g.genetics.genome),seed:g.visualSeed,fire,...(g.genetics.forge?.extensions?{extensions:g.genetics.forge.extensions}:{})}:legacyInput(g,fire);
}
const luma=(c:readonly number[])=>c.reduce((s,v,n)=>s+v*[.2126,.7152,.0722][n],0);
const colour=(pixels:Uint8ClampedArray,i:number)=>[pixels[i*4],pixels[i*4+1],pixels[i*4+2]];
function colourName(c:readonly number[]):PatternTraits['color']{
 const max=Math.max(...c),min=Math.min(...c),h=max===min?0:max===c[0]?60*((c[1]-c[2])/(max-min)) :max===c[1]?60*(2+(c[2]-c[0])/(max-min)):60*(4+(c[0]-c[1])/(max-min));
 return max-min<12?'회색':luma(c)<70?'다크':h<18?'레드':h<43?'오렌지':h<75?'옐로':'크림';
}
function projectedLine(coverage:number,ratio:number,length=54,gaps=0):LineObservation{return{coverage,longestRun:Math.round(ratio*length),gapCount:gaps,length};}
const views=new WeakMap<Gecko,{key:string;up?:ForgeView;down?:ForgeView}>();
// Actions clone game records. Reuse unchanged visual inputs across those clones,
// with a bounded cache rather than retaining every animal ever seen in a season.
const recentViews=new Map<string,ForgeView>();
const MAX_RECENT_VIEWS=64;
type Description=ReturnType<typeof describeCompanionLineage>;
export interface ForgeView {input:RenderInput;description:Description;traits:PatternTraits;observation:PatternObservation;names:PatternName;whiteCoverage:number;legacyProjection:boolean}
/** Measures the same native result that is painted by every gameplay surface. */
export function forgeView(g:Gecko,fire:'up'|'down'='up'):ForgeView|null {
 if(!g.genetics?.forge)return null;
 const key=JSON.stringify([g.genetics.genome,g.genetics.forge,g.genetics.unresolvedComplex,g.genotype,g.potential,g.visualSeed]);
 let cached=views.get(g);if(cached?.key===key&&cached[fire])return cached[fire]!;
 if(!cached||cached.key!==key){cached={key};views.set(g,cached);}
 const visualKey=fire+'|'+key,previous=recentViews.get(visualKey);
 if(previous){recentViews.delete(visualKey);recentViews.set(visualKey,previous);cached[fire]=previous;return previous;}
 const input=forgeInput(g,fire),d=describeCompanionLineage(input),r=d,p=d.parameters;
 // Gameplay paints the flattened approved pixels. Debug layers are large and
 // remain available through the pure renderer, outside this presentation cache.
 d.sprite={...d.sprite,layers:[]};
 const skin=r.pigment.skin.resolved,tones=patternlessTones(skin),white=patternlessTones(r.pigment.white),veil=p.lilly?r.veilMetrics.strength:0;
 const side:number[]=[],body:number[]=[],dorsal:number[]=[],limbs:number[]=[];
 for(let i=0;i<9216;i++)if(source.foreground[i]&&!source.protection[i]){if([3,4].includes(source.labels[i]))side.push(i);if(source.labels[i]!==1)body.push(i);if(source.labels[i]===2)dorsal.push(i);if([5,6].includes(source.labels[i]))limbs.push(i);}
 const tone=(i:number)=>source.shading[i]===1?'highlight':source.shading[i]===3?'shadow':'base';
 const litSkin=(i:number)=>tones[tone(i)].map((v,c)=>Math.round(v+(white[tone(i)][c]-v)*veil));
 const contrast=(i:number)=>Math.hypot(...colour(r.sprite.pixels,i).map((v,c)=>v-litSkin(i)[c]));
 const whitePixel=(i:number)=>{const c=colour(r.sprite.pixels,i).map(v=>source.shading[i]===1?(v-255*.18)/.82:source.shading[i]===3?v/.72:v);return Math.min(...c)>=205&&Math.max(...c)-Math.min(...c)<=55;};
 const fraction=(a:number[],f:(i:number)=>boolean)=>a.length?a.filter(f).length/a.length:0;
 const baseArea=fraction(side,i=>r.visibleTricolorMaterials[i]===1&&!whitePixel(i)),whiteCoverage=fraction(body,whitePixel);
 const rails=r.pinMetrics.rails.map(a=>projectedLine(a.coverage,a.longestRunRatio,a.total,a.gaps)) as [LineObservation,LineObservation];
 const lateral=projectedLine(r.lateralMetrics.columnCoverage,r.lateralMetrics.longestRun,Math.max(1,r.whitewallMetrics.totalColumns));
 const observation:PatternObservation={dorsal:fraction(dorsal,i=>contrast(i)>=26),flank:r.patternMetrics.lateralCoverage,limbs:r.patternMetrics.legCoverage,
  baseArea,creamArea:p.lilly?whiteCoverage:r.tricolorMetrics.ratios.cream,secondaryArea:r.tricolorMetrics.ratios.orange,pin:rails,side:[lateral,{...lateral}],
  drips:r.lateralMetrics.visiblePortholes,wall:r.whitewallMetrics.coverage,bars:r.patternMetrics.tracks.filter(t=>t.rows>=5).length,brokenBars:r.patternMetrics.stripeClass==='brindle',spots:r.spotMetrics.count};
 const color=p.axanthic?'회색':colourName(skin);
 const traits:PatternTraits={...input.phenotype.traits,color,dorsal:observation.dorsal,flank:observation.flank,limbs:observation.limbs,cream:p.lilly?Math.max(whiteCoverage,p.veilStrength):r.tricolorMetrics.ratios.cream,
  pin:rails.map(a=>a.coverage) as[number,number],side:[lateral.coverage,lateral.coverage],spots:{count:r.spotMetrics.count,size:p.spotSize},palette:{base:skin,secondary:d.tricolorMetrics.meanColours.orange,cream:r.pigment.pattern.resolved}};
 const features=[r.dorsalMetrics.superstripe.qualified?'슈퍼스트라이프':'',r.dorsalMetrics.reverse.qualified?'리버스 핀스트라이프':'',r.lateralMetrics.quad?'쿼드스트라이프':r.pinMetrics.classification==='full'?'풀 핀스트라이프':r.pinMetrics.classification==='none'?'':'파셜 핀스트라이프',
  r.lateralMetrics.classification==='porthole'?'포트홀':'',r.whitewallMetrics.qualified?'화이트월':r.whitewallMetrics.classification==='whiteout'?'화이트아웃':'',r.emptyBackMetrics.clearedPixels?'엠티백':'',r.spotMetrics.count>=32?'고밀도 달마시안':r.spotMetrics.count?'달마시안':'',r.complexMetrics.restricted?'슈퍼·복합폼 잠정':'' ].filter(Boolean);
 const observedExtras=features.filter(f=>['화이트월','화이트아웃','엠티백','포트홀','리버스 핀스트라이프'].includes(f)&&!d.name.includes(f));
 const names:PatternName={primary:[d.name,...observedExtras].join(' · '),base:PATTERN_LABELS[r.patternMetrics.classification],color,features,rulesVersion:1};
 const value={input,description:d,traits,observation,names,whiteCoverage,legacyProjection:!g.genetics.genome};cached[fire]=value;recentViews.set(visualKey,value);
 if(recentViews.size>MAX_RECENT_VIEWS)recentViews.delete(recentViews.keys().next().value!);
 return value;
}
