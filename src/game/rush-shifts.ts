import {seededRandom} from '@/genetics/random';
import type {RushTarget} from './rush';

/** Frozen v3 rules. Add a new version when changing these: saved shifts keep theirs. */
export const RUSH_WORKLOADS=[
  {id:'quiet',label:'한가한 매장',min:6,max:8,weight:25},
  {id:'normal',label:'평소처럼',min:9,max:12,weight:35},
  {id:'crowded',label:'손님이 많네?',min:13,max:16,weight:25},
  {id:'overtime',label:'퇴근 좀 하자!',min:17,max:20,weight:15},
] as const;
// The repository had no randomized difficulty. Normal preserves v2's flight curve
// and grading fractions; other profiles scale flight/gap, not workload or pay.
export const RUSH_DIFFICULTIES=[
  {id:'weekday',label:'한가한 평일',weight:20,flightScale:1.12,gapScale:1.08},
  {id:'normal',label:'평범한 근무',weight:45,flightScale:1,gapScale:1},
  {id:'weekend',label:'바쁜 주말',weight:25,flightScale:.90,gapScale:.94},
  {id:'chaos',label:'탈출 대소동',weight:10,flightScale:.82,gapScale:.90},
] as const;
export const RUSH_SHIFT_V3=Object.freeze({
  basePay:10_320,pay:{perfect:1_000,good:500,miss:-1_500},
  initialDelayMs:500,waveGapMs:700,departureMs:650,staggerMs:850,
  flightCurve:[3300,3100,3000,2450,2300,2250],
  groups:[{count:1,weight:15},{count:2,weight:45},{count:3,weight:40}],
});
export type RushWorkload=typeof RUSH_WORKLOADS[number]['id'];
export type RushDifficulty=typeof RUSH_DIFFICULTIES[number]['id'];
export interface RushWave {number:number;startMs:number;targets:RushTarget[]}
export interface RushAssignment {
  version:1;difficulty:RushDifficulty;workload:RushWorkload;total:number;waves:RushWave[];endMs:number;
}
function weighted<T extends {weight:number}>(items:readonly T[],random:()=>number):T{
  let value=random()*items.reduce((sum,item)=>sum+item.weight,0);
  for(const item of items){value-=item.weight;if(value<0)return item;}return items[items.length-1];
}
export function drawRushDifficulty(seed:string,turn:number){
  return weighted(RUSH_DIFFICULTIES,seededRandom(seed,'cre-rush-v3-difficulty:'+turn));
}
export function drawRushWorkload(seed:string,turn:number){
  const random=seededRandom(seed,'cre-rush-v3-workload:'+turn),bucket=weighted(RUSH_WORKLOADS,random);
  return {bucket,total:bucket.min+Math.floor(random()*(bucket.max-bucket.min+1))};
}
/** Timing/choreography depends on wave index and difficulty, never total workload.
 * Late solo waves are ordinary too: a clipped final group has no unique signal.
 * Per-wave streams leave a short shift's targets identical to a long shift's prefix.
 */
export function buildRushWaves(seed:string,turn:number,total:number,difficulty:RushDifficulty):RushWave[]{
  const profile=RUSH_DIFFICULTIES.find(d=>d.id===difficulty);
  if(!profile||!Number.isInteger(total)||total<6||total>20)throw new Error('근무 배치 설정이 올바르지 않습니다.');
  const waves:RushWave[]=[];let startMs=RUSH_SHIFT_V3.initialDelayMs,id=0;
  while(id<total){
    const number=waves.length+1,random=seededRandom(seed,'cre-rush-v3-wave:'+turn+':'+number);
    const intended=number<=2?1:number===3?2:weighted(RUSH_SHIFT_V3.groups,random).count;
    const count=Math.min(intended,total-id),flip=random()<.5;
    const cells=flip?[[.25,.63],[.75,.63],[.5,.25]]:[[.25,.33],[.75,.33],[.5,.74]];
    for(let n=cells.length-1;n>0;n--){const j=Math.floor(random()*(n+1));[cells[n],cells[j]]=[cells[j],cells[n]];}
    const flight=RUSH_SHIFT_V3.flightCurve[Math.min(number-1,RUSH_SHIFT_V3.flightCurve.length-1)]*profile.flightScale;
    const targets=Array.from({length:count},(_,n):RushTarget=>{
      const [x,y]=intended===1?[.25+random()*.5,.32+random()*.32]:cells[n];
      return {id:id++,wave:number,spawnMs:startMs+n*RUSH_SHIFT_V3.staggerMs+Math.round(random()*50),
        flightMs:Math.round(flight*(.96+random()*.08)),x,y,variant:Math.floor(random()*4),version:3,lean:random()<.5?-1:1};
    });
    waves.push({number,startMs,targets});
    startMs=Math.max(...targets.map(t=>Math.ceil(t.spawnMs+t.flightMs*.98)))+Math.round(RUSH_SHIFT_V3.waveGapMs*profile.gapScale);
  }
  return waves;
}
export function createRushAssignment(seed:string,turn:number):RushAssignment{
  const difficulty=drawRushDifficulty(seed,turn),{bucket,total}=drawRushWorkload(seed,turn);
  const waves=buildRushWaves(seed,turn,total,difficulty.id),last=waves[waves.length-1];
  return {version:1,difficulty:difficulty.id,workload:bucket.id,total,waves,
    endMs:Math.max(...last.targets.map(t=>Math.ceil(t.spawnMs+t.flightMs*.98)))+RUSH_SHIFT_V3.departureMs};
}
