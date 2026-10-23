import { lightingExcluded, shadeColour, TONE_IDS, type ToneId } from './lighting';

export const REGION_IDS = ['HEAD', 'DORSAL', 'LATERAL_UPPER', 'LATERAL_LOWER', 'LEGS_FRONT', 'LEGS_REAR', 'TAIL'] as const;
export type RegionId = typeof REGION_IDS[number];
export type BrushTool = 'paint' | 'erase';
export type EditTarget = 'regions' | 'art' | 'protection' | 'lighting';
export interface StrokeOptions { target?: EditTarget; colour?: string; bodyOnly?: boolean; clipRegion?: boolean; tone?: ToneId; applyLighting?: boolean }
export const SIZE = 96, PIXELS = SIZE * SIZE;
export const REGION_COLOURS = ['#f47676', '#f4ce57', '#59c590', '#4eb6dd', '#bf8af1', '#f3a45e', '#e883bb'];
export const REGION_DESCRIPTIONS = ['머리', '등', '옆구리 상부', '옆구리 하부', '앞다리', '뒷다리', '꼬리'];

export interface MaskReference {
  specimenId: string; sourceRgbaSha256: string; pixels: readonly number[];
  foreground: readonly number[]; protectedFeatures: Record<string, number[]>;
  lighting?: { schema: 'gecko-fixed-lighting-reference'; version: 1; lightDirection: 'upper-left'; planeLabels: number[];
    // Legacy references may contain this field; it no longer restricts editing or rendering.
    fixedProtection?: number[] };
}
export interface MaskDocument {
  format: 'gecko-body-mask-editor'; version: 4; specimenId: string;
  width: 96; height: 96; sourceRgbaSha256: string;
  regionOrder: RegionId[]; labels: number[]; foreground: number[]; locks: RegionId[];
  artPixels: number[]; protection: number[]; protectionEnabled: boolean;
  shading: number[];
  // 0 = flat paint; 1..3 = follows lighting, with this tone frozen if protected.
  artLighting: number[];
}
type Channel = EditTarget | 'artLighting';
type Delta = { target: Channel; indices: number[]; before: number[]; after: number[] };
type Patch = Delta[];
type Changes = Map<Channel, Map<number, number>>;
type Stroke = { tool: BrushTool; target: EditTarget; colour: number[]; tone: number; bodyOnly: boolean; clipRegion: boolean; applyLighting: boolean;
  region: number; size: number; before: Changes; last: [number, number] | null };
function assert(condition: unknown, text: string): asserts condition { if (!condition) throw new Error(text); }
const object = (v: unknown): Record<string, unknown> => {
  assert(v && typeof v === 'object' && !Array.isArray(v), '올바른 마스크 JSON 객체가 필요합니다.');
  return v as Record<string, unknown>;
};
function numbers(v: unknown, count: number, max: number): number[] {
  assert(Array.isArray(v) && v.length === count && v.every(n => Number.isInteger(n) && n >= 0 && n <= max), '픽셀·마스크 배열의 크기나 값이 올바르지 않습니다.');
  return [...v] as number[];
}
const same = (a: readonly number[], b: readonly number[]) => a.length === b.length && a.every((v, i) => v === b[i]);

