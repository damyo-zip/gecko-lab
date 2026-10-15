import {chooseBreedingParent} from './helpers/hardcore-navigation';
import {bornIndividual} from '../src/game/hardcore/egg-outcome';
import {preRiskRecord} from '../tests/helpers/risk-projection';
import {test,expect,type Page} from '@playwright/test';
import {writeFile,mkdir} from 'node:fs/promises';
import {newGame as v6Game} from '../tests/helpers/v6-hardcore';
import {newGame,act} from '../src/game/hardcore/play';
import {makeSave,exportBackup} from '../src/game/hardcore/save';
import {valueGecko} from '../src/game/hardcore/market';
import {ancestors} from '../src/game/hardcore/lineage';
import {owned} from '../src/game/hardcore/survival';
import {advancedSafety} from '../src/game/hardcore/genetics';
import {turns} from './fixtures/lifecycle';
import {navigateGame,touch,buyFood} from './helpers/hardcore-navigation';
import type {HardcoreGame} from '../src/game/hardcore/model';
const DATE='2026-10-14';
async function saved(page:Page):Promise<HardcoreGame>{return page.evaluate(async()=>{const db=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open('gecko-lab',1);r.onsuccess=()=>resolve(r.result);});return new Promise(resolve=>{const tx=db.transaction('games','readonly'),r=tx.objectStore('games').get('active');r.onsuccess=()=>resolve(r.result.save.game);tx.oncomplete=()=>db.close();});});}
async function restore(page:Page,game:HardcoreGame,mobile:boolean){await touch(page.getByRole('button',{name:'저장 및 게임 설정',exact:true}),mobile);await page.getByLabel('JSON 백업 파일',{exact:true}).setInputFiles({name:'shop.json',mimeType:'application/json',buffer:Buffer.from(exportBackup(game))});await touch(page.getByRole('button',{name:'복원 실행',exact:true}),mobile);await expect(page.getByRole('dialog')).toHaveCount(0);}
async function shop(page:Page,mobile:boolean){await navigateGame(page,'상점',mobile);await expect(page.locator('.shop-offer')).toHaveCount(4);}
function winning(){for(let n=0;n<100;n++){const original=newGame('shop-live-'+n,DATE,{initialMoney:3_000_000,initialCapacity:20});let g=original;const [f,m]=Object.keys(g.shop.offers);for(const id of [f,m])g=act(g,{type:'buyGecko',offerId:id},DATE);g=act(g,{type:'buyFood',amount:1000},DATE);g=act(g,{type:'breed',fatherId:f,motherId:m},DATE);g=turns(g,18);if(Object.values(g.eggs).every(e=>e.status==='hatched')){const c=g.individuals[Object.values(g.eggs)[0].embryo.id],p=Object.values(g.shop.offers).find(o=>o.individual.stage==='adult'&&o.individual.sex!==c.sex&&!advancedSafety(c,o.individual).length);if(p)return {original,f,m};}}throw new Error('live market fixture missing');}
const errors=new WeakMap<Page,string[]>();
test.beforeEach(async({page})=>{const list:string[]=[];errors.set(page,list);page.on('pageerror',e=>list.push(e.message));page.on('console',m=>{if(m.type()==='error')list.push(m.text());});await page.clock.setFixedTime(new Date(DATE+'T03:00:00Z'));await page.goto('/');await expect(page.getByRole('heading',{name:/보유 개체/})).toBeVisible();});
test.afterEach(async({page})=>expect(errors.get(page)).toEqual([]));

