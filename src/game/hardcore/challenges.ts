import type {Gecko,HardcoreGame,TimedEgg} from './model';
import {CHALLENGE_LOCK_TURNS,challengeById,isChallengeId,type ChallengeId} from './challenge-rules';
import {evaluateBreedingChallenge} from './challenge-evaluator';
import {bornIndividual} from './egg-outcome';
import {visualName,morphDescription} from './adapter';

export interface ChallengeCompletion {
 challengeId:ChallengeId;eggId:string;achievedTurn:number;evaluatorVersion:1;
 /** Immutable birth portrait includes seed, appearance version, genome and parents.
  * It never counts as another owned animal; the existing egg remains pedigree evidence. */
 specimen:Gecko;morph:string;phenotype:string;
 reward:{feedExemptionSlots:1;titleId:ChallengeId};announced:boolean;
}
export interface BreedingChallenges {
 version:1;activeId:ChallengeId|null;selectedTurn:number|null;unlockTurn:number|null;
 completed:ChallengeCompletion[];
 /** Legacy manual selection retained for save/client compatibility; automatic rank ignores it. */
 equippedTitle:ChallengeId|null;
}
export const emptyChallenges=():BreedingChallenges=>({version:1,activeId:null,selectedTurn:null,unlockTurn:null,completed:[],equippedTitle:null});
export const challengeLockRemaining=(game:HardcoreGame)=>Math.max(0,(game.breedingChallenges?.unlockTurn??game.turn)-game.turn);
/** Reward ledger only: no feed-exemption engine existed before this feature.
 * Do not silently change the established one-food-per-animal economy. */
export const challengeFeedSlots=(game:HardcoreGame)=>game.breedingChallenges?.completed.reduce((n,c)=>n+c.reward.feedExemptionSlots,0)??0;
export function selectChallenge(game:HardcoreGame,id:ChallengeId):void {
 if(game.saveVersion!==10||!isChallengeId(id))throw new Error('지원하지 않는 브리딩 도전입니다.');
 const state=game.breedingChallenges??emptyChallenges();
 if(state.activeId===id)return;
 if(state.completed.some(c=>c.challengeId===id))throw new Error('이미 완료한 도전입니다.');
 if(challengeLockRemaining(game)>0)throw new Error(`목표 변경까지 ${challengeLockRemaining(game)}턴 남았습니다.`);
 state.activeId=id;state.selectedTurn=game.turn;state.unlockTurn=game.turn+CHALLENGE_LOCK_TURNS;game.breedingChallenges=state;
}
/** Call ONLY from the transition incubating -> successfully hatched. Never scan
 * past individuals, buy actions or pickup actions. Fixed results remain in eggs. */
export function recordChallengeHatch(game:HardcoreGame,egg:TimedEgg):void {
 const s=game.breedingChallenges,id=s?.activeId;
 if(!s||!id||egg.status!=='hatched'||egg.embryo.birthTurn!==game.turn||egg.resolvedDate!==game.lastDate||egg.lifecycle?.failure||egg.embryo.development?.viable===false||
  s.completed.some(c=>c.challengeId===id)||!evaluateBreedingChallenge(egg.embryo,id))return;
 s.completed.push({challengeId:id,eggId:egg.id,achievedTurn:game.turn,evaluatorVersion:1,
  specimen:bornIndividual(egg.embryo),morph:visualName(egg.embryo),phenotype:morphDescription(egg.embryo),
  reward:{feedExemptionSlots:1,titleId:id},announced:false});
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