export function validateDocument(input: unknown, reference: MaskReference): MaskDocument {
  const v = object(input);
  assert(v.format === 'gecko-body-mask-editor' && [1, 2, 3, 4].includes(v.version as number) && v.width === SIZE && v.height === SIZE, '지원하는 96×96 마스크 작업 파일이 아닙니다.');
  assert(v.specimenId === reference.specimenId && v.sourceRgbaSha256 === reference.sourceRgbaSha256, `${reference.specimenId} 원본이 같은 작업 파일만 열 수 있습니다.`);
  assert(Array.isArray(v.regionOrder) && v.regionOrder.join(',') === REGION_IDS.join(','), '신체 영역은 지정된 7개여야 합니다.');
  const foreground = numbers(v.foreground, PIXELS, 1), labels = numbers(v.labels, PIXELS, 7);
  assert(same(foreground, reference.foreground), '원본 신체 윤곽이 다른 마스크입니다.');
  assert(labels.every((label, i) => !label || foreground[i]), '검은 배경에 신체 영역이 지정되어 있습니다.');
  assert(Array.isArray(v.locks) && v.locks.every(id => REGION_IDS.includes(id)) && new Set(v.locks).size === v.locks.length, '영역 잠금 정보가 올바르지 않습니다.');
  const artPixels = v.version !== 1 ? numbers(v.artPixels, PIXELS * 4, 255) : Array(PIXELS * 4).fill(0);
  assert(artPixels.every((value, i) => i % 4 !== 3 || value === 0 || value === 255), '픽셀 레이어는 불투명 도트 또는 빈 픽셀이어야 합니다.');
  assert(v.version === 1 || typeof v.protectionEnabled === 'boolean', '보호 마스크 설정이 올바르지 않습니다.');
  const shading = (v.version as number) >= 3 ? numbers(v.shading, PIXELS, 3) : [...(reference.lighting?.planeLabels ?? foreground.map(value => value ? 2 : 0))];
  assert(shading.every((value, i) => foreground[i] ? value >= 1 : value === 0), '신체 픽셀은 highlight / base / shadow 중 하나여야 합니다.');
  const artLighting = v.version === 4 ? numbers(v.artLighting, PIXELS, 3) : Array(PIXELS).fill(0);
  assert(artLighting.every((value, i) => !value || (foreground[i] && artPixels[i * 4 + 3] === 255)), '명암 연결은 칠한 신체 픽셀에만 지정할 수 있습니다.');
  return { format: 'gecko-body-mask-editor', version: 4, specimenId: reference.specimenId,
    width: SIZE, height: SIZE, sourceRgbaSha256: reference.sourceRgbaSha256,
    regionOrder: [...REGION_IDS], labels, foreground, locks: [...v.locks] as RegionId[], artPixels,
    protection: v.version !== 1 ? numbers(v.protection, PIXELS, 1) : Array(PIXELS).fill(0),
    protectionEnabled: v.version === 1 ? true : v.protectionEnabled as boolean, shading, artLighting };
}

export function paintLayerPixels(document: MaskDocument, reference: MaskReference): number[] {
  const pixels = [...document.artPixels];
  // Also accepts an unchanged v1-v3 initial fixture before normalization.
  (document.artLighting ?? []).forEach((savedTone, i) => {
    if (!savedTone || !pixels[i * 4 + 3]) return;
    const tone = lightingExcluded(document, i) ? savedTone : document.shading[i];
    pixels.splice(i * 4, 3, ...shadeColour(document.artPixels.slice(i * 4, i * 4 + 3), tone));
  });
  return pixels;
}

/** The source stays immutable; erasing the paint layer reveals this source. */
export function composedPixels(document: MaskDocument, reference: MaskReference): number[] {
  const layer = paintLayerPixels(document, reference);
  return reference.pixels.map((value, i) => layer[(i - i % 4) + 3] ? layer[i] : value);
}
export function baseColourAt(document: MaskDocument, reference: MaskReference, i: number) {
  return (document.artPixels[i * 4 + 3] ? document.artPixels : reference.pixels).slice(i * 4, i * 4 + 3);
}

function visibleComposite(input: unknown): number[] {
  assert(Array.isArray(input) && input.length > 0 && input.length <= 64, '도트 파일의 레이어가 올바르지 않습니다.');
  const result = new Uint8ClampedArray(PIXELS * 4);
  for (const entry of input) {
    const layer = object(entry), pixels = numbers(layer.pixels, PIXELS * 4, 255);
    assert(typeof layer.visible === 'boolean', '레이어 표시 설정이 올바르지 않습니다.');
    if (!layer.visible) continue;
    for (let i = 0; i < result.length; i += 4) {
      const a = pixels[i + 3] / 255, b = result[i + 3] / 255, alpha = a + b * (1 - a);
      for (let c = 0; c < 3; c++) result[i + c] = alpha ? Math.round((pixels[i + c] * a + result[i + c] * b * (1 - a)) / alpha) : 0;
      result[i + 3] = Math.round(alpha * 255);
    }
  }
  return [...result];
}

