import type { HardcoreGame } from "@/game/hardcore/model";
import { newGame } from "@/game/hardcore/play";
import { synchronizeTime } from "@/game/hardcore/time-source";
import { makeSave, readSave } from "@/game/hardcore/save";
import type { GameDate } from "@/game/hardcore/time";
import { DATABASE_NAME, STORE_NAME, SaveConflict } from "./indexed-db";
import {canonicalJSON} from '@/game/save';
import {reconcileRush,assertRushForward,validateRush,type RushState} from '@/game/rush';

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
/** Same IndexedDB transaction as active. A backup cannot rewind this device's shift receipts. */
function withRush(store:IDBObjectStore,game:HardcoreGame,replacement:boolean,done:(game:HardcoreGame)=>void,fail:(error:unknown)=>void){
  const key='rush-v1:'+game.gameId+':'+game.seed,r=store.get(key);
  r.onsuccess=()=>{try{
    const record=r.result as {format:string;version:number;state:RushState}|undefined;
    if(record!==undefined){
      if(!record||typeof record!=='object'||Array.isArray(record)||Object.keys(record).sort().join()!=='format,state,version'||record.format!=='gecko-rush-ledger'||record.version!==1)throw new Error('크레 러시 수령 기록이 손상되었습니다.');
      validateRush(record.state,game.seed);
    }
    let next=game;
    if(replacement){
      const state=reconcileRush(game,record?.state);
      if(canonicalJSON(state??null)!==canonicalJSON(game.cafeRush??null))next={...game,cafeRush:state!,revision:game.revision+1};
    }else assertRushForward(game.cafeRush,record?.state);
    if(next.cafeRush)store.put({format:'gecko-rush-ledger',version:1,state:next.cafeRush},key);
    done(next);
  }catch(e){fail(e);}};
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
        const synced = synchronizeTime(game, date);
        withRush(store,synced,true,next=>{
        const migrated=record&&(record.save.version!==9||record.save.game?.rulesVersion!==4);
        const changed = !record || migrated || next !== game;
        const writeRevision = record ? revision(record) + (changed ? 1 : 0) : 1;
        if (record && migrated)
          store.put(record, "archive-v" + record.save.version + "-" + writeRevision);
        if (changed) store.put({ save: makeSave(next), writeRevision }, "active");
        result = { game: next, writeRevision };
        },e=>{error=e;tx.abort();});
      } catch (e) { error = e; tx.abort(); }
    };
    tx.oncomplete = () => { db.close(); resolve(result); };
    tx.onabort = tx.onerror = () => { db.close(); reject(error ?? new Error("저장 실패 · 기존 데이터는 보존했습니다.")); };
  });
}
/** Persist before UI acknowledgement. Replacement archives the previous active slot in the SAME transaction. */
export async function persistHardcore(game: HardcoreGame, expected: number | null, replacement = false): Promise<LoadedHardcore> {
  const save=makeSave(game),db=await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite"), store = tx.objectStore(STORE_NAME), r = store.get("active");
    let writeRevision = 1, error: unknown,committed=game;
    r.onsuccess = () => {
      try {
        const record = r.result;
        if (expected === null && replacement) { /* explicit recovery; archive raw corrupt record too */ }
        else if ((record ? revision(record) : null) !== expected) throw new SaveConflict();
        if (record && expected !== null) readSave(record.save, game.lastDate);
        writeRevision = record && Number.isSafeInteger(record.writeRevision) && record.writeRevision > 0 ? record.writeRevision + 1 : 1;
        withRush(store,game,replacement,next=>{
          committed=next;
          if (replacement && record) store.put(record, "archive-" + writeRevision + "-" + game.gameId);
          store.put({ save:next===game?save:makeSave(next), writeRevision }, "active");
        },e=>{error=e;tx.abort();});
      } catch (e) { error = e; tx.abort(); }
    };
    tx.oncomplete = () => { db.close(); resolve({ game:committed, writeRevision }); };
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
