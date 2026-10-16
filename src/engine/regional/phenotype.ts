import { validateMendelian, pairKey, LOCI } from '@/genetics/advanced/loci';
import { polyScores } from '@/genetics/advanced/polygenic';
import { mix } from '@/engine/raster';
import { patternTraits } from '@/genetics/advanced/pattern-traits';
import type { Genome } from '@/genetics/advanced/model';
import { APPEARANCE_VERSION, type RegionalPhenotype } from './model';

export const unit = (v: number) => Math.max(0, Math.min(1, v));
const range = (v: number, low: number, high: number) => unit((v - low) / (high - low));

/** Coefficients are a visual GAME approximation of breeder observations, not
 * identified modifier genes, penetrance estimates, or real breeding odds.
 * Existing 60-locus inheritance is read, never edited. Evidence: evidence.ts. */
export function regionalPhenotype(genome: Genome): RegionalPhenotype {
  validateMendelian(genome.mendelian);
  const s = polyScores(genome.polygenic);
  const lw = pairKey(genome.mendelian.loci['lilly-white'], LOCI[0]);
  if (lw === 'Lw/Lw') throw new Error('비생존 릴리 동형접합은 외형 예제로 만들지 않습니다.');
  // Existing same-locus transmission is unchanged. Two-copy and mixed C/S/H
  // expression below is provisional visual GAME modelling, not penetrance or
  // a new viability rule. Single-copy reviewed outputs remain byte-identical.
  const copies=(a:string)=>genome.mendelian.loci['cappuccino-complex'].filter(v=>v===a).length;
  const expressed = { lilly: lw === 'n/Lw', axanthic: genome.mendelian.loci.axanthic.every(a => a === 'ax'),
    cappuccino: copies('C')>0, highway: copies('H')>0, sable: copies('S')>0 };
  const strength = {
    lilly: range(s.cream * .45 + s.flank * .20 + s.dorsal * .20 + s.harlequin * .15, .10, .84),
    cappuccino: range(s.contrast * .40 + s.cream * .30 + s.dorsal * .30, .18, .87),
    highway: range(s.pinstripe * .45 + s.dorsal * .35 + s.cream * .20, .15, .89),
    sable: range(s.cream * .40 + s.dorsal * .35 + s.contrast * .25, .15, .86),
  };
  // Homozygous copies increase the existing regional expression channels.
  // Mixed pairs compose C tail markers → H dorsal expansion → S crown clusters.
  for(const [key,allele] of [['cappuccino','C'],['highway','H'],['sable','S']] as const)
    if(copies(allele)===2)strength[key]=unit(strength[key]*1.12+.12);
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
  return { version: APPEARANCE_VERSION, scores: s, expressed, strength,
    palette: { base,
      secondary: expressed.axanthic ? [13 + s.brightness * 23, 14 + s.brightness * 23, 16 + s.brightness * 23] :
        mix(background.palette.secondary, [37, 29, 25], expressed.sable ? .62 : expressed.cappuccino ? .38 : .08),
      cream: expressed.axanthic ? [226, 229, 232] : background.palette.cream,
      white: expressed.axanthic ? [247, 248, 249] : expressed.lilly ? [253, 249, 235] : [247, 239, 219],
      ink: expressed.axanthic ? [10, 11, 14] : [37, 25, 23] },
    melanin: unit((1 - s.brightness) * .65 + s.contrast * .25), contrast: s.contrast };
}
