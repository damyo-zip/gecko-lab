import {test,expect} from 'vitest';
import {RUSH_V1,rushPlan as versionedPlan,rushProgress,rushGrade,rushDeadline,rushGeometry,startRush as versionedStart,stepRush,claimRush,rushSummary,rushComplete,validateRush,reconcileRush,assertRushForward,rushDuration,type RushGame,type RushGrade} from '@/game/rush';
import {newGame,act} from '@/game/hardcore/play';
import {actWithTime} from '@/game/hardcore/time-source';
import {exportBackup,parseBackup,makeSave} from '@/game/hardcore/save';
import {validateGame} from '@/game/hardcore/validation';
import {collectionStatusGame} from '../e2e/fixtures/collection-status';
const DATE='2026-10-15';
// Keep every original 25s/10-target contract as an explicit legacy-v2 regression.
const rushPlan=(seed:string,turn:number,version:1|2=2)=>versionedPlan(seed,turn,version);
const startRush=(game:RushGame,version:1|2=2)=>versionedStart(game,version);
const simple=():RushGame=>({seed:'front-rush-test',turn:0,money:1000});
function finish(game:RushGame,grades: RushGrade[]=Array(10).fill('perfect')){
  startRush(game);const taps=rushPlan(game.seed,game.turn).map((t,i)=>({id:t.id,atMs:Math.round(t.spawnMs+t.flightMs*(grades[i]==='perfect'?.81:grades[i]==='good'?.56:.1))})).sort((a,b)=>a.atMs-b.atMs);
  for(const tap of taps)stepRush(game,tap.atMs,[tap]);stepRush(game,RUSH_V1.durationMs);return game.cafeRush!;
}
test('six waves have exactly 1/1/1/2/2/3 independently seeded frontal targets within 25 seconds',()=>{
  const p=rushPlan('seed',7);expect(p).toHaveLength(10);expect(Array.from({length:6},(_,i)=>p.filter(t=>t.wave===i+1).length)).toEqual([1,1,1,2,2,3]);
  expect(p).toEqual(rushPlan('seed',7));expect(p).not.toEqual(rushPlan('seed',8));expect(p).not.toEqual(rushPlan('different',7));
  expect(Math.max(...p.map(rushDeadline))+RUSH_V1.escapeMs).toBeLessThan(RUSH_V1.durationMs);expect(p.every(t=>t.flightMs>2000)).toBe(true);
});
test('multi-target perfect windows are separated for one-finger play and catch hitboxes stay on screen without overlap',()=>{
  for(let seed=0;seed<20;seed++){
    const p=rushPlan('geometry-'+seed,0);
    for(let wave=4;wave<=6;wave++){
      const targets=p.filter(t=>t.wave===wave),ideal=targets.map(t=>t.spawnMs+t.flightMs*.81);
      for(let i=1;i<ideal.length;i++)expect(ideal[i]-ideal[i-1]).toBeGreaterThan(500);
    }
    for(const [width,height] of [[306,180],[306,380],[360,430],[480,520]])for(let at=11500;at<24500;at+=80){
      const active=p.filter(t=>rushProgress(t,at)>=0&&rushProgress(t,at)<.98).map(t=>rushGeometry(t,at,width,height));
      for(const g of active){expect(g.x-g.hitSize/2).toBeGreaterThanOrEqual(0);expect(g.x+g.hitSize/2).toBeLessThanOrEqual(width);expect(g.y-g.hitSize/2).toBeGreaterThanOrEqual(0);expect(g.y+g.hitSize/2).toBeLessThanOrEqual(height);}
      for(let i=0;i<active.length;i++)for(let j=i+1;j<active.length;j++){
        const a=active[i],b=active[j];expect(Math.abs(a.x-b.x)>=(a.hitSize+b.hitSize)/2||Math.abs(a.y-b.y)>=(a.hitSize+b.hitSize)/2).toBe(true);
      }
    }
  }
});
test('scale is isotropic, accelerated, and shares the exact progress used by timing judgement',()=>{
  const t=rushPlan('motion',0)[0],g=(p:number)=>rushGeometry(t,t.spawnMs+t.flightMs*p,320,420);
  expect(g(0).size).toBe(20);expect(g(0).hitSize).toBe(44);expect(g(.9).size-g(.8).size).toBeGreaterThan(g(.2).size-g(.1).size);
  expect(g(.81).progress).toBeCloseTo(.81);expect(rushGrade(t,t.spawnMs+t.flightMs*.81)).toBe('perfect');
});
test('too early, GOOD, PERFECT, late GOOD and automatic expiry use the same windows',()=>{
  const t=rushPlan('timing',0)[0];for(const [p,grade] of [[.1,'miss'],[.49,'miss'],[.5,'good'],[.73,'good'],[.74,'perfect'],[.81,'perfect'],[.88,'perfect'],[.9,'good'],[.98,'miss']] as const)expect(rushGrade(t,t.spawnMs+t.flightMs*p)).toBe(grade);
  const game=simple();startRush(game);const target=rushPlan(game.seed,0)[0];stepRush(game,rushDeadline(target)-1);expect(game.cafeRush!.shift.results[0]).toBeNull();stepRush(game,rushDeadline(target));expect(game.cafeRush!.shift.results[0]).toMatchObject({grade:'miss',source:'escape'});
});
test('touching one target does not resolve its simultaneous neighbors and duplicate taps never change its outcome',()=>{
  const game=simple();startRush(game);const targets=rushPlan(game.seed,0),t=targets[3],at=Math.round(t.spawnMs+t.flightMs*.81);
  stepRush(game,at,[{id:3,atMs:at},{id:3,atMs:at}]);const result=structuredClone(game.cafeRush!.shift.results[3]);expect(result!.grade).toBe('perfect');expect(game.cafeRush!.shift.results[4]).toBeNull();
  stepRush(game,at+10,[{id:3,atMs:at+10}]);expect(game.cafeRush!.shift.results[3]).toEqual(result);expect(rushSummary(game.cafeRush!.shift).reward).toBe(300);
});
test('ten PERFECTs pay exactly 3,000 into the existing wallet, once, and never advance a turn',()=>{
  const game=simple();finish(game);expect(rushComplete(game.cafeRush!.shift)).toBe(true);expect(rushSummary(game.cafeRush!.shift)).toMatchObject({perfect:10,caught:10,reward:3000});
  expect(claimRush(game)).toBe(3000);expect(game.money).toBe(4000);expect(game.turn).toBe(0);expect(()=>claimRush(game)).toThrow('이미');expect(game.money).toBe(4000);expect(()=>startRush(game)).toThrow('이번 턴');
});
test('4 PERFECT / 3 GOOD / 3 MISS pays 1,800, and complete unattended play pays zero',()=>{
  const g=simple();finish(g,[...Array(4).fill('perfect'),...Array(3).fill('good'),...Array(3).fill('miss')]);expect(rushSummary(g.cafeRush!.shift)).toMatchObject({perfect:4,good:3,miss:3,reward:1800});claimRush(g);expect(g.money).toBe(2800);
  const missed=simple();startRush(missed);stepRush(missed,25000);expect(claimRush(missed)).toBe(0);expect(missed.cafeRush!.shift.paid).toBe(true);
});
test('invalid timestamps, future/nonexistent targets, rewind and incomplete claiming are rejected',()=>{
  const game=simple();startRush(game);expect(()=>claimRush(game)).toThrow();expect(()=>stepRush(game,-1)).toThrow();expect(()=>stepRush(game,26000)).toThrow();expect(()=>stepRush(game,10,[{id:0,atMs:10}])).toThrow();expect(()=>stepRush(game,2000,[{id:11,atMs:1000}])).toThrow();stepRush(game,100);expect(()=>stepRush(game,99)).toThrow();
});
test('optional extension preserves old saves exactly; progress, pending wages and paid receipts round-trip',()=>{
  let game=newGame('rush-save',DATE);expect(game.cafeRush).toBeUndefined();expect(parseBackup(exportBackup(game),DATE)).toEqual(game);
  game=act(game,{type:'startRush'},DATE);game=act(game,{type:'stepRush',elapsedMs:2000},DATE);expect(parseBackup(exportBackup(game),DATE)).toEqual(game);
  game=act(game,{type:'stepRush',elapsedMs:rushDuration(game.cafeRush!.shift)},DATE);const pending=parseBackup(exportBackup(game),DATE);expect(pending.cafeRush!.shift.paid).toBe(false);
  game=act(game,{type:'claimRush'},DATE);expect(parseBackup(exportBackup(game),DATE)).toEqual(game);expect(game.saveVersion).toBe(11);expect(game.rulesVersion).toBe(4);
});
test('existing turn advance unlocks one new shift; an unfinished previous shift and unclaimed wages survive turns',()=>{
  let game=act(newGame('rush-turn',DATE),{type:'startRush'},DATE),next=actWithTime(game,{type:'endTurn'},DATE);expect(next.turn).toBe(1);expect(()=>act(next,{type:'startRush'},DATE)).toThrow('먼저');
  next=act(next,{type:'stepRush',elapsedMs:rushDuration(next.cafeRush!.shift)},DATE);expect(()=>act(next,{type:'startRush'},DATE)).toThrow('먼저');next=act(next,{type:'claimRush'},DATE);next=act(next,{type:'startRush'},DATE);expect(next.cafeRush!.shift.turn).toBe(1);expect(next.cafeRush!.shift.elapsedMs).toBe(0);expect(game.cafeRush!.shift.elapsedMs).toBe(0);
});
test('malformed version, counts, grade timestamps, invented reward and paid unfinished state fail save validation',()=>{
  const game=newGame('invalid-rush',DATE);startRush(game);const valid=structuredClone(game.cafeRush!);
  for(const mutate of [(s:any)=>s.version=3,(s:any)=>s.shift.results.pop(),(s:any)=>s.shift.results=Array(10),(s:any)=>s.shift.paid=true,(s:any)=>s.shift.reward=3000,(s:any)=>s.shift.elapsedMs=30000,(s:any)=>s.shift.results[0]={grade:'perfect',atMs:100,source:'tap'}]){
    const bad=structuredClone(valid);mutate(bad);expect(()=>validateRush(bad,game.seed)).toThrow();game.cafeRush=bad;expect(()=>makeSave(game)).toThrow();
  }
  game.cafeRush=valid;validateGame(game);
});
test('durable high-water state prevents replay via old empty, in-progress or unclaimed backups, without crediting restored money',()=>{
  const game=simple();const old=structuredClone(game);startRush(game);const started=structuredClone(game);stepRush(game,25000);const unclaimed=structuredClone(game);claimRush(game);const paid=structuredClone(game.cafeRush!);
  for(const restored of [old,started,unclaimed]){const money=restored.money;restored.cafeRush=reconcileRush(restored,paid);expect(restored.cafeRush!.shift.paid).toBe(true);expect(restored.money).toBe(money);expect(()=>startRush(restored)).toThrow();expect(()=>claimRush(restored)).toThrow();}
});
test('committed outcomes cannot be improved within an unpaid shift; a later-turn backup keeps the high-water mark',()=>{
  const game=simple();startRush(game);const t=rushPlan(game.seed,0)[0],early=Math.round(t.spawnMs+t.flightMs*.1);stepRush(game,early,[{id:0,atMs:early}]);const durable=structuredClone(game.cafeRush!);
  const alternate=simple();finish(alternate);const merged=reconcileRush(alternate,durable)!;expect(merged.shift.results[0]!.grade).toBe('miss');validateRush(merged,game.seed);
  expect(()=>assertRushForward(alternate.cafeRush,durable)).toThrow();expect(()=>assertRushForward(undefined,durable)).toThrow();
  const later=simple();later.turn=1;startRush(later);expect(reconcileRush(later,durable)).toEqual(later.cafeRush);
});
test('a paid later-turn imported backup cannot be replayed after restoring an earlier unfinished timeline',()=>{
  const earlier=simple();startRush(earlier);const later=simple();later.turn=1;finish(later);claimRush(later);
  const merged=reconcileRush(later,earlier.cafeRush)!;earlier.cafeRush=merged;expect(merged.shift.turn).toBe(1);expect(merged.shift.paid).toBe(true);expect(()=>claimRush(earlier)).toThrow('이미');expect(()=>startRush(earlier)).toThrow('이번 턴');
});
test('cafe actions preserve an existing live breeding season, eggs, genes, housing, market and game date exactly',()=>{
  let {game}=collectionStatusGame();const before=structuredClone(game);game=act(game,{type:'startRush'},game.lastDate);game=act(game,{type:'stepRush',elapsedMs:rushDuration(game.cafeRush!.shift)},game.lastDate);const reward=rushSummary(game.cafeRush!.shift).reward;game=act(game,{type:'claimRush'},game.lastDate);
  const project=({revision,notices,cafeRush,money,...core}:typeof game)=>core;
  expect(project(game)).toEqual(project(before));expect(game.money).toBe(before.money+reward);expect(game.cafeRush!.shift.paid).toBe(true);expect(parseBackup(exportBackup(game),game.lastDate)).toEqual(game);
});

