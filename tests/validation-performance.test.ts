import {describe,it,expect,vi} from 'vitest';
import type {HardcoreGame} from '../src/game/hardcore/model';
import {validateGame} from '../src/game/hardcore/validation';
import {makeSave,readMonthlySave,checksum} from '../src/game/hardcore/save';
import {actWithTime,synchronizeTime} from '../src/game/hardcore/time-source';
import {act,newGame,newMonthlyGame} from '../src/game/hardcore/play';
import {currentChallengeClutch} from './helpers/current-challenge-game';
import {rushPerformanceGame} from '../e2e/helpers/forge-fixtures';

function freeze<T>(value:T):T {
 if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.freeze(value);for(const v of Object.values(value))freeze(v);}
 return value;
}
const advance=(game:HardcoreGame)=>actWithTime(game,{type:'endTurn'},game.lastDate);

describe('full validation without copying immutable DNA',()=>{
 it('validates frozen weekly/monthly stores, pending pickup and a subsequent uncollected clutch without editing any source',()=>{
  let game=currentChallengeClutch('lilly-dalmatian',true).game;
  const states=[newGame('projection-weekly','2026-10-16'),newMonthlyGame('projection-monthly','2026-10-16'),game];
  game=advance(advance(game));
  const first=Object.values(game.matings)[0];
  game=act(game,{type:'breed',fatherId:first.parents.fatherId,motherId:first.parents.motherId},game.lastDate);
  game=advance(game);states.push(game);
  expect(Object.values(game.eggs).some(e=>e.care?.collectedTurn===null)).toBe(true);
  expect(Object.values(game.eggs).some(e=>e.status==='hatched'&&e.care?.settledTurn===null)).toBe(true);
  for(const source of states){
   const before=checksum(source);freeze(source);expect(()=>validateGame(source)).not.toThrow();
   expect(checksum(source)).toBe(before);expect(readMonthlySave(makeSave(source),source.lastDate).gameId).toBe(source.gameId);
  }
 });
 it('validates 300 genomes with zero full-game structured clones',()=>{
  const game=freeze(rushPerformanceGame(300)),original=globalThis.structuredClone,fullCopies:string[]=[];
  const spy=vi.spyOn(globalThis,'structuredClone').mockImplementation((value,options)=>{const snapshot=value as HardcoreGame|undefined;if(snapshot?.gameId&&snapshot?.individuals)fullCopies.push(snapshot.gameId);return original(value,options);});
  try{validateGame(game);expect(fullCopies).toEqual([]);}finally{spy.mockRestore();}
 });
 it.each(['unknown','array','genome','health','rules','calendar','care','embryo'] as const)('still rejects %s damage after the same object was already validated',kind=>{
  const game=structuredClone(currentChallengeClutch('lilly-dalmatian',true).game);validateGame(game);
  const g=Object.values(game.individuals)[0],e=Object.values(game.eggs)[0];
  switch(kind){
   case 'unknown':Object.assign(g,{unexpected:true});break;
   case 'array':game.individuals[g.id]=Object.assign([],g) as unknown as typeof g;break;
   case 'genome':g.genetics!.genome!.polygenic.loci['red-1']=[99,99];break;
   case 'health':g.healthGenome!.loci['embryonic-vigor']=['bad','bad'];break;
   case 'rules':game.rules.adultAfter=12;break;
   case 'calendar':game.monthlyCalendar!.date='2026-01-01';break;
   case 'care':e.care!.collectedTurn=game.turn+1;break;
   case 'embryo':e.embryo.name='tampered';break;
  }
  expect(()=>validateGame(game)).toThrow();
  expect(()=>synchronizeTime(game,game.lastDate)).toThrow();
  // A recomputed envelope checksum never bypasses structural/inheritance validation.
  expect(()=>readMonthlySave({format:'gecko-lab-save',version:10,checksum:checksum(game),game},game.lastDate)).toThrow();
 });
});
