import {test,expect,type Page,type Locator} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {referenceHomeGame,REFERENCE_DATE} from './fixtures/reference-home';
import {touch,openCollectionCatalog,expandCollectionFilters} from './helpers/hardcore-navigation';
import {exportBackup} from '../src/game/hardcore/save';
import {valueGecko} from '../src/game/hardcore/market';
import {salePriceTags} from '../src/components/hardcore/sale-price-tags';
import {act} from '../src/game/hardcore/play';
import {breedingRisk} from '../src/game/hardcore/breeding-risk';
import type {HardcoreGame} from '../src/game/hardcore/model';

const rename=(p:Page)=>p.getByRole('dialog',{name:'이름 수정',exact:true});
const sale=(p:Page)=>p.getByRole('dialog',{name:'개체 분양',exact:true});
const catalog=(p:Page)=>p.getByRole('dialog',{name:'전체 개체',exact:true});
async function saved(p:Page):Promise<HardcoreGame>{return p.evaluate(async()=>{
 const db=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open('gecko-lab',1);r.onsuccess=()=>resolve(r.result);});
 return new Promise(resolve=>{const tx=db.transaction('games'),r=tx.objectStore('games').get('active');r.onsuccess=()=>resolve(r.result.save.game);tx.oncomplete=()=>db.close();});
});}
async function restore(p:Page,g:HardcoreGame,mobile:boolean){
 await touch(p.getByRole('button',{name:'저장 및 게임 설정',exact:true}),mobile);await p.getByLabel('JSON 백업 파일',{exact:true}).setInputFiles({name:'cards.json',mimeType:'application/json',buffer:Buffer.from(exportBackup(g))});await touch(p.getByRole('button',{name:'복원 실행',exact:true}),mobile);await expect(p.getByRole('dialog')).toHaveCount(0);
}
async function fullySelected(input:Locator,name:string){
 await expect(input).toBeFocused();await expect(input).toHaveValue(name);
 expect(await input.evaluate(n=>{const e=n as HTMLInputElement;return [e.selectionStart,e.selectionEnd];})).toEqual([0,name.length]);
 await expect(input).toHaveAttribute('enterkeyhint','done');
}
const browserErrors=new WeakMap<Page,string[]>();
test.afterEach(async({page})=>{expect(browserErrors.get(page)).toEqual([]);});
test.beforeEach(async({page})=>{browserErrors.set(page,[]);page.on('pageerror',e=>browserErrors.get(page)!.push(e.message));await page.clock.setFixedTime(new Date(REFERENCE_DATE+'T03:00:00Z'));await page.goto('/');await expect(page.getByRole('heading',{name:/^보유 개체/})).toBeVisible();});

test('main card name opens a minimal selected input; Done saves by ID without selecting the card; cancellation changes nothing',async({page},info)=>{
 const mobile=info.project.name.startsWith('mobile'),game=referenceHomeGame(),animals=Object.values(game.individuals),g=animals[1];await restore(page,game,mobile);
 const card=page.getByTestId('hc-card-'+g.id),hero=page.getByTestId('home-hero');await expect(page.locator('.home-card-grid .collection-list-price')).toHaveCount(0);
 await expect(hero.locator('.home-name')).toContainText(animals[0].name);
 await touch(card.getByRole('button',{name:g.name+' 이름 수정',exact:true}),mobile);
 const d=rename(page),input=d.getByRole('textbox',{name:'개체 이름',exact:true});await fullySelected(input,g.name);
 await expect(d.getByRole('heading')).not.toBeVisible();await expect(d.getByRole('button')).toHaveCount(2);await expect(d.locator('p')).toHaveCount(0);
 // insertText respects the selection, unlike fill(), which would mask a bug.
 await page.keyboard.insertText('  새싹이  ');await expect(input).toHaveValue('  새싹이  ');await input.press('Enter');await expect(d).toHaveCount(0);
 await expect(card.getByRole('button',{name:'새싹이 이름 수정',exact:true})).toBeVisible();await expect(hero.locator('.home-name')).toContainText(animals[0].name);
 const renamed=await saved(page);expect(renamed.individuals[g.id]).toEqual({...g,name:'새싹이'});expect(renamed.money).toBe(game.money);expect(valueGecko(renamed.individuals[g.id])).toEqual(valueGecko(g));
 await touch(card.getByRole('button',{name:'새싹이 이름 수정',exact:true}),mobile);await fullySelected(input,'새싹이');await page.keyboard.insertText('취소될 이름');await touch(d.getByRole('button',{name:'취소',exact:true}),mobile);await expect(d).toHaveCount(0);expect(await saved(page)).toEqual(renamed);
 await page.reload();await expect(page.getByTestId('hc-card-'+g.id)).toContainText('새싹이');expect(await saved(page)).toEqual(renamed);
});

