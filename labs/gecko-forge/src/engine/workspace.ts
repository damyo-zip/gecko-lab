import { validateGenome, validateSeed } from './individual';
import type { ForgeGecko, Workspace } from './model';

export const MAX_INDIVIDUALS = 1000;
export const MAX_JSON_BYTES = 8 * 1024 * 1024;
export function emptyWorkspace(): Workspace {
  return { format: 'gecko-forge', version: 1, geneticsVersion: 'advanced-1', rendererVersion: 'patterns-1',
    nextId: 1, individuals: [], favorites: [], selectedId: null, fatherId: null, motherId: null,
    breedingSeed: 'forge-cross-1', offspringCount: 4, settings: { zoom: 3, showB: true } };
}
const record = (v: unknown): Record<string, unknown> => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('JSON 객체가 필요합니다.');
  return v as Record<string, unknown>;
};
const text = (v: unknown, max = 128): string => {
  if (typeof v !== 'string' || !v.trim() || v.length > max) throw new Error('문자열 형식/길이 오류');
  return v;
};
const integer = (v: unknown, max: number, min = 1): number => {
  if (!Number.isSafeInteger(v) || (v as number) < min || (v as number) > max) throw new Error('정수 범위 오류');
  return v as number;
};
function individual(input: unknown): ForgeGecko {
  const v = record(input);
  if (v.version !== 1 || !['male', 'female'].includes(v.sex as string) || !['up', 'down'].includes(v.fire as string) ||
    !['founder', 'offspring', 'edited', 'copy'].includes(v.origin as string)) throw new Error('개체 형식/버전 오류');
  validateGenome(v.genome as ForgeGecko['genome']); validateSeed(v.creationSeed as string); validateSeed(v.visualSeed as string);
  const parents = v.parents === null ? null : record(v.parents);
  return { version: 1, id: text(v.id), name: text(v.name), sex: v.sex as ForgeGecko['sex'], genome: structuredClone(v.genome) as ForgeGecko['genome'],
    creationSeed: v.creationSeed as string, visualSeed: v.visualSeed as string, fire: v.fire as ForgeGecko['fire'], generation: integer(v.generation, 10000),
    parents: parents ? { fatherId: text(parents.fatherId), motherId: text(parents.motherId) } : null,
    origin: v.origin as ForgeGecko['origin'], derivedFrom: v.derivedFrom === null ? null : text(v.derivedFrom) };
}

/** Validate everything before the caller replaces its state. No game-save importer. */
export function importWorkspace(json: string): Workspace {
  if (new TextEncoder().encode(json).length > MAX_JSON_BYTES) throw new Error('JSON은 8MB 이하여야 합니다.');
  const v = record(JSON.parse(json));
  if (v.format !== 'gecko-forge' || v.version !== 1 || v.geneticsVersion !== 'advanced-1' || v.rendererVersion !== 'patterns-1') throw new Error('Forge 실험 JSON/엔진 버전이 아닙니다. 게임 세이브는 가져오지 않습니다.');
  if (!Array.isArray(v.individuals) || v.individuals.length > MAX_INDIVIDUALS) throw new Error('실험 개체는 최대 1,000마리입니다.');
  const individuals = v.individuals.map(individual), byId = new Map(individuals.map(g => [g.id, g]));
  if (byId.size !== individuals.length) throw new Error('중복 개체 ID');
  const reference = (id: unknown): string | null => {
    if (id === null) return null;
    const value = text(id); if (!byId.has(value)) throw new Error('존재하지 않는 개체 ID'); return value;
  };
  // Generation must strictly descend: catches cycles without recursion, even in
  // large/inbred pedigrees. No guessing unknown parent IDs from morph/name.
  for (const g of individuals) {
    if (g.parents) {
      const f = byId.get(g.parents.fatherId), m = byId.get(g.parents.motherId);
      if (!f || !m || f.sex !== 'male' || m.sex !== 'female' || g.generation !== Math.max(f.generation, m.generation) + 1) throw new Error('부모/세대 연결 오류');
    }
    if (g.origin === 'offspring' && !g.parents) throw new Error('자손의 부모 기록 누락');
  }
  if (!Array.isArray(v.favorites)) throw new Error('즐겨찾기 형식 오류');
  const favorites = [...new Set(v.favorites.map(id => { const ref = reference(id); if (!ref) throw new Error('즐겨찾기 ID 오류'); return ref; }))];
  const settings = record(v.settings);
  if (![2, 3, 4].includes(settings.zoom as number) || typeof settings.showB !== 'boolean') throw new Error('실험 설정 오류');
  validateSeed(v.breedingSeed as string);
  const selectedId = reference(v.selectedId), fatherId = reference(v.fatherId), motherId = reference(v.motherId);
  if ((fatherId && byId.get(fatherId)!.sex !== 'male') || (motherId && byId.get(motherId)!.sex !== 'female')) throw new Error('부모 슬롯 성별 오류');
  return { ...emptyWorkspace(), nextId: integer(v.nextId, Number.MAX_SAFE_INTEGER), individuals, favorites, selectedId, fatherId, motherId,
    breedingSeed: v.breedingSeed as string, offspringCount: integer(v.offspringCount, 64), settings: { zoom: settings.zoom as 2 | 3 | 4, showB: settings.showB } };
}
export function exportWorkspace(workspace: Workspace, pretty = true): string {
  const json = JSON.stringify(workspace, null, pretty ? 2 : undefined);
  importWorkspace(json); // Never export a corrupt or non-reproducible workspace.
  return json;
}
