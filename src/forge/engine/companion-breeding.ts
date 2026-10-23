import { createPatternlessFounder, createPatternlessOffspring, assertPatternlessGenome, type ColourPresetId } from './patternless-breeding';
import type { FounderInput } from './individual';
import { seededRandom } from './genetics';
import { emptyWorkspace, importWorkspace } from './workspace';
import { COMPANION_FLAME_RENDERER_ID } from './companion-flame';

/** Founder recipes configure existing alleles. These IDs are never inherited. */
export const COMPANION_PRESETS = [
  { id: 'base', name: '기본형', flank: 0, harlequin: 0, colour: 'orange' },
  { id: 'flame', name: '플레임', flank: 2.5, harlequin: 2, colour: 'orange' },
  { id: 'harlequin', name: '할리퀸', flank: 3.7, harlequin: 3.4, colour: 'orange' },
] as const;
export type CompanionPresetId = typeof COMPANION_PRESETS[number]['id'];
export function createCompanionFounder(input: Omit<FounderInput, 'mendelian'> & { morph: CompanionPresetId; colour?: ColourPresetId }) {
  const recipe = COMPANION_PRESETS.find(p => p.id === input.morph); if (!recipe) throw Error('기본형·플레임·할리퀸 중 선택하세요.');
  const g = createPatternlessFounder({ ...input, colour: input.colour ?? recipe.colour });
  for (const feature of ['flank', 'harlequin'] as const) for (let n = 0; n < 6; n++) {
    const rng = seededRandom(input.seed, `companion:founder:${feature}-${n}`), allele = () => Math.max(0, Math.min(4, Math.round(recipe[feature] + (rng() - .5) * 1.7)));
    g.genome.polygenic.loci[`${feature}-${n}`] = [allele(), allele()];
  }
  return g;
}
export const createCompanionOffspring = createPatternlessOffspring;
export function emptyCompanionWorkspace() {
  const board = emptyWorkspace(COMPANION_FLAME_RENDERER_ID); board.settings.showB = false; board.offspringCount = 6; board.breedingSeed = 'companion-cross-1'; return board;
}
export function starterCompanionWorkspace() {
  const board = emptyCompanionWorkspace();
  board.individuals = [
    createCompanionFounder({ id: 'C-0001', seed: 'companion-amber-13', morph: 'flame', sex: 'male', name: '호박' }),
    createCompanionFounder({ id: 'C-0002', seed: 'companion-sand-39', morph: 'harlequin', sex: 'female', name: '모래' }),
  ];
  board.nextId = 3; board.selectedId = board.fatherId = 'C-0001'; board.motherId = 'C-0002'; return board;
}
export function importCompanionWorkspace(json: string) {
  const board = importWorkspace(json);
  if (board.rendererVersion !== COMPANION_FLAME_RENDERER_ID) throw Error('기본형 01의 플레임 계열 교배판을 선택하세요.');
  for (const g of board.individuals) {
    try { assertPatternlessGenome(g.genome); }
    catch { throw Error('이번 플레임 계열 교배판은 일반 멘델 유전형을 사용합니다.'); }
  }
  return board;
}
