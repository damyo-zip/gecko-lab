import {test,expect,type Page} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {newGame,act} from '../src/game/hardcore/play';
import {rushPlan,RUSH_V1,type RushGrade} from '../src/game/rush';
import {exportBackup} from '../src/game/hardcore/save';
import type {HardcoreGame} from '../src/game/hardcore/model';
import {touch,navigateGame,finishTurn} from './helpers/hardcore-navigation';

const DATE='2026-10-15';test.setTimeout(90_000);
const dialog=(page:Page)=>page.getByRole('dialog',{name:'크레 러시',exact:true});
async function saved(page:Page):Promise<HardcoreGame>{return page.evaluate(async()=>{const db=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open('gecko-lab',1);r.onsuccess=()=>resolve(r.result);});return new Promise(resolve=>{const tx=db.transaction('games','readonly'),r=tx.objectStore('games').get('active');r.onsuccess=()=>resolve(r.result.save.game);tx.oncomplete=()=>db.close();});});}
async function restore(page:Page,g:HardcoreGame,mobile:boolean){
  await touch(page.getByRole('button',{name:'저장 및 게임 설정',exact:true}),mobile);await page.getByLabel('JSON 백업 파일',{exact:true}).setInputFiles({name:'rush.json',mimeType:'application/json',buffer:Buffer.from(exportBackup(g))});await touch(page.getByRole('button',{name:'복원 실행',exact:true}),mobile);await expect(page.getByRole('dialog')).toHaveCount(0);
}
async function boot(page:Page,mobile:boolean){await page.clock.setFixedTime(new Date(DATE+'T03:00:00Z'));await page.goto('/');await expect(page.getByRole('heading',{name:/^보유 개체/})).toBeVisible();const g=newGame('rush-browser-review',DATE,{initialMoney:20000});await restore(page,g,mobile);return g;}
async function open(page:Page,mobile:boolean){await touch(page.getByRole('button',{name:'크레 러시 아르바이트',exact:true}),mobile);await expect(dialog(page)).toBeVisible();}
async function close(page:Page,mobile:boolean){await touch(dialog(page).getByRole('button',{name:'닫기',exact:true}),mobile);await expect(dialog(page)).toHaveCount(0);}
async function start(page:Page,mobile:boolean){await open(page,mobile);await expect(dialog(page).getByRole('button',{name:'알바 시작',exact:true})).toBeEnabled();await touch(dialog(page).getByRole('button',{name:'알바 시작',exact:true}),mobile);await expect(page.getByTestId('rush-stage')).toBeVisible();await expect(page.getByRole('button',{name:'알바 계속하기',exact:true})).toHaveCount(0);}
async function hit(page:Page,id:number,p:number,mobile:boolean){
  const target=page.getByTestId('rush-target-'+id);await expect(target).toBeVisible({timeout:26_000});
  await expect.poll(async()=>Number(await target.getAttribute('data-progress')),{intervals:[10],timeout:5000}).toBeGreaterThanOrEqual(p);
  const r=(await target.boundingBox())!;if(mobile)await page.touchscreen.tap(r.x+r.width/2,r.y+r.height/2);else await page.mouse.click(r.x+r.width/2,r.y+r.height/2);
  await expect(target).toHaveCount(0);
}
function completed(grades:RushGrade[]=Array(10).fill('perfect')){
  let g=newGame('rush-browser-review',DATE,{initialMoney:20000});g=act(g,{type:'startRush'},DATE);
  const taps=rushPlan(g.seed,0).map((t,id)=>({id,atMs:Math.round(t.spawnMs+t.flightMs*(grades[id]==='perfect'?.81:grades[id]==='good'?.56:.1))})).sort((a,b)=>a.atMs-b.atMs);
  for(const tap of taps)g=act(g,{type:'stepRush',elapsedMs:tap.atMs,taps:[tap]},DATE);return act(g,{type:'stepRush',elapsedMs:25000},DATE);
}

