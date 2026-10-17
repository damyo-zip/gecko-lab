import {PART,artColor} from '@/engine/art';
import {compositeLayers} from '@/engine/composite';
import {paint,mix,type RGB} from '@/engine/raster';
import {randomFor} from '@/engine/random';
import {patternAnchors,patternScore} from '@/engine/patterns';
import {patternTraits} from '@/genetics/advanced/pattern-traits';
import {anatomy as A,sourceBase as B} from '@/engine/regional/anatomy';
import {regionalPhenotype,regionalAppearance,type RegionalInput} from '@/engine/regional';
import type {SpriteResult} from '@/engine/model';
import {renderAuthored} from './authored';
import {authoredSubject} from './subject';
import {CANDIDATES,type CandidateId,type CandidatePolicy,type ComparisonId} from './policies';

const unit=(v:number)=>Math.max(0,Math.min(1,v));
const lum=(c:RGB)=>c[0]*.30+c[1]*.59+c[2]*.11;
/** Reuse the authored per-pixel value clusters. No neighbor averaging, procedural
 * replacement illumination, alpha wash or post-image gray filter. White and
 * dark pigments get their own discrete source-value ramps. */
function shade(material:RGB,i:number,neutral:boolean,white:boolean,fire:'up'|'down'):RGB {
 const source=artColor(B.details[i]),offset=(lum(source)-145)/120;
 const shadow:RGB=neutral?[19,20,25]:white?[130,122,109]:[52,29,24];
 const highlight:RGB=neutral?[246,247,251]:[255,247,222];
 // White is a material midtone, not an already clipped highlight. Starting at
 // RGB 254 flattened every authored bright cluster into the same white pixel.
 const midtone=white?mix(material,neutral?[180,184,193]:[184,172,154],.38):material;
 const c=fire==='down'?mix(midtone,neutral?[192,196,203]:[228,214,189],.18):midtone;
 return offset<0?mix(c,shadow,Math.min(.70,-offset*.60)):mix(c,highlight,Math.min(.65,offset*.65));
}
function candidate(input:RegionalInput,policy:CandidatePolicy):SpriteResult {
 const p=regionalPhenotype(input.genome),v=p.strength,e=p.expressed,fire=input.fire??'up';
 const subject=authoredSubject(input),original=renderAuthored(subject);
 // The normal control is a hard contract, not an approximation or a new tint.
 if(!Object.values(e).some(Boolean))return {...original,version:'authored-candidate-'+policy.id.toLowerCase()+'-1'};
 const a=subject.appearance,t=a.patterns!;
 if(e.lilly&&policy.id!=='A'){
  // Existing polygenic scores, without the historical fixed Lilly coverage floor.
  // This is a lab interpretation of the same genome, never an allele edit.
  const background=patternTraits({...input.genome,mendelian:{version:1,loci:{'lilly-white':['n','n'],axanthic:['A','A'],'cappuccino-complex':['n','n']}}});
  a.patterns={...t,dorsal:unit(background.dorsal*.22+.25+v.lilly*.65),flank:unit(background.flank*.16+.10+v.lilly*.74),limbs:unit(.12+v.lilly*.80)};
 }
 const palette={...a.patterns!.palette};
 if(e.cappuccino){palette.base=mix(palette.base,[94,58,38],policy.cappTint*(.40+v.cappuccino*.60));palette.secondary=mix(palette.secondary,[60,38,29],policy.cappTint);}
 if(e.sable){palette.base=mix(palette.base,[55,36,31],policy.sableTint*(.45+v.sable*.55));palette.secondary=mix(palette.secondary,[43,30,28],policy.sableTint);}
 a.patterns={...a.patterns!,palette};
 const r=renderAuthored(subject),layers=r.layers;
 const da=patternAnchors(input.seed,'dorsal'),fa=patternAnchors(input.seed,'flank');
 const rng=randomFor(input.seed,'art-candidate:crown');
 const crowns=[[23,19],[32,19],[41,25],[52,30],[63,33],[73,36]].map(([x,y])=>({x:x+(rng()-.5)*4,y:y+(rng()-.5)*3,rx:2+rng()*3,ry:1.3+rng()*2}));
 const gray=108+(p.scores.brightness-.5)*170*policy.axRange;
 const white:RGB=e.axanthic?[242,243,247]:[254,246,224];
 const tailDark:RGB=e.axanthic?[21,22,28]:[65,40,31];
 for(let i=0;i<9216;i++){
  if(!A.skin[i])continue;
  const part=B.parts[i],head=part===PART.head,torso=part===PART.body,tail=part===PART.tail;
  const x=i%96,y=Math.floor(i/96),depth=A.dorsalDepth[i];
  const field=unit(Math.min(patternScore(x,y,da).score/1.45,patternScore(x,y,fa).score/1.40));
  let material:RGB|undefined,isWhite=false;
  if(e.axanthic){
   // Distinct inherited base/dark/light pigments, each retaining authored relief.
   const planLayer=layers[5].mask[i]?layers[5]:layers[4],source=planLayer.mask[i]?planLayer.pixels:r.pixels;
   const l=source[i*4]*.30+source[i*4+1]*.59+source[i*4+2]*.11;
   const value=l>171?222:l<73?30:gray;
   material=[value,value+1,Math.min(255,value+5)];isWhite=l>171;
  }
  if(e.cappuccino&&tail){
   const progress=A.tailProgress[i],edge=(field-.4)*.025;
   if(progress<.035+v.cappuccino*policy.tailBase+edge){material=white;isWhite=true;}
   if(progress>.97-v.cappuccino*policy.tailTip+edge){material=tailDark;isWhite=false;}
  }
  if(e.highway&&torso){
   const reach=(.04+v.highway*policy.highwayReach)*(.92+.08*Math.sin(x*.46+field*3));
   if(x>=44&&x<=81&&depth<reach*1.4){material=white;isWhite=true;}
   else if(depth>=.55&&field<v.highway*policy.sideReduction){material=e.axanthic?[gray,gray+1,gray+5]:palette.base;isWhite=false;}
  }
  if(e.sable&&(head||torso)){
   const cluster=Math.min(...crowns.map(c=>Math.hypot((x-c.x)/c.rx,(y-c.y)/c.ry)));
   const reach=(.28+v.sable*.86)*policy.crown;
   if(cluster<reach&&(policy.id!=='A'||head&&y<24)){material=white;isWhite=true;}
  }
  if(e.lilly){
   const faceStrength=unit((v.lilly-policy.faceStart)/(1-policy.faceStart));
   const barrier=.12+unit((40-x)/34)*.53+unit((y-21)/18)*.17+field*.09;
   if(head&&barrier<faceStrength*policy.faceReach){material=white;isWhite=true;}
   else if(policy.bodyWhite>0&&v.lilly>.55&&torso&&field<(v.lilly-.55)*policy.bodyWhite*1.9&&!(field<.12&&x>57)){
    material=white;isWhite=true;
   }
  }
  if(!material)continue;
  // The upper flank layer otherwise hides parts of a dorsal material edit.
  // Keep spots and crest details above this material, as in the original stack.
  const layer=head?layers[7]:layers[5];
  layer.mask[i]=255;paint(layer.pixels,i,shade(material,i,e.axanthic,isWhite,fire));
 }
 // Global palette edits must not recolor the original eye, nose, mouth or ink.
 for(let i=0;i<9216;i++)if(A.protectedPixels[i]){
  layers[7].mask[i]=255;layers[7].pixels.set(original.pixels.subarray(i*4,i*4+4),i*4);
 }
 return {...r,layers,pixels:compositeLayers(layers),version:'authored-candidate-'+policy.id.toLowerCase()+'-1'};
}

const cache=new Map<string,SpriteResult>();
/** LAB ONLY. Never selected by production renderSprite or stored on a Gecko. */
export function renderComparison(input:RegionalInput,id:ComparisonId):SpriteResult {
 const key=JSON.stringify([id,input.genome,input.seed,input.fire??'up']);const prior=cache.get(key);
 if(prior){cache.delete(key);cache.set(key,prior);return prior;}
 let result:SpriteResult;
 if(id==='regional')result=regionalAppearance(input).sprite;
 else if(id==='authored')result=renderAuthored(authoredSubject(input));
 else result=candidate(input,CANDIDATES.find(p=>p.id===id as CandidateId)!);
 cache.set(key,result);if(cache.size>60)cache.delete(cache.keys().next().value!);
 return result;
}
export const comparisonCacheSize=()=>cache.size;
