import {test,expect,type Page,type Locator} from '@playwright/test';
import {readFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {lineageFixture} from './fixtures/lineage-reference';
import {newGame,act} from '../src/game/hardcore/play';
import {actWithTime} from '../src/game/hardcore/time-source';
import {exportBackup} from '../src/game/hardcore/save';
import {familyTree} from '../src/game/hardcore/family-album';
import {renderSprite} from '../src/engine/render';
import {specimen,visualName} from '../src/game/hardcore/adapter';
import {navigateGame,touch} from './helpers/hardcore-navigation';
import type {Gecko,HardcoreGame} from '../src/game/hardcore/model';
const DATE='2026-10-14',errors=new WeakMap<Page,string[]>();
const hash=(p:readonly number[]|Uint8ClampedArray)=>createHash('sha256').update(Buffer.from(p)).digest('hex');
/** Newly calculated Math.exp scores may differ by one ULP between Node and Chromium.
 * Normalize only the new shop's derived scores; IDs, genomes, money and existing records remain exact. */
function portableShop(game:HardcoreGame){
 const shop=structuredClone(game.shop);
 for(const offer of Object.values(shop.offers))for(const g of [offer.individual,...(offer.family?[offer.family.father,offer.family.mother]:[])])
  for(const key of Object.keys(g.potential) as (keyof Gecko['potential'])[])g.potential[key]=Math.round(g.potential[key]*1e12)/1e12;
 return shop;
}
async function saved(page:Page):Promise<HardcoreGame>{return page.evaluate(async()=>{
 const db=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open('gecko-lab',1);r.onsuccess=()=>resolve(r.result);});
 return new Promise(resolve=>{const tx=db.transaction('games','readonly'),r=tx.objectStore('games').get('active');r.onsuccess=()=>resolve(r.result.save.game);tx.oncomplete=()=>db.close();});
});}
async function restore(page:Page,game:HardcoreGame,mobile:boolean){
 await touch(page.getByRole('button',{name:'저장 및 게임 설정',exact:true}),mobile);
 await page.getByLabel('JSON 백업 파일',{exact:true}).setInputFiles({name:'album.json',mimeType:'application/json',buffer:Buffer.from(exportBackup(game))});
 await touch(page.getByRole('button',{name:'복원 실행',exact:true}),mobile);await expect(page.getByRole('dialog')).toHaveCount(0);
 await navigateGame(page,'혈통도',mobile);await expect(page.getByRole('region',{name:'혈통 앨범',exact:true})).toBeVisible();
}
async function sameSprite(canvas:Locator,g:Gecko){
 await expect.poll(async()=>hash(await canvas.evaluate(el=>{const c=el as HTMLCanvasElement,ctx=c.getContext('2d')!,scale=c.width/96,raw=ctx.getImageData(0,0,c.width,c.height).data,out:number[]=[];
  for(let y=0;y<96;y++)for(let x=0;x<96;x++)out.push(...raw.slice((y*scale*c.width+x*scale)*4,(y*scale*c.width+x*scale)*4+4));return out;
 }))).toBe(hash(renderSprite(specimen(g)).pixels));
 expect(await canvas.evaluate(el=>!(el as HTMLCanvasElement).getContext('2d')!.imageSmoothingEnabled)).toBe(true);
}
test.beforeEach(async({page})=>{const e:string[]=[];errors.set(page,e);page.on('pageerror',err=>e.push(err.message));page.on('console',m=>{if(m.type()==='error')e.push(m.text());});await page.clock.setFixedTime(new Date(DATE+'T03:00:00Z'));await page.goto('/');await expect(page.getByRole('heading',{name:/보유 개체/})).toBeVisible();});
test.afterEach(async({page})=>expect(errors.get(page)).toEqual([]));

