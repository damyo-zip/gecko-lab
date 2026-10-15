import {test,expect,type Page} from '@playwright/test';
import {startRush} from '../src/game/rush';
import {exportBackup} from '../src/game/hardcore/save';
import type {HardcoreGame} from '../src/game/hardcore/model';
import {rushPerformanceGame} from './fixtures/rush-performance';
import {touch} from './helpers/hardcore-navigation';
import {mkdir,writeFile} from 'node:fs/promises';

test.setTimeout(90_000);
const dialog=(p:Page)=>p.getByRole('dialog',{name:'크레 러시',exact:true});
async function record(p:Page){return p.evaluate(async()=>{
  const db=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open('gecko-lab',1);r.onsuccess=()=>resolve(r.result);});
  return new Promise<{save:{game:HardcoreGame;checksum:string};writeRevision:number}>(resolve=>{
    const tx=db.transaction('games'),r=tx.objectStore('games').get('active');r.onsuccess=()=>resolve(r.result);tx.oncomplete=()=>db.close();
  });
});}
async function put(p:Page,value:Awaited<ReturnType<typeof record>>){await p.evaluate(async value=>{
  const db=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open('gecko-lab',1);r.onsuccess=()=>resolve(r.result);});
  await new Promise<void>((resolve,reject)=>{const tx=db.transaction('games','readwrite');tx.objectStore('games').put(value,'active');tx.oncomplete=()=>{db.close();resolve();};tx.onabort=()=>reject(tx.error);});
},value);}
async function boot(p:Page,count:number,mobile:boolean){
  await p.clock.setFixedTime(new Date('2026-10-15T03:00:00Z'));await p.goto('/');
  const game=rushPerformanceGame(count);startRush(game,2);await touch(p.getByRole('button',{name:'저장 및 게임 설정',exact:true}),mobile);
  await p.getByLabel('JSON 백업 파일',{exact:true}).setInputFiles({name:'load.json',mimeType:'application/json',buffer:Buffer.from(exportBackup(game))});
  await touch(p.getByRole('button',{name:'복원 실행',exact:true}),mobile);await expect(p.getByRole('dialog')).toHaveCount(0);return game;
}
async function open(p:Page,mobile:boolean){await touch(p.getByRole('button',{name:'크레 러시 아르바이트',exact:true}),mobile);await expect(dialog(p)).toBeVisible();}
async function start(p:Page,mobile:boolean){await open(p,mobile);await touch(dialog(p).getByRole('button',{name:'알바 계속하기',exact:true}),mobile);await expect(p.getByTestId('rush-stage')).toBeVisible();}
async function hit(p:Page,id:number,mobile:boolean){
  const target=p.getByTestId('rush-target-'+id);await target.waitFor();
  await expect.poll(async()=>Number(await target.getAttribute('data-progress')),{intervals:[10]}).toBeGreaterThanOrEqual(.78);
  const box=(await target.boundingBox())!;if(mobile)await p.touchscreen.tap(box.x+box.width/2,box.y+box.height/2);else await p.mouse.click(box.x+box.width/2,box.y+box.height/2);
  // Continue touching other targets while this one's durable write is pending.
  // Waiting for its disappearance serializes taps behind IndexedDB latency.
  // The final persisted results below verify every individual acknowledgment.
}

