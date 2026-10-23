import { B_ORIGIN_01 as source } from './art/b-origin-01';
import { PINSTRIPE_RAILS } from './art/pinstripe-rails';
import { CAPPUCCINO_TAIL } from './art/cappuccino-tail';
import { renderCompanionBase } from './companion-base';
import { renderCompanionDorsal, companionDorsalParameters, buildDorsalDetails, type CompanionDorsalParameters } from './companion-dorsal';
import { EMPTYBACK_DORSAL_DOMAIN } from './companion-emptyback';
import { PATTERN_LABELS, classifyCompanionPatterns } from './companion-patterns';
import { veilTraits } from './morph-extensions';
import { veilDensity, veilStrengthFromDensity } from './veil-genetics';
import { validateLillyVeil } from './companion-lilly-veil';
import { patternlessTones, type Rgb } from './patternless';
import { seededRandom, LOCI, pairKey } from './genetics';
import type { AppearanceRenderer, RenderInput } from './model';
import type { SpriteResult, SpriteLayer } from '@/engine/model';

export const COMPANION_LINEAGE_RENDERER_ID = 'b-origin-01-companion-lineage-1' as const;
export const COMPANION_LINEAGE_MODEL = { version: 1, stage: 'adult',
  complex: 'Existing provisional C/S/H allelic locus, unchanged inheritance and viability. Sable and Highway are not extra independent genes.',
  veil: 'Six game-only inherited modifier pairs; active on heterozygous Lilly, carried silently by non-Lilly animals. Cosmetic overrides are not inherited.',
  references: ['https://omnigeckos.com/highway/','https://lmreptiles.com/fg-supersable/','https://www.ibexotic.com/post/what-is-the-sable-morph-and-how-does-it-affect-crested-geckos'],
  limits: 'Adult material expression on the same native silhouette. No raised scales, ageing, medical prediction or invented survival probabilities.' } as const;
export interface CompanionLineageParameters extends CompanionDorsalParameters {
  complexPair: string; sableCopies: 0 | 1 | 2; highwayCopies: 0 | 1 | 2;
  complexExpression: number; complexSeed: number; complexRestricted: boolean;
  inheritedVeilDensity: number | null; inheritedVeilStrength: number | null; veilOverridden: boolean;
}
const N = 9216, roles = renderCompanionBase().materialMask;
type DorsalResult = { [K in keyof ReturnType<typeof renderCompanionDorsal>]: ReturnType<typeof renderCompanionDorsal>[K] };
export interface CompanionLineageResult {
  sprite: SpriteResult;
  patternMetrics: DorsalResult['patternMetrics'];
  pinMetrics: DorsalResult['pinMetrics'];
  spotMetrics: DorsalResult['spotMetrics'];
  veilMetrics: DorsalResult['veilMetrics'];
  whiteMetrics: DorsalResult['whiteMetrics'];
  whitewallMetrics: DorsalResult['whitewallMetrics'];
  lateralMetrics: DorsalResult['lateralMetrics'];
  emptyBackMetrics: DorsalResult['emptyBackMetrics'];
  dorsalMetrics: DorsalResult['dorsalMetrics'];
  tricolorMetrics: DorsalResult['tricolorMetrics'];
  pigment: DorsalResult['pigment'];
  spotMask: DorsalResult['spotMask'];
  pinMask: DorsalResult['pinMask'];
  pinSpreadMask: DorsalResult['pinSpreadMask'];
  forelegRefinementMask: DorsalResult['forelegRefinementMask'];
  whiteMask: DorsalResult['whiteMask'];
  visibleStripeMask: DorsalResult['visibleStripeMask'];
  visibleTricolorMaterials: DorsalResult['visibleTricolorMaterials'];
  emptyBackMask: DorsalResult['emptyBackMask'];
  superStripeBandMask: DorsalResult['superStripeBandMask'];
  superStripeCentreMask: DorsalResult['superStripeCentreMask'];

