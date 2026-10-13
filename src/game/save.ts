import type { GameState } from "./model";
import { validateGameState } from "./validation";

export interface SaveEnvelope {
  format: "gecko-lab-save";
  version: 2;
  checksum: string;
  game: GameState;
}
export const MAX_BACKUP_BYTES = 16 * 1024 * 1024;

/** Stable key ordering allows whitespace/reordering in a JSON backup without losing integrity. */
export function canonicalJSON(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(canonicalJSON).join(",") + "]";
  if (value !== null && typeof value === "object")
    return "{" + Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
      .map(([key, child]) => JSON.stringify(key) + ":" + canonicalJSON(child)).join(",") + "}";
  return JSON.stringify(value);
}
export function checksumGame(game: GameState): string {
  const input = canonicalJSON(game);
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) hash = Math.imul(hash ^ input.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(16).padStart(8, "0");
}
export function makeSave(game: GameState): SaveEnvelope {
  validateGameState(game);
  return { format: "gecko-lab-save", version: 2, checksum: checksumGame(game), game };
}
export function readSave(value: unknown): GameState {
  if (!value || typeof value !== "object") throw new Error("GECKO LAB 저장 파일이 아닙니다.");
  const candidate = value as Partial<SaveEnvelope>;
  if (candidate.format !== "gecko-lab-save" || candidate.version !== 2)
    throw new Error("지원하지 않는 저장 버전입니다. 이 게임은 저장 v2를 지원합니다.");
  validateGameState(candidate.game);
  if (candidate.checksum !== checksumGame(candidate.game))
    throw new Error("저장 파일의 무결성 검사에 실패했습니다. 원본 백업을 확인해 주세요.");
  return candidate.game;
}
export function parseBackup(text: string): GameState {
  if (new TextEncoder().encode(text).length > MAX_BACKUP_BYTES) throw new Error("백업 파일은 16MB 이하여야 합니다.");
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new Error("JSON 형식이 올바르지 않습니다."); }
  return readSave(value);
}
export function exportBackup(game: GameState): string { return JSON.stringify(makeSave(game), null, 2); }