test('live family album matches actual seven nodes, recenters across generations and preserves exact sprites at 360/390/430px',async({page},info)=>{
 const mobile=info.project.name.startsWith('mobile'),f=lineageFixture();await restore(page,f.game,mobile);
 await page.getByRole('combobox',{name:'혈통을 볼 개체',exact:true}).selectOption(f.selectedId);
 const tree=familyTree(f.game,f.selectedId),canvas=page.locator('.album-tree');
 await expect(canvas.locator('.album-tree-card')).toHaveCount(7);
 for(const g of Object.values(tree)){expect(g).toBeDefined();const node=canvas.locator('[data-id="'+g!.id+'"]');await expect(node).toContainText(g!.name);await expect(node).toContainText(visualName(g!));await sameSprite(node.locator('canvas'),g!);}
 await sameSprite(page.locator('.lineage-root canvas'),f.game.individuals[f.selectedId]);
 await expect(page.getByRole('navigation',{name:'게임 탭'}).getByRole('button',{name:'혈통도',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('.lineage-trends,.genetic-panel')).toHaveCount(0);
 for(const width of [360,390,430]){
  await page.setViewportSize({width,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  for(const b of await page.locator('.home-turn-cta,.album-small-button,.album-tree-card,.album-compare-select,.album-family-manage').all()){const box=await b.boundingBox();expect(box!.height).toBeGreaterThanOrEqual(44);}
  await expect.poll(async()=>{const r=await page.locator('.album-tree .is-current').boundingBox(),v=await page.locator('.album-tree-scroll').boundingBox();return r!.x>=v!.x&&r!.x+r!.width<=v!.x+v!.width;}).toBe(true);
  await page.screenshot({path:info.outputPath('album-'+width+'.png'),fullPage:true,scale:'css'});
 }
 // Use the actual scroll container to reveal the maternal side, then touch a parent.
 await page.locator('.album-tree-scroll').evaluate(el=>{el.scrollLeft=el.scrollWidth;});await touch(page.getByRole('button',{name:'어머니 라임 혈통 보기',exact:true}),mobile);
 await expect(page.locator('.lineage-root')).toHaveAttribute('data-id',f.motherId);await expect(page.locator('.album-tree-missing')).toHaveCount(4);
 await touch(page.getByRole('button',{name:'미깡 후손 혈통 보기',exact:true}),mobile);await expect(page.locator('.lineage-root')).toHaveAttribute('data-id',f.selectedId);
 expect(await saved(page)).toEqual(f.game);
 if(mobile){
  await mkdir('docs/lineage-reference',{recursive:true});await page.setViewportSize({width:390,height:844});await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:'docs/lineage-reference/after-390.png',scale:'css'});await page.screenshot({path:'docs/lineage-reference/after-390-full.png',fullPage:true,scale:'css'});
  await page.locator('.album-comparison').scrollIntoViewIfNeeded();await page.screenshot({path:'docs/lineage-reference/comparison-390.png',scale:'css'});
  await page.setViewportSize({width:720,height:1280});await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:'docs/lineage-reference/after-720.png',scale:'css'});await page.screenshot({path:'docs/lineage-reference/after-720-full.png',fullPage:true,scale:'css'});
  const naturalHeight=await page.evaluate(()=>document.documentElement.scrollHeight);await page.setViewportSize({width:720,height:naturalHeight});await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:'docs/lineage-reference/overview-720.png',scale:'css'});
 }
});
test('old favorite registrations, renames and removals remain intact while the two favorite UI boxes are replaced',async({page},info)=>{
 const mobile=info.project.name.startsWith('mobile'),f=lineageFixture();
 let game=act(f.game,{type:'lineage',id:f.selectedId,name:'우리의 첫 가문'},f.game.lastDate);
 const line=Object.values(game.lineages).find(l=>l.name==='우리의 첫 가문')!;
 game=act(game,{type:'renameLineage',lineageId:line.id,name:'초록 앨범'},game.lastDate);
 await restore(page,game,mobile);await page.getByRole('combobox',{name:'혈통을 볼 개체',exact:true}).selectOption(f.selectedId);
 await expect(page.locator('.album-toolbar,.album-favorites')).toHaveCount(0);await expect(page.locator('.breeding-challenge-panel')).toContainText('도전 목표를 선택하세요');
 await expect(page.locator('.lineage-root')).toContainText('초록 앨범');expect(await saved(page)).toEqual(game);
 await page.reload();await expect(page.getByTestId('game-day')).toHaveText('6');expect(await saved(page)).toEqual(game);
 game=act(game,{type:'unfavoriteLineage',lineageId:line.id},game.lastDate);
 game=act(game,{type:'lineage',id:f.selectedId,name:'돌아온 앨범'},game.lastDate);
 expect(game.nextLineage).toBe(f.game.nextLineage+1);await restore(page,game,mobile);expect(await saved(page)).toEqual(game);
 expect(game.individuals[f.selectedId].genetics).toEqual(f.game.individuals[f.selectedId].genetics);
});
test('family default comparison and independent selectors use exact archived sprites; collection opens the chosen individual directly',async({page},info)=>{
 const mobile=info.project.name.startsWith('mobile'),f=lineageFixture();let game=act(f.game,{type:'sell',id:f.fatherId},f.game.lastDate);
 game.food=0;for(let n=0;n<5;n++)game=actWithTime(game,{type:'endTurn'},DATE);
 await restore(page,game,mobile);await page.getByRole('combobox',{name:'혈통을 볼 개체',exact:true}).selectOption(f.selectedId);
 await expect(page.locator('.album-compare-card[data-side="left"]')).toHaveAttribute('data-id',f.fatherId);await expect(page.locator('.album-compare-card[data-side="right"]')).toHaveAttribute('data-id',f.selectedId);
 await sameSprite(page.locator('.album-compare-card[data-side="left"] canvas'),game.individuals[f.fatherId]);await sameSprite(page.locator('.album-compare-card[data-side="right"] canvas'),game.individuals[f.selectedId]);
 await expect(page.locator('.album-compare-card[data-side="left"]')).toContainText('판매 완료');await expect(page.locator('.album-compare-card[data-side="right"]')).toContainText('폐사');
 for(const side of ['left','right']){
  await touch(page.getByRole('button',{name:side==='left'?'왼쪽 비교 개체 변경':'오른쪽 비교 개체 변경',exact:true}),mobile);await page.getByLabel('이름 또는 고유 ID',{exact:true}).fill(side==='left'?f.motherId:f.siblingId);
  await touch(page.getByRole('dialog').getByRole('button',{name:side==='left'?'라임 혈통 선택':'새싹 혈통 선택',exact:true}),mobile);
 }
 await expect(page.locator('.album-compare-card[data-side="left"]')).toHaveAttribute('data-id',f.motherId);await expect(page.locator('.album-compare-card[data-side="right"]')).toHaveAttribute('data-id',f.siblingId);
 await sameSprite(page.locator('.album-compare-card[data-side="left"] canvas'),game.individuals[f.motherId]);expect(await saved(page)).toEqual(game);
 await page.reload();await expect(page.getByTestId('game-day')).toHaveText('11');expect(await saved(page)).toEqual(game);
 await restore(page,f.game,mobile);await navigateGame(page,'컬렉션',mobile);await touch(page.getByRole('button',{name:'미깡 상세보기',exact:true}),mobile);await touch(page.getByRole('button',{name:'영구 혈통 기록 보기',exact:true}),mobile);await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.locator('.lineage-root')).toHaveAttribute('data-id',f.selectedId);
});
test('empty album and missing family records stay honest; lineage end-turn is the common engine and blocks duplicate clicks',async({page},info)=>{
 const mobile=info.project.name.startsWith('mobile'),empty=newGame('empty-album',DATE);await restore(page,empty,mobile);
 await expect(page.locator('.album-reference')).toContainText('아직 가족 앨범에 개체가 없습니다');await expect(page.locator('.album-tree')).toHaveCount(0);await expect(page.getByRole('button',{name:'턴 넘기기',exact:true})).toBeEnabled();
 const f=lineageFixture();await restore(page,f.game,mobile);await page.getByRole('button',{name:'턴 넘기기',exact:true}).evaluate(el=>{(el as HTMLButtonElement).click();(el as HTMLButtonElement).click();});await expect(page.getByTestId('game-day')).toHaveText('7');const actual=await saved(page),expected=actWithTime(f.game,{type:'endTurn'},DATE);expect({...actual,shop:expected.shop}).toEqual(expected);expect(portableShop(actual)).toEqual(portableShop(expected));
 const noFood=structuredClone(f.game);noFood.food=0;await restore(page,noFood,mobile);await touch(page.getByRole('button',{name:'턴 넘기기',exact:true}),mobile);await expect(page.getByRole('dialog',{name:'턴 종료 전 사료 부족',exact:true})).toContainText('부족 4개');expect(await saved(page)).toEqual(noFood);await page.keyboard.press('Escape');
 await navigateGame(page,'인큐베이터',mobile);await expect(page.getByRole('region',{name:'인큐베이터 화면',exact:true})).toBeVisible();await navigateGame(page,'상점',mobile);await expect(page.locator('.shop-offer')).toHaveCount(4);
});
test('v7 active save preserves the exact family record and requests a new game',async({page},info)=>{
 const mobile=info.project.name.startsWith('mobile'),envelope=JSON.parse(await readFile('docs/lineage-reference/baseline-game.json','utf8')),record={save:envelope,writeRevision:20};
 await page.evaluate(async record=>{const db=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open('gecko-lab',1);r.onsuccess=()=>resolve(r.result);});await new Promise<void>(resolve=>{const tx=db.transaction('games','readwrite');tx.objectStore('games').put(record,'active');tx.oncomplete=()=>{db.close();resolve();};});},record);
 await page.reload();await expect(page.getByRole('alert').filter({hasText:'새 외형 엔진'})).toContainText('새 게임');expect(await saved(page)).toEqual(envelope.game);
 await page.reload();expect(await saved(page)).toEqual(envelope.game);
 const active=await page.evaluate(async()=>{const db=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open('gecko-lab',1);r.onsuccess=()=>resolve(r.result);});return new Promise(resolve=>{const tx=db.transaction('games','readonly'),r=tx.objectStore('games').get('active');r.onsuccess=()=>resolve(r.result);tx.oncomplete=()=>db.close();});});expect(active).toEqual(record);

});

