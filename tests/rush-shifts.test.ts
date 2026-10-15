import {test,expect} from 'vitest';
import {writeFileSync} from 'node:fs';
import {createRushAssignment,drawRushDifficulty,drawRushWorkload,buildRushWaves,RUSH_WORKLOADS,RUSH_DIFFICULTIES,RUSH_SHIFT_V3} from '@/game/rush-shifts';
import {startRush,stepRush,claimRush,rushPlan,rushDeadline,rushGeometry,rushSummary,rushComplete,rushDuration,rushFinishAt,validateRush,reconcileRush,assertRushForward,type RushGame,type RushGrade} from '@/game/rush';
import {newGame,act} from '@/game/hardcore/play';
import {exportBackup,parseBackup} from '@/game/hardcore/save';

const DATE='2026-10-15';
function seedFor(total:number,difficulty?:string){
  for(let i=0;i<10000;i++){const seed='variable-shift-'+i;
    if(drawRushWorkload(seed,0).total===total&&(!difficulty||drawRushDifficulty(seed,0).id===difficulty))return seed;
  }throw new Error('missing seeded case');
}
function finish(total:number,grades:RushGrade[]=Array(total).fill('perfect')){
  const game:RushGame={seed:seedFor(total),turn:0,money:1000};startRush(game);
  const plan=rushPlan(game.seed,0,3,game.cafeRush!.shift.assignment);
  const taps=plan.map((t,id)=>({id,atMs:Math.round(t.spawnMs+t.flightMs*(grades[id]==='perfect'?.81:grades[id]==='good'?.56:.1))})).sort((a,b)=>a.atMs-b.atMs);
  for(const tap of taps)stepRush(game,tap.atMs,[tap]);
  expect(rushComplete(game.cafeRush!.shift)).toBe(false); // Same short, undisclosed inter-wave/departure pause.
  stepRush(game,rushFinishAt(game.cafeRush!.shift));return game;
}
test('1,000,000 independent seeded draws follow bucket weights, uniform counts and difficulty/workload independence',()=>{
  const samples=1000000,work=Array(4).fill(0),difficulty=Array(4).fill(0),totals=Array(21).fill(0),joint=Array.from({length:4},()=>Array(4).fill(0));
  for(let i=0;i<samples;i++){
    const seed='distribution-'+i,{bucket,total}=drawRushWorkload(seed,i%37),d=drawRushDifficulty(seed,i%37);
    const w=RUSH_WORKLOADS.findIndex(b=>b.id===bucket.id),j=RUSH_DIFFICULTIES.findIndex(p=>p.id===d.id);
    work[w]++;difficulty[j]++;totals[total]++;joint[w][j]++;
  }
  for(let i=0;i<4;i++){
    expect(Math.abs(work[i]/samples-RUSH_WORKLOADS[i].weight/100)).toBeLessThan(.0025);
    expect(Math.abs(difficulty[i]/samples-RUSH_DIFFICULTIES[i].weight/100)).toBeLessThan(.0025);
    const b=RUSH_WORKLOADS[i],expected=work[i]/(b.max-b.min+1);
    for(let n=b.min;n<=b.max;n++)expect(Math.abs(totals[n]/expected-1)).toBeLessThan(.03);
  }
  let chiSquare=0;for(let w=0;w<4;w++)for(let d=0;d<4;d++){const expected=work[w]*difficulty[d]/samples;chiSquare+=(joint[w][d]-expected)**2/expected;}
  expect(chiSquare).toBeLessThan(27.88); // df=9, 0.1% false-alarm threshold.
  writeFileSync('/tmp/gecko-rush-workload-distribution.json',JSON.stringify({samples,seed:'distribution-i, turn=i%37',workload:work.map((count,i)=>({id:RUSH_WORKLOADS[i].id,count,frequency:count/samples})),difficulty:difficulty.map((count,i)=>({id:RUSH_DIFFICULTIES[i].id,count,frequency:count/samples})),counts:totals.slice(6),joint,chiSquare,independenceDegreesOfFreedom:9},null,2)+'\n');
});
test('2,000 assignments have exact totals, reproducible saved waves, at most three active targets and a capped speed curve',()=>{
  const seen=new Set<string>();
  for(let i=0;i<2000;i++){
    const seed='wave-property-'+i,assignment=createRushAssignment(seed,0),plan=assignment.waves.flatMap(w=>w.targets);
    expect(assignment.total).toBeGreaterThanOrEqual(6);expect(assignment.total).toBeLessThanOrEqual(20);
    expect(plan).toHaveLength(assignment.total);expect(plan.map(t=>t.id)).toEqual(Array.from({length:assignment.total},(_,n)=>n));
    expect(assignment.waves.every(w=>w.targets.length>=1&&w.targets.length<=3)).toBe(true);
    expect(assignment.waves.slice(0,2).map(w=>w.targets.length)).toEqual([1,1]);
    const d=RUSH_DIFFICULTIES.find(d=>d.id===assignment.difficulty)!;
    expect(plan.every(t=>t.flightMs>=Math.floor(2250*d.flightScale*.96))).toBe(true);
    const events=plan.flatMap(t=>[{at:t.spawnMs,delta:1},{at:rushDeadline(t),delta:-1}]).sort((a,b)=>a.at-b.at||a.delta-b.delta);
    let active=0;for(const event of events){active+=event.delta;expect(active).toBeLessThanOrEqual(3);}
    expect(createRushAssignment(seed,0)).toEqual(assignment);seen.add(assignment.difficulty+':'+assignment.workload);
    const game:RushGame={seed,turn:0,money:0};startRush(game);validateRush(game.cafeRush,seed);
  }
  expect(seen.size).toBe(16);expect(createRushAssignment(seedFor(20,'weekday'),0).total).toBe(20);expect(createRushAssignment(seedFor(6,'chaos'),0).total).toBe(6);
});
test('short/long shifts share choreography prefixes; no final-wave flag or total-dependent acceleration',()=>{
  for(const d of RUSH_DIFFICULTIES)for(let i=0;i<100;i++){
    const short=buildRushWaves('prefix-'+i,0,6,d.id).flatMap(w=>w.targets),long=buildRushWaves('prefix-'+i,0,20,d.id).flatMap(w=>w.targets);
    expect(short).toEqual(long.slice(0,6));
    expect(short.every(t=>!('final' in t)&&!('remaining' in t)&&!('total' in t))).toBe(true);
  }
});
test('v3 one-finger perfect windows remain separated and mobile hitboxes stay visible and disjoint',()=>{
  for(const d of RUSH_DIFFICULTIES)for(let i=0;i<30;i++){
    const waves=buildRushWaves('touch-layout-'+i,0,20,d.id),plan=waves.flatMap(w=>w.targets);
    for(const w of waves)for(let n=1;n<w.targets.length;n++){
      const a=w.targets[n-1],b=w.targets[n];expect(b.spawnMs+b.flightMs*.81-a.spawnMs-a.flightMs*.81).toBeGreaterThan(500);
    }
    for(const [width,height] of [[306,180],[306,380],[396,520]])for(let at=0;at<Math.max(...plan.map(rushDeadline));at+=100){
      const active=plan.filter(t=>at>=t.spawnMs&&at<rushDeadline(t)).map(t=>rushGeometry(t,at,width,height));
      for(const g of active){expect(g.x-g.hitSize/2).toBeGreaterThanOrEqual(0);expect(g.y-g.hitSize/2).toBeGreaterThanOrEqual(0);expect(g.x+g.hitSize/2).toBeLessThanOrEqual(width);expect(g.y+g.hitSize/2).toBeLessThanOrEqual(height);}
      for(let a=0;a<active.length;a++)for(let b=a+1;b<active.length;b++)expect(Math.abs(active[a].x-active[b].x)>=(active[a].hitSize+active[b].hitSize)/2||Math.abs(active[a].y-active[b].y)>=(active[a].hitSize+active[b].hitSize)/2).toBe(true);
    }
  }
});
test.each([[6,16320],[10,20320],[20,30320]])('%s PERFECTs earn %s, reveal only after the final result and pay exactly once',(total,pay)=>{
  const game=finish(total),s=game.cafeRush!.shift;
  expect(rushComplete(s)).toBe(true);expect(rushSummary(s).reward).toBe(pay);validateRush(game.cafeRush,game.seed);
  expect(claimRush(game)).toBe(pay);expect(game.money).toBe(1000+pay);expect(()=>claimRush(game)).toThrow();expect(()=>startRush(game)).toThrow();
  game.turn++;startRush(game);expect(game.cafeRush!.shift.turn).toBe(1);expect(game.cafeRush!.shift.results.every(r=>r===null)).toBe(true);
});
test('base and signed grade items follow the exact formula, including zero floor',()=>{
  const mixed=finish(18,[...Array(8).fill('perfect'),...Array(5).fill('good'),...Array(5).fill('miss')]);
  expect(rushSummary(mixed.cafeRush!.shift)).toMatchObject({base:10320,perfectPay:8000,goodPay:2500,missPay:-7500,reward:13320});
  const allMiss=finish(20,Array(20).fill('miss'));expect(claimRush(allMiss)).toBe(0);expect(allMiss.cafeRush!.shift.paid).toBe(true);
  expect(rushSummary(finish(6,Array(6).fill('miss')).cafeRush!.shift).reward).toBe(1320);
});
test('start fixes the assignment; pause/JSON restore preserve waves, outcomes and hidden results without reroll',()=>{
  let game=act(newGame(seedFor(20),DATE),{type:'startRush'},DATE);const assignment=structuredClone(game.cafeRush!.shift.assignment);
  const target=rushPlan(game.seed,0,3,assignment)[0],atMs=Math.round(target.spawnMs+target.flightMs*.81);
  game=act(game,{type:'stepRush',elapsedMs:atMs,taps:[{id:0,atMs}]},DATE);
  const loaded=parseBackup(exportBackup(game),DATE);expect(loaded).toEqual(game);expect(loaded.cafeRush!.shift.assignment).toEqual(assignment);
  expect(()=>act(loaded,{type:'startRush'},DATE)).toThrow();
  for(const field of ['total','difficulty','workload','endMs','waves'] as const){
    const bad=structuredClone(game.cafeRush!);(bad.shift.assignment as any)[field]=null;
    expect(()=>validateRush(bad,game.seed)).toThrow();expect(()=>assertRushForward(bad,game.cafeRush)).toThrow();
  }
});
test('v3 high-water merge retains workload, immutable outcomes and paid receipts without auto-credit',()=>{
  const complete=finish(20),started:RushGame={seed:complete.seed,turn:0,money:0};startRush(started);
  const backup=structuredClone(started);stepRush(started,2000);const durable=structuredClone(started.cafeRush!);
  const merged=reconcileRush(complete,durable)!;validateRush(merged,complete.seed);expect(merged.shift.assignment).toEqual(durable.shift.assignment);
  claimRush(complete);const money=backup.money;backup.cafeRush=reconcileRush(backup,complete.cafeRush);
  expect(backup.money).toBe(money);expect(backup.cafeRush!.shift.paid).toBe(true);expect(()=>claimRush(backup)).toThrow();
  const old:RushGame={seed:complete.seed,turn:0,money:0};startRush(old,2);expect(reconcileRush(old,complete.cafeRush)).toEqual(complete.cafeRush);expect(()=>assertRushForward(old.cafeRush,complete.cafeRush)).toThrow();
});
test('legacy v1/v2 pending and completed salaries keep their original rules when new shifts ship',()=>{
  for(const version of [1,2] as const){
    const game:RushGame={seed:'legacy-pay',turn:0,money:0};startRush(game,version);
    for(const t of rushPlan(game.seed,0,version)){const atMs=Math.round(t.spawnMs+t.flightMs*.81);stepRush(game,atMs,[{id:t.id,atMs}]);}
    stepRush(game,25000);const pending=structuredClone(game.cafeRush);expect(claimRush(game)).toBe(3000);validateRush(game.cafeRush,game.seed);
    expect(rushSummary(pending!.shift).reward).toBe(3000);game.turn++;startRush(game);expect(game.cafeRush!.version).toBe(3);expect(game.cafeRush!.shift.assignment).toBeDefined();
  }
});
