import {seededRandom} from '@/genetics/random';

/** Versioned game rules, not breeding/genetic traits. Keep v1 replayable when adding v2. */
export const RUSH_V1=Object.freeze({durationMs:25_000,checkpointMs:800,escapeMs:420,
  good:[.50,.98] as const,perfect:[.74,.88] as const,pay:{perfect:300,good:200,miss:0},
  waves:[
    {start:500,count:1,flight:3300,stagger:0},
    {start:4500,count:1,flight:3100,stagger:0},
    {start:8300,count:1,flight:3000,stagger:0},
    {start:11900,count:2,flight:2450,stagger:850},
    {start:16100,count:2,flight:2300,stagger:850},
    {start:20000,count:3,flight:2250,stagger:800},
  ],
});
export type RushGrade='perfect'|'good'|'miss';
export interface RushResult {grade:RushGrade;atMs:number;source:'tap'|'escape'}
export interface RushShift {turn:number;elapsedMs:number;results:(RushResult|null)[];paid:boolean}
export type RushVersion=1|2;
export const RUSH_CURRENT_VERSION:RushVersion=2;
export interface RushState {version:RushVersion;shift:RushShift}
export interface RushTarget {id:number;wave:number;spawnMs:number;flightMs:number;x:number;y:number;variant:number;version?:RushVersion;lean?:number}
export interface RushTap {id:number;atMs:number}
export type RushGame={seed:string;turn:number;money:number;cafeRush?:RushState};
function legacyPlan(seed:string,turn:number):RushTarget[]{
  const rng=seededRandom(seed,'cre-rush-v1:'+turn),targets:RushTarget[]=[];
  // Separate spatial lanes + staggered ideal times leave room for one-finger play.
  const lanes=[[.25,.31],[.75,.31],[.5,.73]];
  RUSH_V1.waves.forEach((wave,w)=>{
    const cells=wave.count===1?[[.22+rng()*.56,.28+rng()*.40]]:[...lanes];
    if(wave.count>1&&rng()<.5)[cells[0],cells[1]]=[cells[1],cells[0]];
    for(let n=0;n<wave.count;n++){
      const [x,y]=cells[n];targets.push({id:targets.length,wave:w+1,spawnMs:wave.start+n*wave.stagger+Math.round(rng()*50),
        flightMs:Math.round(wave.flight*(.96+rng()*.08)),x:x+(rng()-.5)*.035,y:y+(rng()-.5)*.035,variant:Math.floor(rng()*4)});
    }
  });return targets;
}
/** V2 keeps the economic/timing contract; changes choreography and projection only.
 * V1 plans remain byte-for-byte reproducible for in-progress saves and receipts. */
