import { B_ORIGIN_01 as source } from './art/b-origin-01';
import { renderCompanionBase } from './companion-base';
import { renderCompanionPatternsV5, companionPatternsParametersV5, DEFAULT_PATTERNS_V5_PARAMETERS, createCompanionPatternsRendererV5 } from './companion-patterns-v5';
import { classifyCompanionPatterns, describeCompanionPatterns, measureCompanionPatternTricolor } from './companion-patterns';
import type { CompanionPatternsParameters } from './companion-patterns';
import { phantomCopies } from './morph-extensions';
import { patternlessTones, type Rgb } from './patternless';
import type { AppearanceRenderer, RenderInput } from './model';
import type { SpriteLayer } from '@/engine/model';

export const COMPANION_PHANTOM_RENDERER_ID = 'b-origin-01-companion-phantom-1' as const;
export const COMPANION_PHANTOM_MODEL = {
  version: 1, inheritance: 'Independent recessive extension: N/N normal, N/ph invisible carrier, ph/ph expressed; legacy missing copies remain unknown.',
  creamRetention: .07, orangeRetention: .035, dorsalRetention: .055, crownRetention: .55, pinRetention: .14,
  stripeSkinReveal: .55,
  lilly: { dorsal: .035, lowerFlank: .78, other: .06, tailTop: 1, veilRetention: .04 },
  limits: 'Breeder-observation-inspired material coefficients, not identified molecular genetics. Whitewall/Empty Back and age-dependent expression are not simulated. C/C art remains the existing super form.',
  references: ['https://acreptiles.com/new_store/index.php?dispatch=pages.view&page_id=54', 'https://www.corchgeckos.com/lillywhite.html'],
} as const;
export interface CompanionPhantomParameters extends CompanionPatternsParameters {
  phantomCopies: 0 | 1 | 2 | null;
  /** Art experiment coefficient, independent of the inherited recessive pair. */
  phantomSuppression: number;
}
export const DEFAULT_PHANTOM_PARAMETERS: Readonly<CompanionPhantomParameters> = { ...DEFAULT_PATTERNS_V5_PARAMETERS, phantomCopies: 2, phantomSuppression: 1 };
const roles = renderCompanionBase().materialMask, N = 9216;
const side = (i: number) => [3, 4].includes(source.labels[i]);
const leg = (i: number) => [5, 6].includes(source.labels[i]);
const mix = (a: Rgb, b: Rgb, t: number): Rgb => a.map((v, n) => Math.round(v + (b[n] - v) * t)) as unknown as Rgb;
const colour = (pixels: Uint8ClampedArray, i: number) => Array.from(pixels.slice(i * 4, i * 4 + 3)) as unknown as Rgb;
const distance = (a: Rgb, b: Rgb) => Math.sqrt(a.reduce((s, v, n) => s + (v - b[n]) ** 2, 0));
const tone = (i: number) => source.shading[i] === 1 ? 'highlight' : source.shading[i] === 3 ? 'shadow' : 'base';
const columns = Array.from({ length: 96 }, (_, x) => {
  const ys = source.labels.flatMap((_, i) => side(i) && i % 96 === x ? [Math.floor(i / 96)] : []);
  return ys.length ? { top: Math.min(...ys), bottom: Math.max(...ys) } : null;
});