test('four actual family offers, private parent popup, confirmed paid reroll, purchase receipt and stable reload at 360/390/430px',async({page},info)=>{
 const mobile=info.project.name.startsWith('mobile');const fixture=winning();await restore(page,fixture.original,mobile);await shop(page,mobile);
 const initial=await saved(page);
 for(const [width,height] of [[360,800],[390,844],[430,844],[360,740]]){await page.setViewportSize({width,height});await page.evaluate(()=>window.scrollTo(0,0));expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(await page.locator('.shop-offer-grid').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length)).toBe(2);
  const cta=await page.locator('.home-turn-cta').boundingBox(),nav=await page.getByRole('navigation',{name:'게임 탭'}).boundingBox();
  expect(await page.evaluate(()=>scrollY)).toBe(0);expect(cta!.y+cta!.height).toBeLessThanOrEqual(nav!.y);
  for(const b of await page.locator('.shop-buy,.shop-parents').all()){const r=await b.boundingBox();expect(r!.height).toBeGreaterThanOrEqual(44);expect(r!.y+r!.height).toBeLessThan(cta!.y);}
  await expect(page.locator('.shop-banner,.shop-description')).toHaveCount(0);for(const c of await page.locator('.shop-offer-art canvas').all())expect(await c.evaluate(el=>{const c=el as HTMLCanvasElement;return !c.getContext('2d')!.imageSmoothingEnabled&&c.getContext('2d')!.getImageData(0,0,c.width,c.height).data.some((v,i)=>i%4===3&&v>0);})).toBe(true);
  await page.screenshot({path:info.outputPath('shop-'+width+'x'+height+'.png'),scale:'css'});
 }
 await page.setViewportSize({width:390,height:844});const first=Object.values(initial.shop.offers)[0],card=page.getByTestId('shop-offer-'+first.id);
 await expect(card).toContainText(first.individual.name);await expect(card).toContainText('₩'+first.askPrice.toLocaleString('ko-KR'));expect(first.askPrice).toBe(valueGecko(first.individual).ask);
 await touch(card.getByRole('button',{name:first.individual.name+' 부모',exact:true}),mobile);const dialog=page.getByRole('dialog');await expect(dialog).toContainText('아버지');await expect(dialog).toContainText('어머니');await expect(dialog.locator('canvas')).toHaveCount(3);
 await expect(dialog).toContainText(`교배 당시 ${first.family!.matingTurn-first.family!.father.birthTurn}턴`);await expect(dialog).not.toContainText('possible het');await expect(dialog).not.toContainText('A/ax');
 await dialog.screenshot({path:info.outputPath('shop-parents.png'),scale:'css'});await touch(dialog.getByRole('button',{name:'상세 창 닫기',exact:true}),mobile);expect(await saved(page)).toEqual(initial);
 await touch(card.getByRole('button',{name:first.individual.name+' 구매',exact:true}),mobile);await expect(card).toContainText('구매 완료');await expect(card.getByRole('button',{name:first.individual.name+' 구매',exact:true})).toBeDisabled();const purchased=await saved(page);expect(purchased.money).toBe(initial.money-first.askPrice);expect(purchased.individuals[first.id]).toEqual(first.individual);expect(ancestors(purchased,first.id).size).toBe(2);
 await navigateGame(page,'컬렉션',mobile);await expect(page.locator('.home-card')).toHaveCount(1);await page.reload();await expect(page.getByTestId('game-day')).toHaveText('0');expect(await saved(page)).toEqual(purchased);await shop(page,mobile);await expect(page.getByTestId('shop-offer-'+first.id)).toContainText('구매 완료');
 await touch(page.getByRole('button',{name:'발품팔기 2,000원',exact:true}),mobile);await touch(page.getByRole('button',{name:'취소',exact:true}),mobile);expect(await saved(page)).toEqual(purchased);
 await touch(page.getByRole('button',{name:'발품팔기 2,000원',exact:true}),mobile);await page.getByRole('button',{name:'2,000원 사용하고 매물 갱신',exact:true}).evaluate(el=>{(el as HTMLButtonElement).click();(el as HTMLButtonElement).click();});await expect(page.getByRole('dialog')).toHaveCount(0);const refreshed=await saved(page);expect(refreshed.money).toBe(purchased.money-2000);expect(refreshed.turn).toBe(0);expect(refreshed.shop.batch).toBe(purchased.shop.batch!+1);expect(refreshed.revision).toBe(purchased.revision+1);expect(Object.keys(refreshed.shop.offers).some(id=>id in purchased.shop.offers)).toBe(false);
 await page.reload();await expect(page.getByTestId('game-day')).toHaveText('0');await shop(page,mobile);expect(await saved(page)).toEqual(refreshed);
 if(mobile){await mkdir('docs/shop-reference',{recursive:true});
  await page.setViewportSize({width:360,height:800});await page.locator('.shop-shell').evaluate(el=>{(el as HTMLElement).style.setProperty('--home-safe-top','20px');(el as HTMLElement).style.setProperty('--home-safe-bottom','34px');});await page.evaluate(()=>window.scrollTo(0,0));
  const safeCta=await page.locator('.home-turn-cta').boundingBox(),safeNav=await page.getByRole('navigation',{name:'게임 탭'}).boundingBox();expect(safeCta!.y+safeCta!.height).toBeLessThanOrEqual(safeNav!.y);
  await page.locator('.shop-shell').evaluate(el=>{(el as HTMLElement).style.removeProperty('--home-safe-top');(el as HTMLElement).style.removeProperty('--home-safe-bottom');});await page.setViewportSize({width:390,height:844});await restore(page,initial,mobile);await shop(page,mobile);await page.evaluate(()=>window.scrollTo(0,0));const cta=await page.locator('.home-turn-cta').boundingBox(),nav=await page.getByRole('navigation',{name:'게임 탭'}).boundingBox();expect(cta!.y+cta!.height).toBeLessThanOrEqual(nav!.y);await page.screenshot({path:'docs/shop-reference/after-390.png',scale:'css'});await page.screenshot({path:'docs/shop-reference/lower-390.png',scale:'css'});await touch(page.locator('.shop-parents').first(),mobile);await page.getByRole('dialog').screenshot({path:'docs/shop-reference/parents-390.png',scale:'css'});await writeFile('docs/shop-reference/state.json',JSON.stringify(makeSave(initial),null,2));}
});

