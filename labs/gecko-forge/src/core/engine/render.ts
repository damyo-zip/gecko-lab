import {createBaseSprite,PART,artColor} from "./art";
import {ENGINE_VERSION,PATTERN_ENGINE_VERSION,LAYER_ORDER,PIXEL_COUNT,validateSpecimen,type GeckoSpecimen,type LayerName,type SpriteLayer,type SpriteResult} from "./model";
import {compositeLayers} from "./legacy/render";
import {randomFor} from "./random";
import {ellipse,mix,paint,type RGB} from "./raster";
import {patternAnchors,patternScore} from "./patterns";
import {buildPatternPlan,isPatternCrest} from "./pattern-plan";
export {compositeLayers};
export {renderSprite as renderLegacySprite} from "./legacy/render";
const BASE=createBaseSprite();
const luminance=(c:RGB)=>c[0]*.3+c[1]*.59+c[2]*.11;
function colorsFor(specimen:GeckoSpecimen){
 const a=specimen.appearance,e=a.expression,gray=a.bodyColor==="slate";
 const fire=(c:RGB):RGB=>specimen.state.fire==="up"?c:mix(mix(c,[luminance(c),luminance(c),luminance(c)],.18),[235,220,195],.18);
 const baseColor:RGB=a.bodyColor==="brown"?[117,73,46]:a.bodyColor==="cream"?[208,170,125]:gray?[103,103,119]:[211,129,58];
 let body=a.patterns?.palette.base??baseColor;
 if(e&&!gray&&!a.patterns){body=mix(body,[219,83,55],e.red*.5);body=mix(body,[235,158,65],e.orange*.22);body=mix(body,e.brightness>.5?[243,204,149]:[102,65,44],Math.abs(e.brightness-.5)*.35);}
 const tint=(source:RGB):RGB=>{
  const l=luminance(source);let color:RGB=source;
  if(gray)color=[Math.round(l*.83+7),Math.round(l*.83+7),Math.round(l*.88+12)];
  else if(a.bodyColor!=="orange"||e||a.patterns){
   const shade=l/160;
   color=shade<1?mix(body,[59,34,28],Math.min(.78,(1-shade)*.85)):mix(body,[255,235,192],Math.min(.92,(shade-1)*.95));
  }
  return fire(color);
 };
 let cream:RGB=a.patterns?.palette.cream??(gray?[203,199,212]:a.patternStyle==="lilly"?[255,244,217]:[255,218,151]);
 if(e&&!gray)cream=mix(cream,[255,247,222],e.cream*.35);
 // Preserve authored highlight/shadow clusters, but color lids and periocular
 // skin from the same body/cream palette as the rest of this individual.
 const eyeSkin=(source:RGB):RGB=>{
  if(gray)return tint(source);
  const creamWeight=a.patternStyle==="lilly"?.92:a.dorsalCoverage*(a.patternStyle==="normal"?.15:.4);
  return mix(tint(source),fire(patternColor(cream,source)),creamWeight);
 };
 const contrast=e?.contrast??.6;
 return {body:fire(body),tint,eyeSkin,ink:fire(gray?[28,27,38]:[55,31,25]),
  cream:fire(cream),pattern:fire(mix(cream,gray?[124,123,144]:[210,164,110],(1-contrast)*.2)),
  normalPattern:fire(gray?[142,141,157]:[238,164,78]),
  secondary:fire(a.patterns?.palette.secondary??(gray?[60,59,78]:mix([105,54,35],[142,79,41],1-contrast))),spots:fire(gray?[24,24,33]:[54,34,25])};
}
function layer(name:LayerName):SpriteLayer{return {name,mask:new Uint8Array(PIXEL_COUNT),pixels:new Uint8ClampedArray(PIXEL_COUNT*4)};}
function put(l:SpriteLayer,i:number,color:RGB){l.mask[i]=255;paint(l.pixels,i,color);}
function patternColor(base:RGB,source:RGB,gray=false):RGB{
 const offset=(luminance(source)-145)/120;
 return offset<0?mix(base,gray?[30,30,42]:[67,39,28],Math.min(.7,-offset*.6)):
  mix(base,gray?[235,234,246]:[255,246,217],Math.min(.65,offset*.65));
}
/** PNG art provides silhouette, actual pixel clusters and all protected regions.
 * Code only changes palette, anatomical motif coverage and seeded spot clusters. */
