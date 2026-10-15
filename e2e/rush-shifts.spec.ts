import {test,expect,type Page} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {exportBackup} from '../src/game/hardcore/save';
import type {HardcoreGame} from '../src/game/hardcore/model';
import {startRush,stepRush,rushPlan,rushFinishAt} from '../src/game/rush';
import {rushShiftGame} from './fixtures/rush-shifts';
import {touch,finishTurn} from './helpers/hardcore-navigation';

test.setTimeout(120_000);
const dialog=(p:Page)=>p.getByRole('dialog',{name:'크레 러시',exact:true});
async function saved(p:Page){return p.evaluate(async()=>{
  const db=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open('gecko-lab',1);r.onsuccess=()=>resolve(r.result);});
  return new Promise<HardcoreGame>(resolve=>{const tx=db.transaction('games'),r=tx.objectStore('games').get('active');r.onsuccess=()=>resolve(r.result.save.game);tx.oncomplete=()=>db.close();});
});}
async function restore(p:Page,game:HardcoreGame,mobile:boolean){
  await touch(p.getByRole('button',{name:'저장 및 게임 설정',exact:true}),mobile);
  await p.getByLabel('JSON 백업 파일',{exact:true}).setInputFiles({name:'shift.json',mimeType:'application/json',buffer:Buffer.from(exportBackup(game))});
  await touch(p.getByRole('button',{name:'복원 실행',exact:true}),mobile);await expect(p.getByRole('dialog')).toHaveCount(0);
}
async function boot(p:Page,game:HardcoreGame,mobile:boolean){await p.clock.setFixedTime(new Date('2026-10-15T03:00:00Z'));await p.goto('/');await restore(p,game,mobile);}
async function open(p:Page,mobile:boolean){await touch(p.getByRole('button',{name:'크레 러시 아르바이트',exact:true}),mobile);await expect(dialog(p)).toBeVisible();}
async function start(p:Page,mobile:boolean){await open(p,mobile);await touch(dialog(p).getByRole('button',{name:'알바 시작',exact:true}),mobile);await expect(p.getByTestId('rush-stage')).toBeVisible();}
async function close(p:Page,mobile:boolean){await touch(dialog(p).getByRole('button',{name:'닫기',exact:true}),mobile);await expect(dialog(p)).toHaveCount(0);}
async function hit(p:Page,id:number,mobile:boolean){
  const target=p.getByTestId('rush-target-'+id);await target.waitFor();
  await expect.poll(async()=>Number(await target.getAttribute('data-progress')),{intervals:[10]}).toBeGreaterThanOrEqual(.78);
  const box=(await target.boundingBox())!;if(mobile)await p.touchscreen.tap(box.x+box.width/2,box.y+box.height/2);else await p.mouse.click(box.x+box.width/2,box.y+box.height/2);
  // Do not serialize independent targets behind save acknowledgments.
}
async function noSpoilers(p:Page){
  await expect(dialog(p)).not.toContainText(/\d+\s*\/\s*\d+|남은.*(?:마리|초)|업무량|총 처리|총 웨이브|6~20|마리 판정 기록/);
  await expect(p.getByTestId('rush-assignment')).toHaveCount(0);
  await expect(dialog(p).locator('[role=progressbar],progress,.rush-wave-track,.rush-time')).toHaveCount(0);
}

test('secret HUD has identical geometry for 6 and 20; mobile sizes and pause/reload never reveal or reroll work',async({page},info)=>{
  const mobile=info.project.name.startsWith('mobile');const geometries=[];
  for(const total of [6,20]){
    const game=rushShiftGame(total,'normal');await boot(page,game,mobile);await open(page,mobile);await noSpoilers(page);
    await expect(dialog(page)).toContainText('기본급 ₩10,320');
    await touch(dialog(page).getByRole('button',{name:'알바 시작',exact:true}),mobile);
    await expect(page.getByTestId('rush-stage')).toBeVisible();await noSpoilers(page);
    geometries.push(await page.locator('.rush-hud').boundingBox());
    await close(page,mobile);const before=(await saved(page)).cafeRush;
    expect(before!.shift.assignment!.total).toBe(total);
    await page.reload();await open(page,mobile);await noSpoilers(page);
    expect((await saved(page)).cafeRush).toEqual(before);
    if(mobile)for(const [width,height] of [[360,800],[390,844],[430,932],[360,640]]){
      await page.setViewportSize({width,height});
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      const stage=await page.getByTestId('rush-stage').boundingBox(),footer=await page.locator('.rush-footer').boundingBox();
      expect(stage!.height).toBeGreaterThan(170);expect(stage!.y+stage!.height).toBeLessThanOrEqual(footer!.y);
    }
    if(mobile)await page.setViewportSize({width:360,height:800});await close(page,mobile);
  }
  expect(geometries[0]).toEqual(geometries[1]);
});

