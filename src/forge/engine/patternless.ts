import { B_ORIGIN_01 } from './art/b-origin-01';
import type { AppearanceRenderer, RenderInput } from './model';
import type { Scores } from './genetics';
import type { SpriteLayer, SpriteResult } from '@/engine/model';

export const PATTERNLESS_RENDERER_ID = 'b-origin-01-patternless-1' as const;
/** Versioned visual mapping of the existing virtual colour scores. */
export const PATTERNLESS_COLOUR_MODEL = {
  version: 1, hue: { offset: 74, orange: -27, red: -75, minimum: 8 },
  saturation: { offset: .18, orange: .66, red: .26, creamReduction: .75, brightnessFloor: .35 },
  lightness: { offset: .12, brightness: .55, cream: .14 },
  fireDown: { lightTarget: .9, lightMix: .22, saturationScale: .75 },
  highlightWhiteMix: .18, shadowScale: .72,
} as const;
export type Rgb = readonly [number, number, number];
const clamp = (v: number, min = 0, max = 1) => Math.max(min, Math.min(max, v));
const hex = (rgb: Rgb) => '#' + rgb.map(v => v.toString(16).padStart(2, '0')).join('');
function hsl(hue: number, saturation: number, lightness: number): Rgb {
  const a = saturation * Math.min(lightness, 1 - lightness);
  const channel = (n: number) => { const k = (n + hue / 30) % 12; return Math.round(255 * (lightness - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))); };
  return [channel(0), channel(8), channel(4)];
}
export function patternlessColour(scores: Scores, fire: 'up' | 'down' = 'up') {
  for (const key of ['red', 'orange', 'brightness', 'cream'] as const) if (!Number.isFinite(scores[key]) || scores[key] < 0 || scores[key] > 1) throw new Error('색상 점수는 0~1이어야 합니다.');
  if (!['up', 'down'].includes(fire)) throw new Error('파이어 설정 오류');
  const m = PATTERNLESS_COLOUR_MODEL;
  const hue = Math.max(m.hue.minimum, m.hue.offset + m.hue.orange * scores.orange + m.hue.red * scores.red);
  let saturation = clamp((m.saturation.offset + m.saturation.orange * scores.orange + m.saturation.red * scores.red) * (1 - m.saturation.creamReduction * scores.cream) * (m.saturation.brightnessFloor + (1 - m.saturation.brightnessFloor) * scores.brightness));
  let lightness = clamp(m.lightness.offset + m.lightness.brightness * scores.brightness + m.lightness.cream * scores.cream);
  if (fire === 'down') { lightness += (m.fireDown.lightTarget - lightness) * m.fireDown.lightMix; saturation *= m.fireDown.saturationScale; }
  const base = hsl(hue, saturation, lightness);
  const name = lightness < .24 ? '차콜' : scores.cream > .6 && lightness > .6 ? '크림' : hue < 16 ? '레드' : hue < 36 ? '오렌지' : hue > 58 ? '올리브' : lightness < .4 ? '브라운' : '옐로';
  return { base, hex: hex(base), name: `${name} 패턴리스` };
}
export function patternlessTones(base: Rgb) {
  if (base.length !== 3 || base.some(value => !Number.isInteger(value) || value < 0 || value > 255)) throw new Error('체색은 0~255의 RGB여야 합니다.');
  return {
    highlight: base.map(v => Math.round(v + (255 - v) * PATTERNLESS_COLOUR_MODEL.highlightWhiteMix)) as unknown as Rgb,
    base: [...base] as unknown as Rgb,
    shadow: base.map(v => Math.round(v * PATTERNLESS_COLOUR_MODEL.shadowScale)) as unknown as Rgb,
  };
}
/** One body colour, authored planes, immutable protected pixels. No pattern/noise/seed masks. */
export function renderSolidPatternless(base: Rgb): SpriteResult {
  const tones = patternlessTones(base), pixels = Uint8ClampedArray.from(B_ORIGIN_01.pixels);
  const body = pixels.slice();
  const layer = (name: SpriteLayer['name']): SpriteLayer => ({ name, pixels: new Uint8ClampedArray(96 * 96 * 4), mask: new Uint8Array(96 * 96) });
  const highlight = layer('highlight'), shadow = layer('shadow'), details = layer('details');
  B_ORIGIN_01.foreground.forEach((value, i) => {
    if (B_ORIGIN_01.protection[i]) { details.pixels.set(pixels.slice(i * 4, i * 4 + 4), i * 4); details.mask[i] = 255; }
    if (!value || B_ORIGIN_01.protection[i]) return;
    body.set([...tones.base, 255], i * 4);
    const tone = B_ORIGIN_01.shading[i], colour = tone === 1 ? tones.highlight : tone === 3 ? tones.shadow : tones.base;
    pixels.set([...colour, 255], i * 4);
    const target = tone === 1 ? highlight : tone === 3 ? shadow : null;
    if (target) { target.pixels.set([...colour, 255], i * 4); target.mask[i] = 255; }
  });
  return { width: 96, height: 96, pixels, version: PATTERNLESS_RENDERER_ID,
    layers: [{ name: 'body', pixels: body, mask: Uint8Array.from(body.filter((_, i) => i % 4 === 3)) }, shadow, highlight, details] };
}
export const patternlessRenderer: AppearanceRenderer = { id: PATTERNLESS_RENDERER_ID,
  render: (input: RenderInput) => renderSolidPatternless(patternlessColour(input.phenotype.genetics.scores, input.fire).base) };