export function renderSprite(specimen:GeckoSpecimen,enabled:readonly LayerName[]=LAYER_ORDER):SpriteResult {
 validateSpecimen(specimen);const c=colorsFor(specimen),a=specimen.appearance;
 const layers=LAYER_ORDER.map(layer),[silhouette,body,shadow,highlight,dorsal,flank,spots,details]=layers;
 const dorsalAnchors=patternAnchors(specimen.seed,"dorsal"),flankAnchors=patternAnchors(specimen.seed,"flank");
 const plan=a.patterns?buildPatternPlan(a.patterns,specimen.seed):null;
 for(let y=0;y<96;y++)for(let x=0;x<96;x++){
  const i=y*96+x;if(!BASE.silhouette[i])continue;
  const source=artColor(BASE.details[i]);
  put(silhouette,i,c.ink);
  if(!BASE.outline[i])put(body,i,c.body);
  // Pixels with middle tones keep their authored palette; separate shaded/highlit
  // clusters replace them through masks and remain meaningful layer toggles.
  if(!BASE.outline[i]&&!BASE.shadows[i]&&!BASE.highlights[i])put(body,i,c.tint(source));
  if(BASE.shadows[i])put(shadow,i,c.tint(source));
  if(BASE.highlights[i])put(highlight,i,c.tint(source));
  if(plan){
   if(plan.dorsal[i])put(dorsal,i,patternColor(plan.secondary[i]?c.secondary:c.pattern,source,a.bodyColor==="slate"));
   if(plan.flank[i])put(flank,i,patternColor(plan.secondary[i]?c.secondary:c.pattern,source,a.bodyColor==="slate"));
   if(plan.edges[i])put(flank,i,mix(c.tint(source),c.ink,.32));
   if(plan.pins[i])put(flank,i,patternColor(c.cream,source,a.bodyColor==="slate"));
  }else if(BASE.dorsalRegion[i]){
   const p=patternScore(x,y,dorsalAnchors),pin=a.expression?.pinstripe??0;
   // The authored crest neighborhood supplies a continuous pin stripe channel.
   const back=BASE.parts[i]===PART.body&&y<39+(x-45)*.18;
   if(a.dorsalCoverage>0&&p.score<a.dorsalCoverage*.94||(pin>0&&back&&p.score<pin*.5))put(dorsal,i,patternColor(c.pattern,source,a.bodyColor==="slate"));
  }
  if(!plan&&BASE.flankRegion[i]){
   const p=patternScore(x,y,flankAnchors),coverage=a.flankCoverage;
   const limb=BASE.parts[i]===PART.frontLeg||BASE.parts[i]===PART.hindLeg;
   const growth=a.patternStyle==="lilly"?.94:limb?.72+(a.expression?.harlequin??.5)*.18:.72;
   if(coverage>0&&p.score<coverage*growth){
    const light=a.patternStyle!=="normal"&&!(a.patternStyle==="tricolor"&&p.secondary);
    const pigment=a.patternStyle==="normal"&&!p.secondary?c.normalPattern:light?c.pattern:c.secondary;
    const color=patternColor(pigment,source,a.bodyColor==="slate");
    put(flank,i,a.patternStyle==="normal"?mix(c.tint(source),color,.75):color);
   }
  }
  // Outline, eye/face and crest are always painted last and cannot be covered.
  if(BASE.outline[i])put(details,i,c.ink);
  else if(BASE.face[i]){
   put(details,i,BASE.eye[i]?source:BASE.eyeSurround[i]?c.eyeSkin(source):c.tint(source));
  }else if(BASE.crest[i]&&(!plan||isPatternCrest(i)))put(details,i,c.cream);
 }
 if(plan){for(let i=0;i<PIXEL_COUNT;i++)if(plan.spots[i]){spots.mask[i]=255;paint(spots.pixels,i,c.spots);}}
 else{
 const rng=randomFor(specimen.seed,"art-v2:spots"),centers:{x:number;y:number;radius:number}[]=[];
 for(let tries=0;tries<14000&&centers.length<a.spotCount;tries++){
  const x=4+Math.floor(rng()*88),y=10+Math.floor(rng()*78),radius=rng()<.73?1:1.7,i=y*96+x;
  if(!BASE.spotRegion[i]||[i-1,i+1,i-96,i+96].some(n=>!BASE.spotRegion[n]))continue;
  if(centers.some(s=>(s.x-x)**2+(s.y-y)**2<(s.radius+radius+1.1)**2))continue;
  centers.push({x,y,radius});
 }
 for(const s of centers)ellipse(spots.mask,s.x,s.y,s.radius,s.radius);
 for(let i=0;i<PIXEL_COUNT;i++){if(!BASE.spotRegion[i])spots.mask[i]=0;if(spots.mask[i])paint(spots.pixels,i,c.spots);}
 }
 return {width:96,height:96,layers,pixels:compositeLayers(layers,enabled),version:plan?PATTERN_ENGINE_VERSION:ENGINE_VERSION};
}