export function renderCompanionPhantom(p: CompanionPhantomParameters) {
  if (![null, 0, 1, 2].includes(p.phantomCopies) || !Number.isFinite(p.phantomSuppression) || p.phantomSuppression < 0 || p.phantomSuppression > 1) throw Error('팬텀 사본은 0·1·2 또는 미기록, 표현 억제는 0~1이어야 합니다.');
  const latent = renderCompanionPatternsV5(p), active = p.phantomCopies === 2 && p.cappuccinoCopies !== 2;
  const amount = active ? p.phantomSuppression : 0;
  const phantomMask = new Uint8Array(N), albedo = new Uint8ClampedArray(N * 4);
  if (!amount) return { ...latent, sprite: { ...latent.sprite, version: COMPANION_PHANTOM_RENDERER_ID }, phantomMask, phantomAlbedo: albedo,
    phantomMetrics: { expressed: p.phantomCopies === 2, applied: false, copies: p.phantomCopies, pixels: 0, retainedWhitePixels: latent.whiteMask.filter(Boolean).length, structuralPinCoverage: latent.pinMetrics.coverage, pinColourRetention: 1, whiteVeilRetention: p.lilly ? p.veilStrength : 0 } };
  // A second material pass supplies skin/limb/ventral albedos, never a flattened
  // grayscale/dark filter. Original pattern masks remain as latent spatial data.
  const bare = renderCompanionPatternsV5({ ...p, stripeBodyColor: mix(p.stripeBodyColor, p.bodyColor, amount * COMPANION_PHANTOM_MODEL.stripeSkinReveal), flameStrength: 0, legPatternStrength: 0, extremeStrength: 0, tricolorStrength: 0, lilly: false, pinStrength: 0 });
  const skin = bare.pigment.skin.resolved, cream = mix(latent.pigment.pattern.resolved, skin, amount * (1 - COMPANION_PHANTOM_MODEL.creamRetention));
  const bareAlbedo = bare.albedo ?? renderCompanionBase({ bodyColor: skin, detailColor: bare.pigment.pattern.resolved }).albedo;
  const orange = mix(latent.tricolorPalette.orange, skin, amount * (1 - COMPANION_PHANTOM_MODEL.orangeRetention));
  const white = latent.pigment.white, stripe = mix(p.stripeColor, [35, 36, 40], latent.pigment.suppression);
  const pixels = latent.sprite.pixels.slice(), whiteMask = new Uint8Array(N), visiblePatternMask = new Uint8Array(N), visibleStripeMask = new Uint8Array(N), visiblePinMask = new Uint8Array(N), materials = new Uint8Array(N);
  const rows = Array.from({ length: 6 }, () => new Set<number>());
  let stripeN = 0, stripeContrast = 0, pinRetentionSum = 0, pinN = 0;
  const veil = p.lilly ? p.veilStrength * (1 - amount * (1 - COMPANION_PHANTOM_MODEL.lilly.veilRetention)) : 0;
  const lit = (rgb: Rgb, i: number) => { const t = tone(i); return mix(patternlessTones(rgb)[t], patternlessTones(white)[t], veil); };
  source.foreground.forEach((v, i) => {
    if (!v || source.protection[i]) return;
    const label = source.labels[i], refined = latent.forelegRefinementMask[i];
    let rgb = colour(bareAlbedo, i), role = 1;
    if (label === 2) rgb = mix(latent.pigment.pattern.resolved, skin, amount * (1 - COMPANION_PHANTOM_MODEL.dorsalRetention));
    if (roles[i] === 1) rgb = mix(rgb, skin, amount * (1 - COMPANION_PHANTOM_MODEL.crownRetention));
    if (refined) rgb = skin;
    const substrate = rgb;
    if (latent.patternMask[i] && !refined && ![1,2,3,5].includes(roles[i])) {
      role = latent.tricolorMaterialMask[i] === 2 ? 2 : 3; rgb = role === 2 ? orange : cream;
    }
    if (refined) rgb = skin;
    let beforeStripe = rgb;
    const stripePainted = !!bare.stripeMask[i] && !(p.cappuccinoCopies && label === 7);
    if (stripePainted) { rgb = mix(rgb, stripe, p.stripeStrength * (label === 7 ? .65 : 1)); role = 4; }
    let whiteRetention = 0;
    if (p.lilly && latent.whiteMask[i] && !refined) {
      const c = columns[i % 96], depth = c ? (Math.floor(i / 96) - c.top) / Math.max(1, c.bottom - c.top) : 0;
      const target = label === 7 && roles[i] === 6 ? 1 : side(i) && depth >= .70 ? COMPANION_PHANTOM_MODEL.lilly.lowerFlank : label === 2 ? COMPANION_PHANTOM_MODEL.lilly.dorsal : COMPANION_PHANTOM_MODEL.lilly.other;
      // Lilly's white replaces the ordinary pattern material. Suppressing that
      // material reveals the anatomical skin plane, avoiding two stacked washes.
      beforeStripe = mix(beforeStripe, substrate, amount);
      rgb = stripePainted ? mix(beforeStripe, stripe, p.stripeStrength * (label === 7 ? .65 : 1)) : beforeStripe;
      whiteRetention = 1 - amount * (1 - target); rgb = mix(rgb, white, whiteRetention);
      if (whiteRetention > .2) whiteMask[i] = 255;
    }
    const baseline = lit(mix(beforeStripe, white, whiteRetention), i);
    if (latent.pinMask[i] || latent.pinSpreadMask[i]) {
      const retained = 1 - amount * (1 - COMPANION_PHANTOM_MODEL.pinRetention);
      rgb = mix(skin, latent.pigment.pattern.resolved, retained); role = 0; pinRetentionSum += retained; pinN++;
    }
    albedo.set([...rgb, 255], i * 4);
    let result = lit(rgb, i);
    if (latent.spotMask[i]) { result = colour(latent.sprite.pixels, i); role = 0; }
    if ((latent.pinMask[i] || latent.pinSpreadMask[i]) && !latent.spotMask[i] && distance(result, lit(substrate, i)) >= 26) visiblePinMask[i] = 255;
    pixels.set([...result, pixels[i * 4 + 3]], i * 4); phantomMask[i] = 255;
    if (side(i)) materials[i] = whiteMask[i] ? 5 : role;
    if ((latent.patternMask[i] || whiteMask[i]) && !latent.spotMask[i] && !latent.pinMask[i] && !latent.pinSpreadMask[i] && role !== 4 && distance(result, lit(substrate, i)) >= 26) visiblePatternMask[i] = 255;
    const contrast = distance(result, baseline);
    if (stripePainted && role === 4 && contrast >= 26) {
      visibleStripeMask[i] = 255; stripeN++; stripeContrast += contrast;
      if ([2,3,4].includes(label) && bare.stripeOwners[i]) rows[bare.stripeOwners[i]-1].add(Math.floor(i/96));
    }
  });
  const eligible = (i: number) => !!source.foreground[i] && !source.protection[i] && !latent.forelegRefinementMask[i] && ![1,2,3,5].includes(roles[i]);
  const indices = source.labels.flatMap((_, i) => eligible(i) ? [i] : []);
  const fraction = (filter: (i: number) => boolean) => { const domain = indices.filter(filter); return domain.length ? domain.filter(i => visiblePatternMask[i]).length / domain.length : 0; };
  const lateralCoverage = fraction(side), upperCoverage = fraction(i => source.labels[i] === 3), legCoverage = fraction(leg);
  const tracks = rows.map(set => {
    const ys = [...set].sort((a,b)=>a-b); let longest=0, run=0, prior=-2;
    ys.forEach(y=>{run=y===prior+1?run+1:1;prior=y;longest=Math.max(longest,run);});
    const span=ys.length?ys.at(-1)!-ys[0]+1:0;return{rows:ys.length,span,longest,gaps:span-ys.length};
  });
  const good = tracks.filter(t=>t.rows>=5), span = good.reduce((s,t)=>s+t.span,0), fragmentation = span ? good.reduce((s,t)=>s+t.gaps,0)/span : 0;
  const stripeClass = good.length < 3 || !stripeN || stripeContrast/stripeN < 55 ? 'none' : p.brindleStrength >= .55 && fragmentation >= .12 ? 'brindle' : 'tiger';
  const tricolorMetrics = measureCompanionPatternTricolor(pixels, materials, p, lateralCoverage);
  const observation = { lateralCoverage, upperCoverage, legCoverage, stripeClass, clearTricolor: tricolorMetrics.clear, superForm: false } as const;
  const rises = columns.flatMap((c,x)=>{if(!c)return[];const ys=indices.filter(i=>side(i)&&i%96===x&&visiblePatternMask[i]).map(i=>Math.floor(i/96));return[ys.length?(c.bottom-Math.min(...ys)+1)/(c.bottom-c.top+1):0];});
  const patternMetrics = { ...latent.patternMetrics, ...observation, ...classifyCompanionPatterns(observation), tracks, fragmentation,
    stripePixels: stripeN, stripeContrast: stripeN ? stripeContrast/stripeN : 0, stripeQuality: Math.round(100*Math.min(1,(stripeN?stripeContrast/stripeN:0)/150)*Math.min(1,good.length/5)),
    maximumRise: Math.max(0,...rises), meanRise: rises.reduce((a,b)=>a+b,0)/rises.length };
  const layer: SpriteLayer = { name: 'details', mask: phantomMask, pixels: pixels.slice() };
  return { ...latent, sprite: { ...latent.sprite, version: COMPANION_PHANTOM_RENDERER_ID, pixels, layers: [...latent.sprite.layers, layer] },
    latentPatternMask: latent.patternMask, latentWhiteMask: latent.whiteMask, whiteMask, visiblePatternMask, visibleStripeMask, visiblePinMask, visibleTricolorMaterials: materials,
    stripeMask: bare.stripeMask, stripeOwners: bare.stripeOwners, tricolorMetrics, patternMetrics, phantomMask, phantomAlbedo: albedo,
    veilMetrics: { ...latent.veilMetrics, strength: veil, underpaintRetention: 1-veil },
    whiteMetrics: { whitePixels: whiteMask.filter(Boolean).length, whiteLateralPixels: whiteMask.filter((v,i)=>v&&side(i)).length, whiteLateralCoverage: whiteMask.filter((v,i)=>v&&side(i)).length/latent.patternMetrics.lateralPixels },
    tricolorPalette: { body: skin, orange, cream }, pigment: { ...latent.pigment, skin: { ...bare.pigment.skin, resolved: skin }, pattern: { ...latent.pigment.pattern, resolved: cream } },
    phantomMetrics: { expressed: true, applied: true, copies: p.phantomCopies, pixels: phantomMask.filter(Boolean).length, retainedWhitePixels: whiteMask.filter(Boolean).length,
      structuralPinCoverage: latent.pinMetrics.coverage, pinColourRetention: pinN ? pinRetentionSum/pinN : 0, whiteVeilRetention: veil } };
}
export function companionPhantomParameters(input: RenderInput, veilOverride?: number): CompanionPhantomParameters {
  return { ...companionPatternsParametersV5(input, veilOverride), phantomCopies: phantomCopies(input.extensions), phantomSuppression: 1 };
}
export function describeCompanionPhantom(input: RenderInput, veilOverride?: number) {
  const parameters = companionPhantomParameters(input, veilOverride), r = renderCompanionPhantom(parameters);
  const old = describeCompanionPatterns(input, veilOverride, () => r);
  return { ...old, parameters, name: parameters.phantomCopies === 2 ? `팬텀 · ${old.name.replace('풀 핀', '풀 핀 구조')}` : old.name, phantomMetrics: r.phantomMetrics };
}
export function createCompanionPhantomRenderer(veilOverride?: number): AppearanceRenderer {
  createCompanionPatternsRendererV5(veilOverride);
  return { id: veilOverride === undefined ? COMPANION_PHANTOM_RENDERER_ID : `${COMPANION_PHANTOM_RENDERER_ID}:veil:${veilOverride}`, render: input => renderCompanionPhantom(companionPhantomParameters(input, veilOverride)).sprite };
}
export const companionPhantomRenderer = createCompanionPhantomRenderer();