test('offline PWA reload keeps the album, live sprites and terrarium available without progressing real time',async({page,context},info)=>{
 const mobile=info.project.name.startsWith('mobile'),f=lineageFixture();await restore(page,f.game,mobile);
 await page.evaluate(()=>navigator.serviceWorker.ready);await expect.poll(()=>page.evaluate(()=>!!navigator.serviceWorker.controller)).toBe(true);
 await context.setOffline(true);await page.reload();await expect(page.getByTestId('game-day')).toHaveText('6');await navigateGame(page,'혈통도',mobile);
 await page.getByRole('combobox',{name:'혈통을 볼 개체',exact:true}).selectOption(f.selectedId);await sameSprite(page.locator('.lineage-root canvas'),f.game.individuals[f.selectedId]);
 expect(await page.evaluate(async()=>{const r=await fetch('/ui/home-terrarium.png');return r.ok&&(await r.blob()).size>1000;})).toBe(true);
 await expect(page.locator('.album-favorite')).toHaveCount(0);await expect(page.locator('.breeding-challenge-panel')).toBeVisible();expect(await saved(page)).toEqual(f.game);await context.setOffline(false);
});

test('compact challenge panel and all five goals replace the favorite slider at mobile sizes without altering records',async({page},info)=>{
 const mobile=info.project.name.startsWith('mobile'),f=lineageFixture();await restore(page,f.game,mobile);
 for(const width of [360,390,430]){
  await page.setViewportSize({width,height:800});await expect(page.locator('.album-banner,.album-toolbar,.album-favorites')).toHaveCount(0);
  const panel=page.locator('.breeding-challenge-panel');expect((await panel.boundingBox())!.height).toBeLessThan(210);
  await touch(page.getByRole('button',{name:'전체 도전 목표 보기',exact:true}),mobile);
  const dialog=page.getByRole('dialog',{name:'전체 도전 목표',exact:true});await expect(dialog.locator('.challenge-goal')).toHaveCount(5);
  expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  for(const button of await dialog.getByRole('button',{name:'이 목표 선택',exact:true}).all())expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await page.keyboard.press('Escape');expect(await saved(page)).toEqual(f.game);
 }
 await page.getByRole('combobox',{name:'혈통을 볼 개체',exact:true}).selectOption(f.selectedId);
 await expect(page.locator('.lineage-root')).toContainText('시조 가문');await expect(page.locator('.album-tree-card')).toHaveCount(7);
});
