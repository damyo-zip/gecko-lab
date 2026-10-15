import {test,expect,type Page} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {newGame,act} from '../src/game/hardcore/play';
import {actWithTime} from '../src/game/hardcore/time-source';
import {exportBackup} from '../src/game/hardcore/save';
import {owned} from '../src/game/hardcore/survival';
import {rushPlan} from '../src/game/rush';
import type {HardcoreGame} from '../src/game/hardcore/model';
import {touch,navigateGame,finishTurn} from './helpers/hardcore-navigation';

const DATE='2026-10-15';
const guide=(page:Page)=>page.getByRole('region',{name:'첫 게코를 기다리는 시간',exact:true});
const rush=(page:Page)=>page.getByRole('dialog',{name:'크레 러시',exact:true});
async function saved(page:Page):Promise<HardcoreGame>{return page.evaluate(async()=>{
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('gecko-lab',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  return new Promise((resolve,reject)=>{const tx=db.transaction('games'),r=tx.objectStore('games').get('active');r.onsuccess=()=>resolve(r.result.save.game);tx.oncomplete=()=>db.close();tx.onerror=()=>reject(tx.error);});
});}
async function restore(page:Page,g:HardcoreGame,mobile:boolean){
  await touch(page.getByRole('button',{name:'저장 및 게임 설정',exact:true}),mobile);
  await page.getByLabel('JSON 백업 파일',{exact:true}).setInputFiles({name:'empty-collection.json',mimeType:'application/json',buffer:Buffer.from(exportBackup(g))});
  await touch(page.getByRole('button',{name:'복원 실행',exact:true}),mobile);await expect(page.getByRole('dialog')).toHaveCount(0);
}
async function boot(page:Page,mobile:boolean,seed:string,money=500000){
  await page.clock.setFixedTime(new Date(DATE+'T03:00:00Z'));await page.goto('/');await expect(page.getByRole('heading',{name:/^보유 개체/})).toBeVisible();
  const g=newGame(seed,DATE,{initialMoney:money});await restore(page,g,mobile);return g;
}
async function closeRush(page:Page,mobile:boolean){await touch(rush(page).getByRole('button',{name:'닫기',exact:true}),mobile);await expect(rush(page)).toHaveCount(0);}
function pendingWage(){
  let g=act(newGame('empty-guide-wage',DATE,{initialMoney:0}),{type:'startRush'},DATE);
  const taps=rushPlan(g.seed,g.turn,g.cafeRush!.version).map(t=>({id:t.id,atMs:Math.round(t.spawnMs+t.flightMs*.81)})).sort((a,b)=>a.atMs-b.atMs);
  for(const t of taps)g=act(g,{type:'stepRush',elapsedMs:t.atMs,taps:[t]},DATE);
  return act(g,{type:'stepRush',elapsedMs:25000},DATE);
}

test('empty collection replaces only the inventory prompt with a compact two-action breeder guide at mobile widths',async({page},info)=>{
  const mobile=info.project.name.startsWith('mobile'),g=await boot(page,mobile,'empty-guide-layout'),errors:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));await mkdir('docs/empty-collection',{recursive:true});
  for(const [width,height] of mobile?[[360,800],[390,844],[430,932],[320,640],[360,640]]:[[1280,900]]){
    await page.setViewportSize({width,height});await expect(guide(page)).toBeVisible();
    await expect(page.locator('.home-info-empty')).toContainText('나의 컬렉션');
    await expect(page.getByRole('heading',{name:/^보유 개체/})).toContainText('0 / 4');
    await expect(page.getByRole('combobox',{name:'모프 필터',exact:true})).toBeVisible();await expect(page.getByRole('combobox',{name:'개체 정렬',exact:true})).toBeVisible();
    await expect(page.getByRole('button',{name:'상점 보기',exact:true})).toHaveCount(0);await expect(page.getByText('보유 개체가 없습니다. 상점에서 첫 게코를 데려오세요.',{exact:true})).toHaveCount(0);
    const cafe=guide(page).getByRole('button',{name:'카페 알바하기',exact:true}),shop=guide(page).getByRole('button',{name:'상점 구경하기',exact:true});
    await guide(page).scrollIntoViewIfNeeded();const a=(await cafe.boundingBox())!,b=(await shop.boundingBox())!,panel=(await guide(page).boundingBox())!;
    expect(a.height).toBeGreaterThanOrEqual(44);expect(b.height).toBeGreaterThanOrEqual(44);expect(Math.abs(a.y-b.y)).toBeLessThan(1);expect(a.x+a.width).toBeLessThanOrEqual(b.x);
    expect(panel.height).toBeLessThan(300);expect(panel.y+panel.height).toBeLessThanOrEqual((await page.locator('.home-footer').boundingBox())!.y+1);
    expect(await guide(page).evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    expect(await cafe.evaluate(el=>Array.from(el.querySelectorAll('strong,small')).every(x=>x.scrollWidth<=x.clientWidth))).toBe(true);
    await expect(page.getByRole('button',{name:'턴 넘기기',exact:true})).toBeVisible();expect(await page.getByRole('navigation',{name:'게임 탭'}).getByRole('button').count()).toBe(4);
    if(mobile)await page.screenshot({path:`docs/empty-collection/guide-${width}-${height}.png`,scale:'css'});
  }
  expect(await saved(page)).toEqual(g);expect(errors).toEqual([]);
});

