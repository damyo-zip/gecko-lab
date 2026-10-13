import type { GameState } from "@/game/model";
import { createNewGame } from "@/game/play";
import { makeSave, readSave, type SaveEnvelope } from "@/game/save";

export const DATABASE_NAME = "gecko-lab";
export const STORE_NAME = "games";
const ACTIVE_SLOT = "phase2-lab";
interface StoredRecord { save: SaveEnvelope; writeRevision: number }
export interface LoadedGame { game: GameState; writeRevision: number }
export class SaveConflict extends Error {
  constructor() { super("다른 창에서 진행이 변경되었습니다. 새로고침 후 다시 진행해 주세요."); }
}
function decodeRecord(value: unknown): LoadedGame {
  if (!value || typeof value !== "object") throw new Error("저장 레코드가 손상되었습니다.");
  const record = value as StoredRecord;
  if (!Number.isSafeInteger(record.writeRevision) || record.writeRevision < 1) throw new Error("저장 리비전이 손상되었습니다.");
  return { game: readSave(record.save), writeRevision: record.writeRevision };
}
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let blocked = false;
    if (!globalThis.indexedDB) { reject(new Error("이 브라우저에서 IndexedDB를 사용할 수 없습니다.")); return; }
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME);
    };
    request.onerror = () => reject(new Error("브라우저 저장소를 열 수 없습니다. 저장 권한과 사용 가능 용량을 확인해 주세요."));
    request.onblocked = () => { blocked = true; reject(new Error("다른 창이 저장소 변경을 막고 있습니다. 다른 GECKO LAB 창을 닫아 주세요.")); };
    request.onsuccess = () => {
      const database = request.result;
      if (blocked) { database.close(); return; }
      database.onversionchange = () => database.close();
      resolve(database);
    };
  });
}

/** Strict-mode-safe initialization: creation and load happen inside one serialized transaction. */
export async function loadOrCreateGame(): Promise<LoadedGame> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME), request = store.get(ACTIVE_SLOT);
    let result: LoadedGame, error: Error | undefined;
    request.onsuccess = () => {
      try {
        if (request.result !== undefined) result = decodeRecord(request.result);
        else {
          const game = createNewGame();
          store.put({ save: makeSave(game), writeRevision: 1 } satisfies StoredRecord, ACTIVE_SLOT);
          result = { game, writeRevision: 1 };
        }
      } catch (caught) { error = caught instanceof Error ? caught : new Error("저장 데이터를 읽을 수 없습니다."); transaction.abort(); }
    };
    transaction.oncomplete = () => { database.close(); resolve(result); };
    transaction.onabort = transaction.onerror = () => {
      database.close(); reject(error ?? new Error("저장 데이터를 읽을 수 없습니다. 기존 데이터는 덮어쓰지 않았습니다."));
    };
  });
}

/**
 * Atomic compare-and-swap. The storage revision only increases, even after restoring
 * an old game snapshot, preventing stale tabs from overwriting restored progress.
 * forceRecovery is only used after an explicit replacement confirmation in the UI.
 */
export async function persistGame(game: GameState, expectedRevision: number | null, forceRecovery = false): Promise<LoadedGame> {
  const save = makeSave(game);
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME), request = store.get(ACTIVE_SLOT);
    let writeRevision = 1, error: Error | undefined;
    request.onsuccess = () => {
      try {
        const existing = request.result;
        const rawRevision = existing?.writeRevision;
        if (!forceRecovery) {
          const current = existing === undefined ? null : decodeRecord(existing);
          if ((current?.writeRevision ?? null) !== expectedRevision) throw new SaveConflict();
        }
        writeRevision = Number.isSafeInteger(rawRevision) && rawRevision > 0 ? rawRevision + 1 : 1;
        store.put({ save, writeRevision } satisfies StoredRecord, ACTIVE_SLOT);
      } catch (caught) { error = caught instanceof Error ? caught : new Error("저장 실패"); transaction.abort(); }
    };
    transaction.oncomplete = () => { database.close(); resolve({ game, writeRevision }); };
    transaction.onabort = transaction.onerror = () => {
      database.close(); reject(error ?? new Error("자동 저장에 실패했습니다. 진행을 반영하지 않았습니다. 저장 용량을 확인하고 백업해 주세요."));
    };
  });
}
