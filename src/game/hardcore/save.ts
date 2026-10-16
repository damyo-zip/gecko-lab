import { canonicalJSON, MAX_BACKUP_BYTES } from "@/game/save";
import type { HardcoreGame } from "./model";
import { migrateV2 } from "./create";
import type { GameDate } from "./time";
import { validateGame, validateV3, validateV4 } from "./validation";
import { legacyRecord } from "./genetics";
import type { LegacyV4Game } from "./model";
import { migrateV12 } from "./migrate-lifecycle";
import { migrateShop } from "./shop-family";
import { migrateSingleClutch } from "./migrate-single-clutch";
import {migrateAlbum} from './migrate-album';
import { migrateBroodCare } from "./brood-care";
import {migrateRisk} from './migrate-risk';

export function checksum(value: unknown): string {
  const input = canonicalJSON(value); let hash = 2166136261;
  for (let i = 0; i < input.length; i++) hash = Math.imul(hash ^ input.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(16).padStart(8, "0");
}
export function makeSave(game: HardcoreGame) {
  validateGame(game); return { format: "gecko-lab-save" as const, version: game.saveVersion, checksum: checksum(game), game };
}
function migrateLegacy(legacy:LegacyV4Game):HardcoreGame {
  const game={...structuredClone(legacy),saveVersion:5 as const};
  for(const g of Object.values(game.individuals))g.genetics=legacyRecord(g);
  for(const e of Object.values(game.eggs))e.embryo.genetics=legacyRecord(e.embryo);
  for(const o of Object.values(game.shop.offers))o.individual.genetics=legacyRecord(o.individual);
  for(const m of Object.values(game.matings))m.genetics=null;
  validateGame(game);return game;
}
export function readLegacySave(value: unknown, date: GameDate): HardcoreGame {
  if (!value || typeof value !== "object") throw new Error("GECKO LAB 저장 파일이 아닙니다.");
  const candidate = value as ReturnType<typeof makeSave>;
  if (candidate.format !== "gecko-lab-save") throw new Error("GECKO LAB 저장 파일이 아닙니다.");
  if ((candidate.version as number) === 2) { const migrated = migrateV2(value, date); validateGame(migrated); return migrated; }
  if ((candidate.version as number) === 3) {
    const legacy: unknown = candidate.game;
    validateV3(legacy);
    if (candidate.checksum !== checksum(legacy)) throw new Error("저장 파일의 무결성 검사에 실패했습니다.");
    // Switch existing games to turns without inventing extra elapsed days or changing genes/history.
    const migrated: LegacyV4Game = { ...structuredClone(legacy), saveVersion: 4,
      time: { mode: "turn", realtimeAnchorDate: date } };
    return migrateLegacy(migrated);
  }
  if((candidate.version as number)===4){const legacy:unknown=candidate.game;validateV4(legacy);
    if(candidate.checksum!==checksum(legacy))throw new Error("저장 파일의 무결성 검사에 실패했습니다.");return migrateLegacy(legacy);}
  if (candidate.version !== 5) throw new Error("지원하지 않는 저장 버전입니다. v2·v3·v4·v5 백업을 지원합니다.");
  validateGame(candidate.game);
  if (candidate.checksum !== checksum(candidate.game)) throw new Error("저장 파일의 무결성 검사에 실패했습니다.");
  return candidate.game;
}
export function readV6Save(value: unknown,date:GameDate):HardcoreGame {
  const candidate=value as ReturnType<typeof makeSave>|null;
  if(candidate?.version===6){
    if(candidate.format!=="gecko-lab-save")throw new Error("GECKO LAB 저장 파일이 아닙니다.");
    validateGame(candidate.game);
    if(candidate.game.saveVersion!==6||candidate.checksum!==checksum(candidate.game))throw new Error("저장 파일의 무결성 검사에 실패했습니다.");
    const game=migrateSingleClutch(candidate.game);validateGame(game);return game;
  }
  const game=migrateV12(readLegacySave(value,date));validateGame(game);return game;
}
export function readArchiveSave(value:unknown,date:GameDate):HardcoreGame {
  if((value as {version?:number})?.version===11)return readSave(value,date);
  const candidate=value as ReturnType<typeof makeSave>|null;
  if(candidate?.version===7||candidate?.version===8||candidate?.version===9||candidate?.version===10){
    if(candidate.format!=="gecko-lab-save")throw new Error("GECKO LAB 저장 파일이 아닙니다.");
    validateGame(candidate.game);
    if(candidate.game.saveVersion!==candidate.version||candidate.checksum!==checksum(candidate.game))throw new Error("저장 파일의 무결성 검사에 실패했습니다.");
    const game=migrateBroodCare(migrateRisk(migrateAlbum(candidate.game)));validateGame(game);return game;
  }
  const game=migrateBroodCare(migrateRisk(migrateAlbum(migrateShop(readV6Save(value,date)))));validateGame(game);return game;
}
/** Old records are kept untouched. No migration invents regional alleles or
 * rewrites an existing player's appearance; only explicit new-game replaces it. */
export function readSave(value:unknown,_date:GameDate):HardcoreGame {
  const candidate=value as ReturnType<typeof makeSave>|null;
  if(!candidate||candidate.format!=="gecko-lab-save")throw new Error("GECKO LAB 저장 파일이 아닙니다.");
  if(candidate.version!==11)throw new Error("새 외형 엔진이 적용되었습니다. 기존 저장은 보존되어 있습니다. 설정에서 새 게임을 시작해 주세요.");
  validateGame(candidate.game);
  if(candidate.game.saveVersion!==11||candidate.checksum!==checksum(candidate.game))throw new Error("저장 파일의 무결성 검사에 실패했습니다.");
  return candidate.game;
}
export function parseBackup(input: string, date: GameDate): HardcoreGame {
  if (new TextEncoder().encode(input).length > MAX_BACKUP_BYTES) throw new Error("백업 파일은 16MB 이하여야 합니다.");
  let value: unknown;
  try { value = JSON.parse(input); } catch { throw new Error("JSON 형식이 올바르지 않습니다."); }
  return readSave(value, date);
}
export function exportBackup(game: HardcoreGame): string { return JSON.stringify(makeSave(game), null, 2); }