test('guide and header open the single existing rush dialog and share unfinished progress across close and reload',async({page},info)=>{
  const mobile=info.project.name.startsWith('mobile'),g=await boot(page,mobile,'empty-guide-progress',0);
  await touch(guide(page).getByRole('button',{name:'카페 알바하기',exact:true}),mobile);await expect(rush(page)).toHaveCount(1);await expect(rush(page).getByRole('button',{name:'알바 시작',exact:true})).toBeEnabled();
  expect(await saved(page)).toEqual(g);await touch(rush(page).getByRole('button',{name:'알바 시작',exact:true}),mobile);await expect(page.getByTestId('rush-target-0')).toBeVisible();await closeRush(page,mobile);
  const checkpoint=await saved(page);expect(checkpoint.cafeRush!.shift.elapsedMs).toBeGreaterThan(0);expect(checkpoint.money).toBe(0);expect(checkpoint.turn).toBe(0);
  await touch(page.getByRole('button',{name:'크레 러시 아르바이트',exact:true}),mobile);await expect(rush(page)).toHaveCount(1);await expect(page.getByRole('button',{name:'알바 계속하기',exact:true})).toBeVisible();
  expect(Number(await page.getByTestId('rush-stage').getAttribute('data-elapsed'))).toBe(checkpoint.cafeRush!.shift.elapsedMs);await closeRush(page,mobile);
  await page.reload();await expect(guide(page)).toBeVisible();await touch(guide(page).getByRole('button',{name:'카페 알바하기',exact:true}),mobile);
  await expect(page.getByRole('button',{name:'알바 계속하기',exact:true})).toBeVisible();expect(await saved(page)).toEqual(checkpoint);await closeRush(page,mobile);
});

test('a breeder with no animals can collect wages once through the guide, revisit through either entry and work next turn',async({page},info)=>{
  const mobile=info.project.name.startsWith('mobile');await boot(page,mobile,'empty-guide-wage',0);const pending=pendingWage();await restore(page,pending,mobile);
  await touch(guide(page).getByRole('button',{name:'카페 알바하기',exact:true}),mobile);await expect(page.getByTestId('rush-pay')).toHaveText('₩3,000');
  await touch(rush(page).getByRole('button',{name:'급여 받기',exact:true}),mobile);await expect(rush(page)).toContainText('급여 수령 완료');await closeRush(page,mobile);
  const paid=await saved(page);expect(paid.money).toBe(3000);expect(owned(paid)).toHaveLength(0);
  for(const header of [true,false]){
    await touch(header?page.getByRole('button',{name:'크레 러시 아르바이트',exact:true}):guide(page).getByRole('button',{name:'카페 알바하기',exact:true}),mobile);
    await expect(rush(page)).toContainText('이번 턴 아르바이트 완료');await expect(rush(page).getByRole('button',{name:'급여 받기',exact:true})).toHaveCount(0);await closeRush(page,mobile);expect(await saved(page)).toEqual(paid);
  }
  await page.reload();await expect(guide(page)).toBeVisible();expect(await saved(page)).toEqual(paid);
  await finishTurn(page,mobile);const next=await saved(page);expect(next.turn).toBe(1);expect(next.money).toBe(3000);expect(next.shop).not.toEqual(paid.shop);await expect(guide(page)).toBeVisible();
  await touch(guide(page).getByRole('button',{name:'카페 알바하기',exact:true}),mobile);await expect(rush(page).getByRole('button',{name:'알바 시작',exact:true})).toBeEnabled();await closeRush(page,mobile);
});