export const RUSH_V2=Object.freeze({...RUSH_V1,projectionPower:1.65,bankDegrees:5,driftPx:12});
export function rushPlan(seed:string,turn:number,version:RushVersion=RUSH_CURRENT_VERSION):RushTarget[]{
  if(version===1)return legacyPlan(seed,turn);
  const rng=seededRandom(seed,'cre-rush-v2:'+turn),targets:RushTarget[]=[];
  RUSH_V2.waves.forEach((wave,w)=>{
    // Two safe triangular layouts, shuffled without changing each target's ideal-time spacing.
    const flip=rng()<.5;
    const cells=flip?[[.25,.63],[.75,.63],[.5,.25]]:[[.25,.33],[.75,.33],[.5,.74]];
    for(let i=cells.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[cells[i],cells[j]]=[cells[j],cells[i]];}
    for(let n=0;n<wave.count;n++){
      const [x,y]=wave.count===1?[.25+rng()*.5,.32+rng()*.32]:cells[n];
      targets.push({id:targets.length,wave:w+1,spawnMs:wave.start+n*wave.stagger+Math.round(rng()*50),
        flightMs:Math.round(wave.flight*(.96+rng()*.08)),x,y,variant:Math.floor(rng()*4),version:2,lean:rng()<.5?-1:1});
    }
  });return targets;
}
export const rushProgress=(target:RushTarget,ms:number)=>(ms-target.spawnMs)/target.flightMs;
export const rushDeadline=(target:RushTarget)=>Math.ceil(target.spawnMs+target.flightMs*RUSH_V1.good[1]);
export function rushGrade(target:RushTarget,atMs:number):RushGrade{
  if(target.version!==2){const p=rushProgress(target,atMs);return p>=RUSH_V1.perfect[0]&&p<=RUSH_V1.perfect[1]?'perfect':p>=RUSH_V1.good[0]&&p<RUSH_V1.good[1]?'good':'miss';}
  return atMs>=target.spawnMs+target.flightMs*RUSH_V1.perfect[0]&&atMs<=target.spawnMs+target.flightMs*RUSH_V1.perfect[1]?'perfect':atMs>=target.spawnMs+target.flightMs*RUSH_V1.good[0]&&atMs<target.spawnMs+target.flightMs*RUSH_V1.good[1]?'good':'miss';
}
export function rushSummary(shift:RushShift){
  const counts={perfect:0,good:0,miss:0};for(const r of shift.results)if(r)counts[r.grade]++;
  return {...counts,caught:counts.perfect+counts.good,resolved:counts.perfect+counts.good+counts.miss,
    reward:counts.perfect*RUSH_V1.pay.perfect+counts.good*RUSH_V1.pay.good};
}
export const rushComplete=(s:RushShift)=>s.elapsedMs===RUSH_V1.durationMs&&s.results.every(Boolean);
export function startRush(game:RushGame,version:RushVersion=RUSH_CURRENT_VERSION){
  const prior=game.cafeRush?.shift;
  if(prior&&(!prior.paid||prior.turn>=game.turn))throw new Error(prior.paid?'이번 턴 아르바이트를 이미 완료했습니다.':'진행 중이거나 미수령인 아르바이트를 먼저 마쳐주세요.');
  game.cafeRush={version,shift:{turn:game.turn,elapsedMs:0,results:Array(10).fill(null),paid:false}};
}
/** Advance the active-play clock and judge direct target taps in timestamp order. */
export function stepRush(game:RushGame,elapsedMs:number,taps:readonly RushTap[]=[]){
  const s=game.cafeRush?.shift;if(!s||s.paid||rushComplete(s))throw new Error('진행 중인 아르바이트가 없습니다.');
  if(!Number.isSafeInteger(elapsedMs)||elapsedMs<s.elapsedMs||elapsedMs>RUSH_V1.durationMs||taps.length>10)throw new Error('아르바이트 시간 기록이 올바르지 않습니다.');
  const plan=rushPlan(game.seed,s.turn,game.cafeRush!.version),before=s.elapsedMs;
  const escape=(at:number)=>{for(const target of plan)if(!s.results[target.id]&&at>=rushDeadline(target))s.results[target.id]={grade:'miss',atMs:rushDeadline(target),source:'escape'};};
  let last=before;
  for(const tap of taps){
    const target=plan[tap.id];
    if(!target||!Number.isSafeInteger(tap.atMs)||tap.atMs<last||tap.atMs>elapsedMs||tap.atMs<target.spawnMs)throw new Error('포획 터치 기록이 올바르지 않습니다.');
    last=tap.atMs;escape(tap.atMs);
    if(!s.results[tap.id])s.results[tap.id]={grade:rushGrade(target,tap.atMs),atMs:tap.atMs,source:'tap'};
  }
  escape(elapsedMs);s.elapsedMs=elapsedMs;
}
export function claimRush(game:RushGame){
  const s=game.cafeRush?.shift;if(!s||!rushComplete(s))throw new Error('모든 웨이브를 먼저 마쳐주세요.');
  if(s.paid)throw new Error('이미 급여를 받았습니다.');
  const reward=rushSummary(s).reward;if(game.money+reward>1e12)throw new Error('게임 자금 한도를 초과합니다.');
  game.money+=reward;s.paid=true;return reward;
}
const same=(a:RushResult,b:RushResult|null)=>!!b&&a.grade===b.grade&&a.atMs===b.atMs&&a.source===b.source;
/** Optional versioned extension on save v9. Old saves need no fabricated shift/migration. */
export function validateRush(value:unknown,seed:string):asserts value is RushState{
  const fail=()=>{throw new Error('크레 러시 저장 기록이 손상되었습니다.');};
  const keys=(v:unknown,k:string)=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join()===k.split(' ').sort().join();
  if(!keys(value,'version shift'))fail();const state=value as RushState,s=state.shift;
  if(![1,2].includes(state.version)||!keys(s,'turn elapsedMs results paid')||!Number.isSafeInteger(s.turn)||s.turn<0||s.turn>1e6||!Number.isSafeInteger(s.elapsedMs)||s.elapsedMs<0||s.elapsedMs>RUSH_V1.durationMs||typeof s.paid!=='boolean'||!Array.isArray(s.results)||s.results.length!==10)fail();
  const plan=rushPlan(seed,s.turn,state.version);
  for(let id=0;id<s.results.length;id++){const r=s.results[id];
    const t=plan[id];if(r===null){if(s.elapsedMs>=rushDeadline(t))fail();continue;}
    if(!keys(r,'grade atMs source')||!['perfect','good','miss'].includes(r.grade)||!['tap','escape'].includes(r.source)||!Number.isSafeInteger(r.atMs)||r.atMs<t.spawnMs||r.atMs>s.elapsedMs)fail();
    if(r.source==='escape'?(r.grade!=='miss'||r.atMs!==rushDeadline(t)):(r.atMs>=rushDeadline(t)||r.grade!==rushGrade(t,r.atMs)))fail();
  }
  if(s.paid&&!rushComplete(s))fail();
}
/** Durable per-game high-water mark survives restoring an earlier backup on this device.
 * Money remains exactly the backup's money; reconciliation never credits currency. */