test('six real PERFECT touches reveal departure only afterward, render the salary receipt and pay once',async({page},info)=>{
  const mobile=info.project.name.startsWith('mobile'),game=rushShiftGame(6,'normal');await boot(page,game,mobile);
  await open(page,mobile);if(mobile){await mkdir('docs/rush-secret-shifts',{recursive:true});await page.screenshot({path:'docs/rush-secret-shifts/intro-mobile.png',scale:'css'});}
  await touch(dialog(page).getByRole('button',{name:'알바 시작',exact:true}),mobile);
  for(let id=0;id<6;id++){await noSpoilers(page);await expect(page.locator('.rush-departure')).toHaveCount(0);await hit(page,id,mobile);}
  await expect(page.locator('.rush-departure')).toBeVisible();await expect(page.getByTestId('rush-pay')).toHaveText('₩16,320');
  await expect(page.getByTestId('rush-total')).toHaveText('6마리');await expect(page.getByTestId('rush-assignment')).toContainText('한가한 매장');
  await expect(page.getByTestId('rush-assignment')).toContainText('평범한 근무');
  await expect(page.locator('.rush-pay-breakdown')).toContainText('PERFECT × 6');await expect(page.locator('.rush-pay-breakdown')).toContainText('+₩6,000');
  const claimBox=await dialog(page).getByRole('button',{name:'급여 받기',exact:true}).boundingBox(),footerBox=await page.locator('.rush-footer').boundingBox();
  expect(claimBox!.y+claimBox!.height).toBeLessThanOrEqual(footerBox!.y);
  if(mobile)await page.screenshot({path:'docs/rush-secret-shifts/result-six-mobile.png',scale:'css'});
  await dialog(page).getByRole('button',{name:'급여 받기',exact:true}).evaluate(el=>{(el as HTMLButtonElement).click();(el as HTMLButtonElement).click();});
  await expect(dialog(page)).toContainText('급여 수령 완료');await close(page,mobile);expect((await saved(page)).money).toBe(game.money+16320);
  await open(page,mobile);await expect(dialog(page).getByRole('button',{name:'알바 시작',exact:true})).toHaveCount(0);await close(page,mobile);
  await finishTurn(page,mobile);await open(page,mobile);await expect(dialog(page).getByRole('button',{name:'알바 시작',exact:true})).toBeVisible();
});

