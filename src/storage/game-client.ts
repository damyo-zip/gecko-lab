import type {Action,HardcoreGame} from '@/game/hardcore/model';
import type {HistoryEntry} from '@/game/hardcore/compact-model';
import type {GameDate} from '@/game/hardcore/time';
import {loadGame,type LoadedHardcore} from './hardcore';
import {SaveConflict} from './indexed-db';
import {applyGameDelta,type GameRequest,type GameResponse} from './game-checkpoint';

export class CommitUncertain extends Error {constructor(){super('저장 스레드 응답을 확인할 수 없습니다. 저장 상태를 새로고침해주세요.');}}
export class GameClient {
 private worker:Worker|null=null;private disabled=false;private revision:number|null=null;private key='';private sequence=0;
 private pending=new Map<number,{resolve:(r:Extract<GameResponse,{ok:true}>)=>void;reject:(e:Error)=>void}>();
 private ensure():boolean {
  if(this.disabled||typeof Worker==='undefined')return false;
  if(this.worker)return true;
  try{
   this.worker=new Worker(new URL('./game.worker.ts',import.meta.url));
   this.worker.onmessage=(e:MessageEvent<GameResponse>)=>{const r=e.data,p=this.pending.get(r.id);if(!p)return;this.pending.delete(r.id);if(r.ok)p.resolve(r);else p.reject(r.conflict?new SaveConflict():new Error(r.message));};
   this.worker.onerror=this.worker.onmessageerror=()=>{this.disabled=true;this.dispose(new CommitUncertain());};return true;
  }catch{this.disabled=true;return false;}
 }
 private request(message:Omit<Extract<GameRequest,{type:'load'}>,'id'>|Omit<Extract<GameRequest,{type:'init'}>,'id'>|Omit<Extract<GameRequest,{type:'act'}>,'id'>){
  return new Promise<Extract<GameResponse,{ok:true}>>((resolve,reject)=>{
   const id=++this.sequence;this.pending.set(id,{resolve,reject});
   try{this.worker!.postMessage({...message,id});}catch{this.pending.delete(id);reject(new CommitUncertain());}
  });
 }
 async open(date:GameDate):Promise<LoadedHardcore>{
  if(!this.ensure())return loadGame(date);
  try{const r=await this.request({type:'load',date});if(!r.loaded)throw Error('게임 저장 응답이 없습니다.');this.remember(r.loaded);return r.loaded;}
  catch(e){if(!(e instanceof CommitUncertain))throw e;this.disabled=true;this.dispose();return loadGame(date);}
 }
 private remember(loaded:LoadedHardcore){this.revision=loaded.writeRevision;this.key=loaded.game.gameId+':'+loaded.game.seed;}
 async execute(source:LoadedHardcore|null,date:GameDate,action?:Action,replacement?:HardcoreGame,history:HistoryEntry[]=[]):Promise<{loaded:LoadedHardcore;actionError?:string}|null>{
  if(!this.ensure())return null;
  if(source&&(this.revision!==source.writeRevision||this.key!==source.game.gameId+':'+source.game.seed)){await this.request({type:'init',loaded:source});this.remember(source);}
  const r=await this.request({type:'act',date,action,replacement,history});
  const game=applyGameDelta(source?.game,r.delta);if(!game)throw new CommitUncertain();
  const loaded={game,writeRevision:r.writeRevision};this.remember(loaded);return {loaded,actionError:r.actionError};
 }
 dispose(error=new CommitUncertain()){
  this.worker?.terminate();this.worker=null;this.revision=null;this.key='';for(const p of this.pending.values())p.reject(error);this.pending.clear();
 }
}
