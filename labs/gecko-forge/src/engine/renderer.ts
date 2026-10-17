import { renderSprite } from '@/engine/render';
import type { AppearanceRenderer, ForgeGecko, RenderInput } from './model';
import { calculatePhenotype, describeAppearance } from './appearance';
import { validateSeed, viability } from './individual';
import type { GeckoSpecimen } from '@/engine/model';

/** Baseline is main c934363 / patterns-1 (2.1.0), NOT a regional prototype.
 * This adapter replaces game/hardcore/adapter, without importing game data.
 * Existing C/S/H inheritance is intact; this baseline renderer has no dedicated
 * C/S/H material treatment. That limitation is deliberately not hidden. */
export function baselineSpecimen(input: RenderInput): GeckoSpecimen {
  validateSeed(input.seed);
  const { traits: t, genetics } = input.phenotype, s = genetics.scores;
  const { classification } = describeAppearance(input.phenotype, input.seed);
  const lilly = input.phenotype.observed['lilly-white'] === 'Lilly White';
  // Compound labels can replace Lilly/Axanthic labels. Traits retain the actual
  // expressed material independently of those naming shortcuts.
  const ax = t.color === '회색';
  return { schemaVersion: 1, id: 'forge', name: 'forge', seed: input.seed,
    state: { fire: input.fire }, appearance: {
      bodyColor: ax ? 'slate' : lilly ? 'cream' : s.red > .55 || s.orange > .58 ? 'orange' : s.brightness < .42 ? 'brown' : s.cream > .7 ? 'cream' : 'orange',
      patternStyle: lilly ? 'lilly' : ax ? 'axanthic' : classification.base.includes('트라이컬러') ? 'tricolor' : classification.base.includes('할리퀸') ? 'harlequin' : classification.base.includes('달마시안') ? 'dalmatian' : 'normal',
      dorsalCoverage: t.dorsal, flankCoverage: t.flank, spotCount: Math.min(70, t.spots.count), patterns: t,
      expression: { red: s.red, orange: s.orange, brightness: s.brightness, cream: s.cream,
        harlequin: s.harlequin, pinstripe: s.pinstripe, contrast: s.contrast },
    } };
}
export const baselineRenderer: AppearanceRenderer = {
  id: 'patterns-1', render: input => renderSprite(baselineSpecimen(input)),
};

/** Portable pure entry point: phenotype + visual seed -> straight RGBA 96×96.
 * Swap/implement AppearanceRenderer here. Browser Canvas is a separate UI port. */
export function renderAppearance(input: RenderInput, renderer: AppearanceRenderer = baselineRenderer) {
  validateSeed(input.seed);
  const result = renderer.render(input);
  if (result.width !== 96 || result.height !== 96 || result.pixels.length !== 96 * 96 * 4) throw new Error('출력은 96×96 RGBA여야 합니다.');
  return result;
}
const cache = new Map<string, ReturnType<typeof renderAppearance>>();
export function renderIndividual(g: ForgeGecko) {
  if (!viability(g.genome).viable) return null;
  const key = JSON.stringify([g.genome, g.visualSeed, g.fire]);
  let sprite = cache.get(key);
  if (!sprite) {
    sprite = renderAppearance({ phenotype: calculatePhenotype(g.genome), seed: g.visualSeed, fire: g.fire });
    cache.set(key, sprite);
    if (cache.size > 128) cache.delete(cache.keys().next().value!);
  }
  // Do not expose cached mutable buffers to UI callers or export plugins.
  return { ...sprite, pixels: sprite.pixels.slice(), layers: sprite.layers.map(l => ({ ...l, pixels: l.pixels.slice(), mask: l.mask.slice() })) };
}