  complexMask: Uint8Array; complexDorsalMask: Uint8Array; complexCrownMask: Uint8Array; complexTailMask: Uint8Array; complexAlbedo: Uint8ClampedArray;
  complexMetrics: { pair:string;label:string;sable:boolean;highway:boolean;restricted:boolean;expression:number;pixels:number;dorsalPixels:number;crownPixels:number;tailPixels:number;dorsalFill:number;provisional:boolean };
  veilInheritance: {known:boolean;density:number|null;strength:number|null;overridden:boolean;source:string};
}
const mix = (a: Rgb, b: Rgb, t: number) => a.map((v, c) => Math.round(v + (b[c] - v) * t)) as unknown as Rgb;
const rgb = (a: Uint8ClampedArray, i: number) => Array.from(a.slice(i * 4, i * 4 + 3)) as unknown as Rgb;
const lum = (a: Rgb) => a[0] * .2126 + a[1] * .7152 + a[2] * .0722;
const distance = (a: Rgb, b: Rgb) => Math.hypot(...a.map((v, c) => v - b[c]));
const tone = (i: number) => source.shading[i] === 1 ? 'highlight' : source.shading[i] === 3 ? 'shadow' : 'base';
const tail = new Float32Array(N).fill(-1);
for (const [y, x, n, d] of CAPPUCCINO_TAIL.runs) tail.fill(d / CAPPUCCINO_TAIL.maximum, y * 96 + x, y * 96 + x + n);
const spans = Array.from({ length: 96 }, (_, x) => {
  const a = PINSTRIPE_RAILS.rails[0].pixels.filter(i => i % 96 === x).map(i => Math.floor(i / 96)), b = PINSTRIPE_RAILS.rails[1].pixels.filter(i => i % 96 === x).map(i => Math.floor(i / 96));
  return a.length && b.length ? { top: Math.max(...a), bottom: Math.min(...b) } : null;
});
/** Only the private input for the old material adapter is normalised. Actual DNA is never rewritten. */
export function companionLineageParameters(input: RenderInput, override?: number): CompanionLineageParameters {
  if (override !== undefined) validateLillyVeil(override);
  const label = input.phenotype.observed['cappuccino-complex'], locus = LOCI.find(l => l.id === 'cappuccino-complex')!;
  const pair = Object.entries(locus.phenotypes).find(([, v]) => v === label)?.[0];
  if (!pair) throw Error('지원하지 않는 C/S/H 발현입니다.');
  const alleles = pair.split('/'), sableCopies = alleles.filter(a => a === 'S').length as 0 | 1 | 2, highwayCopies = alleles.filter(a => a === 'H').length as 0 | 1 | 2;
  const q = veilDensity(veilTraits(input.extensions)), inheritedVeilStrength = q === null ? null : veilStrengthFromDensity(q);
  const normalized = sableCopies || highwayCopies ? { ...input, phenotype: { ...input.phenotype, observed: { ...input.phenotype.observed, 'cappuccino-complex': 'Normal' } } } : input;
  const p = companionDorsalParameters(normalized, override ?? inheritedVeilStrength ?? undefined), s = input.phenotype.inheritedScores;
  return { ...p, complexPair: pair, sableCopies, highwayCopies, complexRestricted: locus.blocked.includes(pair),
    complexExpression: Math.max(0, Math.min(1, .35 * s.dorsal + .35 * s.cream + .3 * s.pinstripe)),
    complexSeed: Math.floor(seededRandom(input.seed, 'companion:complex-layout:1')() * 0x100000000),
    inheritedVeilDensity: q, inheritedVeilStrength, veilOverridden: override !== undefined };
}
export function renderCompanionLineage(p: CompanionLineageParameters): CompanionLineageResult {
  const locus = LOCI.find(l => l.id === 'cappuccino-complex')!;
  if (!Object.hasOwn(locus.phenotypes, p.complexPair) || pairKey(p.complexPair.split('/') as [string,string], locus) !== p.complexPair || ![0,1,2].includes(p.sableCopies) || ![0,1,2].includes(p.highwayCopies) || p.sableCopies !== p.complexPair.split('/').filter(a=>a==='S').length || p.highwayCopies !== p.complexPair.split('/').filter(a=>a==='H').length) throw Error('C/S/H 사본과 발현이 일치하지 않습니다.');
  if (!Number.isFinite(p.complexExpression) || p.complexExpression < 0 || p.complexExpression > 1 || !Number.isInteger(p.complexSeed) || p.complexSeed < 0 || p.complexSeed > 0xffffffff) throw Error('복합 모프 발현 설정 오류');
  const sable = p.sableCopies > 0, highway = p.highwayCopies > 0, active = sable || highway, strength = p.complexExpression;
  const working = !active ? p : { ...p,
    bodyColor: mix(p.bodyColor, sable ? [49, 45, 44] : [77, 73, 68], sable ? .55 : .42),
    skinBrightness: p.skinBrightness * (sable ? .75 : .86),
    flameStrength: p.flameStrength * (highway ? .22 : .76), legPatternStrength: p.legPatternStrength * (highway ? .30 : .82),
    extremeStrength: p.extremeStrength * (highway ? .20 : .78), tricolorStrength: p.tricolorStrength * (highway ? .30 : .74),
    stripeStrength: p.stripeStrength * (highway ? .18 : .65),
  };
  const base: DorsalResult = renderCompanionDorsal(working);
  const mask = new Uint8Array(N), dorsalMask = new Uint8Array(N), crownMask = new Uint8Array(N), tailMask = new Uint8Array(N), albedo = new Uint8ClampedArray(N * 4);
  const pixels = base.sprite.pixels.slice(), layer: SpriteLayer = { name: 'details', mask, pixels: new Uint8ClampedArray(N * 4) };
  const skin = base.pigment.skin.resolved, suppression = base.pigment.suppression;
  const white = mix(sable ? [250, 237, 213] : [253, 243, 219], [242, 244, 248], suppression);
  const retained = (p.phantomCopies === 2 ? .09 : 1) * (p.emptyBackCopies ? .62 : 1);
  const ink = mix([34, 29, 28], [28, 29, 32], suppression), phase = seededRandom(String(p.complexSeed), 'companion:complex-shapes:1')() * Math.PI * 2;
  const veil = p.lilly ? base.phantomMetrics.whiteVeilRetention : 0, lit = (c: Rgb, i: number) => mix(patternlessTones(c)[tone(i)], patternlessTones(base.pigment.white)[tone(i)], veil);
  if (active) source.foreground.forEach((v, i) => {
    if (!v || source.protection[i] || base.spotMask[i] || base.pinMask[i] || base.pinSpreadMask[i] || base.forelegRefinementMask[i]) return;
    const x = i % 96, y = Math.floor(i / 96), span = spans[x]; let colour: Rgb | undefined;
    if (source.labels[i] === 2 && span && y > span.top && y < span.bottom) {
      const edge = Math.min(y - span.top, span.bottom - y) / Math.max(1, (span.bottom - span.top) / 2);
      // Broad inward tongues with uneven lengths. No random pixel speckling.
      const wave = .74 + .18 * Math.sin(x * .47 + phase) + .08 * Math.sin(x * .21 - phase);
      const reach = (highway ? .20 + 1.14 * strength : .16 + .82 * strength) * wave;
      colour = skin;
      if (edge <= reach) { colour = mix(skin, white, retained); dorsalMask[i] = 255; }
    }
    if (sable && roles[i] === 1 && y <= 29 && (x < 21 || Math.sin(x * .32 + phase) > -.25)) { colour = mix(skin, white, retained * .90); crownMask[i] = 255; }
    if (highway && tail[i] >= 0) {
      const d = tail[i]; colour = d < .56 ? mix(skin, white, retained * .94) : d < .76 ? mix(mix(skin, white, retained * .94), ink, (d - .56) / .20) : ink;
      tailMask[i] = 255;
    }
    if (!colour) return;
    const c = lit(colour, i); albedo.set([...colour, pixels[i * 4 + 3]], i * 4); pixels.set([...c, pixels[i * 4 + 3]], i * 4); layer.pixels.set(pixels.slice(i * 4, i * 4 + 4), i * 4); mask[i] = 255;
  });
  const whiteMask = base.whiteMask.slice(), visibleStripeMask = base.visibleStripeMask.slice(), visibleMaterials = base.visibleTricolorMaterials.slice();
  mask.forEach((v, i) => { if (v) { visibleStripeMask[i] = 0; visibleMaterials[i] = 5; whiteMask[i] = dorsalMask[i] || crownMask[i] || tailMask[i] && tail[i] < .56 ? 255 : 0; } });
  // Freshly covered dorsal tracks cannot retain their previous Tiger/SS/EB goal.
  const ss = base.dorsalMetrics.superstripe, centreColumns = new Set<number>(), allCentre = new Set<number>(); let contrastSum = 0;
  buildDorsalDetails(0,1,p.dorsalSeed).centre.forEach((v, i) => { if (!v) return; const x = i % 96; allCentre.add(x);if(!base.superStripeCentreMask[i])return;
    const neighbours = [i - 96, i + 96].filter(j => base.superStripeBandMask[j]);
    const d = neighbours.length === 2 ? Math.min(...neighbours.map(j => lum(rgb(pixels, j)) - lum(rgb(pixels, i)))) : 0;
    if (d >= 30) { centreColumns.add(x); contrastSum += d; }
  });
  let longest = 0, run = 0; [...allCentre].sort((a,b)=>a-b).forEach(x=>{run=centreColumns.has(x)?run+1:0;longest=Math.max(longest,run);});
  const coverage = allCentre.size ? centreColumns.size / allCentre.size : 0, longestRun = allCentre.size ? longest / allCentre.size : 0;
  const superstripe = !mask.some(Boolean) ? ss : { ...ss, visibleColumns: centreColumns.size, coverage, longestRun, meanContrast: centreColumns.size ? contrastSum / centreColumns.size : 0, qualified: ss.bandPixels >= 16 && base.pinMetrics.coverage >= .9 && coverage >= .85 && longestRun >= .8 };
  const eligible = Array.from(EMPTYBACK_DORSAL_DOMAIN).flatMap((v,i)=>v&&!source.protection[i]&&!base.spotMask[i]&&!base.pinMask[i]&&!base.pinSpreadMask[i]?[i]:[]);
  const clean = eligible.filter(i=>distance(rgb(pixels,i),lit(skin,i))<26).length, cleanCoverage = eligible.length ? clean / eligible.length : 0;
  const emptyBackMetrics = !active ? base.emptyBackMetrics : { ...base.emptyBackMetrics, cleanPixels: clean, cleanCoverage, remainingPatternPixels: eligible.length-clean, classification: p.emptyBackCopies===null?'unrecorded':!p.emptyBackCopies?'normal':cleanCoverage>=.9?'clean':'partial', goal:!!p.emptyBackCopies&&cleanCoverage>=.9&&base.pinMetrics.classification==='full'&&base.patternMetrics.lateralCoverage>=.5 };
  const compound = locus.blocked.includes(p.complexPair);
  emptyBackMetrics.goal = !compound && emptyBackMetrics.goal;
  const tracks=Array.from({length:6},(_,n)=>{const ys=[...new Set(Array.from(visibleStripeMask).flatMap((v,i)=>v&&base.stripeOwners[i]===n+1&&[2,3,4].includes(source.labels[i])?[Math.floor(i/96)]:[]))].sort((a,b)=>a-b);let longest=0,run=0,prior=-2;ys.forEach(y=>{run=y===prior+1?run+1:1;prior=y;longest=Math.max(longest,run);});const span=ys.length?ys.at(-1)!-ys[0]+1:0;return{rows:ys.length,span,longest,gaps:span-ys.length};});
  const good=tracks.filter(t=>t.rows>=5),totalSpan=good.reduce((s,t)=>s+t.span,0),fragmentation=totalSpan?good.reduce((s,t)=>s+t.gaps,0)/totalSpan:0;
  let stripePixels=0,stripeContrast=0;visibleStripeMask.forEach((v,i)=>{if(v){stripePixels++;stripeContrast+=distance(rgb(pixels,i),lit(skin,i));}});stripeContrast=stripePixels?stripeContrast/stripePixels:0;
  const stripeClass:'none'|'tiger'|'brindle'=good.length<3||stripeContrast<55?'none':p.brindleStrength>=.55&&fragmentation>=.12?'brindle':'tiger';
  const patternMetrics=!active?base.patternMetrics:{...base.patternMetrics,...classifyCompanionPatterns({...base.patternMetrics,stripeClass}),stripeClass,tracks,fragmentation,stripePixels,stripeContrast,stripeQuality:Math.round(100*Math.min(1,stripeContrast/150)*Math.min(1,good.length/5))};
  const complexMetrics = { pair: p.complexPair, label: locus.phenotypes[p.complexPair], sable, highway, restricted: compound, expression: strength,
    pixels: mask.filter(Boolean).length, dorsalPixels: dorsalMask.filter(Boolean).length, crownPixels: crownMask.filter(Boolean).length, tailPixels: tailMask.filter(Boolean).length,
    dorsalFill: dorsalMask.filter(Boolean).length / Math.max(1, eligible.length), provisional: true };
  // This is a fresh, uncached result. Assign fields separately to keep the
  // public TypeScript surface finite across the historical renderer unions.
  const result: CompanionLineageResult = {
    sprite:base.sprite,
    patternMetrics:base.patternMetrics,
    pinMetrics:base.pinMetrics,
    spotMetrics:base.spotMetrics,
    veilMetrics:base.veilMetrics,
    whiteMetrics:base.whiteMetrics,
    whitewallMetrics:base.whitewallMetrics,
    lateralMetrics:base.lateralMetrics,
    emptyBackMetrics:base.emptyBackMetrics,
    dorsalMetrics:base.dorsalMetrics,
    tricolorMetrics:base.tricolorMetrics,
    pigment:base.pigment,
    spotMask:base.spotMask,
    pinMask:base.pinMask,
    pinSpreadMask:base.pinSpreadMask,
    forelegRefinementMask:base.forelegRefinementMask,
    whiteMask:base.whiteMask,
    visibleStripeMask:base.visibleStripeMask,
    visibleTricolorMaterials:base.visibleTricolorMaterials,
    emptyBackMask:base.emptyBackMask,
    superStripeBandMask:base.superStripeBandMask,
    superStripeCentreMask:base.superStripeCentreMask,
    complexMask:mask,complexDorsalMask:dorsalMask,complexCrownMask:crownMask,complexTailMask:tailMask,complexAlbedo:albedo,complexMetrics,
    veilInheritance:{known:p.inheritedVeilDensity!==null,density:p.inheritedVeilDensity,strength:p.inheritedVeilStrength,overridden:p.veilOverridden,source:p.veilOverridden?'cosmetic':p.inheritedVeilDensity===null?'legacy-seed':'inherited'},
  };
  const sprite: SpriteResult = base.sprite;
  result.sprite = { ...sprite, version: COMPANION_LINEAGE_RENDERER_ID, pixels, layers: active ? [...sprite.layers, layer] : sprite.layers };
  result.complexMask=mask;result.complexDorsalMask=dorsalMask;result.complexCrownMask=crownMask;result.complexTailMask=tailMask;result.complexAlbedo=albedo;result.complexMetrics=complexMetrics;
  result.veilInheritance={known:p.inheritedVeilDensity!==null,density:p.inheritedVeilDensity,strength:p.inheritedVeilStrength,overridden:p.veilOverridden,source:p.veilOverridden?'cosmetic':p.inheritedVeilDensity===null?'legacy-seed':'inherited'};
  result.whiteMask=whiteMask;result.visibleStripeMask=visibleStripeMask;result.visibleTricolorMaterials=visibleMaterials;result.emptyBackMetrics=emptyBackMetrics;
  result.patternMetrics=patternMetrics;
  result.emptyBackMask=base.emptyBackMask.map((v,i)=>mask[i]?0:v);
  if(active){result.emptyBackMetrics.clearedPixels=result.emptyBackMask.filter(Boolean).length;result.emptyBackMetrics.clearedCoverage=eligible.length?result.emptyBackMetrics.clearedPixels/eligible.length:0;}
  result.whiteMetrics={...base.whiteMetrics,whitePixels:whiteMask.filter(Boolean).length};
  result.dorsalMetrics={...base.dorsalMetrics,superstripe,goal:!compound&&superstripe.qualified&&base.pinMetrics.classification==='full'&&base.lateralMetrics.quad,reverseGoal:!compound&&base.dorsalMetrics.reverseGoal};
  result.lateralMetrics={...base.lateralMetrics,goal:!compound&&base.lateralMetrics.goal,portholeGoal:!compound&&base.lateralMetrics.portholeGoal};
  result.whitewallMetrics={...base.whitewallMetrics,goal:!compound&&base.whitewallMetrics.goal,emptyBackGoal:!compound&&base.whitewallMetrics.qualified&&base.pinMetrics.classification==='full'&&!!p.emptyBackCopies&&(!active?base.emptyBackMetrics.cleanCoverage:cleanCoverage)>=.9};
  return result;
}
export function describeCompanionLineage(input: RenderInput, override?: number) {
  const parameters = companionLineageParameters(input, override), r = renderCompanionLineage(parameters), c = r.complexMetrics;
  const failed = input.phenotype.observed['lilly-white'] === 'Lilly 동형접합 비생존';
  const complexName = c.sable && c.highway ? '세이블/하이웨이 · 잠정' : c.sable ? parameters.complexPair==='C/S'?'루왁 · 잠정':parameters.sableCopies===2?'슈퍼 세이블 · 잠정':'세이블' : c.highway ? parameters.complexPair==='C/H'?'카푸치노/하이웨이 · 잠정':parameters.highwayCopies===2?'슈퍼 하이웨이 · 잠정':'하이웨이' : parameters.cappuccinoCopies===2?(parameters.lilly?'설악 · 슈퍼 카푸치노':'슈퍼 카푸치노'):parameters.cappuccinoCopies?(parameters.lilly?'프라푸치노':'카푸치노'):'';
  const name = failed ? '릴리 동형접합 비생존' : [complexName, parameters.lilly?'릴리화이트':'', parameters.axanthic?'아잔틱':'', parameters.phantomCopies===2?'팬텀':'', r.dorsalMetrics.superstripe.qualified?'슈퍼스트라이프':'', r.lateralMetrics.quad?'쿼드스트라이프':'', PATTERN_LABELS[r.patternMetrics.classification], r.spotMetrics.count?'달마시안':'', r.pinMetrics.classification==='full'?'풀 핀':''].filter(Boolean).join(' · ');
  return Object.assign({}, r, { parameters, name });
}
export function createCompanionLineageRenderer(override?: number): AppearanceRenderer {
  if (override !== undefined) validateLillyVeil(override);
  return { id: override===undefined?COMPANION_LINEAGE_RENDERER_ID:`${COMPANION_LINEAGE_RENDERER_ID}:veil:${override}`, render: input=>renderCompanionLineage(companionLineageParameters(input,override)).sprite };
}
export const companionLineageRenderer = createCompanionLineageRenderer();