test('v1 pending and paid saves keep their original plan, projection and payout after v2 ships',async()=>{
  const fixture=(await import('./fixtures/rush-v1-plan.json')).default,game=simple();startRush(game,1);
  expect(rushPlan(game.seed,0,1)).toEqual(fixture);const t=rushPlan(game.seed,0,1)[0];
  expect(rushGeometry(t,t.spawnMs+t.flightMs*.81,320,420).size).toBe(Math.round(20+(134.4-20)*.81**2.3));
  const at=Math.round(t.spawnMs+t.flightMs*.81);stepRush(game,at,[{id:0,atMs:at}]);
  const pending=structuredClone(game.cafeRush!);validateRush(pending,game.seed);
  stepRush(game,25000);expect(claimRush(game)).toBe(300);validateRush(game.cafeRush,game.seed);
  game.turn++;startRush(game);expect(game.cafeRush!.version).toBe(2);expect(game.cafeRush!.shift.results.every(r=>r===null)).toBe(true);
});
test('same-turn restore or forward action cannot switch rules to reroll a committed v1 outcome',()=>{
  const old=simple();startRush(old,1);stepRush(old,4000);const next=simple();startRush(next,2);
  expect(reconcileRush(next,old.cafeRush)).toEqual(old.cafeRush);expect(()=>assertRushForward(next.cafeRush,old.cafeRush)).toThrow();
  stepRush(old,25000);claimRush(old);expect(reconcileRush(next,old.cafeRush)!.shift.paid).toBe(true);
});
test('v2 ballistic path and bank settle into capture; padded hitbox encloses the rotated square',()=>{
  for(const t of rushPlan('moving',0,2))for(const p of [0,.2,.5,.74,.81,.88,.97]){
    const g=rushGeometry(t,t.spawnMs+t.flightMs*p,306,300),rad=g.rotation*Math.PI/180;
    expect(g.hitSize+.00001).toBeGreaterThanOrEqual(g.size*(Math.abs(Math.cos(rad))+Math.abs(Math.sin(rad))));
    expect(g.x-g.hitSize/2).toBeGreaterThanOrEqual(0);expect(g.y-g.hitSize/2).toBeGreaterThanOrEqual(0);
    expect(g.x+g.hitSize/2).toBeLessThanOrEqual(306);expect(g.y+g.hitSize/2).toBeLessThanOrEqual(300);
  }
  const t=rushPlan('moving',0,2)[0],g=(p:number)=>rushGeometry(t,t.spawnMs+t.flightMs*p,320,420);
  expect(g(.2).x).not.toBe(g(.8).x);expect(Math.abs(g(.81).rotation)).toBeLessThan(3);expect(g(.81).pose).toBe(2);
});
test('every visible v2 PERFECT millisecond grades PERFECT and the exact boundaries are inclusive',()=>{
  for(let i=0;i<50;i++)for(const t of rushPlan('boundaries-'+i,i,2)){
    for(const p of [.5,.74,.88,.98])expect(rushGrade(t,t.spawnMs+t.flightMs*p)).toBe(p===.5?'good':p===.98?'miss':'perfect');
    for(let at=Math.ceil(t.spawnMs+t.flightMs*.74);at<=Math.floor(t.spawnMs+t.flightMs*.88);at++)expect(rushGrade(t,at)).toBe('perfect');
  }
});
test('feedback explains early/late misses and chains derive from committed chronological results only',async()=>{
  const {rushFeedback,rushStreak}=await import('@/game/rush'),t=rushPlan('feedback',0)[0];
  expect(rushFeedback(t,{grade:'miss',source:'tap',atMs:t.spawnMs+10})).toContain('멀어요');
  expect(rushFeedback(t,{grade:'miss',source:'escape',atMs:rushDeadline(t)})).toContain('지나갔어요');
  const g=simple();finish(g,['perfect','good','perfect','miss','perfect','perfect','good','good','good','perfect']);
  expect(rushStreak(g.cafeRush!.shift)).toEqual({current:6,best:6,perfect:1});expect(rushSummary(g.cafeRush!.shift).reward).toBe(2300);
});
