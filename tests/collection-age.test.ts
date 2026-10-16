import {test,expect} from 'vitest';
import {collectionAge} from '@/components/hardcore/collection-query';
import {referenceHomeGame} from '../e2e/fixtures/reference-home';
import {ageTurns} from '@/game/hardcore/lifecycle';
import {exportBackup,parseBackup} from '@/game/hardcore/save';

test('canonical turn age is rendered in months/years, including month and year boundaries',()=>{
 const game=referenceHomeGame(),source=Object.values(game.individuals)[0],before=structuredClone(game);
 for(const [turns,label] of [[0,'0개월'],[4,'0개월'],[5,'1개월'],[12,'2개월'],[51,'11개월'],[52,'1년 0개월'],[86,'1년 8개월']] as const){
  const g={...source,birthTurn:game.turn-turns};
  expect(collectionAge(game,g)).toBe(label);expect(ageTurns(game,g)).toBe(turns);
 }
 expect(game).toEqual(before);
});
test('display uses normalized turn age even when a migrated historical birth date is different',()=>{
 const game=referenceHomeGame(),g=Object.values(game.individuals)[0];
 expect(g.birthDate).not.toBe(game.lastDate);expect(collectionAge(game,g)).toBe('2개월');
 expect(collectionAge(game,{...g,birthDate:'2000-01-01'})).toBe('2개월');
 const copy=parseBackup(exportBackup(game),game.lastDate);expect(collectionAge(copy,copy.individuals[g.id])).toBe('2개월');expect(copy).toEqual(game);
});