test('browse retains actual offers, a purchase hides the guide, filter-empty differs, and selling/death restores it despite pedigree records',async({page},info)=>{
  const mobile=info.project.name.startsWith('mobile'),g=await boot(page,mobile,'empty-guide-shop');
  await touch(guide(page).getByRole('button',{name:'상점 구경하기',exact:true}),mobile);await expect(page.locator('.game-tab-content')).toHaveAttribute('data-view','shop');
  await expect(page.locator('.shop-offer')).toHaveCount(4);expect(await saved(page)).toEqual(g);
  const offer=Object.values(g.shop.offers).find(o=>o.askPrice<=g.money)!;expect(offer).toBeTruthy();
  await touch(page.getByTestId('shop-offer-'+offer.id).getByRole('button',{name:offer.individual.name+' 구매',exact:true}),mobile);await expect(page.getByTestId('shop-offer-'+offer.id).getByRole('button',{name:offer.individual.name+' 구매',exact:true})).toBeDisabled();
  const purchased=await saved(page);expect(purchased.money).toBe(g.money-offer.askPrice);expect(owned(purchased)).toHaveLength(1);
  await navigateGame(page,'컬렉션',mobile);await expect(guide(page)).toHaveCount(0);await expect(page.locator('.home-card')).toHaveCount(1);await page.reload();await expect(page.locator('.home-card')).toHaveCount(1);await expect(guide(page)).toHaveCount(0);
  await touch(page.getByRole('button',{name:'컨디션 관리',exact:true}),mobile);await page.getByRole('combobox',{name:'성장 단계 필터',exact:true}).selectOption(offer.individual.stage==='adult'?'hatchling':'adult');await page.keyboard.press('Escape');
  await expect(page.locator('.home-empty')).toHaveText('필터에 맞는 개체가 없습니다.');await expect(guide(page)).toHaveCount(0);
  await touch(page.getByRole('button',{name:'컨디션 관리',exact:true}),mobile);await page.getByRole('combobox',{name:'성장 단계 필터',exact:true}).selectOption('all');await page.keyboard.press('Escape');
  await touch(page.getByRole('button',{name:offer.individual.name+' 상세보기',exact:true}),mobile);const detail=page.getByRole('dialog',{name:offer.individual.name+' 상세',exact:true});
  await touch(detail.getByRole('button',{name:/^분양 준비/}),mobile);await touch(detail.getByRole('button',{name:'분양 확정',exact:true}),mobile);await expect(detail).toContainText('판매 완료');await touch(detail.getByRole('button',{name:'상세 창 닫기',exact:true}),mobile);
  await expect(guide(page)).toBeVisible();const sold=await saved(page);expect(sold.individuals[offer.id].status).toBe('sold');expect(Object.keys(sold.individuals).length).toBeGreaterThan(0);
  let dead=purchased;for(let i=0;i<5;i++)dead=actWithTime(dead,{type:'endTurn'},DATE);expect(dead.individuals[offer.id].status).toBe('dead');
  await restore(page,dead,mobile);await expect(guide(page)).toBeVisible();await expect(page.locator('.home-card')).toHaveCount(0);await page.reload();await expect(guide(page)).toBeVisible();expect(await saved(page)).toEqual(dead);
});
