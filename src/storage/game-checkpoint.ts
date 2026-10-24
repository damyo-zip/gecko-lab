import type {Action,HardcoreGame} from '@/game/hardcore/model';
import type {HistoryEntry} from '@/game/hardcore/compact-model';
import type {GameDate} from '@/game/hardcore/time';
import {actWithTime,synchronizeTime} from '@/game/hardcore/time-source';
import {loadGame,persistHardcore,type LoadedHardcore} from './hardcore';

export type Delta={set:unknown}|{fields:Record<string,Delta>;remove:string[]};
/** Runs in the worker: send only changed fields, retaining UI DNA/sprite identities. */
export function gameDelta(before:unknown,after:unknown):Delta|undefined {
 if(Object.is(before,after))return undefined;
 if(Array.isArray(before)&&Array.isArray(after)){
  if(before.length===after.length&&before.every((v,n)=>!gameDelta(v,after[n])))return undefined;
  return {set:after};
 }
 if(before&&after&&typeof before==='object'&&typeof after==='object'&&!Array.isArray(before)&&!Array.isArray(after)){
  const a=before as Record<string,unknown>,b=after as Record<string,unknown>,fields:Record<string,Delta>={},remove=Object.keys(a).filter(k=>!Object.hasOwn(b,k));
  for(const k of Object.keys(b)){const delta=Object.hasOwn(a,k)?gameDelta(a[k],b[k]):{set:b[k]};if(delta)fields[k]=delta;}
  return remove.length||Object.keys(fields).length?{fields,remove}:undefined;
 }
 return {set:after};
}
export function applyGameDelta<T>(source:T,delta:Delta|undefined):T {
 if(!delta)return source;if('set' in delta)return delta.set as T;
 const result={...source} as Record<string,unknown>;
 for(const key of delta.remove)delete result[key];
 for(const [key,value] of Object.entries(delta.fields))Object.defineProperty(result,key,{value:applyGameDelta(result[key],value),enumerable:true,writable:true,configurable:true});
 return result as T;
}
export type GameRequest={id:number}&({type:'load';date:GameDate}|{type:'init';loaded:LoadedHardcore}|{type:'act';date:GameDate;action?:Action;replacement?:HardcoreGame;history?:HistoryEntry[]});
export type GameResponse={id:number}&({ok:true;loaded?:LoadedHardcore;delta?:Delta;writeRevision:number;actionError?:string}|{ok:false;message:string;conflict:boolean});
export class GameCheckpoint {
 private current:LoadedHardcore|null=null;
 constructor(private persist:typeof persistHardcore=persistHardcore,private load:typeof loadGame=loadGame){}
 initialize(loaded:LoadedHardcore){this.current=loaded;}
 async open(date:GameDate){this.current=await this.load(date);return this.current;}
 async execute(date:GameDate,action?:Action,replacement?:HardcoreGame,history:HistoryEntry[]=[]){
  const source=this.current;if(!source&&!replacement)throw Error('게임 저장을 먼저 준비해주세요.');
  const synced=synchronizeTime(replacement??source!.game,date);let next=synced,actionError:string|undefined;
  if(action)try{next=actWithTime(synced,action,date);}catch(e){actionError=e instanceof Error?e.message:'게임 행동 실패';}
  let loaded=source!;
  if(replacement||next!==source?.game)loaded=await this.persist(next,source?.writeRevision??null,!!replacement,history);
  this.current=loaded;
  return {delta:gameDelta(source?.game,loaded.game),writeRevision:loaded.writeRevision,...(actionError?{actionError}:{})};
 }
}
