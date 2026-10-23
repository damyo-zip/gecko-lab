import { COMPANION_DALMATIAN_RENDERER_ID } from './companion-dalmatian-v3';
import { emptyCompanionDalmatianWorkspace as previousEmpty, starterCompanionDalmatianWorkspace as previousStarter, importCompanionDalmatianWorkspace as previousImport } from './companion-dalmatian-v2-breeding';
import { importWorkspace } from './workspace';

export { createCompanionDalmatianFounder, createCompanionDalmatianOffspring, COMPANION_DALMATIAN_PRESETS } from './companion-dalmatian-v2-breeding';
export type { CompanionDalmatianPresetId } from './companion-dalmatian-v2-breeding';
export function emptyCompanionDalmatianWorkspace() { const b=previousEmpty(); b.rendererVersion=COMPANION_DALMATIAN_RENDERER_ID; return b; }
export function starterCompanionDalmatianWorkspace() { const b=previousStarter(); b.rendererVersion=COMPANION_DALMATIAN_RENDERER_ID; return b; }
export function importCompanionDalmatianWorkspace(json:string) {
  const parsed=importWorkspace(json);
  // Reuse v2's full genome, parent and veil validation without mutating the input.
  const b=parsed.rendererVersion===COMPANION_DALMATIAN_RENDERER_ID
    ? previousImport(JSON.stringify({...parsed,rendererVersion:'b-origin-01-companion-dalmatian-2'}))
    : previousImport(json);
  b.rendererVersion=COMPANION_DALMATIAN_RENDERER_ID; return b;
}
