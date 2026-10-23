import { B_ORIGIN_01 as source } from './art/b-origin-01';
import { CAPPUCCINO_TAIL } from './art/cappuccino-tail';
import { renderCompanionBase } from './companion-base';
import { DALMATIAN_FORELEG_REFINEMENT } from './companion-dalmatian-v3';
import { seededRandom } from './genetics';
import type { CompanionPatternsParameters } from './companion-patterns';

/** Breeder references and the distinction from v3 are recorded in docs/research/tiger-2026-10-21.md. */
export const COMPANION_TRANSVERSE_STRIPE_MODEL = {
  version: 4,
  direction: 'Transverse to the nose-to-tail axis: one band crosses dorsal and lateral planes, tapering towards the belly.',
  shape: 'Six unequal, seeded band paths with broad dorsal shoulders and narrow, irregular lateral ends; no repeated rib strokes.',
  dorsal: 'Warm skin between bands replaces the continuous cream saddle as tigering increases; actual pins and protective structure stay above it.',
  brindle: 'The same band paths develop staggered interruptions, displaced lower fragments and short attached branches.',
  accessories: 'A few weaker bands follow the curved tail distance field; Cappuccino tail material takes precedence.',
  lighting: 'Pigment albedo, then original authored three-tone lighting once, then the existing Lilly veil.',
  references: ['https://www.fringemorphs.com/crested-gecko-morphs', 'https://community.morphmarket.com/t/crested-gecko-morph-trait-guide/19766/1'],
  limits: 'Reference-informed native pixel art; coefficients and inherited trait mapping are game parameters, not measured biological genetics.',
} as const;
const N = 9216, roles = renderCompanionBase().materialMask;
const reserved = new Uint8Array(N), tail = new Int16Array(N).fill(-1);
for (const [y, x, n] of DALMATIAN_FORELEG_REFINEMENT.runs) reserved.fill(255, y * 96 + x, y * 96 + x + n);
for (const [y, x, n, d] of CAPPUCCINO_TAIL.runs) tail.fill(d, y * 96 + x, y * 96 + x + n);
const body = (i: number) => [2, 3, 4].includes(source.labels[i]);
const eligible = (i: number) => !!source.foreground[i] && !source.protection[i] && !reserved[i] && ![1, 2, 3, 5].includes(roles[i]);
const sections = Array.from({ length: 96 }, (_, x) => {
  const ys = source.labels.flatMap((_, i) => body(i) && i % 96 === x ? [Math.floor(i / 96)] : []);
  return ys.length ? { top: Math.min(...ys), bottom: Math.max(...ys), height: Math.max(...ys) - Math.min(...ys) } : null;
});
const flanks = Array.from({ length: 96 }, (_, x) => {
  const ys = source.labels.flatMap((label, i) => [3, 4].includes(label) && i % 96 === x ? [Math.floor(i / 96)] : []);
  return ys.length ? { top: Math.min(...ys), bottom: Math.max(...ys), height: Math.max(...ys) - Math.min(...ys) + 1 } : null;
});
export interface CompanionStripeExtent {
  minimumLateralRows: number;
  maximumLateralDepth: number;
  bellyClearance: number;
}
const adjacent = (i: number) => [i % 96 ? i - 1 : -1, i % 96 < 95 ? i + 1 : -1, i - 96, i + 96].filter(j => j >= 0 && j < N);
export function buildCompanionTransverseStripes(p: Pick<CompanionPatternsParameters, 'stripeStrength' | 'brindleStrength' | 'stripeWidth' | 'stripeSeed'>, extent?: CompanionStripeExtent) {
  for (const v of [p.stripeStrength, p.brindleStrength, p.stripeWidth]) if (!Number.isFinite(v) || v < 0 || v > 1) throw Error('무늬 발현 설정은 0~1이어야 합니다.');
  if (!Number.isInteger(p.stripeSeed) || p.stripeSeed < 0 || p.stripeSeed > 0xffffffff) throw Error('줄무늬 시드는 uint32 정수여야 합니다.');
  if (extent && (!Number.isInteger(extent.minimumLateralRows) || extent.minimumLateralRows < 1 || extent.minimumLateralRows > 4 || !Number.isFinite(extent.maximumLateralDepth) || extent.maximumLateralDepth <= 0 || extent.maximumLateralDepth > 1 || !Number.isInteger(extent.bellyClearance) || extent.bellyClearance < 1 || extent.bellyClearance > 4)) throw Error('줄무늬의 옆구리 길이 설정이 올바르지 않습니다.');
  const mask = new Uint8Array(N), owners = new Uint8Array(N);
  if (!p.stripeStrength) return { mask, owners };
  const rng = seededRandom(String(p.stripeSeed), 'companion:transverse-layout:4');
  const tracks = [36.5, 43.8, 52, 60.8, 71.8, 80].map((root, n) => ({
    root: root + (rng() - .5) * 2.8,
    sweep: [3.8, 4.5, -.8, -3.6, -2.5, 1.8][n] + (rng() - .5) * 2,
    bend: [.6, 1.9, 2.8, 1.4, 1, .6][n] + (rng() - .5) * 1.2,
    end: [.72, .95, .86, .98, .76, .72][n] + (rng() - .5) * .12,
    weight: [.75, 1, .9, 1.15, .85, .72][n] + (rng() - .5) * .18,
    gap: [.50, .43, .65, .47, .59, .32][n] + (rng() - .5) * .12,
  }));
  // Opt-in extent control is used by v5. Leaving it absent reproduces v4.
  const floor = (x: number) => {
    const c = flanks[Math.max(0, Math.min(95, Math.round(x)))];
    if (!c || !extent) return 95;
    const clearance = Math.min(extent.bellyClearance, Math.max(1, c.height - 2));
    return Math.min(c.bottom - clearance, c.top + Math.floor((c.height - 1) * extent.maximumLateralDepth));
  };
  const stamp = (x: number, y: number, owner: number, domain = body) => {
    if (x < 0 || x > 95 || y < 0 || y > 95) return;
    const i = y * 96 + x;
    if (extent && [3, 4].includes(source.labels[i]) && y > floor(x)) return;
    if (eligible(i) && domain(i)) { mask[i] = 255; owners[i] = owner; }
  };
  tracks.forEach((b, n) => {
    const c = sections[Math.round(b.root)]; if (!c) return;
    const center = (t: number) => b.root + b.sweep * t + b.bend * Math.sin(Math.PI * t);
    const gapY = c.top + c.height * b.gap;
    // Alternating intervals avoid one horizontal cut through the whole animal.
    const gapRadius = p.brindleStrength * (n % 2 ? 2.9 : 2.2);
    let firstLateral = -1;
    if (extent) for (let y = c.top; y <= Math.min(95, c.bottom + 6); y++) {
      const t = (y - c.top) / Math.max(1, c.height);
      const x = Math.round(center(t) + (y > gapY ? p.brindleStrength * (n % 2 ? -1.6 : 1.3) : 0));
      const i = y * 96 + x;
      if (x >= 0 && x < 96 && eligible(i) && [3, 4].includes(source.labels[i]) && y <= floor(x)) { firstLateral = y; break; }
    }
    const naturalEnd = c.top + c.height * b.end;
    const minimumEnd = firstLateral < 0 ? naturalEnd : firstLateral + extent!.minimumLateralRows - 1;
    const end = Math.max(naturalEnd, minimumEnd), shortDip = minimumEnd > naturalEnd;
    for (let y = c.top - 1; y <= (extent ? Math.min(95, Math.ceil(end)) : c.bottom); y++) {
      const t = (y - c.top) / Math.max(1, c.height);
      const preserveDip = extent && shortDip && y >= firstLateral && y <= minimumEnd;
      if (t < 0 || (extent ? y > end : t > b.end) || !preserveDip && p.brindleStrength > 0 && Math.abs(y - gapY) < gapRadius) continue;
      const displacement = y > gapY ? p.brindleStrength * (n % 2 ? -1.6 : 1.3) : 0;
      const mid = center(t) + displacement;
      const shoulder = 1 + .13 * Math.sin(t * 9 + n * 1.8);
      const lateral = [3, 4].includes(source.labels[y * 96 + Math.round(mid)]);
      const originalTip = t > b.end - .12 ? .55 : 1;
      const tip = extent && lateral ? Math.min(originalTip, y >= Math.min(end, floor(mid)) - 1 ? .55 : 1) : originalTip;
      let radius = (1.05 + 1.05 * p.stripeWidth) * b.weight * (1 - .5 * t ** 1.6) * shoulder * tip;
      // A two-pixel shoulder plus one-pixel tip reads as a short connected dip,
      // even when the protected dorsal boundary separates it from the back.
      if (preserveDip && y === firstLateral) radius = Math.max(radius, 1.05);
      for (let x = Math.floor(mid - radius); x <= Math.ceil(mid + radius); x++) {
        if (Math.abs(x - mid) <= Math.max(.52, radius)) stamp(x, y, n + 1);
      }
    }
    // Short connected forks belong to the band; never scattered dots or loops.
    if (p.brindleStrength > .35 && [1, 3, 4].includes(n)) {
      const join = .28, length = .16 + .1 * p.brindleStrength;
      for (let y = c.top; y <= c.bottom; y++) {
        const t = (y - c.top) / Math.max(1, c.height), u = (t - join + length) / length;
        if (u < 0 || u > 1 || Math.abs(y - gapY) < gapRadius) continue;
        const mid = center(t) + (1 - u) * (2.7 + p.brindleStrength) * (n % 2 ? -1 : 1);
        stamp(Math.round(mid), y, n + 1);
      }
    }
  });
  // The hindmost body flow continues onto the exposed outer thigh, without
  // drawing through the limb's protected crease or its pale inner surface.
  const haunchX = 75 + (rng() - .5) * 2;
  for (let y = 49; y <= 55; y++) {
    const x = Math.round(haunchX - (y - 49) * .35);
    stamp(x, y, 5, i => source.labels[i] === 6 && roles[i] !== 4);
    if (y < 52) stamp(x + 1, y, 5, i => source.labels[i] === 6 && roles[i] !== 4);
  }
  // Distance runs follow the curl instead of laying world-space lines over it.
  const tailBands = [9, 24, 40].map(d => d + (rng() - .5) * 4);
  for (let i = 0; i < N; i++) if (source.labels[i] === 7 && eligible(i) && tail[i] >= 0) {
    const d = tail[i], x = i % 96, y = Math.floor(i / 96);
    const wobble = p.brindleStrength * Math.sin((x + y) * .7);
    if (tailBands.some(v => Math.abs(d - v + wobble) < .7 + .35 * p.stripeWidth)) stamp(x, y, 6, j => source.labels[j] === 7);
  }
  if (extent) for (let owner = 1; owner <= 6; owner++) {
    const lateral = source.labels.flatMap((label, i) => owners[i] === owner && [3, 4].includes(label) ? [i] : []);
    if (lateral.length >= 3) continue;
    const anchors = source.labels.flatMap((label, i) => owners[i] === owner && label === 2 ? [i] : []);
    if (!anchors.length) continue;
    const bottom = Math.max(...anchors.map(i => Math.floor(i / 96)));
    const ends = anchors.filter(i => Math.floor(i / 96) >= bottom - 1);
    const shapes = [[[0, 0], [1, 0], [0, 1]], [[0, 0], [-1, 0], [0, 1]], [[0, 0], [0, 1], [1, 1]], [[0, 0], [0, 1], [-1, 1]]];
    let best: { score: number; points: number[] } | undefined;
    // Protected contour pixels can separate the two planes. Continue immediately
    // below the existing band with a three-pixel shoulder/tip, never through a leg.
    for (const anchor of ends) for (let dy = 1; dy <= 5; dy++) for (let dx = -2; dx <= 2; dx++) for (const shape of shapes) {
      const x = anchor % 96 + dx, y = Math.floor(anchor / 96) + dy;
      const points = shape.map(([a, b]) => (y + b) * 96 + x + a);
      if (points.some(i => i < 0 || i >= N || !eligible(i) || ![3, 4].includes(source.labels[i]) || Math.floor(i / 96) > floor(i % 96) || owners[i] && owners[i] !== owner)) continue;
      const score = dy + Math.abs(dx) * 2;
      if (!best || score < best.score) best = { score, points };
    }
    if (best) for (const i of best.points) { mask[i] = 255; owners[i] = owner; }
  }
  // Silhouette clipping may leave single pixels; retain short bands, not freckles.
  const seen = new Uint8Array(N);
  for (let i = 0; i < N; i++) if (mask[i] && !seen[i]) {
    const q = [i]; seen[i] = 1;
    for (let n = 0; n < q.length; n++) for (const j of adjacent(q[n])) if (mask[j] && !seen[j]) { seen[j] = 1; q.push(j); }
    if (q.length < 3) q.forEach(j => { mask[j] = owners[j] = 0; });
  }
  return { mask, owners };
}
