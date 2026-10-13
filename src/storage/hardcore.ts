import type { HardcoreGame } from "@/game/hardcore/model";
import { newGame } from "@/game/hardcore/play";
import { synchronizeTime } from "@/game/hardcore/time-source";
import { makeSave, readSave } from "@/game/hardcore/save";
import type { GameDate } from "@/game/hardcore/time";
import { DATABASE_NAME, STORE_NAME, SaveConflict } from "./indexed-db";

export interface LoadedHardcore { game: HardcoreGame; writeRevision: number }
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) { reject(new Error("IndexedDB 저장 권한이 필요합니다.")); return; }
    let blocked = false;
    const r = indexedDB.open(DATABASE_NAME, 1);
    r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(STORE_NAME)) r.result.createObjectStore(STORE_NAME); };
    r.onsuccess = () => { if (blocked) { r.result.close(); return; } r.result.onversionchange = () => r.result.close(); resolve(r.result); };
    r.onerror = () => reject(new Error("저장소를 열 수 없습니다."));
    r.onblocked = () => { blocked = true; reject(new Error("다른 GECKO LAB 창을 닫고 다시 시도하세요.")); };
  });
}
function revision(record: { writeRevision: number }): number {
  if (!Number.isSafeInteger(record.writeRevision) || record.writeRevision < 1) throw new Error("저장 리비전이 손상되었습니다.");
  return record.writeRevision;
}
/** Atomic migration/catch-up. StrictMode and simultaneous tabs cannot duplicate days. */
export async function loadGame(date: GameDate): Promise<LoadedHardcore> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite"), store = tx.objectStore(STORE_NAME), r = store.get("active");
    let result: LoadedHardcore, error: unknown;
    r.onsuccess = () => {
      try {
        const record = r.result;
        const game = record ? readSave(record.save, date) : newGame("GECKO-" + date + "-" + Date.now(), date);
        const next = synchronizeTime(game, date);
        const changed = !record || record.save.version !== 5 || next !== game;
        const writeRevision = record ? revision(record) + (changed ? 1 : 0) : 1;
        if (record && [2,3,4].includes(record.save.version))
          store.put(record, "archive-v" + record.save.version + "-" + writeRevision);
        if (changed) store.put({ save: makeSave(next), writeRevision }, "active");
        result = { game: next, writeRevision };
      } catch (e) { error = e; tx.abort(); }
    };
    tx.oncomplete = () => { db.close(); resolve(result); };
    tx.onabort = tx.onerror = () => { db.close(); reject(error ?? new Error("저장 실패 · 기존 데이터는 보존했습니다.")); };
  });
}
/** Persist before UI acknowledgement. Replacement archives the previous active slot in the SAME transaction. */
export async function persistHardcore(game: HardcoreGame, expected: number | null, replacement = false): Promise<LoadedHardcore> {
  const save = makeSave(game), db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite"), store = tx.objectStore(STORE_NAME), r = store.get("active");
    let writeRevision = 1, error: unknown;
    r.onsuccess = () => {
      try {
        const record = r.result;
        if (expected === null && replacement) { /* explicit recovery; archive raw corrupt record too */ }
        else if ((record ? revision(record) : null) !== expected) throw new SaveConflict();
        if (record && expected !== null) readSave(record.save, game.lastDate);
        writeRevision = record && Number.isSafeInteger(record.writeRevision) && record.writeRevision > 0 ? record.writeRevision + 1 : 1;
        if (replacement && record) store.put(record, "archive-" + writeRevision + "-" + game.gameId);
        store.put({ save, writeRevision }, "active");
      } catch (e) { error = e; tx.abort(); }
    };
    tx.oncomplete = () => { db.close(); resolve({ game, writeRevision }); };
    tx.onabort = tx.onerror = () => { db.close(); reject(error ?? new Error("자동 저장 실패 · 진행을 반영하지 않았습니다.")); };
  });
}
export async function listArchives(): Promise<{ key: string; data: unknown }[]> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly"), r = tx.objectStore(STORE_NAME).openCursor(), items: { key: string; data: unknown }[] = [];
    r.onsuccess = () => { const c = r.result; if (!c) return; if (String(c.key).startsWith("archive-")) items.push({ key: String(c.key), data: c.value.save }); c.continue(); };
    tx.oncomplete = () => { db.close(); resolve(items); }; tx.onerror = () => { db.close(); reject(tx.error); };
  });
}