test('legacy v2: 300 actual genomes: worker checkpoints never clone/paint the background; close and offline resume preserve records',async({page,context},info)=>{
  await page.addInitScript(()=>{(window as any).__rushInputs=[];document.addEventListener('pointerdown',e=>{
    const target=(e.target as Element).closest('.rush-target');if(target)(window as any).__rushInputs.push({id:Number(target.getAttribute('data-testid')!.split('-').at(-1)),atMs:Number(document.querySelector('[data-testid=rush-stage]')?.getAttribute('data-elapsed'))});
  },true);});
  const mobile=info.project.name.startsWith('mobile'),game=await boot(page,300,mobile),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await start(page,mobile);expect(page.workers().some(w=>w.url().includes('/_next/static/'))).toBe(true);
  await page.evaluate(()=>{
    (window as any).__rushLoad={clones:0,paints:0,mutations:0};
    const clone=window.structuredClone;Object.defineProperty(window,'structuredClone',{configurable:true,value:(...args:unknown[])=>{(window as any).__rushLoad.clones++;return Reflect.apply(clone,window,args);}});
    const draw=CanvasRenderingContext2D.prototype.drawImage;Object.defineProperty(CanvasRenderingContext2D.prototype,'drawImage',{configurable:true,value:function(this:CanvasRenderingContext2D,...args:unknown[]){if(this.canvas.closest('.home-collection'))(window as any).__rushLoad.paints++;return Reflect.apply(draw,this,args);}});
    new MutationObserver(records=>(window as any).__rushLoad.mutations+=records.length).observe(document.querySelector('.home-collection')!,{subtree:true,attributes:true,characterData:true,childList:true});
  });
  await hit(page,0,mobile);await expect(page.getByTestId('rush-wage')).toHaveText('₩300');
  expect(await page.evaluate(()=>(window as any).__rushLoad)).toEqual({clones:0,paints:0,mutations:0});
  await touch(dialog(page).getByRole('button',{name:'닫기',exact:true}),mobile);await expect(dialog(page)).toHaveCount(0);
  const paused=(await record(page)).save.game;
  const firstInputs=await page.evaluate(()=>(window as any).__rushInputs) as {id:number;atMs:number}[];
  expect(paused.individuals).toEqual(game.individuals);expect(paused.shop).toEqual(game.shop);expect(paused.money).toBe(game.money);expect(paused.turn).toBe(0);
  await page.waitForFunction(()=>!!navigator.serviceWorker.controller);await context.setOffline(true);await page.reload();
  await expect(page.getByRole('heading',{name:/^보유 개체/})).toBeVisible();await open(page,mobile);
  expect(page.workers().length).toBeGreaterThan(0);await touch(dialog(page).getByRole('button',{name:'알바 계속하기',exact:true}),mobile);
  await hit(page,1,mobile);await expect(page.getByTestId('rush-wage')).toHaveText('₩600');
  for(let id=2;id<10;id++){
    if(id===7){await page.getByTestId('rush-target-9').waitFor({timeout:25000});await expect(page.locator('.rush-target')).toHaveCount(3);}
    await hit(page,id,mobile);
  }
  await expect(page.getByTestId('rush-pay')).toBeVisible();
  const complete=(await record(page)).save.game;
  const inputs=[...firstInputs,...await page.evaluate(()=>(window as any).__rushInputs) as {id:number;atMs:number}[]];
  await writeFile(info.outputPath('touch-timing.json'),JSON.stringify({inputs,shift:complete.cafeRush},null,2));
  await expect(page.getByTestId('rush-pay')).toHaveText('₩3,000');
  expect(inputs).toHaveLength(10);for(const input of inputs)expect(complete.cafeRush!.shift.results[input.id]).toMatchObject({grade:'perfect',atMs:input.atMs});
  if(mobile){await mkdir('docs/rush-performance',{recursive:true});await page.screenshot({path:'docs/rush-performance/result-300-mobile.png',scale:'css'});}
  await dialog(page).getByRole('button',{name:'급여 받기',exact:true}).evaluate(el=>{(el as HTMLButtonElement).click();(el as HTMLButtonElement).click();});
  await expect(dialog(page)).toContainText('급여 수령 완료');
  await touch(dialog(page).getByRole('button',{name:'닫기',exact:true}),mobile);await expect(dialog(page)).toHaveCount(0);
  const resumed=(await record(page)).save.game;expect(resumed.individuals).toEqual(game.individuals);expect(resumed.cafeRush!.shift.results[0]).toEqual(paused.cafeRush!.shift.results[0]);expect(resumed.money).toBe(game.money+3000);
  await context.setOffline(false);expect(errors).toEqual([]);
});

test('worker save failures retain the ledger, retry safely and honor another tab revision',async({page},info)=>{
  const mobile=info.project.name.startsWith('mobile');await boot(page,6,mobile);await start(page,mobile);
  const good=await record(page),bad=structuredClone(good);bad.save.checksum='corrupt';await put(page,bad);
  await expect(dialog(page).getByRole('alert')).toContainText('자동 저장을 완료하지 못했습니다');
  expect(await record(page)).toEqual(bad);
  const ledger=()=>page.evaluate(async()=>{
    const db=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open('gecko-lab',1);r.onsuccess=()=>resolve(r.result);});
    return new Promise<number>(resolve=>{const tx=db.transaction('games'),r=tx.objectStore('games').openCursor();let elapsed=-1;r.onsuccess=()=>{const c=r.result;if(!c)return;if(String(c.key).startsWith('rush-v1:'))elapsed=c.value.state.shift.elapsedMs;c.continue();};tx.oncomplete=()=>{db.close();resolve(elapsed);};});
  });
  expect(await ledger()).toBe(0);await put(page,good);await touch(dialog(page).getByRole('button',{name:'저장 재시도',exact:true}),mobile);
  await expect(dialog(page).getByRole('alert')).toHaveCount(0);expect(await ledger()).toBeGreaterThan(0);
  const committed=await record(page);await put(page,{...committed,writeRevision:committed.writeRevision+1});
  await touch(dialog(page).getByRole('button',{name:'알바 계속하기',exact:true}),mobile);
  await expect(dialog(page).getByRole('alert')).toContainText('다른 창');
  const conflict=await record(page);expect(conflict.save).toEqual(committed.save);expect(await ledger()).toBe(committed.save.game.cafeRush!.shift.elapsedMs);
});

test('a blocked worker uses the original durable path without losing judgments',async({page},info)=>{
  const mobile=info.project.name.startsWith('mobile');await page.addInitScript(()=>{Object.defineProperty(window,'Worker',{configurable:true,value:class{constructor(){throw new Error('worker blocked');}}});});
  await boot(page,6,mobile);await start(page,mobile);await hit(page,0,mobile);await expect(page.getByTestId('rush-wage')).toHaveText('₩300');
  await touch(dialog(page).getByRole('button',{name:'닫기',exact:true}),mobile);await expect(dialog(page)).toHaveCount(0);
  expect((await record(page)).save.game.cafeRush!.shift.results[0]?.grade).toBe('perfect');
});