/** Imports validate completely before the UI replaces any current work. */
export function parseDocument(text: string, reference: MaskReference): MaskDocument {
  assert(new TextEncoder().encode(text).length <= 2 * 1024 * 1024, '파일은 2MB 이하여야 합니다.');
  const v = object(JSON.parse(text));
  if (v.format === 'gecko-body-mask-editor') return validateDocument(v, reference);
  const studio = v.format === 'gecko-pixel-studio' && v.version === 1;
  assert(studio || (v.schema === 'gecko-body-region-masks' && v.version === 1), '마스크 작업·영역 데이터·도트 스튜디오 JSON을 선택하세요.');
  assert(v.width === SIZE && v.height === SIZE, '마스크 크기는 96×96이어야 합니다.');
  if (studio) {
    assert(same(numbers(v.baseline, PIXELS * 4, 255), reference.pixels), `도트 작업 파일의 원본 이미지가 ${reference.specimenId}과 다릅니다.`);
  } else {
    assert(v.specimenId === reference.specimenId && v.sourceRgbaSha256 === reference.sourceRgbaSha256, '다른 원본의 마스크 데이터입니다.');
    assert(same(numbers(v.foreground, PIXELS, 1), reference.foreground), '원본 신체 윤곽이 다른 마스크입니다.');
  }
  const masks = object(studio ? v.regions : v.masks);
  const keys = REGION_IDS.map(id => studio ? id.toLowerCase() : id);
  assert(Object.keys(masks).length === 7 && keys.every(key => Object.hasOwn(masks, key)), '정확히 7개 신체 마스크가 필요합니다.');
  const labels = Array(PIXELS).fill(0);
  keys.forEach((key, region) => numbers(masks[key], PIXELS, 1).forEach((value, i) => {
    if (!value) return;
    assert(!labels[i], `마스크가 겹칩니다: ${i % SIZE}, ${Math.floor(i / SIZE)}`);
    labels[i] = region + 1;
  }));
  let locks: RegionId[] = [];
  if (studio && v.lockedRegions !== undefined) {
    assert(Array.isArray(v.lockedRegions) && v.lockedRegions.every(id => keys.includes(id)), '도트 파일의 영역 잠금 정보가 올바르지 않습니다.');
    locks = v.lockedRegions.map(id => REGION_IDS[keys.indexOf(id)]);
  }
  const state = v.editorState === undefined ? null : object(v.editorState);
  if (state) assert([1, 2, 3].includes(state.version as number), '지원하지 않는 픽셀·보호 마스크 정보입니다.');
  let artPixels = state ? numbers(state.artPixels, PIXELS * 4, 255) : Array(PIXELS * 4).fill(0);
  const composite = studio ? visibleComposite(v.layers) : null;
  if (composite && !state) {
    assert(composite.every((value, i) => i % 4 !== 3 || value === 255), '현재 편집기는 불투명 원본 위의 도트 레이어를 지원합니다.');
    for (let i = 0; i < PIXELS; i++) if (composite.slice(i * 4, i * 4 + 4).some((value, c) => value !== reference.pixels[i * 4 + c])) {
      artPixels.splice(i * 4, 4, ...composite.slice(i * 4, i * 4 + 4));
    }
  }
  const document = validateDocument({ format: 'gecko-body-mask-editor', version: state?.version === 3 ? 4 : state?.version === 2 ? 3 : 2, specimenId: reference.specimenId,
    width: SIZE, height: SIZE, sourceRgbaSha256: reference.sourceRgbaSha256,
    regionOrder: REGION_IDS, foreground: [...reference.foreground], labels, locks,
    artPixels, protection: state ? state.protection : Array(PIXELS).fill(0), protectionEnabled: state ? state.protectionEnabled : true,
    shading: state?.shading, artLighting: state?.artLighting }, reference);
  if (composite) assert(same(composite, composedPixels(document, reference)), '도트 레이어와 저장된 픽셀 정보가 서로 다릅니다.');
  return document;
}

