import type {GameDate} from '@/game/hardcore/time';
import type {LoadedHardcore} from './hardcore';
import {SaveConflict} from './indexed-db';
import {canIsolateRush,type RushRequest,type RushResponse,type RushStep} from './rush-checkpoint';

/** One snapshot transfer per game revision change outside Rush; checkpoint messages stay tiny. */
export class RushClient {
  private worker:Worker|null=null;
  private disabled=false;
  private sequence=0;
  private revision:number|null=null;
  private gameKey='';
  private preparing:Promise<boolean>|null=null;
  private pending=new Map<number,{resolve:(value:Extract<RushResponse,{ok:true}>)=>void;reject:(e:Error)=>void}>();
  private request(message:Omit<Extract<RushRequest,{type:'init'}>,'id'>|Omit<Extract<RushRequest,{type:'step'}>,'id'>){
    return new Promise<Extract<RushResponse,{ok:true}>>((resolve,reject)=>{
      const id=++this.sequence;this.pending.set(id,{resolve,reject});
      try{this.worker!.postMessage({...message,id});}catch(error){this.pending.delete(id);reject(error instanceof Error?error:new Error('저장 스레드 전송 실패'));}
    });
  }
  async prepare(loaded:LoadedHardcore):Promise<boolean>{
    if(this.disabled||typeof Worker==='undefined'||!canIsolateRush(loaded.game))return false;
    if(this.preparing)await this.preparing;
    if(this.disabled)return false;
    const key=loaded.game.gameId+':'+loaded.game.seed;
    if(this.revision===loaded.writeRevision&&this.gameKey===key)return true;
    this.preparing=(async()=>{
      try{
        if(!this.worker){
          this.worker=new Worker(new URL('./rush.worker.ts',import.meta.url));
          this.worker.onmessage=(event:MessageEvent<RushResponse>)=>{
            const r=event.data,p=this.pending.get(r.id);if(!p)return;this.pending.delete(r.id);
            if(r.ok)p.resolve(r);else p.reject(r.conflict?new SaveConflict():new Error(r.message));
          };
          this.worker.onerror=this.worker.onmessageerror=()=>this.dispose(new Error('저장 스레드가 중단되었습니다. 저장 상태를 새로고침해주세요.'));
        }
        await this.request({type:'init',loaded});this.revision=loaded.writeRevision;this.gameKey=key;return true;
      }catch{this.dispose();this.disabled=true;return false;}
    })();
    try{return await this.preparing;}finally{this.preparing=null;}
  }
  async step(source:LoadedHardcore,action:RushStep,date:GameDate):Promise<LoadedHardcore|null>{
    if(!await this.prepare(source))return null; // Compatibility fallback before any worker write.
    const response=await this.request({type:'step',action,date});
    if(!response.patch)throw new Error('크레 러시 저장 응답이 누락되었습니다.');
    this.revision=response.writeRevision;
    return {game:{...source.game,...response.patch},writeRevision:response.writeRevision};
  }
  dispose(error=new Error('저장 스레드를 닫았습니다.')){
    this.worker?.terminate();this.worker=null;this.revision=null;this.gameKey='';
    for(const p of this.pending.values())p.reject(error);this.pending.clear();
  }
}
