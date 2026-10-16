import { validateMendelian, pairKey, LOCI } from '@/genetics/advanced/loci';
import { polyScores } from '@/genetics/advanced/polygenic';
import { mix } from '@/engine/raster';
import { patternTraits } from '@/genetics/advanced/pattern-traits';
import type { Genome } from '@/genetics/advanced/model';
import { PROTOTYPE_VERSION, type PrototypePhenotype } from './model';

export const unit = (v: number) => Math.max(0, Math.min(1, v));
const range = (v: number, low: number, high: number) => unit((v - low) / (high - low));

/** Coefficients are a visual GAME approximation of breeder observations, not
 * identified modifier genes, penetrance estimates, or real breeding odds.
 * Existing 60-locus inheritance is read, never edited. Evidence: evidence.ts. */
export function prototypePhenotype(genome: Genome): PrototypePhenotype {
  validateMendelian(genome.mendelian);
  const s = polyScores(genome.polygenic);
  const lw = pairKey(genome.mendelian.loci['lilly-white'], LOCI[0]);
  if (lw === 'Lw/Lw') throw new Error('비생존 릴리 동형접합은 외형 예제로 만들지 않습니다.');
  const complex = pairKey(genome.mendelian.loci['cappuccino-complex'], LOCI[2]);
  if (!['n/n', 'n/C', 'n/S', 'n/H'].includes(complex))
    throw new Error('두 복합 변이 사본의 외형은 이 프로토타입에서 아직 모델링하지 않습니다.');
  const expressed = { lilly: lw === 'n/Lw', axanthic: genome.mendelian.loci.axanthic.every(a => a === 'ax'),
    cappuccino: complex === 'n/C', highway: complex === 'n/H', sable: complex === 'n/S' };
  const strength = {
    lilly: range(s.cream * .45 + s.flank * .20 + s.dorsal * .20 + s.harlequin * .15, .10, .84),
    cappuccino: range(s.contrast * .40 + s.cream * .30 + s.dorsal * .30, .18, .87),
    highway: range(s.pinstripe * .45 + s.dorsal * .35 + s.cream * .20, .15, .89),
    sable: range(s.cream * .40 + s.dorsal * .35 + s.contrast * .25, .15, .86),
  };
  // Read the inherited background without the old fixed Lilly/gray overrides.
  const background = patternTraits({ ...genome, mendelian: { version: 1, loci: {
    'lilly-white': ['n', 'n'], axanthic: ['A', 'A'], 'cappuccino-complex': ['n', 'n'],
  } } });
  let base = background.palette.base;
  if (expressed.cappuccino) base = mix(base, [68, 48, 39], .16 + strength.cappuccino * .32);
  if (expressed.sable) base = mix(base, [49, 43, 40], .32 + strength.sable * .34);
  // Ax changes pigment materials BEFORE lighting, not a post-render gray filter.
  // Brightness is retained; dark patches are a separate spatial melanin channel.
  if (expressed.axanthic) {
    const gray = Math.round(24 + s.brightness * 178);
    base = [gray, gray + 1, gray + 3];
  }
  return { version: PROTOTYPE_VERSION, scores: s, expressed, strength,
    palette: { base,
      secondary: expressed.axanthic ? [13 + s.brightness * 23, 14 + s.brightness * 23, 16 + s.brightness * 23] :
        mix(background.palette.secondary, [37, 29, 25], expressed.sable ? .62 : expressed.cappuccino ? .38 : .08),
      cream: expressed.axanthic ? [226, 229, 232] : background.palette.cream,
      white: expressed.axanthic ? [247, 248, 249] : expressed.lilly ? [253, 249, 235] : [247, 239, 219],
      ink: expressed.axanthic ? [10, 11, 14] : [37, 25, 23] },
    melanin: unit((1 - s.brightness) * .65 + s.contrast * .25), contrast: s.contrast };
}
