import {describe,it,expect} from 'vitest';
import {eggParents} from '../src/components/hardcore/incubator-parents';
import {incubatorFixture} from '../e2e/fixtures/incubator-reference';

describe('incubator parent records',()=>{
 it('resolves the actual egg parents even after sale or death without creating individuals',()=>{
  const game=incubatorFixture(),egg=Object.values(game.eggs)[0],ids=egg.embryo.parents!;
  game.individuals[ids.motherId].status='sold';game.individuals[ids.fatherId].status='dead';
  const before=JSON.stringify(game),parents=eggParents(game,egg);
  expect(parents.mother).toBe(game.individuals[ids.motherId]);expect(parents.father).toBe(game.individuals[ids.fatherId]);
  expect(JSON.stringify(game)).toBe(before);
 });
 it('uses registered mating parents for older embryos and honestly leaves missing records empty',()=>{
  const game=incubatorFixture(),egg=Object.values(game.eggs)[0],ids=egg.embryo.parents!;
  egg.embryo.parents=null;
  expect(eggParents(game,egg).mother?.id).toBe(ids.motherId);
  delete game.individuals[ids.motherId];expect(eggParents(game,egg).mother).toBeNull();
  delete game.matings[egg.matingId!];expect(eggParents(game,egg)).toEqual({mother:null,father:null});
 });
});