export function linePoints(x: number, y: number, endX: number, endY: number): [number, number][] {
  const points: [number, number][] = [], dx = Math.abs(endX - x), dy = -Math.abs(endY - y);
  const sx = x < endX ? 1 : -1, sy = y < endY ? 1 : -1; let error = dx + dy;
  while (true) {
    points.push([x, y]); if (x === endX && y === endY) return points;
    const twice = error * 2;
    if (twice >= dy) { error += dy; x += sx; }
    if (twice <= dx) { error += dx; y += sy; }
  }
}

export class MaskEditor {
  private doc: MaskDocument;
  private past: Patch[] = []; private future: Patch[] = []; private stroke: Stroke | null = null;
  constructor(document: MaskDocument, private reference: MaskReference) { this.doc = validateDocument(document, reference); }
  get document(): MaskDocument { return structuredClone(this.doc); }
  get canUndo() { return this.past.length > 0; }
  get canRedo() { return this.future.length > 0; }
  labelAt(x: number, y: number) { return this.doc.labels[y * SIZE + x] ?? 0; }
  isProtected(x: number, y: number) { return this.doc.protectionEnabled && !!this.doc.protection[y * SIZE + x]; }
  toneAt(x: number, y: number) { const i = y * SIZE + x; return this.doc.foreground[i] && !lightingExcluded(this.doc, i) ? this.doc.shading[i] : 0; }
  isLocked(region: RegionId) { return this.doc.locks.includes(region); }
  setLocked(region: RegionId, locked: boolean) {
    this.cancelStroke(); this.doc.locks = this.doc.locks.filter(id => id !== region);
    if (locked) this.doc.locks.push(region);
  }
  setProtectionEnabled(enabled: boolean) { this.cancelStroke(); this.doc.protectionEnabled = enabled; }
  private buffer(target: Channel) { return target === 'art' ? this.doc.artPixels : target === 'artLighting' ? this.doc.artLighting : target === 'protection' ? this.doc.protection : target === 'lighting' ? this.doc.shading : this.doc.labels; }
  private write(target: Channel, i: number, value: number, before: Changes) {
    const buffer = this.buffer(target); if (buffer[i] === value) return;
    let channel = before.get(target); if (!channel) { channel = new Map(); before.set(target, channel); }
    if (!channel.has(i)) channel.set(i, buffer[i]); buffer[i] = value;
  }
  private freezePaint(i: number, before: Changes) {
    if (this.doc.artLighting[i] && !lightingExcluded(this.doc, i)) this.write('artLighting', i, this.doc.shading[i], before);
  }
  private blocked(i: number) {
    return (this.doc.protectionEnabled && this.doc.protection[i]) || (this.doc.labels[i] && this.isLocked(REGION_IDS[this.doc.labels[i] - 1]));
  }
  beginStroke(tool: BrushTool, region: RegionId, size = 1, options: StrokeOptions = {}) {
    assert(!this.stroke, '이전 획을 먼저 마무리하세요.');
    assert(REGION_IDS.includes(region) && [1, 3, 5].includes(size), '브러시 설정 오류');
    const target = options.target ?? 'regions', colour = options.colour ?? '#000000';
    assert(['regions', 'art', 'protection', 'lighting'].includes(target) && /^#[a-f\d]{6}$/i.test(colour) && TONE_IDS.includes(options.tone ?? 'base'), '편집 대상이나 색상 오류');
    this.stroke = { tool, target, colour: [...colour.slice(1).match(/../g)!.map(v => parseInt(v, 16)), 255], tone: TONE_IDS.indexOf(options.tone ?? 'base') + 1,
      bodyOnly: options.bodyOnly ?? true, clipRegion: options.clipRegion ?? false, applyLighting: options.applyLighting ?? false,
      region: REGION_IDS.indexOf(region) + 1, size, before: new Map(), last: null };
  }
  breakStroke() { if (this.stroke) this.stroke.last = null; }
  strokeTo(x: number, y: number) {
    const s = this.stroke; assert(s, '브러시 획을 먼저 시작하세요.');
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || x >= SIZE || y < 0 || y >= SIZE) { this.breakStroke(); return; }
    const points = s.last ? linePoints(...s.last, x, y) : [[x, y]];
    for (const [px, py] of points) {
      const radius = (s.size - 1) / 2;
      for (let by = Math.max(0, py - radius); by <= Math.min(SIZE - 1, py + radius); by++) {
        for (let bx = Math.max(0, px - radius); bx <= Math.min(SIZE - 1, px + radius); bx++) {
          const i = by * SIZE + bx, label = this.doc.labels[i];
          if (s.target !== 'protection' && this.blocked(i)) continue;
          if (s.target === 'lighting' && (!this.doc.foreground[i] || lightingExcluded(this.doc, i))) continue;
          if (s.target === 'regions' && (!this.doc.foreground[i] || this.isLocked(REGION_IDS[s.region - 1]) || (s.tool === 'erase' && label !== s.region))) continue;
          if (s.target === 'art' && ((s.bodyOnly && !this.doc.foreground[i]) || (s.clipRegion && label !== s.region))) continue;
          if (s.target === 'art' && s.applyLighting && lightingExcluded(this.doc, i)) continue;
          const values = s.target === 'art' ? (s.tool === 'erase' ? [0, 0, 0, 0] : s.colour) : s.target === 'lighting' ? [s.tool === 'erase' ? 2 : s.tone] : [s.tool === 'erase' ? 0 : s.target === 'protection' ? 1 : s.region];
          values.forEach((next, c) => {
            const index = s.target === 'art' ? i * 4 + c : i;
            if (s.target === 'protection' && next && !this.doc.protection[i]) this.freezePaint(i, s.before);
            this.write(s.target, index, next, s.before);
          });
          if (s.target === 'art') this.write('artLighting', i, s.tool === 'paint' && s.applyLighting && this.doc.foreground[i] ? this.doc.artLighting[i] || this.doc.shading[i] : 0, s.before);
        }
      }
    }
    s.last = [x, y];
  }
  endStroke() {
    const s = this.stroke; this.stroke = null;
    if (!s) return false;
    return this.recordChanges(s.before);
  }
  cancelStroke() {
    if (this.stroke) for (const [target, values] of this.stroke.before) for (const [i, before] of values) this.buffer(target)[i] = before;
    this.stroke = null;
  }
  private record(patch: Patch) { this.past.push(patch); if (this.past.length > 100) this.past.shift(); this.future = []; }
  private recordChanges(before: Changes) {
    const patch: Patch = [];
    for (const [target, values] of before) {
      const buffer = this.buffer(target), indices = [...values.keys()].filter(i => values.get(i) !== buffer[i]);
      if (indices.length) patch.push({ target, indices, before: indices.map(i => values.get(i)!), after: indices.map(i => buffer[i]) });
    }
    if (!patch.length) return false; this.record(patch); return true;
  }
  undo() {
    this.cancelStroke(); const patch = this.past.pop(); if (!patch) return false;
    patch.forEach(change => change.indices.forEach((i, n) => { this.buffer(change.target)[i] = change.before[n]; })); this.future.push(patch); return true;
  }
  redo() {
    this.cancelStroke(); const patch = this.future.pop(); if (!patch) return false;
    patch.forEach(change => change.indices.forEach((i, n) => { this.buffer(change.target)[i] = change.after[n]; })); this.past.push(patch); return true;
  }
  reset(labels: number[]) {
    this.cancelStroke(); numbers(labels, PIXELS, 7);
    assert(labels.every((v, i) => !v || this.doc.foreground[i]), '신체 윤곽이 다른 초기 마스크입니다.');
    const indices = labels.flatMap((v, i) => v !== this.doc.labels[i] && !this.blocked(i) && (!v || !this.isLocked(REGION_IDS[v - 1])) ? [i] : []);
    if (!indices.length) return false;
    const before = indices.map(i => this.doc.labels[i]); indices.forEach(i => { this.doc.labels[i] = labels[i]; });
    this.record([{ target: 'regions', indices, before, after: indices.map(i => labels[i]) }]); return true;
  }
  setProtection(mask: number[], mode: 'replace' | 'add' | 'remove' = 'replace') {
    this.cancelStroke(); numbers(mask, PIXELS, 1);
    const next = mask.map((v, i) => mode === 'add' ? Number(v || this.doc.protection[i]) : mode === 'remove' ? Number(!v && this.doc.protection[i]) : v);
    const before: Changes = new Map();
    next.forEach((value, i) => { if (value && !this.doc.protection[i]) this.freezePaint(i, before); this.write('protection', i, value, before); });
    return this.recordChanges(before);
  }
  resetArt() {
    this.cancelStroke();
    const before: Changes = new Map();
    this.doc.artPixels.forEach((_, i) => { if (!this.blocked(Math.floor(i / 4))) this.write('art', i, 0, before); });
    this.doc.artLighting.forEach((_, i) => { if (!this.blocked(i)) this.write('artLighting', i, 0, before); });
    return this.recordChanges(before);
  }
  paintBackground(colour: string) {
    assert(/^#[a-f\d]{6}$/i.test(colour), '배경색은 #RRGGBB 형식이어야 합니다.');
    return this.replaceBackground([...colour.slice(1).match(/../g)!.map(value => parseInt(value, 16)), 255]);
  }
  resetBackground() { return this.replaceBackground([0, 0, 0, 0]); }
  private replaceBackground(rgba: number[]) {
    this.cancelStroke();
    const before: Changes = new Map();
    this.doc.foreground.forEach((body, i) => {
      // Background actions always retain protection, even when brush protection is disabled.
      if (body || this.doc.protection[i]) return;
      rgba.forEach((value, c) => this.write('art', i * 4 + c, value, before));
      this.write('artLighting', i, 0, before);
    });
    return this.recordChanges(before);
  }
  resetLighting() {
    this.cancelStroke();
    const initial = this.reference.lighting?.planeLabels ?? this.doc.foreground.map(value => value ? 2 : 0);
    return this.replaceBuffer('lighting', this.doc.shading.map((value, i) => this.blocked(i) || lightingExcluded(this.doc, i) ? value : initial[i]));
  }
  private replaceBuffer(target: EditTarget, values: number[]) {
    const buffer = this.buffer(target), indices = values.flatMap((v, i) => v !== buffer[i] ? [i] : []);
    if (!indices.length) return false;
    const before = indices.map(i => buffer[i]); indices.forEach(i => { buffer[i] = values[i]; });
    this.record([{ target, indices, before, after: indices.map(i => values[i]) }]); return true;
  }
  serialize() { return JSON.stringify(this.doc); }
  stats() {
    const counts = Array(8).fill(0); let missing = 0;
    this.doc.labels.forEach((label, i) => { counts[label]++; if (this.doc.foreground[i] && !label) missing++; });
    return { counts, missing, assigned: counts.slice(1).reduce((a, b) => a + b, 0), total: this.doc.foreground.reduce((a, b) => a + b, 0) };
  }
}

