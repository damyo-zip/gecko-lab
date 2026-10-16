import type {HardcoreGame} from './model';
import {isChallengeId} from './challenge-rules';

export const BREEDER_TITLES=['견습 브리더','신예 브리더','모프 탐구가','혈통 설계자','모프 마스터','전설의 브리더'] as const;
/** Player-wide presentation derived solely from permanent, distinct achievements.
 * No persisted rank counter; selection, ownership and legacy equipped titles are ignored. */
export function breederRank(game:Pick<HardcoreGame,'breedingChallenges'>){
 const completed=new Set((game.breedingChallenges?.completed??[]).map(c=>c.challengeId).filter(isChallengeId)).size;
 return {completed,title:BREEDER_TITLES[Math.min(completed,5)],legendary:completed===5};
}
