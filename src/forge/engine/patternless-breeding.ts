import { createFounder, createOffspring, validateGenome, type FounderInput } from './individual';
import { seededRandom, wildGenome, type Genome } from './genetics';
import { emptyWorkspace, importWorkspace } from './workspace';
import { PATTERNLESS_RENDERER_ID } from './patternless';
import type { ForgeGecko, Workspace } from './model';

export const COLOUR_PRESETS = [
  { id: 'brown', name: '브라운', means: [1.6, 1.9, 1.3, 1.2] },
  { id: 'yellow', name: '옐로', means: [.5, 3.5, 3.1, 1.1] },
  { id: 'orange', name: '오렌지', means: [2.1, 3.4, 2.4, 1.0] },
  { id: 'red', name: '레드', means: [3.6, 2.2, 2.25, .8] },
  { id: 'olive', name: '올리브', means: [.8, .75, 2, 1.1] },
  { id: 'cream', name: '크림', means: [1.4, 2.6, 3.5, 3.6] },
  { id: 'charcoal', name: '차콜', means: [.6, 1.1, .45, .8] },
] as const;
export type ColourPresetId = typeof COLOUR_PRESETS[number]['id'];
export function assertPatternlessGenome(genome: Genome) {
  validateGenome(genome);
  const wild = wildGenome();
  if (Object.entries(wild.loci).some(([id, pair]) => genome.mendelian.loci[id].some((allele, i) => allele !== pair[i]))) throw new Error('패턴리스 교배는 기본 멘델 유전형의 개체를 사용합니다.');
}
export function createPatternlessFounder(input: Omit<FounderInput, 'mendelian'> & { colour: ColourPresetId }): ForgeGecko {
  const preset = COLOUR_PRESETS.find(p => p.id === input.colour); if (!preset) throw new Error('지원하지 않는 체색입니다.');
  const gecko = createFounder({ ...input, mendelian: wildGenome() });
  // Configure actual founder alleles. Children use the unchanged inheritPoly
  // implementation; colour names, hex values and parental averages are not inherited.
  ['red', 'orange', 'brightness', 'cream'].forEach((feature, f) => {
    for (let locus = 0; locus < 6; locus++) {
      const rng = seededRandom(input.seed, `patternless:founder:${feature}-${locus}`);
      const allele = () => Math.max(0, Math.min(4, Math.round(preset.means[f] + (rng() - .5) * 2)));
      gecko.genome.polygenic.loci[`${feature}-${locus}`] = [allele(), allele()];
    }
  });
  return gecko;
}
export function createPatternlessOffspring(father: ForgeGecko, mother: ForgeGecko, input: { id: string; seed: string; visualSeed?: string }) {
  assertPatternlessGenome(father.genome); assertPatternlessGenome(mother.genome);
  return createOffspring(father, mother, input);
}
export function emptyPatternlessWorkspace(): Workspace {
  const workspace = emptyWorkspace(PATTERNLESS_RENDERER_ID); workspace.settings.showB = false; workspace.offspringCount = 8; workspace.breedingSeed = 'patternless-cross-1'; return workspace;
}
export function starterPatternlessWorkspace(): Workspace {
  const workspace = emptyPatternlessWorkspace();
  workspace.individuals = COLOUR_PRESETS.map((preset, i) => createPatternlessFounder({ id: `P-${String(i + 1).padStart(4, '0')}`, seed: `patternless-starter-${preset.id}`, colour: preset.id, sex: i % 2 ? 'female' : 'male', name: preset.name }));
  workspace.nextId = workspace.individuals.length + 1; workspace.fatherId = workspace.individuals[0].id; workspace.motherId = workspace.individuals[1].id; workspace.selectedId = workspace.fatherId; return workspace;
}
export function importPatternlessWorkspace(json: string): Workspace {
  const workspace = importWorkspace(json);
  if (workspace.rendererVersion !== PATTERNLESS_RENDERER_ID) throw new Error('B-ORIGIN-01 패턴리스 교배 파일을 선택하세요.');
  workspace.individuals.forEach(g => assertPatternlessGenome(g.genome)); return workspace;
}
