import type {Point} from '@/engine/raster';
/** Full-pose art direction, drawn in B's native coordinates. No random contours,
 * stamp selection, detached fragment placement or neutral repainting. Polygon
 * vertices describe complete designed boundaries; the compiler freezes them
 * into 96×96 indexed maps. Original B pixels remain the canvas underneath. */
export const FAMILIES=[
 {id:'narrow',label:'좁은·분리형',coverage:.12,connection:.20},
 {id:'classic',label:'B 기본 흐름형',coverage:.34,connection:.50},
 {id:'broad',label:'넓은·창문형',coverage:.85,connection:.45},
 {id:'flow',label:'연결·등줄기형',coverage:.65,connection:.92},
] as const;
export type FamilyId=typeof FAMILIES[number]['id'];
export const MORPH_FAMILIES=[{id:'normal',label:'노멀'},{id:'lilly',label:'릴리화이트'},{id:'axanthic',label:'아잔틱'},{id:'cappuccino',label:'카푸치노'},{id:'highway',label:'하이웨이'},{id:'sable',label:'세이블'}] as const;
export type ArtMorph=typeof MORPH_FAMILIES[number]['id'];
export type Cadence='a'|'b';
export type Ink=0|1|2|3|4;
export interface Stroke {ink:Ink;path:readonly Point[];region:'body'|'tail'|'head'|'limbs';creamOnly?:boolean}
const stroke=(ink:Ink,region:Stroke['region'],path:readonly Point[],creamOnly=false):Stroke=>({ink,region,path,creamOnly});

// These are whole flank/back contours, deliberately following the original
// long cream edge and brown windows. They are not scattered little ornaments.
const sideBay:readonly Point[]=[[33,36],[44,37],[53,39],[66,41],[73,45],[70,50],[57,51],[44,46],[35,43]];
const broadSide:readonly Point[]=[[31,33],[38,34],[41,37],[46,35],[52,37],[55,36],[61,39],[67,39],[74,44],[71,49],[67,48],[65,51],[60,49],[56,50],[52,47],[47,48],[44,45],[40,45],[38,42],[34,41]];
const flowingBack:readonly Point[]=[[31,28],[38,29],[44,30],[48,29],[54,32],[59,32],[65,34],[70,35],[77,41],[75,45],[71,43],[68,42],[64,40],[61,40],[57,37],[53,38],[50,35],[46,36],[42,33],[38,34],[33,32]];
const backWindow:readonly Point[]=[[42,37],[45,37],[48,39],[47,43],[44,43],[42,41]];
const hipWindow:readonly Point[]=[[59,42],[63,42],[66,45],[64,48],[61,47],[59,45]];
const neckWindow:readonly Point[]=[[33,34],[36,34],[39,36],[38,39],[35,39]];
const tailFlow:readonly Point[]=[[77,43],[82,45],[88,52],[91,60],[91,66],[87,72],[83,75],[78,78],[69,80],[61,78],[55,75],[51,70],[53,68],[57,73],[63,76],[69,77],[77,75],[83,71],[86,65],[86,59],[83,52],[79,49]];