test('sale tags use the actual quote; cancel is read-only; rapid duplicate sales pay exactly once and preserve the pedigree',async({page},info)=>{
 const mobile=info.project.name.startsWith('mobile'),game=referenceHomeGame(),g=Object.values(game.individuals)[0],quote=valueGecko(g).sell;await restore(page,game,mobile);
 await expect(page.locator('.home-card-grid .collection-list-price')).toHaveCount(0);await openCollectionCatalog(page,mobile);const card=catalog(page).getByTestId('collection-list-'+g.id);await touch(card.locator('.collection-list-price'),mobile);const d=sale(page);
 await expect(d.locator('.card-sale-name')).toHaveText(g.name);await expect(d.locator('.card-sale-price strong')).toHaveText('₩'+quote.toLocaleString('ko-KR'));await expect(d.locator('canvas')).toBeVisible();const art=(await d.locator('.card-sale-art').boundingBox())!,sprite=(await d.locator('canvas').boundingBox())!,name=(await d.locator('.card-sale-name').boundingBox())!;expect(sprite.y+sprite.height).toBeLessThanOrEqual(art.y+art.height+1);expect(art.y+art.height).toBeLessThan(name.y);
 const tags=salePriceTags(g);expect(await d.locator('.card-price-tag').allTextContents()).toEqual(tags.map(t=>t.label));
 for(const tag of tags)await expect(d.locator('[data-factor="'+tag.id+'"]').first()).toHaveClass('card-price-tag '+tag.tone);
 expect(await d.textContent()).not.toMatch(/노령|은퇴|근친|희귀|번식 가능/);expect(await saved(page)).toEqual(game);
 await touch(d.getByRole('button',{name:'취소',exact:true}),mobile);await expect(d).toHaveCount(0);expect(await saved(page)).toEqual(game);
 await touch(card.locator('.collection-list-price'),mobile);const sell=d.getByRole('button',{name:'판매',exact:true});
 await sell.evaluate(n=>{(n as HTMLButtonElement).click();(n as HTMLButtonElement).click();});await expect(d).toHaveCount(0);await expect(card).toHaveCount(0);
 const sold=await saved(page);expect(sold.money).toBe(game.money+quote);expect(sold.sales).toHaveLength(1);expect(sold.individuals[g.id]).toEqual({...g,status:'sold'});
 await touch(catalog(page).getByRole('button',{name:'상세 창 닫기',exact:true}),mobile);await expect(page.getByRole('heading',{name:/^보유 개체/})).toContainText('5 / 20');await expect(page.getByTestId('game-money')).toContainText((game.money+quote).toLocaleString('ko-KR'));
 await page.reload();await expect(page.getByTestId('hc-card-'+g.id)).toHaveCount(0);expect(await saved(page)).toEqual(sold);
});

test('manager remains mounted for name edits and sales, retaining filter and scroll while other interactions still work',async({page},info)=>{
 const mobile=info.project.name.startsWith('mobile'),game=referenceHomeGame(),sources=Object.values(game.individuals);game.capacity=80;game.rules.initialCapacity=80;
 for(let n=6;n<42;n++){const g=structuredClone(sources[n%6]);g.id=game.gameId+'-card-'+n;g.name='관리 개체 '+n;g.visualSeed=g.id;game.individuals[g.id]=g;}
 await restore(page,game,mobile);await openCollectionCatalog(page,mobile);const manager=catalog(page),list=manager.locator('.collection-list-scroll');await list.evaluate(n=>n.scrollTop=700);
 const g=Object.values(game.individuals)[18],card=manager.getByTestId('collection-list-'+g.id);await card.scrollIntoViewIfNeeded();const top=await list.evaluate(n=>n.scrollTop);
 await touch(card.getByRole('button',{name:g.name+' 이름 수정',exact:true}),mobile);await fullySelected(rename(page).getByRole('textbox'),g.name);await page.keyboard.insertText('새 관리 이름');await rename(page).getByRole('textbox').press('Enter');await expect(rename(page)).toHaveCount(0);
 expect(await list.evaluate(n=>n.scrollTop)).toBe(top);await expect(manager).toBeVisible();await expect(card.locator('.home-card-select')).toHaveAttribute('aria-pressed','false');await expect(card).toContainText('새 관리 이름');
 await expandCollectionFilters(page,mobile);await manager.getByRole('searchbox').fill(g.id);await touch(manager.getByRole('button',{name:'검색·필터 접기',exact:true}),mobile);await expect(card).toBeVisible();
 await touch(card.locator('.collection-list-price'),mobile);await expect(sale(page)).toBeVisible();await touch(sale(page).getByRole('button',{name:'판매',exact:true}),mobile);await expect(sale(page)).toHaveCount(0);await expect(manager).toBeVisible();await expect(card).toHaveCount(0);await expect(manager.getByRole('status')).toHaveText('0 / 41마리');await expandCollectionFilters(page,mobile);await expect(manager.getByRole('searchbox')).toHaveValue(g.id);
 await touch(manager.getByRole('button',{name:'필터 초기화',exact:true}),mobile);const first=manager.locator('.collection-list-row').first();await touch(first.locator('.home-card-more'),mobile);await expect(page.getByRole('dialog').last()).toContainText('전체 외형 분류');await page.keyboard.press('Escape');await expect(manager).toBeVisible();
});

