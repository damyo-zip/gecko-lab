import {test,expect,type Page} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {newGame,act} from '../src/game/hardcore/play';
import {actWithTime} from '../src/game/hardcore/time-source';
import {exportBackup} from '../src/game/hardcore/save';
import {breedingRisk} from '../src/game/hardcore/breeding-risk';
import {eggFailure} from '../src/game/hardcore/egg-outcome';
import {touch,navigateGame,finishTurn} from './helpers/hardcore-navigation';
import type {HardcoreGame} from '../src/game/hardcore/model';
const DATE='2026-10-15';
function fixture(){
 for(let n=0;n<100;n++){
  let game=newGame('manual-browser-'+n,DATE,{initialMoney:2_000_000,initialCapacity:4});
  const [fatherId,motherId]=Object.keys(game.shop.offers);for(const offerId of [fatherId,motherId])game=act(game,{type:'buyGecko',offerId},DATE);
  game=act(game,{type:'buyFood',amount:300},DATE);
  const risk=breedingRisk(game,game.individuals[fatherId],game.individuals[motherId]);
  game=act(game,{type:'breed',fatherId,motherId,riskAcknowledgement:risk.acknowledgement},DATE);
  for(let t=0;t<2;t++)game=actWithTime(game,{type:'endTurn'},DATE);
  const eggs=Object.values(game.eggs),success=eggs.find(e=>eggFailure(e)===null),infertile=eggs.find(e=>eggFailure(e)==='infertile');
  if(success&&infertile)return {game,motherId,successId:success.id,failedId:infertile.id};
 }throw new Error('No real mixed-outcome clutch');
}
async function saved(page:Page){return page.evaluate(async()=>{
 const db=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open('gecko-lab',1);r.onsuccess=()=>resolve(r.result);});
 return new Promise<HardcoreGame>(resolve=>{const tx=db.transaction('games'),r=tx.objectStore('games').get('active');r.onsuccess=()=>resolve(r.result.save.game);tx.oncomplete=()=>db.close();});
});}
async function boot(page:Page,game:HardcoreGame,mobile:boolean){
 await page.clock.setFixedTime(new Date(DATE+'T03:00:00Z'));await page.goto('/');
 await touch(page.getByRole('button',{name:'저장 및 게임 설정',exact:true}),mobile);
 await page.getByLabel('JSON 백업 파일',{exact:true}).setInputFiles({name:'manual.json',mimeType:'application/json',buffer:Buffer.from(exportBackup(game))});
 await touch(page.getByRole('button',{name:'복원 실행',exact:true}),mobile);await expect(page.getByRole('dialog')).toHaveCount(0);
}
test('manual pair collection, newborn pickup and infertile removal persist with exactly one growth scale',async({page},info)=>{
 test.setTimeout(120_000);const mobile=info.project.name.startsWith('mobile'),f=fixture(),errors:string[]=[];
 page.on('pageerror',e=>errors.push(e.message));if(mobile)await page.setViewportSize({width:390,height:844});
 await boot(page,f.game,mobile);const pair=page.getByTestId('collect-eggs-'+f.motherId);
 await expect(pair).toBeVisible();await expect(pair.locator('canvas')).toHaveCount(2);
 await touch(page.getByTestId('hc-card-'+f.motherId).locator('.home-card-select'),mobile);
 await expect(page.getByTestId('hero-collect-eggs-'+f.motherId)).toBeVisible();
 if(mobile){await mkdir('docs/manual-brood-care',{recursive:true});await page.screenshot({path:'docs/manual-brood-care/collection-eggs-390.png',scale:'css'});}
 await finishTurn(page,mobile);await page.reload();await expect(page.getByTestId('game-day')).toHaveText('3');
 await expect(pair).toBeVisible();expect(Object.values((await saved(page)).eggs).every(e=>e.care?.collectedTurn===null)).toBe(true);
 await touch(pair,mobile);await expect(pair).toHaveCount(0);await expect(page.getByTestId('hero-collect-eggs-'+f.motherId)).toHaveCount(0);
 let g=await saved(page);expect(Object.values(g.eggs).every(e=>e.care?.collectedTurn===3&&e.lifecycle?.dueTurn===7)).toBe(true);
 await expect(page.getByRole('dialog')).toHaveCount(0);await navigateGame(page,'인큐베이터',mobile);
 await expect(page.getByTestId('incubator-remaining')).toHaveText('28일 (4턴)');await expect(page.getByTestId('incubator-free')).toHaveText('0');
 for(let n=0;n<4;n++)await finishTurn(page,mobile);
 await navigateGame(page,'인큐베이터',mobile);const baby=page.getByTestId('receive-hatchling-'+f.successId),failed=page.getByTestId('remove-egg-'+f.failedId);
 await expect(baby).toBeVisible();await expect(failed).toBeVisible();g=await saved(page);const childId=g.eggs[f.successId].embryo.id;
 expect(g.individuals[childId]).toBeUndefined();await expect(page.getByTestId('incubator-free')).toHaveText('0');
 const art=page.getByTestId('select-egg-'+f.successId);const sprite=art.locator('canvas[data-growth-stage]');await expect(sprite).toHaveAttribute('data-growth-stage','hatchling');
 const geometry=await sprite.evaluate(el=>{const c=el as HTMLCanvasElement,b=c.getBoundingClientRect(),old=c.style.getPropertyValue('--growth-scale');c.style.setProperty('--growth-scale','1');const full=c.getBoundingClientRect();c.style.setProperty('--growth-scale',old);return {ratio:b.width/full.width,aspect:b.width/b.height,centerDelta:Math.abs(b.x+b.width/2-full.x-full.width/2),smoothing:c.getContext('2d')!.imageSmoothingEnabled};});
 expect(geometry.ratio).toBeCloseTo(.5,5);expect(geometry.aspect).toBeCloseTo(1,5);expect(geometry.centerDelta).toBeLessThan(.1);expect(geometry.smoothing).toBe(false);
 await expect(art.getByRole('img',{name:'깨진 알껍데기',exact:true})).toBeVisible();await expect(page.getByTestId('select-egg-'+f.failedId).getByRole('img',{name:'변색된 실패 알',exact:true})).toBeVisible();
 await touch(art,mobile);await expect(art).toHaveAttribute('aria-pressed','true');expect(await saved(page)).toEqual(g);await touch(page.getByTestId('select-egg-'+f.failedId),mobile);await expect(failed).toBeVisible();expect(await saved(page)).toEqual(g);
 for(const [width,height] of [[360,640],[360,800],[390,844],[430,844]]){
  await page.setViewportSize({width,height});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(await page.locator('.reference-content').evaluate(el=>el.scrollHeight<=el.clientHeight+1)).toBe(true);
  for(const button of [art,baby,page.getByTestId('select-egg-'+f.failedId),failed]){
   const box=(await button.boundingBox())!,card=(await button.locator('..').boundingBox())!;
   expect(box.height).toBeGreaterThanOrEqual(44);expect(box.y+box.height).toBeLessThanOrEqual(card.y+card.height-2);
  }
 }
 if(mobile)await page.screenshot({path:'docs/manual-brood-care/incubator-newborn-430.png',scale:'css'});
 await finishTurn(page,mobile);await page.reload();await expect(page.getByTestId('game-day')).toHaveText('8');await navigateGame(page,'인큐베이터',mobile);await expect(baby).toBeVisible();await expect(failed).toBeVisible();
 await touch(baby,mobile);await expect(baby).toHaveCount(0);g=await saved(page);expect(g.individuals[childId]).toMatchObject({birthTurn:7,stage:'hatchling',visualSeed:g.eggs[f.successId].embryo.visualSeed});
 await expect(page.getByTestId('incubator-free')).toHaveText('0'); // reserved space becomes owned space.
 await touch(failed,mobile);await expect(failed).toHaveCount(0);await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.getByTestId('incubator-free')).toHaveText('1');
 g=await saved(page);await page.reload();await expect(page.getByTestId('game-day')).toHaveText('8');expect(await saved(page)).toEqual(g);
 await expect(page.getByTestId('hc-card-'+childId)).toBeVisible();expect(errors).toEqual([]);
});

test('old v9 care state remains untouched and requests a new game',async({page},info)=>{
 test.setTimeout(90_000);const mobile=info.project.name.startsWith('mobile'),f=fixture(),old=structuredClone(f.game);
 old.saveVersion=9;for(const egg of Object.values(old.eggs))delete egg.care;
 const {makeSave}=await import('../src/game/hardcore/save'),record={save:makeSave(old),writeRevision:17};
 await page.clock.setFixedTime(new Date(DATE+'T03:00:00Z'));await page.goto('/');await expect(page.getByTestId('game-day')).toHaveText('0');
 await page.evaluate(async record=>{
  const db=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open('gecko-lab',1);r.onsuccess=()=>resolve(r.result);});
  await new Promise<void>(resolve=>{const tx=db.transaction('games','readwrite');tx.objectStore('games').put(record,'active');tx.oncomplete=()=>{db.close();resolve();};});
 },record);
 await page.reload();await expect(page.getByRole('alert').filter({hasText:'새 외형 엔진이 적용'})).toBeVisible();
 expect(await saved(page)).toEqual(old);
 await expect(page.getByRole('button',{name:'백업 복원 또는 새 게임',exact:true})).toBeVisible();
});
