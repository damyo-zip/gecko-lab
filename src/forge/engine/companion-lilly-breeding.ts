import { createCompanionFounder, COMPANION_PRESETS, importCompanionWorkspace } from './companion-breeding';
import { COMPANION_FLAME_RENDERER_ID } from './companion-flame';
import { COMPANION_LILLY_RENDERER_ID } from './companion-lilly';
import { createOffspring, validateGenome, viability, type FounderInput } from './individual';
import { emptyWorkspace, importWorkspace } from './workspace';
import type { Genome } from './genetics';
import type { ColourPresetId } from './patternless-breeding';

export const COMPANION_LILLY_PRESETS = [...COMPANION_PRESETS,
  { id: 'lilly', name: '릴리화이트', flank: 3.7, harlequin: 3.4, colour: 'orange' }] as const;
export type CompanionLillyPresetId = typeof COMPANION_LILLY_PRESETS[number]['id'];
export function assertCompanionLillyGenome(genome: Genome) {
  validateGenome(genome);
  if (genome.mendelian.loci.axanthic.some(a => a !== 'A') || genome.mendelian.loci['cappuccino-complex'].some(a => a !== 'n'))
    throw Error('이 교배판은 일반형과 릴리화이트 유전형을 지원합니다.');
}
export function createCompanionLillyFounder(input: Omit<FounderInput, 'mendelian'> & { morph: CompanionLillyPresetId; colour?: ColourPresetId }) {
  const g = createCompanionFounder({ ...input, morph: input.morph === 'lilly' ? 'harlequin' : input.morph });
  if (input.morph === 'lilly') g.genome.mendelian.loci['lilly-white'] = ['n', 'Lw'];
  return g;
}
export function createCompanionLillyOffspring(father: Parameters<typeof createOffspring>[0], mother: Parameters<typeof createOffspring>[1], input: Parameters<typeof createOffspring>[2]) {
  assertCompanionLillyGenome(father.genome); assertCompanionLillyGenome(mother.genome);
  return createOffspring(father, mother, input);
}
export function emptyCompanionLillyWorkspace() {
  const board = emptyWorkspace(COMPANION_LILLY_RENDERER_ID); board.settings.showB = false;
  board.offspringCount = 6; board.breedingSeed = 'lilly-cross-1'; return board;
}
export function starterCompanionLillyWorkspace() {
  const board = emptyCompanionLillyWorkspace();
  board.individuals = [
    createCompanionLillyFounder({ id: 'C-0001', seed: 'companion-amber-13', morph: 'flame', sex: 'male', name: '호박' }),
    createCompanionLillyFounder({ id: 'C-0002', seed: 'companion-sand-39', morph: 'lilly', sex: 'female', name: '설화' }),
  ];
  board.nextId = 3; board.selectedId = board.motherId = 'C-0002'; board.fatherId = 'C-0001'; return board;
}
/** Explicit upgrade accepts the preceding family, retaining its genomes and pixels. */
export function importCompanionLillyWorkspace(json: string) {
  let board = importWorkspace(json);
  if (board.rendererVersion === COMPANION_FLAME_RENDERER_ID) {
    board = importCompanionWorkspace(json); board.rendererVersion = COMPANION_LILLY_RENDERER_ID;
  }
  if (board.rendererVersion !== COMPANION_LILLY_RENDERER_ID) throw Error('기본형 01의 가족 또는 릴리화이트 교배판을 선택하세요.');
  board.individuals.forEach(g => assertCompanionLillyGenome(g.genome));
  for (const id of [board.fatherId, board.motherId]) if (id && !viability(board.individuals.find(g => g.id === id)!.genome).viable)
    throw Error('비생존 결과는 부모로 선택할 수 없습니다.');
  return board;
}
