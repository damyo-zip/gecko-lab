import type {HardcoreGame} from './model';
import {isChallengeId} from './challenge-rules';

export const BREEDER_TITLES=['견습 브리더','신예 브리더','모프 탐구가','혈통 설계자','모프 마스터','전설의 브리더'] as const;
export const CURRENT_BREEDER_TITLES=['견습 브리더','견습 브리더','모프 탐구가','모프 탐구가','혈통 설계자','혈통 설계자','모프 마스터','모프 마스터','전설의 브리더'] as const;
/** Player-wide presentation derived solely from permanent, distinct achievements.
 * No persisted rank counter; selection, ownership and legacy equipped titles are ignored. */
export function breederRank(game:Pick<HardcoreGame,'breedingChallenges'>){
 const completed=new Set((game.breedingChallenges?.completed??[]).map(c=>c.challengeId).filter(isChallengeId)).size;
 if(game.breedingChallenges?.version===2)return {completed,title:CURRENT_BREEDER_TITLES[Math.min(completed,8)],legendary:completed===8};
 return {completed,title:BREEDER_TITLES[Math.min(completed,5)],legendary:completed===5};
}
