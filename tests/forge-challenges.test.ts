import {test,expect} from 'vitest';
import {currentChallengeClutch} from './helpers/current-challenge-game';
import {challengeTurn} from './helpers/challenge-game';
import {act} from '@/game/hardcore/play';
import {makeSave,readMonthlySave} from '@/game/hardcore/save';
import {BREEDING_CHALLENGES} from '@/game/hardcore/challenge-rules';

test.each(BREEDING_CHALLENGES)('current $id goal is attainable through real inherited conception and an unedited hatch',c=>{
 let {game,eggId}=currentChallengeClutch(c.id,true);
 game=act(game,{type:'selectChallenge',challengeId:c.id},game.lastDate);
 for(let n=0;n<3;n++)game=challengeTurn(readMonthlySave(makeSave(game),game.lastDate));
 expect(game.eggs[eggId].status).toBe('hatched');
 expect(game.breedingChallenges!.completed[0]).toMatchObject({challengeId:c.id,evaluatorVersion:3});
 expect(readMonthlySave(makeSave(game),game.lastDate)).toEqual(game);
});
