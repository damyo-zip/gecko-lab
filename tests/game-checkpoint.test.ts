import {describe,it,expect,vi,afterEach} from 'vitest';
import {GameCheckpoint,gameDelta,applyGameDelta,type GameRequest,type GameResponse} from '../src/storage/game-checkpoint';
import {GameClient,CommitUncertain} from '../src/storage/game-client';
import {newCurrentGame} from '../src/game/hardcore/play';
import {actWithTime} from '../src/game/hardcore/time-source';
import {makeSave,readMonthlySave} from '../src/game/hardcore/save';
import {compactGame} from '../src/game/hardcore/compact';
import type {persistHardcore} from '../src/storage/hardcore';
import {SaveConflict} from '../src/storage/indexed-db';
const DATE='2026-10-24';
const started=()=>({game:newCurrentGame('worker-actions',DATE),writeRevision:7});
afterEach(()=>vi.unstubAllGlobals());
describe('general action worker',()=>{
 it('matches the established action, full validation and compact save path and retains unchanged genetic references on UI patches',async()=>{
  const source=started();let durable=source;
  const persist:typeof persistHardcore=async(game,revision)=>{expect(revision).toBe(durable.writeRevision);const next=compactGame(game).game;durable={game:readMonthlySave(makeSave(next),DATE),writeRevision:revision!+1};return durable;};
  const checkpoint=new GameCheckpoint(persist);checkpoint.initialize(source);
  const response=await checkpoint.execute(DATE,{type:'buyFood',amount:1});const actual=applyGameDelta(source.game,response.delta);
  const expected=compactGame(actWithTime(source.game,{type:'buyFood',amount:1},DATE)).game;
  expect(actual).toEqual(expected);expect(response.writeRevision).toBe(8);expect(actual.individuals).toBe(source.game.individuals);expect(actual.shop).toBe(source.game.shop);
  expect(actual.food).toBe(source.game.food+1);expect(actual.money).toBe(source.game.money-source.game.rules.foodUnitPrice);
 });
 it('does not advance or debit on a rejected action, and never acknowledges failed persistence',async()=>{
  const source=started(),persist=vi.fn<typeof persistHardcore>().mockRejectedValue(new SaveConflict()),c=new GameCheckpoint(persist);c.initialize(source);
  const rejected=await c.execute(DATE,{type:'buyFood',amount:1001});expect(rejected.actionError).toBeTruthy();expect(persist).not.toHaveBeenCalled();expect(rejected.delta).toBeUndefined();
  await expect(c.execute(DATE,{type:'buyFood',amount:1})).rejects.toBeInstanceOf(SaveConflict);expect(source.writeRevision).toBe(7);
 });
 it('patches deletion and arrays without mutating the source or replacing an unchanged subtree',()=>{
  const source={same:{dna:[1,2,3]},removed:1,items:['old']},next={same:{dna:[1,2,3]},items:['new'],added:0};
  const result=applyGameDelta(source,gameDelta(source,next));expect(result).toEqual(next);expect(result.same).toBe(source.same);expect(source.removed).toBe(1);
 });
 it('keeps checkpoints in the worker across actions, transmits no full game again, and refuses to replay an uncertain write',async()=>{
  const sent:GameRequest[]=[];let breakWrite=false;
  class FakeWorker{onmessage:((e:MessageEvent<GameResponse>)=>void)|null=null;onerror:(()=>void)|null=null;onmessageerror:(()=>void)|null=null;
   postMessage(m:GameRequest){sent.push(m);if(m.type==='act'&&breakWrite){this.onerror?.();return;}const r:GameResponse=m.type==='init'?{id:m.id,ok:true,writeRevision:m.loaded.writeRevision}:{id:m.id,ok:true,delta:{fields:{food:{set:1}},remove:[]},writeRevision:8};queueMicrotask(()=>this.onmessage?.({data:r} as MessageEvent<GameResponse>));}terminate(){} }
  vi.stubGlobal('Worker',FakeWorker);const client=new GameClient(),source=started();
  const result=(await client.execute(source,DATE,{type:'buyFood',amount:1}))!;expect(result.loaded.game.food).toBe(1);expect(sent.map(r=>r.type)).toEqual(['init','act']);
  breakWrite=true;await expect(client.execute(result.loaded,DATE,{type:'buyFood',amount:1})).rejects.toBeInstanceOf(CommitUncertain);expect(sent.map(r=>r.type)).toEqual(['init','act','act']);client.dispose();
 });
});
