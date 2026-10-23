import { B_ORIGIN_01 } from './art/b-origin-01';
import { COMPANION_MATERIALS } from './art/companion-materials';
import { patternlessTones, type Rgb } from './patternless';
import type { SpriteLayer, SpriteResult } from '@/engine/model';
import type { MaskDocument } from '../mask-editor/model';

export const COMPANION_RENDERER_ID = 'b-origin-01-companion-1' as const;
export interface CompanionParameters { bodyColor: Rgb; detailColor: Rgb }
export const DEFAULT_COMPANION_PARAMETERS: Readonly<CompanionParameters> = { bodyColor: [201, 131, 70], detailColor: [255, 225, 174] };
export const COMPANION_COLOUR_MODEL = {
  version: 1, faceCheekDetailMix: .16, throatDetailMix: .66, ventralDetailMix: .35,
  toeDetailMix: .82, tailDetailMix: .12, limbDetailMix: .18,
  lighting: { highlightWhiteMix: .18, shadowScale: .72 },
  dorsalAndCrown: 'detailColor', flankMarkings: false,
} as const;
const roles = new Uint8Array(96 * 96);
for (const [y, x, length, role] of COMPANION_MATERIALS.runs) roles.fill(role, y * 96 + x, y * 96 + x + length);
const mix = (a: Rgb, b: Rgb, amount: number): Rgb => a.map((v, channel) => Math.round(v + (b[channel] - v) * amount)) as unknown as Rgb;
export function validateCompanionParameters(parameters: CompanionParameters): void {
  if (!parameters || typeof parameters !== 'object') throw Error('기본형 색상 설정이 필요합니다.');
  for (const rgb of [parameters.bodyColor, parameters.detailColor]) if (!Array.isArray(rgb) || rgb.length !== 3 || rgb.some(v => !Number.isInteger(v) || v < 0 || v > 255)) throw Error('색상은 0~255의 RGB 세 값이어야 합니다.');
  patternlessTones(parameters.bodyColor); patternlessTones(parameters.detailColor);
}
/** Common anatomical materials, no random markings or changes to source planes. */
export function renderCompanionBase(parameters: CompanionParameters = DEFAULT_COMPANION_PARAMETERS) {
  validateCompanionParameters(parameters);
  const m = COMPANION_COLOUR_MODEL, { bodyColor: body, detailColor: detail } = parameters;
  const palette = {
    skin: body, face_crown: detail, face_cheek: mix(body, detail, m.faceCheekDetailMix),
    throat: mix(body, detail, m.throatDetailMix), ventral_skin: mix(body, detail, m.ventralDetailMix),
    toe_pads: mix(body, detail, m.toeDetailMix), tail_plane: mix(body, detail, m.tailDetailMix),
    limb_top: mix(body, detail, m.limbDetailMix), dorsal: detail,
  };
  const tones = COMPANION_MATERIALS.names.map(name => patternlessTones(palette[name]));
  const pixels = Uint8ClampedArray.from(B_ORIGIN_01.pixels), albedo = pixels.slice();
  const layer = (name: SpriteLayer['name']): SpriteLayer => ({ name, pixels: new Uint8ClampedArray(96 * 96 * 4), mask: new Uint8Array(96 * 96) });
  const bodyLayer = layer('body'), highlight = layer('highlight'), shadow = layer('shadow'), details = layer('details');
  bodyLayer.pixels.set(pixels); bodyLayer.mask.set(B_ORIGIN_01.pixels.filter((_, i) => i % 4 === 3));
  const materialMask = new Uint8Array(96 * 96);
  B_ORIGIN_01.foreground.forEach((foreground, i) => {
    if (B_ORIGIN_01.protection[i]) { details.pixels.set(pixels.slice(i * 4, i * 4 + 4), i * 4); details.mask[i] = 255; }
    if (!foreground || B_ORIGIN_01.protection[i]) return;
    const role = roles[i], tone = B_ORIGIN_01.shading[i], colours = tones[role];
    const rgb = tone === 1 ? colours.highlight : tone === 3 ? colours.shadow : colours.base;
    albedo.set([...colours.base, 255], i * 4); bodyLayer.pixels.set([...colours.base, 255], i * 4);
    pixels.set([...rgb, 255], i * 4); materialMask[i] = role;
    const target = tone === 1 ? highlight : tone === 3 ? shadow : null;
    if (target) { target.pixels.set([...rgb, 255], i * 4); target.mask[i] = 255; }
  });
  const sprite: SpriteResult = { width: 96, height: 96, pixels, version: COMPANION_RENDERER_ID, layers: [bodyLayer, shadow, highlight, details] };
  return { sprite, albedo, materialMask, palette, tones, sourceRgbaSha256: B_ORIGIN_01.sourceRgbaSha256 };
}

export interface CompanionStudy {
  format: 'b-origin-01-base-study'; version: 1; rendererVersion: typeof COMPANION_RENDERER_ID;
  sourceRgbaSha256: typeof B_ORIGIN_01.sourceRgbaSha256; parameters: CompanionParameters;
}
export function createCompanionStudy(parameters: CompanionParameters = DEFAULT_COMPANION_PARAMETERS): CompanionStudy {
  validateCompanionParameters(parameters);
  return { format: 'b-origin-01-base-study', version: 1, rendererVersion: COMPANION_RENDERER_ID,
    sourceRgbaSha256: B_ORIGIN_01.sourceRgbaSha256, parameters: { bodyColor: [...parameters.bodyColor] as unknown as Rgb, detailColor: [...parameters.detailColor] as unknown as Rgb } };
}
export function importCompanionStudy(json: string): CompanionStudy {
  if (new TextEncoder().encode(json).length > 65536) throw Error('설정 파일은 64KB 이하여야 합니다.');
  const value = JSON.parse(json) as CompanionStudy;
  if (!value || value.format !== 'b-origin-01-base-study' || value.version !== 1 || value.rendererVersion !== COMPANION_RENDERER_ID || value.sourceRgbaSha256 !== B_ORIGIN_01.sourceRgbaSha256) throw Error('B-ORIGIN-01 기본형 설정을 선택하세요.');
  return createCompanionStudy(value.parameters);
}

/** Reopen in the existing pixel editor with native albedo and live lighting. */
export function createCompanionMaskDocument(parameters: CompanionParameters = DEFAULT_COMPANION_PARAMETERS): MaskDocument {
  const { albedo } = renderCompanionBase(parameters), artPixels = new Uint8ClampedArray(96 * 96 * 4), artLighting = new Uint8Array(96 * 96);
  B_ORIGIN_01.foreground.forEach((v, i) => { if (v && !B_ORIGIN_01.protection[i]) { artPixels.set(albedo.slice(i * 4, i * 4 + 4), i * 4); artLighting[i] = 1; } });
  return { format: 'gecko-body-mask-editor', version: 4, specimenId: 'B-ORIGIN-01', width: 96, height: 96,
    sourceRgbaSha256: B_ORIGIN_01.sourceRgbaSha256, regionOrder: ['HEAD', 'DORSAL', 'LATERAL_UPPER', 'LATERAL_LOWER', 'LEGS_FRONT', 'LEGS_REAR', 'TAIL'],
    labels: [...B_ORIGIN_01.labels], foreground: [...B_ORIGIN_01.foreground], protection: [...B_ORIGIN_01.protection], shading: [...B_ORIGIN_01.shading],
    locks: [], protectionEnabled: true, artPixels: [...artPixels], artLighting: [...artLighting] };
}
