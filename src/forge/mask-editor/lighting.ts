import type { MaskDocument, MaskReference } from './model';

export const TONE_IDS = ['highlight', 'base', 'shadow'] as const;
export type ToneId = typeof TONE_IDS[number];
export const TONE_COLOURS = ['#f1e7cc', '#b29b79', '#625b59'];
export const PAINT_LIGHTING = { version: 1, highlightWhiteMix: 0.18, shadowScale: 0.72 } as const;

/** Evaluate once from the saved base colour, never from a shaded screen pixel. */
export function shadeColour(rgb: readonly number[], tone: number) {
  return rgb.slice(0, 3).map(value => Math.round(tone === 1 ? value + (255 - value) * PAINT_LIGHTING.highlightWhiteMix : tone === 3 ? value * PAINT_LIGHTING.shadowScale : value));
}

/** Only the editable user mask excludes lighting, independent of the paint-lock toggle. */
export function lightingExcluded(document: MaskDocument, i: number) {
  return !!document.protection[i];
}
export function exportLighting(document: MaskDocument, reference: MaskReference) {
  const excluded = document.foreground.map((value, i) => Number(value && lightingExcluded(document, i)));
  const labels = document.shading.map((value, i) => document.foreground[i] && !excluded[i] ? value : 0);
  return { schema: 'gecko-fixed-three-tone-lighting', version: 1, specimenId: document.specimenId, width: 96, height: 96,
    sourceRgbaSha256: reference.sourceRgbaSha256, lightDirection: 'upper-left', independentOfMorph: true,
    toneOrder: [...TONE_IDS], labels, masks: Object.fromEntries(TONE_IDS.map((id, n) => [id, labels.map(value => Number(value === n + 1))])),
    excluded, eligible: document.foreground.map((value, i) => Number(value && !excluded[i])),
    protectionPolicy: 'Exclude only the user protection mask, even when paint protection is disabled. No fixed exclusions.' };
}
/** Neutral inspection colours only. Never bake lighting into the user's art. */
export function lightingPreview(document: MaskDocument, reference: MaskReference, source: number[]) {
  const colours = TONE_COLOURS.map(hex => hex.slice(1).match(/../g)!.map(v => parseInt(v, 16)));
  const pixels = [...source], data = exportLighting(document, reference);
  data.labels.forEach((value, i) => { if (value) pixels.splice(i * 4, 4, ...colours[value - 1], 255); });
  return pixels;
}
