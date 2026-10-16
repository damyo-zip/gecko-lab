import {canonicalJSON} from '@/game/save';
import type {HardcoreGame} from './model';
import {isChallengeId,CHALLENGE_LOCK_TURNS} from './challenge-rules';
import {bornIndividual} from './egg-outcome';

/** Historical awards are validated against their immutable egg evidence, never
 * re-evaluated using a future phenotype engine or a renamed/sold collection record. */
export function validateChallenges(game:HardcoreGame):void {
 if(!Object.hasOwn(game,'breedingChallenges'))return;
 const fail=():never=>{throw new Error('브리딩 도전 저장 기록이 손상되었습니다.');};
 const keys=(v:unknown,k:string)=>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).sort().join()!==k.split(' ').sort().join())fail();};
 const integer=(v:unknown)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0&&v<=game.turn;
 const s=game.breedingChallenges;
 keys(s,'version activeId selectedTurn unlockTurn completed equippedTitle');
 if(!s||game.saveVersion!==10||s.version!==1||!Array.isArray(s.completed)||s.completed.length>5)fail();
 for(const c of s!.completed){
  keys(c,'challengeId eggId achievedTurn evaluatorVersion specimen morph phenotype reward announced');keys(c.reward,'feedExemptionSlots titleId');
  const egg=game.eggs[c.eggId];
  if(!isChallengeId(c.challengeId)||!integer(c.achievedTurn)||c.evaluatorVersion!==1||typeof c.announced!=='boolean'||
   typeof c.morph!=='string'||!c.morph||c.morph.length>512||typeof c.phenotype!=='string'||c.phenotype.length>2048||
   c.reward.feedExemptionSlots!==1||c.reward.titleId!==c.challengeId||!egg||egg.status!=='hatched'||egg.embryo.birthTurn!==c.achievedTurn||
   egg.lifecycle?.failure||canonicalJSON(c.specimen)!==canonicalJSON(bornIndividual(egg.embryo)))fail();
 }
 if(new Set(s!.completed.map(c=>c.challengeId)).size!==s!.completed.length)fail();
 if(s!.activeId===null){if(s!.selectedTurn!==null||s!.unlockTurn!==null)fail();}
 else {
  if(!isChallengeId(s!.activeId)||!integer(s!.selectedTurn))fail();
  const c=s!.completed.find(c=>c.challengeId===s!.activeId);
  if(c&&c.achievedTurn<s!.selectedTurn!)fail();
  if(s!.unlockTurn!==(c?.achievedTurn??s!.selectedTurn!+CHALLENGE_LOCK_TURNS))fail();
 }
 if(s!.equippedTitle!==null&&!s!.completed.some(c=>c.challengeId===s!.equippedTitle))fail();
}
