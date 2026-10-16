import {test,expect} from 'vitest';
import {breederRankGames} from './helpers/breeder-rank-game';
import {breederRank,BREEDER_TITLES} from '@/game/hardcore/breeder-rank';
import {act,newGame} from '@/game/hardcore/play';
import {parseBackup,exportBackup} from '@/game/hardcore/save';
import {challengeTurn} from './helpers/challenge-game';
const states=breederRankGames();

test.each(BREEDER_TITLES.map((title,count)=>({title,count})))('$count distinct real hatch achievements display $title before and after save',({count,title})=>{
 const g=states[count],before=exportBackup(g);
 expect(breederRank(g)).toEqual({completed:count,title,legendary:count===5});
 expect(breederRank(parseBackup(before,g.lastDate))).toEqual(breederRank(g));expect(exportBackup(g)).toBe(before);
});
test('duplicate known goals do not count twice and legacy manual selection never determines the automatic rank',()=>{
 const g=structuredClone(states[1]),record=g.breedingChallenges!.completed[0];
 g.breedingChallenges!.equippedTitle=record.challengeId;
 expect(breederRank(parseBackup(exportBackup(g),g.lastDate)).title).toBe('신예 브리더');
 // Malformed duplicates are rejected by save validation; the display still deduplicates.
 g.breedingChallenges!.completed.push(record,record);expect(breederRank(g).completed).toBe(1);
 expect(breederRank(g).title).toBe('신예 브리더');
});
test('target changes, first winner sale and actual deaths preserve rank; a new game starts at zero',()=>{
 let g=structuredClone(states[1]);const record=g.breedingChallenges!.completed[0];
 g=act(g,{type:'selectChallenge',challengeId:'sun'},g.lastDate);expect(breederRank(g).title).toBe('신예 브리더');
 g=act(g,{type:'receiveHatchling',eggId:record.eggId},g.lastDate);
 g=act(g,{type:'sell',id:record.specimen.id},g.lastDate);expect(g.individuals[record.specimen.id].status).toBe('sold');
 g.food=0;for(let n=0;n<5;n++)g=challengeTurn(g);
 expect(Object.values(g.individuals).some(i=>i.status==='dead')).toBe(true);
 expect(breederRank(parseBackup(exportBackup(g),g.lastDate)).title).toBe('신예 브리더');expect(g.breedingChallenges!.completed[0]).toEqual(record);
 expect(breederRank(newGame('new-rank-reset',g.lastDate))).toEqual({completed:0,title:'견습 브리더',legendary:false});
});
