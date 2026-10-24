import type {Gecko,HardcoreGame,TimedEgg} from './model';
import {CHALLENGE_LOCK_TURNS,LEGACY_CHALLENGE_LOCK_TURNS,challengeById,isChallengeId,type ChallengeId,isCurrentChallengeId,isLegacyChallengeId,CHALLENGE_REWARD} from './challenge-rules';
import {evaluateBreedingChallenge} from './challenge-evaluator';
import {bornIndividual} from './egg-outcome';
import {visualName,morphDescription} from './adapter';
import {breederRank} from './breeder-rank';

export interface ChallengeCompletion {
 challengeId:ChallengeId;eggId:string;achievedTurn:number;evaluatorVersion:1|2|3;
 /** Immutable birth portrait includes seed, appearance version, genome and parents.
  * It never counts as another owned animal; the existing egg remains pedigree evidence. */
 specimen:Gecko;morph:string;phenotype:string;
 /** Legacy field name retained for save compatibility; not assignable slots. */
 reward:{feedExemptionSlots:0|1;titleId:ChallengeId;money?:number;food?:number;bonus?:number};announced:boolean;
 trophyEggIds?:string[];representativeEggId?:string;
}
export interface BreedingChallenges {
 version:1|2;activeId:ChallengeId|null;selectedTurn:number|null;unlockTurn:number|null;
 completed:ChallengeCompletion[];
 /** Legacy manual selection retained for save/client compatibility; automatic rank ignores it. */
 equippedTitle:ChallengeId|null;
 initialSelection?:boolean;
}
export const emptyChallenges=(version:1|2=1,turn=0):BreedingChallenges=>({version,activeId:version===2?'lilly-dalmatian':null,selectedTurn:version===2?turn:null,unlockTurn:version===2?turn:null,completed:[],equippedTitle:null,...(version===2?{initialSelection:true}:{})});
export const challengeLockRemaining=(game:HardcoreGame)=>Math.max(0,(game.breedingChallenges?.unlockTurn??game.turn)-game.turn);
/** Current meals derive from two-goal milestones, with no second counter. The
 * raw historical reader retains its original one-goal/one-meal contract. */
export const challengeFeedSlots=(game:HardcoreGame)=>game.breedingChallenges?.version===2?Math.floor(breederRank(game).completed/2):breederRank(game).completed;
export function selectChallenge(game:HardcoreGame,id:ChallengeId):void {
 if(game.saveVersion!==10||!isChallengeId(id))throw new Error('지원하지 않는 브리딩 도전입니다.');
 const state=game.breedingChallenges??emptyChallenges(game.forge?2:1,game.turn);
 if(state.version===2?!isCurrentChallengeId(id):!isLegacyChallengeId(id))throw new Error('현재 도전 목록에서 목표를 선택하세요.');
 if(state.activeId===id){game.breedingChallenges=state;return;}
 if(state.version===1&&state.completed.some(c=>c.challengeId===id))throw new Error('이미 완료한 도전입니다.');
 if(challengeLockRemaining(game)>0)throw new Error(`목표 변경까지 ${challengeLockRemaining(game)}턴 남았습니다.`);
 state.activeId=id;state.selectedTurn=game.turn;state.unlockTurn=game.turn+(state.completed.some(c=>c.challengeId===id)?0:state.version===2?CHALLENGE_LOCK_TURNS:LEGACY_CHALLENGE_LOCK_TURNS);if(state.version===2)state.initialSelection=false;game.breedingChallenges=state;
}
/** Call ONLY from the transition incubating -> successfully hatched. Never scan
 * past individuals, buy actions or pickup actions. Fixed results remain in eggs. */
export function recordChallengeHatch(game:HardcoreGame,egg:TimedEgg):void {
 const s=game.breedingChallenges,id=s?.activeId;
 if(!s||!id||egg.status!=='hatched'||egg.embryo.birthTurn!==game.turn||egg.resolvedDate!==game.lastDate||egg.lifecycle?.failure||egg.embryo.development?.viable===false||
  !evaluateBreedingChallenge(egg.embryo,id))return;
 const existing=s.completed.find(c=>c.challengeId===id);
 if(existing){
  if(s.version===2&&!existing.trophyEggIds!.includes(egg.id))existing.trophyEggIds!.push(egg.id);
  return;
 }
 const count=s.completed.length+1,modern=s.version===2,bonus=modern&&count===8?CHALLENGE_REWARD.finalBonus:0;
 if(modern){
  if(game.money+CHALLENGE_REWARD.money+bonus>1e12||game.food+CHALLENGE_REWARD.food>1_000_000)throw new Error('도전 보상을 받을 자금·사료 보관 한도를 초과했습니다.');
  game.money+=CHALLENGE_REWARD.money+bonus;game.food+=CHALLENGE_REWARD.food;
 }
 s.completed.push({challengeId:id,eggId:egg.id,achievedTurn:game.turn,evaluatorVersion:modern?3:egg.embryo.genetics?.forge?2:1,
  specimen:bornIndividual(egg.embryo),morph:visualName(egg.embryo),phenotype:morphDescription(egg.embryo),
  reward:modern?{feedExemptionSlots:count%2===0?1:0,titleId:id,money:CHALLENGE_REWARD.money,food:CHALLENGE_REWARD.food,bonus}:{feedExemptionSlots:1,titleId:id},announced:false,
  ...(modern?{trophyEggIds:[egg.id],representativeEggId:egg.id}:{})});
 if(modern)s.initialSelection=false;
 s.unlockTurn=game.turn;
 // Keep the achieved target visible, but never choose the next one for the player.
}
export function acknowledgeChallenge(game:HardcoreGame,id:ChallengeId):void {
 const c=game.breedingChallenges?.completed.find(c=>c.challengeId===id);if(c)c.announced=true;
}
/** @deprecated Compatibility action only; does not affect the automatic breeder rank. */
export function equipChallengeTitle(game:HardcoreGame,id:ChallengeId|null):void {
 const s=game.breedingChallenges;
 if(!s||id!==null&&!s.completed.some(c=>c.reward.titleId===id))throw new Error('아직 획득하지 않은 칭호입니다.');
 s.equippedTitle=id;
}
/** @deprecated Historical equipped label; gameplay UI uses breederRank instead. */
export function equippedChallengeTitle(game:HardcoreGame):string|null {
 const id=game.breedingChallenges?.equippedTitle;return id?challengeById(id).title:null;
}

/** Only previously observed, successful matching hatches may represent a trophy. */
export function setChallengeRepresentative(game:HardcoreGame,id:ChallengeId,eggId:string):void {
 const s=game.breedingChallenges,c=s?.completed.find(c=>c.challengeId===id);
 if(s?.version!==2||!c?.trophyEggIds?.includes(eggId))throw new Error('이 도전의 성공 기록에서 대표 개체를 선택하세요.');
 c.representativeEggId=eggId;
}
export function trophySpecimen(game:HardcoreGame,c:ChallengeCompletion):Gecko {
 const egg=c.representativeEggId?game.eggs[c.representativeEggId]:null;
 return egg?bornIndividual(egg.embryo):c.specimen;
}
