import type {Action,HardcoreGame} from '@/game/hardcore/model';
import {actWithTime,synchronizeTime} from '@/game/hardcore/time-source';
import type {GameDate} from '@/game/hardcore/time';
import {persistHardcore,type LoadedHardcore} from './hardcore';

export type RushStep=Extract<Action,{type:'stepRush'}>;
export type RushPatch=Pick<HardcoreGame,'revision'|'cafeRush'|'notices'>;
export type RushRequest={id:number}&({type:'init';loaded:LoadedHardcore}|{type:'step';action:RushStep;date:GameDate});
export type RushResponse={id:number}&({ok:true;patch?:RushPatch;writeRevision:number}|{ok:false;message:string;conflict:boolean});

export const canIsolateRush=(game:HardcoreGame)=>game.saveVersion===9&&game.rulesVersion===4&&game.time.mode==='turn';

/** Runs the existing action, full validation, checksum, CAS and atomic ledger transaction.
 * Only manual v1.2 checkpoints qualify: they cannot change livestock, money or dates.
 * Keep the full snapshot in the worker; replies never copy the collection back to React.
 */
export class RushCheckpoint {
  private current:LoadedHardcore|null=null;
  constructor(private persist:typeof persistHardcore=persistHardcore){}
  initialize(loaded:LoadedHardcore){
    if(!canIsolateRush(loaded.game))throw new Error('지원하지 않는 크레 러시 저장 방식입니다.');
    this.current=loaded;
  }
  async step(action:RushStep,date:GameDate){
    if(!this.current)throw new Error('크레 러시 저장을 먼저 준비해주세요.');
    if(action.type!=='stepRush')throw new Error('크레 러시 체크포인트만 처리할 수 있습니다.');
    const source=this.current;
    const next=actWithTime(synchronizeTime(source.game,date),action,date);
    const loaded=await this.persist(next,source.writeRevision);
    this.current=loaded;
    const {revision,cafeRush,notices}=loaded.game;
    return {patch:{revision,cafeRush,notices},writeRevision:loaded.writeRevision};
  }
}