export function authoredPlan(morph:ArtMorph,family:FamilyId,cadence:Cadence):Stroke[]{
 const out:Stroke[]=[];
 // Each family is a complete layout relative to the original authored B.
 if(family==='narrow')out.push(stroke(1,'body',[[38,34],[44,35],[47,37],[45,42],[41,42],[38,39]],true),stroke(1,'body',[[53,38],[61,39],[66,43],[64,47],[58,47],[55,44]],true));
 if(family==='broad')out.push(stroke(2,'body',broadSide),stroke(0,'body',backWindow),stroke(0,'body',hipWindow),stroke(0,'body',neckWindow));
 if(family==='flow')out.push(stroke(2,'body',flowingBack),stroke(2,'body',[[37,33],[41,34],[44,36],[48,37],[53,38],[57,37],[62,39],[66,41],[67,44],[63,44],[60,42],[56,42],[53,44],[49,42],[46,41],[43,39],[39,38]]),stroke(0,'body',backWindow),stroke(2,'tail',tailFlow));
 if(morph==='lilly'){
  // Source cream is converted to white by the compiler; these contours extend
  // the ORIGINAL cream edge rather than replacing the pose with a white sheet.
  if(family==='narrow')out.push(stroke(4,'body',[[34,41],[42,43],[47,43],[52,46],[58,46],[64,48],[68,47],[68,50],[60,52],[51,49],[42,47],[35,44]]));
  if(family==='classic')out.push(stroke(4,'body',[[32,38],[38,39],[42,41],[47,39],[53,41],[57,40],[65,43],[69,44],[70,49],[65,50],[61,48],[57,50],[52,47],[48,48],[43,45],[38,44],[34,42]]),stroke(0,'body',backWindow));
  if(family==='broad'||family==='flow'){
   out.push(stroke(4,'body',broadSide),stroke(1,'body',backWindow),stroke(1,'body',hipWindow));
   out.push(stroke(4,'limbs',[[26,39],[39,42],[45,50],[40,58],[29,59],[31,53],[35,48],[30,44]]));
   out.push(stroke(4,'limbs',[[63,47],[71,48],[78,53],[72,59],[62,60],[65,55],[67,52]]));
  }
  if(family==='flow')out.push(stroke(4,'body',flowingBack),stroke(4,'head',[[7,25],[12,23],[16,20],[24,18],[32,19],[35,24],[33,29],[26,32],[18,33],[8,30]]));
 }
 if(morph==='cappuccino'){
  // Reduce selected side pigment, keep the B back/face and its authored texture.
  if(family==='narrow'||family==='classic')out.push(stroke(1,'body',[[41,38],[56,39],[68,43],[70,49],[58,49],[44,45]],true));
  out.push(stroke(4,'tail',family==='broad'||family==='flow'?[[75,42],[81,43],[87,50],[90,56],[87,61],[84,56],[82,51],[77,49]]:[[77,43],[82,45],[86,49],[85,53],[81,50],[77,49]]));
  out.push(stroke(3,'tail',family==='flow'||family==='broad'?[[50,65],[58,70],[64,75],[70,77],[66,80],[58,78],[53,75],[50,70]]:[[50,65],[55,68],[58,74],[54,74],[51,71]]));
 }
 if(morph==='highway'){
  out.push(stroke(1,'body',sideBay,true));
  // Four authored inner dorsal edges: separated teeth → channel → broad
  // inward scallops → continuous wavy spine. No line/noise field at runtime.
  const edges:Record<FamilyId,readonly Point[]>={
   narrow:[[33,29],[42,30],[46,32],[45,34],[41,33],[38,34],[34,32]],
   classic:[[32,29],[41,30],[46,31],[52,32],[56,34],[62,34],[69,38],[75,41],[73,44],[68,41],[63,40],[59,37],[55,38],[51,35],[46,36],[42,33],[37,34],[33,32]],
   broad:[[31,28],[43,30],[48,30],[56,32],[63,33],[71,37],[77,42],[73,47],[68,43],[64,44],[60,40],[56,42],[51,38],[47,40],[42,36],[37,37],[33,33]],
   flow:flowingBack,
  };
  out.push(stroke(4,'body',edges[family]));
  if(family==='narrow')out.push(stroke(4,'body',[[54,33],[61,34],[68,37],[70,40],[66,39],[62,37],[57,37]]));
  if(family==='flow')out.push(stroke(4,'tail',tailFlow));
 }
 if(morph==='sable'){
  // Crown follows the original crest; flank windows are retained. Cappuccino
  // tail markers are intentionally not used for Sable.
  out.push(stroke(4,'head',family==='narrow'?[[25,18],[29,18],[32,20],[29,22],[26,21]]:[[23,17],[28,17],[33,19],[35,22],[31,23],[29,21],[26,22],[24,20]]));
  out.push(stroke(4,'body',family==='narrow'?[[38,31],[41,31],[44,33],[42,35],[39,34]]:flowingBack));
  if(family==='broad'||family==='flow')out.push(stroke(4,'body',broadSide),stroke(1,'body',backWindow),stroke(1,'body',hipWindow));
  if(family==='classic')out.push(stroke(4,'body',[[51,35],[55,35],[59,38],[58,41],[55,42],[52,39]]));
 }
 // Second complete drawing: a different pair of large windows and a stepped
 // neck connection. Whole-map cadence is selected once, never per body part.
 if(cadence==='b'){
  out.push(stroke(morph==='lilly'||morph==='highway'||morph==='sable'?4:2,'body',[[35,32],[39,33],[43,36],[45,40],[43,43],[41,41],[40,38],[37,36],[34,35]]));
  out.push(stroke(1,'body',[[53,39],[55,39],[57,42],[56,46],[54,45],[53,42]],true));
 }
 return out;
}