test('pending mother cannot be sold and errors stay in rename dialog without mutating saved data',async({page},info)=>{
 const mobile=info.project.name.startsWith('mobile');let game=referenceHomeGame();const [mother,father]=Object.values(game.individuals),risk=breedingRisk(game,father,mother);
 game=act(game,{type:'breed',fatherId:father.id,motherId:mother.id,riskAcknowledgement:risk.acknowledgement},REFERENCE_DATE);await restore(page,game,mobile);
 await openCollectionCatalog(page,mobile);const card=catalog(page).getByTestId('collection-list-'+mother.id);await touch(card.locator('.collection-list-price'),mobile);const d=sale(page);await expect(d.getByRole('alert')).toContainText('산란 전');await expect(d.getByRole('button',{name:'판매',exact:true})).toBeDisabled();await touch(d.getByRole('button',{name:'취소',exact:true}),mobile);
 await touch(card.getByRole('button',{name:mother.name+' 이름 수정',exact:true}),mobile);const r=rename(page),input=r.getByRole('textbox');await page.keyboard.insertText('   ');await input.press('Enter');await expect(r.getByRole('alert')).toContainText('1~24자');await expect(r).toBeVisible();expect(await saved(page)).toEqual(game);
 await input.fill('가'.repeat(24));await input.press('Enter');await expect(r).toHaveCount(0);expect((await saved(page)).individuals[mother.id].name).toBe('가'.repeat(24));
});

test('mobile touch targets, visual viewport keyboard accommodation and card geometry stay usable',async({page},info)=>{
 const mobile=info.project.name.startsWith('mobile'),game=referenceHomeGame(),g=Object.values(game.individuals)[1];await restore(page,game,mobile);await mkdir('docs/card-actions',{recursive:true});
 for(const width of [360,390,430]){
  await page.setViewportSize({width,height:844});const card=page.getByTestId('hc-card-'+g.id),before=await card.boundingBox(),hero=await page.getByTestId('home-hero').boundingBox();
  if(mobile&&width===390)await page.screenshot({path:'docs/card-actions/home-390.png',scale:'css'});
  await touch(card.getByRole('button',{name:g.name+' 이름 수정',exact:true}),mobile);const d=rename(page),input=d.getByRole('textbox');await fullySelected(input,g.name);
  expect(await page.getByTestId('home-hero').boundingBox()).toEqual(hero);expect(await card.boundingBox()).toEqual(before);
  if(mobile&&width===390)await page.screenshot({path:'docs/card-actions/rename-390.png',scale:'css'});
  // Emulate Android's visual-only keyboard resize; this is not physical-device testing.
  await page.evaluate(()=>{Object.defineProperty(visualViewport!,'height',{configurable:true,value:300});Object.defineProperty(visualViewport!,'offsetTop',{configurable:true,value:80});visualViewport!.dispatchEvent(new Event('resize'));});
  await expect.poll(async()=>{const r=(await d.boundingBox())!;return r.y>=80&&r.y+r.height<=380;}).toBe(true);await expect(input).toBeFocused();
  await page.evaluate(()=>{delete (visualViewport as any).height;delete (visualViewport as any).offsetTop;visualViewport!.dispatchEvent(new Event('resize'));});
  await touch(d.getByRole('button',{name:'취소',exact:true}),mobile);await expect(card.locator('.collection-list-price')).toHaveCount(0);await openCollectionCatalog(page,mobile);await touch(catalog(page).getByTestId('collection-list-'+g.id).locator('.collection-list-price'),mobile);await expect(sale(page)).toBeVisible();
  expect(await sale(page).evaluate(n=>n.scrollWidth<=n.clientWidth)).toBe(true);if(mobile&&width===390)await page.screenshot({path:'docs/card-actions/sale-390.png',scale:'css'});await touch(sale(page).getByRole('button',{name:'취소',exact:true}),mobile);await touch(catalog(page).getByRole('button',{name:'상세 창 닫기',exact:true}),mobile);
  expect(await page.locator('.reference-content').evaluate(n=>n.scrollHeight<=n.clientHeight+1)).toBe(true);
 }
});