test('20 targets with 300 owned records stay independent, resume offline, preserve frame timestamps and pay once',async({page,context},info)=>{
  const mobile=info.project.name.startsWith('mobile'),game=rushShiftGame(20,'normal',300),errors:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{(window as any).__rushInputs=[];document.addEventListener('pointerdown',e=>{
    const t=(e.target as Element).closest('.rush-target');if(t)(window as any).__rushInputs.push({id:Number(t.getAttribute('data-testid')!.split('-').at(-1)),atMs:Number(document.querySelector('[data-testid=rush-stage]')?.getAttribute('data-elapsed'))});
  },true);});
  await boot(page,game,mobile);await start(page,mobile);expect(page.workers().length).toBeGreaterThan(0);
  await hit(page,0,mobile);await expect(page.getByTestId('rush-wage')).toHaveText('₩11,320');await close(page,mobile);
  const before=(await saved(page)).cafeRush,firstInputs=await page.evaluate(()=>(window as any).__rushInputs);
  await page.waitForFunction(()=>!!navigator.serviceWorker.controller);await context.setOffline(true);await page.reload();
  await open(page,mobile);expect((await saved(page)).cafeRush).toEqual(before);await touch(dialog(page).getByRole('button',{name:'알바 계속하기',exact:true}),mobile);
  await page.evaluate(()=>{
    (window as any).__load={clones:0,paints:0,mutations:0,maxTargets:0};const c=window.structuredClone;
    Object.defineProperty(window,'structuredClone',{configurable:true,value:(...args:unknown[])=>{(window as any).__load.clones++;return Reflect.apply(c,window,args);}});
    const draw=CanvasRenderingContext2D.prototype.drawImage;CanvasRenderingContext2D.prototype.drawImage=function(...args:any[]){if(this.canvas.closest('.home-collection'))(window as any).__load.paints++;return Reflect.apply(draw,this,args);};
    new MutationObserver(r=>(window as any).__load.mutations+=r.length).observe(document.querySelector('.home-collection')!,{subtree:true,attributes:true,characterData:true,childList:true});
    const observe=()=>{(window as any).__load.maxTargets=Math.max((window as any).__load.maxTargets,document.querySelectorAll('.rush-target').length);requestAnimationFrame(observe);};observe();
  });
  for(let id=1;id<20;id++)await hit(page,id,mobile);
  await expect(page.getByTestId('rush-pay')).toHaveText('₩30,320');await expect(page.getByTestId('rush-total')).toHaveText('20마리');
  const complete=await saved(page),inputs=[...firstInputs,...await page.evaluate(()=>(window as any).__rushInputs)];
  expect(inputs).toHaveLength(20);for(const tap of inputs)expect(complete.cafeRush!.shift.results[tap.id]).toMatchObject({grade:'perfect',atMs:tap.atMs});
  const load=await page.evaluate(()=>(window as any).__load);expect(load).toEqual({clones:0,paints:0,mutations:0,maxTargets:expect.any(Number)});expect(load.maxTargets).toBeLessThanOrEqual(3);
  const claimBox=await dialog(page).getByRole('button',{name:'급여 받기',exact:true}).boundingBox(),footerBox=await page.locator('.rush-footer').boundingBox();
  expect(claimBox!.y+claimBox!.height).toBeLessThanOrEqual(footerBox!.y);
  expect(complete.individuals).toEqual(game.individuals);expect(complete.shop).toEqual(game.shop);expect(complete.turn).toBe(game.turn);expect(complete.money).toBe(game.money);expect(complete.cafeRush!.shift.assignment).toEqual(before!.shift.assignment);
  await writeFile(info.outputPath('twenty-targets.json'),JSON.stringify({load,inputs,shift:complete.cafeRush},null,2));
  if(mobile){await mkdir('docs/rush-secret-shifts',{recursive:true});await page.screenshot({path:'docs/rush-secret-shifts/result-twenty-mobile.png',scale:'css'});}
  await touch(dialog(page).getByRole('button',{name:'급여 받기',exact:true}),mobile);await expect(dialog(page)).toContainText('급여 수령 완료');await close(page,mobile);
  expect((await saved(page)).money).toBe(game.money+30320);await context.setOffline(false);expect(errors).toEqual([]);
});

test('mixed variable salary survives older backups and zero wages still get an exactly-once receipt',async({page},info)=>{
  const mobile=info.project.name.startsWith('mobile'),game=rushShiftGame(18),before=structuredClone(game);startRush(game);
  const taps=rushPlan(game.seed,0,3,game.cafeRush!.shift.assignment).map(t=>({id:t.id,atMs:Math.round(t.spawnMs+t.flightMs*(t.id<8?.81:t.id<13?.56:.1))})).sort((a,b)=>a.atMs-b.atMs);
  for(const tap of taps)stepRush(game,tap.atMs,[tap]);
  stepRush(game,rushFinishAt(game.cafeRush!.shift));const unclaimed=structuredClone(game);
  await boot(page,game,mobile);await open(page,mobile);await expect(page.getByTestId('rush-pay')).toHaveText('₩13,320');
  await expect(page.getByTestId('rush-perfect')).toHaveText('8마리');await expect(page.getByTestId('rush-good')).toHaveText('5마리');await expect(page.getByTestId('rush-miss')).toHaveText('5마리');
  await expect(page.locator('.rush-pay-breakdown')).toContainText('−₩7,500');
  await touch(dialog(page).getByRole('button',{name:'급여 받기',exact:true}),mobile);await expect(dialog(page)).toContainText('급여 수령 완료');await close(page,mobile);
  for(const backup of [before,unclaimed]){await restore(page,backup,mobile);await open(page,mobile);await expect(dialog(page)).toContainText('급여 수령 완료');expect((await saved(page)).money).toBe(backup.money);await close(page,mobile);}
  const zero=rushShiftGame(20,'chaos');startRush(zero);stepRush(zero,zero.cafeRush!.shift.assignment!.endMs);
  await restore(page,zero,mobile);await open(page,mobile);await expect(page.getByTestId('rush-pay')).toHaveText('₩0');
  await touch(dialog(page).getByRole('button',{name:'급여 받기',exact:true}),mobile);await expect(dialog(page)).toContainText('급여 수령 완료');await close(page,mobile);
  expect((await saved(page)).money).toBe(zero.money);expect((await saved(page)).cafeRush!.shift.paid).toBe(true);
});
