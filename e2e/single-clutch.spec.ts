import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {newGame,act} from './fixtures/legacy-catalog';
import {exportBackup,type makeSave} from '../src/game/hardcore/save';
import {freeSlots,reserved} from '../src/game/hardcore/survival';
import {touch,navigateGame,finishTurn} from './helpers/hardcore-navigation';
import {successfulPair} from './fixtures/lifecycle';
import type {HardcoreGame} from '../src/game/hardcore/model';
const DATE='2026-10-14';
const oldSaves=JSON.parse(readFileSync('tests/fixtures/three-clutch-v6.json','utf8')) as Record<'beforeLaying'|'laid1',ReturnType<typeof makeSave>>;
test.setTimeout(90_000);
async function saved(page:Page):Promise<HardcoreGame>{return page.evaluate(async()=>{
 const db=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open('gecko-lab',1);r.onsuccess=()=>resolve(r.result);});
 return new Promise(resolve=>{const tx=db.transaction('games','readonly'),r=tx.objectStore('games').get('active');r.onsuccess=()=>resolve(r.result.save.game);tx.oncomplete=()=>db.close();});
});}
async function restore(page:Page,g:HardcoreGame,mobile:boolean){await touch(page.getByRole('button',{name:'저장 및 게임 설정',exact:true}),mobile);await page.getByLabel('JSON 백업 파일',{exact:true}).setInputFiles({name:'two-slots.json',mimeType:'application/json',buffer:Buffer.from(exportBackup(g))});await touch(page.getByRole('button',{name:'복원 실행',exact:true}),mobile);await expect(page.getByRole('dialog')).toHaveCount(0);}
test.beforeEach(async({page})=>{await page.clock.setFixedTime(new Date(DATE+'T03:00:00Z'));await page.goto('/');await expect(page.getByRole('heading',{name:/^보유 개체/})).toBeVisible();});
for(const available of [0,1,2])test(`${available} free slots: exact shortage, two-slot booking, one automatic clutch and four-turn rest`,async({page},info)=>{
 const mobile=info.project.name.startsWith('mobile'),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 const seed=successfulPair('two-slot-browser-',DATE).original.seed;
 let g=newGame(seed,DATE,{initialCapacity:available+2,initialMoney:3_000_000});const [father,mother]=Object.keys(g.shop.offers);
 for(const id of [father,mother])g=act(g,{type:'buyGecko',offerId:id},DATE);g=act(g,{type:'buyFood',amount:1000},DATE);
 await restore(page,g,mobile);await navigateGame(page,'교배',mobile);
 await page.getByRole('combobox',{name:'수컷 부모',exact:true}).selectOption(father);await page.getByRole('combobox',{name:'암컷 부모',exact:true}).selectOption(mother);
 await expect(page.getByTestId('breeding-slots')).toContainText(`빈 슬롯 ${available}개 · 필요 2개`);
 const button=page.getByRole('button',{name:'교배 일정 시작 · 공간 2칸 예약',exact:true});
 if(available<2){await expect(button).toBeDisabled();await expect(page.locator('.game-warning')).toContainText(`${2-available}개 부족`);expect(await saved(page)).toEqual(g);}
 else {
  await expect(button).toBeEnabled();await page.screenshot({path:info.outputPath('two-slot-breeding.png'),fullPage:true,scale:'css'});await touch(button,mobile);await expect(page.getByRole('heading',{name:'인큐베이터',exact:true})).toBeVisible();
  g=await saved(page);expect(reserved(g)).toBe(2);expect(freeSlots(g)).toBe(0);const m=Object.values(g.matings)[0],fixed=m.lifecycle!.offspring;
  await page.reload();await expect(page.getByTestId('game-day')).toHaveText('0');expect(await saved(page)).toEqual(g);await navigateGame(page,'부화',mobile);
  await finishTurn(page,mobile);expect(Object.keys((await saved(page)).eggs)).toHaveLength(0);
  await finishTurn(page,mobile);g=await saved(page);expect(Object.values(g.eggs)).toHaveLength(2);expect(reserved(g)).toBe(2);expect(freeSlots(g)).toBe(0);expect(g.matings[m.id]).toMatchObject({status:'laid',lifecycle:{clutchesLaid:1,maxClutches:1}});expect(g.individuals[mother].nextBreedTurn).toBe(6);
  await expect(page.getByTestId('mating-'+m.id)).toContainText('산란 일정 종료 · 보존된 알 2개');await page.screenshot({path:info.outputPath('two-slot-incubator.png'),fullPage:true,scale:'css'});
  for(let turn=3;turn<=10;turn++){
   await finishTurn(page,mobile);g=await saved(page);expect(Object.values(g.eggs)).toHaveLength(2);
   if(turn<6)expect(Object.values(g.eggs).every(e=>e.status==='incubating')).toBe(true);
   if(turn===6){expect(Object.values(g.eggs).every(e=>e.status==='hatched')).toBe(true);for(const o of fixed)expect(g.individuals[o.embryo.id]).toEqual(o.embryo);}
  }
  expect(g.matings[m.id].lifecycle!.offspring).toEqual(fixed);await page.reload();await expect(page.getByTestId('game-day')).toHaveText('10');expect(await saved(page)).toEqual(g);
 }
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
});
for(const key of ['beforeLaying','laid1'] as const)test(`real v6 ${key}: atomic archive, released reservations and no future clutches after reload`,async({page},info)=>{
 const mobile=info.project.name.startsWith('mobile'),record={save:oldSaves[key],writeRevision:17},errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.evaluate(async record=>{const db=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open('gecko-lab',1);r.onsuccess=()=>resolve(r.result);});await new Promise<void>(resolve=>{const tx=db.transaction('games','readwrite');tx.objectStore('games').put(record,'active');tx.oncomplete=()=>{db.close();resolve();};});},record);
 await page.reload();await expect(page.getByTestId('game-day')).toHaveText(String(record.save.game.turn));let g=await saved(page);const m=Object.values(g.matings)[0],old=Object.values(record.save.game.matings)[0];
 expect(g.rulesVersion).toBe(4);expect(g.eggs).toEqual(record.save.game.eggs);expect(m.lifecycle!.offspring).toEqual(old.lifecycle!.offspring.slice(0,2));expect(g.individuals[m.parents.motherId].nextBreedTurn).toBe(6);expect(reserved(g)).toBe(2);
 for(const id of Object.keys(record.save.game.individuals)){expect(g.individuals[id].genetics).toEqual(record.save.game.individuals[id].genetics);}
 const archives=await page.evaluate(async()=>{const db=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open('gecko-lab',1);r.onsuccess=()=>resolve(r.result);});return new Promise<unknown[]>(resolve=>{const tx=db.transaction('games','readonly'),items:unknown[]=[],r=tx.objectStore('games').openCursor();r.onsuccess=()=>{const c=r.result;if(!c)return;if(String(c.key).startsWith('archive-'))items.push({key:c.key,value:c.value});c.continue();};tx.oncomplete=()=>{db.close();resolve(items);};});});
 expect(archives).toEqual([{key:'archive-v6-18',value:record}]);await page.reload();await expect(page.getByTestId('game-day')).toHaveText(String(g.turn));expect(await saved(page)).toEqual(g);
 const revision=await page.evaluate(async()=>{const db=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open('gecko-lab',1);r.onsuccess=()=>resolve(r.result);});return new Promise<number>(resolve=>{const tx=db.transaction('games','readonly'),r=tx.objectStore('games').get('active');r.onsuccess=()=>resolve(r.result.writeRevision);tx.oncomplete=()=>db.close();});});expect(revision).toBe(18);
 await navigateGame(page,'부화',mobile);while(g.turn<10){await finishTurn(page,mobile);g=await saved(page);}
 expect(Object.values(g.eggs)).toHaveLength(2);expect(g.matings[m.id].status).toBe('laid');expect(g.matings[m.id].lifecycle!.maxClutches).toBe(1);expect(errors).toEqual([]);
});