export function reconcileRush(game:RushGame,durable:RushState|undefined):RushState|undefined{
  const incoming=game.cafeRush;if(!durable)return incoming;
  validateRush(durable,game.seed);if(!incoming)return structuredClone(durable);
  const a=incoming.shift,b=durable.shift;
  if(a.turn<b.turn)return structuredClone(durable);
  if(a.turn>b.turn)return incoming;
  if(b.paid)return structuredClone(durable);
  if(a.paid)return incoming;
  // Same turn cannot be replayed under a different choreography. Preserve the durable attempt.
  if(incoming.version!==durable.version)return structuredClone(durable);
  const state=structuredClone(incoming),s=state.shift;s.elapsedMs=Math.max(a.elapsedMs,b.elapsedMs);s.paid=a.paid||b.paid;
  s.results=b.results.map((known,id)=>known??(a.results[id]&&a.results[id]!.atMs>=b.elapsedMs?a.results[id]:null));
  // Fill deadlines crossed by a newer imported checkpoint; never reroll committed hits/misses.
  for(const t of rushPlan(game.seed,s.turn,state.version))if(!s.results[t.id]&&s.elapsedMs>=rushDeadline(t))s.results[t.id]={grade:'miss',atMs:rushDeadline(t),source:'escape'};
  validateRush(state,game.seed);return state;
}
export function assertRushForward(next:RushState|undefined,prior:RushState|undefined){
  if(!prior)return;
  const a=next?.shift,b=prior.shift;
  if(!a||a.turn<b.turn||a.turn>b.turn&&!b.paid||a.turn===b.turn&&(next!.version!==prior.version||a.elapsedMs<b.elapsedMs||b.paid&&!a.paid||b.results.some((r,i)=>r&&!same(r,a.results[i]))))throw new Error('다른 창의 아르바이트 기록이 있습니다. 저장 상태를 새로고침하세요.');
}
/** Shared display/hit geometry. No stretching; separate lanes stay inside the stage. */
export function rushGeometry(t:RushTarget,ms:number,width:number,height:number){
  const p=Math.max(0,rushProgress(t,ms));
  if(t.version===2){
    const q=Math.min(1.16,p),max=Math.min(172,width*.39,height*.30),size=Math.round(20+(max-20)*Math.pow(q,RUSH_V2.projectionPower));
    // A small ballistic arc and bank settle before the capture window. Never move the canvas independently of its hitbox.
    const approach=Math.max(0,1-p),rotation=(t.lean??1)*RUSH_V2.bankDegrees*Math.sin(Math.PI*Math.min(1,p));
    const hitSize=Math.max(44,Math.ceil(size*(Math.abs(Math.cos(rotation*Math.PI/180))+Math.abs(Math.sin(rotation*Math.PI/180))))),radius=hitSize/2;
    return {size,hitSize,x:Math.max(radius+2,Math.min(width-radius-2,t.x*width+(t.lean??1)*RUSH_V2.driftPx*approach**2)),
      y:Math.max(radius+2,Math.min(height-radius-2,t.y*height-20*Math.sin(Math.PI*Math.min(1,p)))),progress:p,rotation,
      pose:(p<.46?0:p<.74?1:2) as 0|1|2};
  }
  const max=Math.min(160,width*.42,height*.32),size=Math.round(20+(max-20)*Math.pow(Math.min(1.16,p),2.3));
  const radius=Math.max(44,size)/2;
  return {size,hitSize:Math.max(44,size),x:Math.max(radius+2,Math.min(width-radius-2,t.x*width)),y:Math.max(radius+2,Math.min(height-radius-2,t.y*height)),progress:p,rotation:0,pose:1 as const};
}

export function rushFeedback(target:RushTarget,result:RushResult){
  const p=rushProgress(target,result.atMs);
  return result.grade==='perfect'?'딱 좋은 순간!':result.grade==='good'?(p<.74?'조금만 더 기다려요':'조금만 더 일찍!'):result.source==='escape'?'앗, 지나갔어요':p<.5?'아직 너무 멀어요':'조금 늦었어요';
}
export function rushStreak(shift:RushShift){
  let current=0,best=0,perfect=0;
  for(const result of shift.results.filter((r):r is RushResult=>!!r).sort((a,b)=>a.atMs-b.atMs)){
    current=result.grade==='miss'?0:current+1;best=Math.max(best,current);perfect=result.grade==='perfect'?perfect+1:0;
  }return {current,best,perfect};
}
