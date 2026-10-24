import {describe,it,expect,vi,afterEach} from 'vitest';
import {RushCheckpoint,type RushRequest,type RushResponse} from '../src/storage/rush-checkpoint';
import {migrateMonthly} from '../src/game/hardcore/migrate-monthly';
import {migrateForge} from '../src/game/hardcore/migrate-forge';
import {RushClient} from '../src/storage/rush-client';
import {act} from '../src/game/hardcore/play';
import {actWithTime,synchronizeTime} from '../src/game/hardcore/time-source';
import {rushPlan,startRush,rushDuration,rushSummary,type RushVersion} from '../src/game/rush';
import {rushPerformanceGame} from '../e2e/fixtures/rush-performance';
import type {LoadedHardcore,persistHardcore} from '../src/storage/hardcore';
import {makeSave,readSave} from '../src/game/hardcore/save';
import {SaveConflict} from '../src/storage/indexed-db';

const DATE='2026-10-15';
const started=(version:RushVersion=2,monthly=false)=>{const original=rushPerformanceGame(6),game=monthly?migrateMonthly(migrateForge(original)):original;startRush(game,version);return {game,writeRevision:7};};
describe('isolated checkpoints use the original game and persistence rules',()=>{
  it.each([[1,false],[2,false],[3,false],[1,true],[2,true],[3,true]] as const)('v%s monthly=%s: matches the full action path, keeps every non-Rush field, roundtrips and pays once',async(version,monthly)=>{
    const source=started(version,monthly);
    let durable=structuredClone(source),expected=source.game;
    const persist:typeof persistHardcore=async(game,revision)=>{
      expect(revision).toBe(durable.writeRevision);
      durable={game:readSave(makeSave(game),DATE),writeRevision:revision!+1};return durable;
    };
    const worker=new RushCheckpoint(persist);worker.initialize(structuredClone(source));
    const plan=rushPlan(expected.seed,0,version);
    const taps=plan.map(t=>({id:t.id,atMs:Math.round(t.spawnMs+t.flightMs*.8)})).sort((a,b)=>a.atMs-b.atMs);
    for(const tap of taps){
      const action={type:'stepRush' as const,elapsedMs:tap.atMs,taps:[tap]};
      expected=actWithTime(synchronizeTime(expected,DATE),action,DATE);
      const result=await worker.step(action,DATE);
      expect({...source.game,...result.patch}).toEqual(expected);
    }
    const final=await worker.step({type:'stepRush',elapsedMs:rushDuration(source.game.cafeRush!.shift)},DATE);
    const complete={...source.game,...final.patch};expect(complete.individuals).toBe(source.game.individuals);
    expect(complete.money).toBe(source.game.money);expect(complete.turn).toBe(source.game.turn);
    const paid=act(complete,{type:'claimRush'},DATE);expect(paid.money).toBe(source.game.money+rushSummary(complete.cafeRush!.shift).reward);
    expect(()=>act(paid,{type:'claimRush'},DATE)).toThrow();
    expect(readSave(makeSave(complete),DATE)).toEqual(complete);
  });
  it('does not advance its revision or acknowledge a failed write; retry uses the original revision',async()=>{
    const source=started();let fail=true;
    const persist=vi.fn<typeof persistHardcore>(async(game,expected)=>{if(fail)throw new Error('disk full');return {game,writeRevision:expected!+1};});
    const worker=new RushCheckpoint(persist);worker.initialize(source);
    const action={type:'stepRush' as const,elapsedMs:800};
    await expect(worker.step(action,DATE)).rejects.toThrow('disk full');expect(source.game.cafeRush!.shift.elapsedMs).toBe(0);
    fail=false;expect((await worker.step(action,DATE)).patch.cafeRush!.shift.elapsedMs).toBe(800);
    expect(persist.mock.calls.map(c=>c[1])).toEqual([7,7]);
  });
  it('refuses other actions and legacy automatic time sources',async()=>{
    const worker=new RushCheckpoint();expect(()=>worker.initialize({...started(),game:{...started().game,saveVersion:5}})).toThrow();
    worker.initialize(started());await expect(worker.step({type:'endTurn'} as never,DATE)).rejects.toThrow('체크포인트');
  });
});

describe('small worker replies and client lifecycle',()=>{
  afterEach(()=>vi.unstubAllGlobals());
  function install(handler:(message:RushRequest)=>RushResponse|'crash'){
    const sent:RushRequest[]=[];
    class FakeWorker{
      onmessage?: (e:{data:RushResponse})=>void;onerror?:()=>void;
      postMessage(message:RushRequest){sent.push(message);queueMicrotask(()=>{const r=handler(message);if(r==='crash')this.onerror?.();else this.onmessage?.({data:r});});}
      terminate(){}
    }
    vi.stubGlobal('Worker',FakeWorker);return sent;
  }
  it.each([false,true])('monthly=%s: transfers the collection once, keeps record identities, reinitializes after non-Rush actions',async monthly=>{
    let revision=7;
    const sent=install(m=>m.type==='init'?{id:m.id,ok:true,writeRevision:m.loaded.writeRevision}:
      {id:m.id,ok:true,writeRevision:++revision,patch:{revision,notices:[],cafeRush:{version:2,shift:{turn:0,elapsedMs:m.action.elapsedMs,results:Array(10).fill(null),paid:false}}}});
    const client=new RushClient(),source=started(2,monthly);await client.prepare(source);
    const first=(await client.step(source,{type:'stepRush',elapsedMs:800},DATE))!;
    expect(first.game.individuals).toBe(source.game.individuals);expect(first.game.shop).toBe(source.game.shop);
    await client.step(first,{type:'stepRush',elapsedMs:1600},DATE);
    expect(sent.map(m=>m.type)).toEqual(['init','step','step']);
    expect(JSON.stringify(sent[1]).length).toBeLessThan(150);
    await client.prepare({...first,writeRevision:20});expect(sent.at(-1)?.type).toBe('init');client.dispose();
  });
  it('preserves conflict identity and never retries a potentially committed step automatically',async()=>{
    const sent=install(m=>m.type==='init'?{id:m.id,ok:true,writeRevision:7}:{id:m.id,ok:false,message:'conflict',conflict:true});
    const client=new RushClient();await expect(client.step(started(),{type:'stepRush',elapsedMs:800},DATE)).rejects.toBeInstanceOf(SaveConflict);
    expect(sent.map(m=>m.type)).toEqual(['init','step']);client.dispose();
  });
  it('falls back before any write when workers are blocked',async()=>{
    const sent=install(()=>'crash'),client=new RushClient();
    expect(await client.step(started(),{type:'stepRush',elapsedMs:800},DATE)).toBeNull();
    expect(sent.map(m=>m.type)).toEqual(['init']);client.dispose();
  });
});
