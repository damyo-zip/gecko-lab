import {test,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {readSave,readMonthlySave,makeSave} from '../src/game/hardcore/save';
import {actWithTime} from '../src/game/hardcore/time-source';
import {eggFailure} from '../src/game/hardcore/egg-outcome';
const histories=JSON.parse(readFileSync('tests/fixtures/three-clutch-v6.json','utf8'));
test.each(['laid2','laid3'])('monthly migration retains all conceived historical %s eggs and their remaining turns',key=>{
 const envelope=histories[key],before=readSave(envelope,'2026-10-24');let game=readMonthlySave(envelope,'2026-10-24');
 expect(game.money).toBe(before.money);expect(game.food).toBe(before.food);expect(Object.keys(game.eggs)).toEqual(Object.keys(before.eggs));
 for(const id of Object.keys(before.matings))expect(game.matings[id].lifecycle!.offspring.map(o=>({genome:o.embryo.genetics!.genome,seed:o.embryo.visualSeed}))).toEqual(before.matings[id].lifecycle!.offspring.map(o=>({genome:o.embryo.genetics!.genome,seed:o.embryo.visualSeed})));
 for(const id of Object.keys(before.eggs)){expect(game.eggs[id].lifecycle).toEqual(before.eggs[id].lifecycle);expect(game.eggs[id].embryo.genetics!.genome).toEqual(before.eggs[id].embryo.genetics!.genome);}
 const due=Math.max(...Object.values(game.eggs).map(e=>e.lifecycle!.dueTurn));
 while(game.turn<due)game=actWithTime(game,{type:'endTurn'},game.lastDate);
 for(const egg of Object.values(game.eggs))expect(egg.status).toBe(eggFailure(egg)===null?'hatched':'failed');
 expect(readMonthlySave(makeSave(game),game.lastDate)).toEqual(game);
});
