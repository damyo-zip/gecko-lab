import {inspectChallenge} from './challenge-observation';
import {canonicalJSON} from '@/game/save';
import type {HardcoreGame} from './model';
import {CHALLENGE_LOCK_TURNS,LEGACY_CHALLENGE_LOCK_TURNS,isCurrentChallengeId,isLegacyChallengeId,CHALLENGE_REWARD} from './challenge-rules';
import {bornIndividual} from './egg-outcome';

/** Historical v1/v2 awards retain their original structural contract. Current
 * trophies use immutable egg evidence and the frozen v3 visible evaluator. */
export function validateChallenges(game:HardcoreGame):void {
 if(!Object.hasOwn(game,'breedingChallenges'))return;
 const fail=():never=>{throw new Error('브리딩 도전 저장 기록이 손상되었습니다.');};
 const keys=(v:unknown,k:string)=>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).sort().join()!==k.split(' ').sort().join())fail();};
 const integer=(v:unknown)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0&&v<=game.turn;
 const s=game.breedingChallenges;
 keys(s,'version activeId selectedTurn unlockTurn completed equippedTitle'+(s?.version===2?' initialSelection':''));
 if(!s||game.saveVersion!==10||![1,2].includes(s.version)||!Array.isArray(s.completed)||s.completed.length>(s.version===2?8:5))fail();
 const modern=s!.version===2;
 if(modern&&(typeof s!.initialSelection!=='boolean'||s!.initialSelection&&(s!.activeId!=='lilly-dalmatian'||s!.completed.length>0)))fail();
 const validId=modern?isCurrentChallengeId:isLegacyChallengeId;
 for(const [index,c] of s!.completed.entries()){
  keys(c,'challengeId eggId achievedTurn evaluatorVersion specimen morph phenotype reward announced'+(modern?' trophyEggIds representativeEggId':''));keys(c.reward,'feedExemptionSlots titleId'+(modern?' money food bonus':''));
  const egg=game.eggs[c.eggId];
  if(!validId(c.challengeId)||!integer(c.achievedTurn)||!(modern?[3]:[1,2]).includes(c.evaluatorVersion)||c.evaluatorVersion===2&&!c.specimen.genetics?.forge||typeof c.announced!=='boolean'||
   typeof c.morph!=='string'||!c.morph||c.morph.length>512||typeof c.phenotype!=='string'||c.phenotype.length>2048||
   c.reward.feedExemptionSlots!==(modern?(index+1)%2===0?1:0:1)||c.reward.titleId!==c.challengeId||!egg||egg.status!=='hatched'||egg.embryo.birthTurn!==c.achievedTurn||
   egg.lifecycle?.failure||canonicalJSON(c.specimen)!==canonicalJSON(bornIndividual(egg.embryo)))fail();
  if(modern){
   if(c.reward.money!==CHALLENGE_REWARD.money||c.reward.food!==CHALLENGE_REWARD.food||c.reward.bonus!==(index===7?CHALLENGE_REWARD.finalBonus:0)||
    !Array.isArray(c.trophyEggIds)||!c.trophyEggIds.length||new Set(c.trophyEggIds).size!==c.trophyEggIds.length||c.trophyEggIds[0]!==c.eggId||!c.trophyEggIds.includes(c.representativeEggId!))fail();
   for(const id of c.trophyEggIds!){
    const e=game.eggs[id];
    if(!e||e.status!=='hatched'||e.lifecycle?.failure||e.embryo.development?.viable===false||e.embryo.birthTurn<c.achievedTurn||e.embryo.birthTurn>game.turn||!isCurrentChallengeId(c.challengeId)||!inspectChallenge(e.embryo,c.challengeId).passed)fail();
   }
  }
 }
 if(new Set(s!.completed.map(c=>c.challengeId)).size!==s!.completed.length)fail();
 if(s!.activeId===null){if(s!.selectedTurn!==null||s!.unlockTurn!==null)fail();}
 else {
  if(!validId(s!.activeId)||!integer(s!.selectedTurn))fail();
  const c=s!.completed.find(c=>c.challengeId===s!.activeId);
  if(!modern&&c&&c.achievedTurn<s!.selectedTurn!)fail();
  if(s!.unlockTurn!==(c?(modern?Math.max(c.achievedTurn,s!.selectedTurn!):c.achievedTurn):s!.selectedTurn!+(modern?(s!.initialSelection?0:CHALLENGE_LOCK_TURNS):LEGACY_CHALLENGE_LOCK_TURNS)))fail();
 }
 if(s!.equippedTitle!==null&&!s!.completed.some(c=>c.challengeId===s!.equippedTitle))fail();
}