test('one shared money plus opens the portrait intro from all four tabs with crisp original frontal art and unchanged state',async({page},info)=>{
  const mobile=info.project.name.startsWith('mobile'),g=await boot(page,mobile),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await mkdir('docs/cre-rush',{recursive:true});
  for(const name of ['컬렉션','인큐베이터','혈통도','상점']){await navigateGame(page,name,mobile);await open(page,mobile);await expect(dialog(page)).toContainText('파충류 카페 알바');await expect(dialog(page).getByRole('button',{name:'알바 시작',exact:true})).toBeEnabled();await close(page,mobile);}
  await open(page,mobile);
  for(const [width,height] of mobile?[[360,800],[390,844],[430,932],[360,640]]:[[1280,900]]){
    await page.setViewportSize({width,height});const d=dialog(page),r=(await d.boundingBox())!;expect(r.y+r.height).toBeLessThanOrEqual(height);expect(await d.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    expect((await d.getByRole('button',{name:'알바 시작',exact:true}).boundingBox())!.height).toBeGreaterThanOrEqual(44);
    const sprite=d.locator('canvas');expect(await sprite.evaluate(el=>{const c=el as HTMLCanvasElement,ctx=c.getContext('2d')!,pixels=ctx.getImageData(0,0,96,96).data;return c.width===96&&c.height===96&&!ctx.imageSmoothingEnabled&&pixels.some((v,i)=>i%4===3&&v===255)&&pixels.some((v,i)=>i%4===3&&v===0);})).toBe(true);
    if(mobile&&height>700)await page.screenshot({path:`docs/cre-rush/intro-${width}.png`,scale:'css'});
  }
  await close(page,mobile);expect(await saved(page)).toEqual(g);expect(errors).toEqual([]);
});
test('real 25-second ten-target touch play catches independent waves, earns exactly 3,000 once and unlocks next turn',async({page},info)=>{
  const mobile=info.project.name.startsWith('mobile'),g=await boot(page,mobile),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));if(mobile)await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>{(window as any).__rushTouches=[];document.addEventListener('pointerdown',e=>{const target=(e.target as Element).closest('.rush-target');if(target)(window as any).__rushTouches.push({id:target.getAttribute('data-testid'),progress:target.getAttribute('data-progress'),elapsed:document.querySelector('[data-testid=rush-stage]')?.getAttribute('data-elapsed')});},true);});
  await start(page,mobile);const before=Date.now();
  for(let id=0;id<10;id++){
    if(id===7){await expect(page.getByTestId('rush-target-9')).toBeVisible({timeout:25_000});await expect(page.locator('.rush-target')).toHaveCount(3);}
    await hit(page,id,.77,mobile);
    // Capture after this hit commits; a screenshot must not delay the very tap it verifies.
    if(id===7&&mobile)await page.screenshot({path:'docs/cre-rush/catch-390.png',scale:'css'});
    if(id===3){const other=page.getByTestId('rush-target-4'),p=Number(await other.getAttribute('data-progress'));await expect.poll(async()=>Number(await other.getAttribute('data-progress')),{intervals:[10]}).toBeGreaterThan(p);}
  }
  await expect(page.getByTestId('rush-perfect')).toBeVisible({timeout:6000});await writeFile(info.outputPath('touch-timing.json'),JSON.stringify({touches:await page.evaluate(()=>(window as any).__rushTouches),shift:(await saved(page)).cafeRush},null,2));
  await expect(page.getByTestId('rush-perfect')).toHaveText('10마리');await expect(page.getByTestId('rush-good')).toHaveText('0마리');await expect(page.getByTestId('rush-miss')).toHaveText('0마리');await expect(page.getByTestId('rush-pay')).toHaveText('₩3,000');expect(Date.now()-before).toBeGreaterThan(24_000);expect(Date.now()-before).toBeLessThan(31_000);
  const completed=await saved(page);expect(completed.money).toBe(g.money);expect(completed.turn).toBe(g.turn);if(mobile){await page.screenshot({path:'docs/cre-rush/result-390.png',scale:'css'});await writeFile('docs/cre-rush/review-save.json',exportBackup(completed));}
  await dialog(page).getByRole('button',{name:'급여 받기',exact:true}).evaluate(el=>{(el as HTMLButtonElement).click();(el as HTMLButtonElement).click();});await expect(dialog(page)).toContainText('급여 수령 완료');await expect(dialog(page).getByRole('alert')).toHaveCount(0);expect((await saved(page)).money).toBe(g.money+3000);
  await close(page,mobile);await open(page,mobile);await expect(dialog(page)).toContainText('이번 턴 아르바이트 완료');await expect(dialog(page).getByRole('button',{name:'알바 시작',exact:true})).toHaveCount(0);await close(page,mobile);await finishTurn(page,mobile);await open(page,mobile);await expect(dialog(page).getByRole('button',{name:'알바 시작',exact:true})).toBeEnabled();expect(errors).toEqual([]);
});
test('early direct touch misses, blank background catches nothing, GOOD works, and close/reload/background pause preserve progress',async({page},info)=>{
  const mobile=info.project.name.startsWith('mobile');await boot(page,mobile);await start(page,mobile);await hit(page,0,.05,mobile);await expect.poll(async()=>(await saved(page)).cafeRush?.shift.results[0]?.grade).toBe('miss');
  await expect(page.getByTestId('rush-target-1')).toBeVisible({timeout:6000});const area=(await page.getByTestId('rush-stage').boundingBox())!;if(mobile)await page.touchscreen.tap(area.x+6,area.y+area.height-8);else await page.mouse.click(area.x+6,area.y+area.height-8);expect((await saved(page)).cafeRush!.shift.results[1]).toBeNull();await hit(page,1,.55,mobile);await expect(page.getByTestId('rush-wage')).toHaveText('₩200');
  await close(page,mobile);const paused=await saved(page);await page.reload();await expect(page.getByRole('heading',{name:/^보유 개체/})).toBeVisible();expect(await saved(page)).toEqual(paused);await open(page,mobile);await expect(page.getByRole('button',{name:'알바 계속하기',exact:true})).toBeVisible();expect(Number(await page.getByTestId('rush-stage').getAttribute('data-elapsed'))).toBe(paused.cafeRush!.shift.elapsedMs);
  await touch(page.getByRole('button',{name:'알바 계속하기',exact:true}),mobile);
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});await expect(page.getByRole('button',{name:'알바 계속하기',exact:true})).toBeVisible();const at=await page.getByTestId('rush-stage').getAttribute('data-elapsed');await page.waitForTimeout(350);expect(await page.getByTestId('rush-stage').getAttribute('data-elapsed')).toBe(at);
  await page.evaluate(()=>{delete (document as unknown as {hidden?:boolean}).hidden;document.dispatchEvent(new Event('visibilitychange'));});await touch(page.getByRole('button',{name:'알바 계속하기',exact:true}),mobile);await expect(page.getByTestId('rush-good')).toHaveText('1마리',{timeout:25_000});await expect(page.getByTestId('rush-miss')).toHaveText('9마리');await expect(page.getByTestId('rush-pay')).toHaveText('₩200');
});
test('unclaimed wages survive offline reload/backup; claimed and older same-game backups cannot reset receipts or repay',async({page,context},info)=>{
  const mobile=info.project.name.startsWith('mobile'),original=await boot(page,mobile),pending=completed();await restore(page,pending,mobile);await page.waitForFunction(()=>!!navigator.serviceWorker.controller);await context.setOffline(true);await page.reload();await expect(page.getByRole('heading',{name:/^보유 개체/})).toBeVisible();await open(page,mobile);await expect(page.getByTestId('rush-pay')).toHaveText('₩3,000');await touch(dialog(page).getByRole('button',{name:'급여 받기',exact:true}),mobile);await expect(dialog(page)).toContainText('급여 수령 완료');const paid=await saved(page);expect(paid.money).toBe(23000);await close(page,mobile);
  for(const backup of [paid,pending,original]){await restore(page,backup,mobile);await open(page,mobile);await expect(dialog(page)).toContainText('이번 턴 아르바이트 완료');await expect(dialog(page).getByRole('button',{name:'급여 받기',exact:true})).toHaveCount(0);await expect(dialog(page).getByRole('button',{name:'알바 시작',exact:true})).toHaveCount(0);expect((await saved(page)).money).toBe(backup.money);await close(page,mobile);}
  await context.setOffline(false);
});
test('simultaneous tabs cannot claim the same shift twice and the losing tab recovers the paid record',async({page,context},info)=>{
  const mobile=info.project.name.startsWith('mobile');await boot(page,mobile);await restore(page,completed(),mobile);await open(page,mobile);const other=await context.newPage();await other.clock.setFixedTime(new Date(DATE+'T03:00:00Z'));await other.goto('/');await expect(other.getByRole('heading',{name:/^보유 개체/})).toBeVisible();await open(other,mobile);
  await Promise.all([dialog(page).getByRole('button',{name:'급여 받기',exact:true}).evaluate(el=>(el as HTMLButtonElement).click()),dialog(other).getByRole('button',{name:'급여 받기',exact:true}).evaluate(el=>(el as HTMLButtonElement).click())]);await expect.poll(async()=>(await saved(page)).money).toBe(23000);await other.reload();await expect(other.getByRole('heading',{name:/^보유 개체/})).toBeVisible();await open(other,mobile);await expect(dialog(other)).toContainText('급여 수령 완료');expect((await saved(other)).money).toBe(23000);await other.close();
});
test('a failed active-save write rolls back the wage and durable receipt together, then retry pays once',async({page},info)=>{
  const mobile=info.project.name.startsWith('mobile');await boot(page,mobile);await restore(page,completed(),mobile);await open(page,mobile);
  await page.evaluate(()=>{const original=IDBObjectStore.prototype.put;(window as any).__rushOriginalPut=original;IDBObjectStore.prototype.put=function(value:any,key?:IDBValidKey){if(key==='active')throw new DOMException('Review storage failure','QuotaExceededError');return original.call(this,value,key);};});
  await touch(dialog(page).getByRole('button',{name:'급여 받기',exact:true}),mobile);await expect(dialog(page).getByRole('alert')).toContainText('급여를 저장하지 못했습니다');const failed=await saved(page);expect(failed.money).toBe(20000);expect(failed.cafeRush!.shift.paid).toBe(false);
  expect(await page.evaluate(async()=>{const db=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open('gecko-lab',1);r.onsuccess=()=>resolve(r.result);});return new Promise<boolean>(resolve=>{const tx=db.transaction('games'),r=tx.objectStore('games').openCursor();let paid=false;r.onsuccess=()=>{const c=r.result;if(!c)return;if(String(c.key).startsWith('rush-v1:'))paid=c.value.state.shift.paid;c.continue();};tx.oncomplete=()=>{db.close();resolve(paid);};});})).toBe(false);
  await page.evaluate(()=>{IDBObjectStore.prototype.put=(window as any).__rushOriginalPut;delete (window as any).__rushOriginalPut;});await touch(dialog(page).getByRole('button',{name:'급여 받기',exact:true}),mobile);await expect(dialog(page)).toContainText('급여 수령 완료');expect((await saved(page)).money).toBe(23000);
});
test('a corrupt durable receipt is reported and cannot silently reset an already started shift',async({page},info)=>{
  const mobile=info.project.name.startsWith('mobile');await boot(page,mobile);await restore(page,completed(),mobile);const before=await saved(page);
  await page.evaluate(async({gameId,seed})=>{const db=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open('gecko-lab',1);r.onsuccess=()=>resolve(r.result);});await new Promise<void>(resolve=>{const tx=db.transaction('games','readwrite');tx.objectStore('games').put(null,'rush-v1:'+gameId+':'+seed);tx.oncomplete=()=>{db.close();resolve();};});},{gameId:before.gameId,seed:before.seed});
  await page.reload();await expect(page.getByRole('heading',{name:'저장 데이터를 불러오지 못했습니다',exact:true})).toBeVisible();await expect(page.locator('main').getByRole('alert')).toContainText('크레 러시 수령 기록이 손상');expect(await saved(page)).toEqual(before);
});
