import {withoutForge} from './helpers/forge-fixtures';
import {openIncubatorRecords} from './helpers/hardcore-navigation';
import {buyFood,manageResources,closeResources} from "./helpers/hardcore-navigation";
import {test,expect,type Page} from '@playwright/test';
import {axCatalog as newGame,act} from './helpers/forge-fixtures';
import {newGame as legacyGame,act as legacyAct} from '../tests/helpers/legacy-hardcore';
import {makeSave,exportBackup} from '../src/game/hardcore/save';
import {touch,navigateGame,finishTurn} from './helpers/hardcore-navigation';
import {addDays} from '../src/game/hardcore/time';
import type {HardcoreGame} from '../src/game/hardcore/model';
const DATE='2026-10-14';
async function saved(page:Page):Promise<HardcoreGame>{return page.evaluate(async()=>{
 const db=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open('gecko-lab',1);r.onsuccess=()=>resolve(r.result);});
 return new Promise(resolve=>{const tx=db.transaction('games','readonly'),r=tx.objectStore('games').get('active');r.onsuccess=()=>resolve(r.result.save.game);tx.oncomplete=()=>db.close();});
});}
async function restore(page:Page,g:HardcoreGame,mobile:boolean){await touch(page.getByRole('button',{name:'저장 및 게임 설정',exact:true}),mobile);await page.getByLabel('JSON 백업 파일',{exact:true}).setInputFiles({name:'v12.json',mimeType:'application/json',buffer:Buffer.from(exportBackup(g))});await touch(page.getByRole('button',{name:'복원 실행',exact:true}),mobile);await expect(page.getByRole('dialog')).toHaveCount(0);}
test.beforeEach(async({page})=>{await page.clock.setFixedTime(new Date(DATE+'T03:00:00Z'));await page.goto('/');await expect(page.getByRole('heading',{name:/^보유 개체/})).toBeVisible();});
test('360px shortage warning cancels safely, redirects to food purchase, and auto-feeds all living stages once',async({page},info)=>{
 const mobile=info.project.name.startsWith('mobile'),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width:360,height:800});
 let g=newGame('food-warning',DATE,{initialMoney:3_000_000,initialCapacity:20});for(const offer of Object.values(g.shop.offers).filter(o=>['노멀 수컷','Ax 해칭'].includes(o.individual.name)))g=act(g,{type:'buyGecko',offerId:offer.id},DATE);
 await restore(page,g,mobile);await touch(page.getByRole('button',{name:'턴 넘기기',exact:true}),mobile);await expect(page.getByRole('dialog')).toContainText('필요 사료 2개');expect(await saved(page)).toEqual(g);
 await page.screenshot({path:info.outputPath('v12-food-warning-360.png'),scale:'css'});await touch(page.getByRole('button',{name:'상세 창 닫기',exact:true}),mobile);expect(await saved(page)).toEqual(g);
 await touch(page.getByRole('button',{name:'턴 넘기기',exact:true}),mobile);await touch(page.getByRole('button',{name:'사료 구입하러 가기',exact:true}),mobile);await buyFood(page,mobile,2);
 await navigateGame(page,'컬렉션',mobile);await finishTurn(page,mobile);const next=await saved(page);expect(next.food).toBe(0);expect(next.turn).toBe(1);expect(next.lastDate).toBe(addDays(DATE,30));expect(Object.values(next.individuals).every(i=>i.hearts===5)).toBe(true);
 await page.reload();await expect(page.getByTestId('game-day')).toHaveText('1');expect(await saved(page)).toEqual(next);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
});
test('retirement and guaranteed 216-month death update housing while keeping original genes and lineage after reload',async({page},info)=>{
 const mobile=info.project.name.startsWith('mobile');let g=newGame('old-gecko',DATE,{initialCapacity:20});const offer=Object.values(g.shop.offers)[0],gecko=offer.individual;gecko.birthTurn=-215;gecko.birthDate=addDays(DATE,-215*30);g=act(g,{type:'buyGecko',offerId:offer.id},DATE);g.food=10;
 await restore(page,g,mobile);await touch(page.getByRole('button',{name:gecko.name+' 상세보기',exact:true}),mobile);await expect(page.getByRole('dialog')).toContainText('번식 은퇴');await expect(page.getByRole('button',{name:'부모로 선택',exact:true})).toBeDisabled();await page.keyboard.press('Escape');
 await finishTurn(page,mobile);const next=await saved(page);expect(next.individuals[gecko.id]).toMatchObject({status:'dead',deathCause:'natural',hearts:0});expect(next.individuals[gecko.id].genetics).toEqual(gecko.genetics);expect(next.individuals[gecko.id].potential).toEqual(gecko.potential);expect(next.food).toBe(9);await expect(page.locator('.home-card')).toHaveCount(0);
 await navigateGame(page,'혈통',mobile);await expect(page.getByRole('combobox',{name:'혈통을 볼 개체',exact:true})).toContainText(gecko.name);await touch(page.getByRole('button',{name:'상세 정보',exact:true}),mobile);await expect(page.getByRole('dialog')).toContainText('노령 자연사');await page.keyboard.press('Escape');await page.screenshot({path:info.outputPath('v12-natural-death-lineage.png'),scale:'css'});
 await page.reload();await expect(page.getByTestId('game-day')).toHaveText('1');expect(await saved(page)).toEqual(next);
});
test('real active v5 migration archives the exact original, pauses real time, retains genes and single-clutch commitments',async({page},info)=>{
 const mobile=info.project.name.startsWith('mobile');let old=legacyGame('v5-live',DATE,{initialCapacity:20});const [f,m]=Object.keys(old.shop.offers);for(const id of [f,m])old=legacyAct(old,{type:'buyGecko',offerId:id},DATE);old=legacyAct(old,{type:'breed',fatherId:f,motherId:m},DATE);old.time.mode='realtime';
 const record={save:makeSave(old),writeRevision:9};await page.evaluate(async record=>{const db=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open('gecko-lab',1);r.onsuccess=()=>resolve(r.result);});await new Promise<void>(resolve=>{const tx=db.transaction('games','readwrite');tx.objectStore('games').put(record,'active');tx.oncomplete=()=>{db.close();resolve();};});},record);
 await page.clock.setFixedTime(new Date(addDays(DATE,700)+'T03:00:00Z'));await page.reload();await expect(page.getByTestId('game-day')).toHaveText('0');const next=await saved(page);expect(next).toMatchObject({saveVersion:10,rulesVersion:5,lastDate:DATE,time:{mode:'turn'}});expect(next.nextClutch).toBe(old.nextClutch);
 for(const id of [f,m]){expect(withoutForge(next.individuals[id].genetics)).toEqual(old.individuals[id].genetics);expect(next.individuals[id].potential).toEqual(old.individuals[id].potential);}
 expect(Object.values(next.matings)[0].lifecycle!.maxClutches).toBe(1);
 const archived=await page.evaluate(async()=>{const db=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open('gecko-lab',1);r.onsuccess=()=>resolve(r.result);});return new Promise(resolve=>{const tx=db.transaction('games','readonly'),r=tx.objectStore('games').get('archive-v5-10');r.onsuccess=()=>resolve(r.result);tx.oncomplete=()=>db.close();});});expect(archived).toEqual(record);
 await navigateGame(page,'부화',mobile);await openIncubatorRecords(page,mobile);await expect(page.locator('.hc-event').first()).toContainText('산란 0/1');await page.reload();await expect(page.getByTestId('game-day')).toHaveText('0');expect(await saved(page)).toEqual(next);
});
