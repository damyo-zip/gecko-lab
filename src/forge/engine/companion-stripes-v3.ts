import { B_ORIGIN_01 as source } from './art/b-origin-01';
import { renderCompanionBase } from './companion-base';
import { DALMATIAN_FORELEG_REFINEMENT } from './companion-dalmatian-v3';
import { seededRandom } from './genetics';
import type { CompanionPatternsParameters } from './companion-patterns';

export const COMPANION_WEDGE_STRIPE_MODEL = {
  version: 3, primaryTracks: 3, accentTracks: 2,
  shape: 'Asymmetric tapered colour planes: two-pixel roots, one-pixel tips, three long sweeps and two shorter accents.',
  dorsal: 'The bright dorsal plane and its protected boundary remain continuous; stripes start on the flank.',
  brindle: 'Staggered breaks and short pointed branches growing into the parent sweep, never repeated U-shaped loops.',
  lighting: 'Original three-tone authored lighting once, followed by the existing white veil; no added light bands.',
} as const;
const N = 9216, roles = renderCompanionBase().materialMask;
const reserved = new Uint8Array(N);
for (const [y, x, n] of DALMATIAN_FORELEG_REFINEMENT.runs) reserved.fill(255, y * 96 + x, y * 96 + x + n);
const side = (i: number) => source.labels[i] === 3 || source.labels[i] === 4;
const eligible = (i: number) => !!source.foreground[i] && side(i) && !source.protection[i] && !reserved[i] && ![1, 2, 3, 5].includes(roles[i]);
const sections = Array.from({ length: 96 }, (_, x) => {
  const ys = source.labels.flatMap((_, i) => side(i) && i % 96 === x ? [Math.floor(i / 96)] : []);
  return ys.length ? { top: Math.min(...ys), bottom: Math.max(...ys), height: Math.max(...ys) - Math.min(...ys) + 1 } : null;
});
const adjacent = (i: number) => [i % 96 ? i - 1 : -1, i % 96 < 95 ? i + 1 : -1, i - 96, i + 96].filter(j => j >= 0 && j < N);
export function buildCompanionWedgeStripes(p: Pick<CompanionPatternsParameters, 'stripeStrength' | 'brindleStrength' | 'stripeWidth' | 'stripeSeed'>) {
  for (const v of [p.stripeStrength, p.brindleStrength, p.stripeWidth]) if (!Number.isFinite(v) || v < 0 || v > 1) throw Error('무늬 발현 설정은 0~1이어야 합니다.');
  if (!Number.isInteger(p.stripeSeed) || p.stripeSeed < 0 || p.stripeSeed > 0xffffffff) throw Error('줄무늬 시드는 uint32 정수여야 합니다.');
  const mask = new Uint8Array(N), owners = new Uint8Array(N);
  if (!p.stripeStrength) return { mask, owners };
  const rng = seededRandom(String(p.stripeSeed), 'companion:wedge-layout:3');
  const roots = [42, 52, 63].map(x => x + (rng() - .5) * 3.8);
  const sweeps = roots.map((root, n) => ({ root, end: [.89, .98, .82][n] + (rng() - .5) * .14,
    sweep: [6.3, 1.0, -4.2][n] + (rng() - .5) * 2.4, bow: [.8, 4.2, 1.7][n] + (rng() - .5) * 1.4,
    gap: [.48, .56, .34][n] + (rng() - .5) * .16, primary: true }));
  const accents = [0, 1].map((n) => ({ root: (n ? roots[2] + 4.8 : roots[0] - 6.5) + (rng() - .5) * 2.4,
    end: [.35, .46][n] + (rng() - .5) * .15, sweep: n ? -1.8 : 2.4, bow: .6,
    gap: .7, primary: false }));
  const tracks = [...sweeps, ...accents];
  const stamp = (x: number, y: number, owner: number) => {
    if (x < 33 || x > 83 || y < 0 || y > 95) return;
    const i = y * 96 + x; if (eligible(i)) { mask[i] = 255; owners[i] = owner; }
  };
  tracks.forEach((track, n) => {
    const c = sections[Math.round(track.root)]; if (!c) return;
    const start = track.primary ? 0 : .04 + n % 2 * .08, end = Math.min(1, track.end);
    const centerAt = (t: number) => track.root + track.sweep * t + track.bow * Math.sin(Math.PI * t) + p.brindleStrength * .45 * Math.sin(t * 6 + n);
    const gapY = c.top + track.gap * (c.height - 1);
    const isGap = (y: number) => track.primary && n !== 0 && p.brindleStrength > 0 && Math.abs(y - gapY) < 1.55 * p.brindleStrength;
    let prior: { x: number; y: number } | null = null;
    for (let y = c.top; y <= c.bottom; y++) {
      const t = (y - c.top) / Math.max(1, c.height - 1);
      if (t < start || t > end || isGap(y)) { prior = null; continue; }
      const center = centerAt(t), x = Math.round(center), progress = (t - start) / (end - start);
      const width = Math.max(.25, (1.9 + p.stripeWidth * .7) * (1 - .76 * progress * progress) * (track.primary ? 1 : .8));
      stamp(x, y, n + 1);
      const shoulder = Math.abs(center - (x - 1)) < Math.abs(center - (x + 1)) ? x - 1 : x + 1;
      if (width > 1.25) stamp(shoulder, y, n + 1);
      if (prior && prior.y === y - 1 && Math.abs(prior.x - x) === 1) stamp(prior.x, y, n + 1);
      prior = { x, y };
    }
    // A short branch converges into the sweep; its pointed end faces upward.
    if (track.primary && p.brindleStrength > .2 && n === 0) {
      const join = .38, length = (.13 + .15 * p.brindleStrength), direction = 1;
      let previous: { x: number; y: number } | null = null;
      for (let y = c.top; y <= c.bottom; y++) {
        const t = (y - c.top) / Math.max(1, c.height - 1), u = (t - join + length) / length;
        if (u < 0 || u > 1 || isGap(y)) { previous = null; continue; }
        const x = Math.round(centerAt(t) + direction * (1 - u) * (1.2 + 2.5 * p.brindleStrength));
        stamp(x, y, n + 1);
        if (previous && previous.y === y - 1 && Math.abs(previous.x - x) === 1) stamp(previous.x, y, n + 1);
        previous = { x, y };
      }
    }
  });
  const seen = new Uint8Array(N);
  for (let i = 0; i < N; i++) if (mask[i] && !seen[i]) {
    const q = [i]; seen[i] = 1;
    for (let n = 0; n < q.length; n++) for (const j of adjacent(q[n])) if (mask[j] && !seen[j]) { seen[j] = 1; q.push(j); }
    if (q.length < 3) q.forEach(j => { mask[j] = owners[j] = 0; });
  }
  return { mask, owners };
}
