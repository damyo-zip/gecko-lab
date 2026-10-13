import { canonicalJSON, MAX_BACKUP_BYTES } from "@/game/save";
import type { HardcoreGame } from "./model";
import { migrateV2 } from "./create";
import type { GameDate } from "./time";
import { validateGame } from "./validation";

export function checksum(value: unknown): string {
  const input = canonicalJSON(value); let hash = 2166136261;
  for (let i = 0; i < input.length; i++) hash = Math.imul(hash ^ input.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(16).padStart(8, "0");
}
export function makeSave(game: HardcoreGame) {
  validateGame(game); return { format: "gecko-lab-save" as const, version: 3 as const, checksum: checksum(game), game };
}
export function readSave(value: unknown, date: GameDate): HardcoreGame {
  if (!value || typeof value !== "object") throw new Error("GECKO LAB 저장 파일이 아닙니다.");
  const candidate = value as ReturnType<typeof makeSave>;
  if (candidate.format !== "gecko-lab-save") throw new Error("GECKO LAB 저장 파일이 아닙니다.");
  if ((candidate.version as number) === 2) { const migrated = migrateV2(value, date); validateGame(migrated); return migrated; }
  if (candidate.version !== 3) throw new Error("지원하지 않는 저장 버전입니다. v2와 v3 백업을 지원합니다.");
  validateGame(candidate.game);
  if (candidate.checksum !== checksum(candidate.game)) throw new Error("저장 파일의 무결성 검사에 실패했습니다.");
  return candidate.game;
}
export function parseBackup(input: string, date: GameDate): HardcoreGame {
  if (new TextEncoder().encode(input).length > MAX_BACKUP_BYTES) throw new Error("백업 파일은 16MB 이하여야 합니다.");
  let value: unknown;
  try { value = JSON.parse(input); } catch { throw new Error("JSON 형식이 올바르지 않습니다."); }
  return readSave(value, date);
}
export function exportBackup(game: HardcoreGame): string { return JSON.stringify(makeSave(game), null, 2); }
