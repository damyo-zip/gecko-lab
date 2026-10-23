import { COMPANION_DALMATIAN_RENDERER_ID } from './companion-dalmatian-v2';
import { COMPANION_DALMATIAN_PRESETS as previousPresets, emptyCompanionDalmatianWorkspace as previousEmpty, starterCompanionDalmatianWorkspace as previousStarter, importCompanionDalmatianWorkspace as previousImport } from './companion-dalmatian-breeding';
import { assertCompanionPigmentGenome } from './companion-pigment-breeding';
import { importWorkspace } from './workspace';
import { viability } from './individual';

export { createCompanionDalmatianFounder, createCompanionDalmatianOffspring } from './companion-dalmatian-breeding';
export type { CompanionDalmatianPresetId } from './companion-dalmatian-breeding';
export const COMPANION_DALMATIAN_PRESETS = previousPresets.map(p => p.id==='dalmatian-large' ? {...p,name:'작은 반점 소수형'} : p);
export function emptyCompanionDalmatianWorkspace() { const b=previousEmpty(); b.rendererVersion=COMPANION_DALMATIAN_RENDERER_ID; return b; }
export function starterCompanionDalmatianWorkspace() { const b=previousStarter(); b.rendererVersion=COMPANION_DALMATIAN_RENDERER_ID; return b; }
export function importCompanionDalmatianWorkspace(json:string) {
  let b=importWorkspace(json);
  if(b.rendererVersion!==COMPANION_DALMATIAN_RENDERER_ID) b=previousImport(json);
  b.individuals.forEach(g=>assertCompanionPigmentGenome(g.genome));
  for(const id of [b.fatherId,b.motherId]) if(id&&!viability(b.individuals.find(g=>g.id===id)!.genome).viable) throw Error('비생존 결과는 부모로 선택할 수 없습니다.');
  b.rendererVersion=COMPANION_DALMATIAN_RENDERER_ID; return b;
}
