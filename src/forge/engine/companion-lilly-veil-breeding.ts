import { emptyCompanionLillyWorkspace, starterCompanionLillyWorkspace, importCompanionLillyWorkspace, assertCompanionLillyGenome } from './companion-lilly-breeding';
import { COMPANION_LILLY_VEIL_RENDERER_ID } from './companion-lilly-veil';
import { importWorkspace } from './workspace';
import { viability } from './individual';

export function emptyCompanionLillyVeilWorkspace() {
  const board = emptyCompanionLillyWorkspace(); board.rendererVersion = COMPANION_LILLY_VEIL_RENDERER_ID; return board;
}
export function starterCompanionLillyVeilWorkspace() {
  const board = starterCompanionLillyWorkspace(); board.rendererVersion = COMPANION_LILLY_VEIL_RENDERER_ID; return board;
}
export function importCompanionLillyVeilWorkspace(json: string) {
  let board = importWorkspace(json);
  if (board.rendererVersion !== COMPANION_LILLY_VEIL_RENDERER_ID) {
    board = importCompanionLillyWorkspace(json); board.rendererVersion = COMPANION_LILLY_VEIL_RENDERER_ID;
  }
  board.individuals.forEach(g => assertCompanionLillyGenome(g.genome));
  for (const id of [board.fatherId, board.motherId]) if (id && !viability(board.individuals.find(g => g.id === id)!.genome).viable)
    throw Error('비생존 결과는 부모로 선택할 수 없습니다.');
  return board;
}