test('shop end-turn follows real breeding, incubation, growth, second generation and persistence without double turns or reroll charges',async({page},info)=>{
 test.setTimeout(90_000);const mobile=info.project.name.startsWith('mobile'),fixture=winning();await restore(page,fixture.original,mobile);await shop(page,mobile);
 for(const id of [fixture.f,fixture.m])await touch(page.getByTestId('shop-offer-'+id).getByRole('button',{name:/ 구매$/}),mobile);await buyFood(page,mobile,1000);
 await navigateGame(page,'교배',mobile);await chooseBreedingParent(page,'male',fixture.f);await chooseBreedingParent(page,'female',fixture.m);await touch(page.getByRole('button',{name:'교배하기',exact:true}),mobile);
 const breeding=await saved(page),fixed=Object.values(breeding.matings)[0].lifecycle!.offspring;
 await shop(page,mobile);const money=breeding.money;
 for(let n=1;n<=18;n++){await page.getByRole('button',{name:'턴 넘기기',exact:true}).evaluate(el=>{(el as HTMLButtonElement).click();(el as HTMLButtonElement).click();});await expect(page.getByTestId('game-day')).toHaveText(String(n));await expect(page.locator('.game-tab-content')).toHaveAttribute('aria-busy','false');const g=await saved(page);const cta=await page.locator('.home-turn-cta').boundingBox(),nav=await page.getByRole('navigation',{name:'게임 탭'}).boundingBox();expect(await page.evaluate(()=>scrollY)).toBe(0);if(mobile)expect(cta!.y+cta!.height).toBeLessThanOrEqual(nav!.y);expect(g.money).toBe(money);expect(g.shop.batch).toBe(breeding.shop.batch!+n);expect(Object.values(g.shop.offers)).toHaveLength(4);if(n===2)expect(Object.values(g.eggs)).toHaveLength(2);if(n===6)for(const o of fixed)expect(g.individuals[o.embryo.id]).toEqual(bornIndividual(o.embryo));}
 let g=await saved(page);const child=g.individuals[fixed[0].embryo.id];expect(child.stage).toBe('adult');expect(child.generation).toBe(3);await navigateGame(page,'컬렉션',mobile);await touch(page.getByRole('button',{name:child.name+' 상세보기',exact:true}),mobile);await page.getByLabel('개체 이름',{exact:true}).fill('상점 혈통 자손');await touch(page.getByRole('button',{name:'이름 저장',exact:true}),mobile);await page.keyboard.press('Escape');await shop(page,mobile);
 const partner=Object.values(g.shop.offers).find(o=>o.individual.stage==='adult'&&o.individual.sex!==child.sex&&!advancedSafety(child,o.individual).length)!;await touch(page.getByTestId('shop-offer-'+partner.id).getByRole('button',{name:/ 구매$/}),mobile);
 await navigateGame(page,'교배',mobile);await chooseBreedingParent(page,'male',child.sex==='male'?child.id:partner.id);await chooseBreedingParent(page,'female',child.sex==='female'?child.id:partner.id);await touch(page.getByRole('button',{name:'교배하기',exact:true}),mobile);await shop(page,mobile);
 for(let n=19;n<=24;n++){await touch(page.getByRole('button',{name:'턴 넘기기',exact:true}),mobile);await expect(page.getByTestId('game-day')).toHaveText(String(n));}
 g=await saved(page);expect(owned(g).some(i=>i.generation===4)).toBe(true);expect(ancestors(g,child.id).size).toBe(6);await page.reload();await expect(page.getByTestId('game-day')).toHaveText('24');expect(await saved(page)).toEqual(g);
});

test('insufficient funds disable reroll and purchases; missing legacy parent records remain honestly unknown',async({page},info)=>{
 const mobile=info.project.name.startsWith('mobile');const poor=newGame('poor-shop',DATE,{initialMoney:1999});await restore(page,poor,mobile);await shop(page,mobile);await expect(page.getByRole('button',{name:'발품팔기 2,000원',exact:true})).toBeDisabled();for(const b of await page.locator('.shop-buy').all()){await expect(b).toBeDisabled();await expect(b).toContainText('자금 부족');}expect(await saved(page)).toEqual(poor);
 if(mobile){const cta=await page.locator('.home-turn-cta').boundingBox(),nav=await page.getByRole('navigation',{name:'게임 탭'}).boundingBox();expect(await page.evaluate(()=>scrollY)).toBe(0);expect(cta!.y+cta!.height).toBeLessThanOrEqual(nav!.y);}
 const old=v6Game('unknown-family',DATE),record={save:makeSave(old),writeRevision:10};
 await page.evaluate(async record=>{const db=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open('gecko-lab',1);r.onsuccess=()=>resolve(r.result);});await new Promise<void>(resolve=>{const tx=db.transaction('games','readwrite');tx.objectStore('games').put(record,'active');tx.oncomplete=()=>{db.close();resolve();};});},record);
 await page.reload();await expect(page.getByTestId('game-day')).toHaveText('0');await shop(page,mobile);const upgraded=await saved(page);expect(upgraded.saveVersion).toBe(9);
 const first=Object.values(upgraded.shop.offers)[0];expect(first.family).toBeNull();expect(preRiskRecord(first.individual)).toEqual(old.shop.offers[first.id].individual);expect(first.askPrice).toBe(old.shop.offers[first.id].askPrice);
 await touch(page.getByTestId('shop-offer-'+first.id).getByRole('button',{name:first.individual.name+' 부모',exact:true}),mobile);await expect(page.getByRole('dialog')).toContainText('부모 기록이 없습니다');await expect(page.getByRole('dialog').locator('.shop-family-grid')).toHaveCount(0);await page.keyboard.press('Escape');
 const archive=await page.evaluate(async()=>{const db=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open('gecko-lab',1);r.onsuccess=()=>resolve(r.result);});return new Promise(resolve=>{const tx=db.transaction('games','readonly'),r=tx.objectStore('games').get('archive-v6-11');r.onsuccess=()=>resolve(r.result);tx.oncomplete=()=>db.close();});});expect(archive).toEqual(record);await page.reload();await expect(page.getByTestId('game-day')).toHaveText('0');expect(await saved(page)).toEqual(upgraded);
});
