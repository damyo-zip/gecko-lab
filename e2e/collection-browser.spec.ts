import {test,expect,type Page} from "@playwright/test";
import {mkdir,writeFile} from "node:fs/promises";
import {referenceHomeGame,REFERENCE_DATE} from "./fixtures/reference-home";
import {touch,navigateGame,openCollectionCatalog} from "./helpers/hardcore-navigation";
import {exportBackup} from "../src/game/hardcore/save";
import {specimen} from "../src/game/hardcore/adapter";
import {valueGecko} from "../src/game/hardcore/market";
import {addDays} from "../src/game/hardcore/time";
import type {HardcoreGame} from "../src/game/hardcore/model";

function manyGame(count=37) {
  const game=referenceHomeGame(),sources=Object.values(game.individuals);game.capacity=80;game.rules.initialCapacity=80;
  for(let n=sources.length;n<count;n++){
    const g=structuredClone(sources[n%sources.length]);g.id=game.gameId+"-browser-"+n;g.name="새싹 "+String(n).padStart(2,"0");g.visualSeed=g.id;
    g.stage=n%3===0?"hatchling":n%3===1?"juvenile":"adult";g.birthTurn=g.stage==="hatchling"?-2:g.stage==="juvenile"?-8:-12;g.birthDate=addDays(REFERENCE_DATE,g.birthTurn*7);
    game.individuals[g.id]=g;
  }
  return game;
}
async function saved(page:Page):Promise<HardcoreGame> {
  return page.evaluate(async()=>{
    const db=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open('gecko-lab',1);r.onsuccess=()=>resolve(r.result);});
    return new Promise(resolve=>{const tx=db.transaction('games'),r=tx.objectStore('games').get('active');r.onsuccess=()=>resolve(r.result.save.game);tx.oncomplete=()=>db.close();});
  });
}
async function restore(page:Page,game:HardcoreGame,mobile:boolean) {
  await page.clock.setFixedTime(new Date(REFERENCE_DATE+'T03:00:00Z'));await page.goto('/');await expect(page.getByRole('heading',{name:/^보유 개체/})).toBeVisible();
  await touch(page.getByRole('button',{name:'저장 및 게임 설정',exact:true}),mobile);
  await page.getByLabel('JSON 백업 파일',{exact:true}).setInputFiles({name:'collection.json',mimeType:'application/json',buffer:Buffer.from(exportBackup(game))});
  await touch(page.getByRole('button',{name:'복원 실행',exact:true}),mobile);await expect(page.getByRole('dialog')).toHaveCount(0);
}
async function scrollCollection(page:Page,mobile:boolean) {
  const content=page.locator('.reference-content'),r=(await content.boundingBox())!;
  if(mobile){
    const cdp=await page.context().newCDPSession(page),x=r.x+r.width*.45,y=r.y+r.height*.8;
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
    for(let step=1;step<=12;step++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-r.height*.5*step/12,id:1}]});await page.evaluate(()=>new Promise(requestAnimationFrame));}
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();
  }else{await content.hover();await page.mouse.wheel(0,300);}
  await expect.poll(()=>content.evaluate(el=>el.scrollTop)).toBeGreaterThan(0);
}

test('original grid, two-column view, vertical browsing and more specimens retain fixed chrome and immutable records',async({page},info)=>{
  test.setTimeout(60_000);const mobile=info.project.name.startsWith('mobile'),game=manyGame(),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await restore(page,game,mobile);
  const sizes=mobile?[[360,800],[390,844],[430,932],[390,693],[360,640]]:[[720,1280],[1280,900]];
  for(const [width,height] of sizes){
    await navigateGame(page,'인큐베이터',mobile);await page.setViewportSize({width,height});await navigateGame(page,'컬렉션',mobile);
    const grid=page.locator('.home-card-grid');await expect(grid).toHaveClass(/columns-3/);await expect(grid.locator('.home-card')).toHaveCount(12);
    await expect(page.locator('.home-card-carousel,.home-page-controls')).toHaveCount(0);
    const chrome=await page.locator('.home-header,.home-footer').evaluateAll(nodes=>nodes.map(el=>el.getBoundingClientRect().toJSON()));
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&scrollY===0)).toBe(true);
    for(const canvas of await grid.locator('canvas').all())expect(await canvas.evaluate(el=>!(el as HTMLCanvasElement).getContext('2d')!.imageSmoothingEnabled)).toBe(true);
    if(mobile){await mkdir('docs/collection-restore',{recursive:true});await page.screenshot({path:`docs/collection-restore/home-${width}-${height}.png`,scale:'css'});}
    await scrollCollection(page,mobile);
    expect(await page.locator('.home-header,.home-footer').evaluateAll(nodes=>nodes.map(el=>el.getBoundingClientRect().toJSON()))).toEqual(chrome);
    await touch(page.getByRole('button',{name:'2열로 보기',exact:true}),mobile);await expect(grid).toHaveClass(/columns-2/);
    await touch(page.getByRole('button',{name:'3열로 보기',exact:true}),mobile);await expect(grid).toHaveClass(/columns-3/);
  }
  for(const count of [24,36,37]){await touch(page.getByRole('button',{name:'개체 더 보기',exact:true}),mobile);await expect(page.locator('.home-card')).toHaveCount(count);}
  await expect(page.getByRole('button',{name:'개체 더 보기',exact:true})).toHaveCount(0);
  const child=Object.values(game.individuals)[36];await touch(page.getByRole('button',{name:child.name+' 선택',exact:true}),mobile);await expect(page.locator('.home-name')).toContainText(child.name);
  await page.getByRole('combobox',{name:'모프 필터',exact:true}).selectOption('axanthic');await expect(page.locator('.home-card')).toHaveCount(Object.values(game.individuals).filter(g=>specimen(g).appearance.patternStyle==='axanthic').length);
  expect(await saved(page)).toEqual(game);await page.reload();await expect(page.getByRole('heading',{name:/^보유 개체/})).toContainText('37 / 80');expect(await saved(page)).toEqual(game);expect(errors).toEqual([]);
});

test('scrolling catalog shows actual sprites, names and sell quotes, supports public filters and price sort, and loads every specimen',async({page},info)=>{
  const mobile=info.project.name.startsWith('mobile'),game=manyGame(),animals=Object.values(game.individuals);await page.setViewportSize({width:390,height:844});await restore(page,game,mobile);
  await openCollectionCatalog(page,mobile);const dialog=page.getByRole('dialog',{name:'전체 개체 목록',exact:true});
  await expect(dialog.locator('.collection-list-row')).toHaveCount(24);
  for(const g of animals.slice(0,6)){const row=dialog.getByTestId('collection-list-'+g.id);await expect(row).toContainText(g.name);await expect(row).toContainText('₩'+valueGecko(g).sell.toLocaleString('ko-KR'));expect(await row.locator('canvas').evaluate(el=>{const c=el as HTMLCanvasElement;return !c.getContext('2d')!.imageSmoothingEnabled&&c.getContext('2d')!.getImageData(0,0,c.width,c.height).data.some((v,i)=>i%4===3&&v>0);})).toBe(true);}
  await dialog.locator('.collection-list-scroll').evaluate(el=>{el.scrollTop=el.scrollHeight;});await expect(dialog.locator('.collection-list-row')).toHaveCount(37);expect(await dialog.locator('.collection-list-scroll').evaluate(el=>el.scrollTop)).toBeGreaterThan(0);expect(await page.locator('.reference-content').evaluate(el=>el.scrollTop)).toBe(0);
  await dialog.getByRole('combobox',{name:'목록 정렬',exact:true}).selectOption('priceDesc');
  const sorted=[...animals].sort((a,b)=>valueGecko(b).sell-valueGecko(a).sell);expect(await dialog.locator('.collection-list-row').evaluateAll(nodes=>nodes.slice(0,6).map(n=>n.getAttribute('data-testid')))).toEqual(sorted.slice(0,6).map(g=>'collection-list-'+g.id));
  await dialog.getByRole('combobox',{name:'목록 성별',exact:true}).selectOption('unknown');await expect(dialog.getByRole('status')).toContainText(String(animals.filter(g=>g.stage!=='adult').length)+' / 37');
  for(const row of await dialog.locator('.collection-list-row').all())await expect(row).toContainText('미구분');
  await touch(dialog.getByRole('button',{name:'필터 초기화',exact:true}),mobile);
  await dialog.getByRole('combobox',{name:'목록 모프 필터',exact:true}).selectOption('axanthic');await expect(dialog.locator('.collection-list-row').first()).toContainText('Axanthic');
  await touch(dialog.getByRole('button',{name:'필터 초기화',exact:true}),mobile);await dialog.getByRole('searchbox',{name:'이름·ID 검색',exact:true}).fill(animals[12].id);await expect(dialog.locator('.collection-list-row')).toHaveCount(1);await expect(dialog.locator('.collection-list-row')).toContainText(animals[12].name);
  await dialog.getByRole('searchbox',{name:'이름·ID 검색',exact:true}).fill('존재하지않는개체');await expect(dialog).toContainText('조건에 맞는 개체가 없습니다.');
  await touch(dialog.getByRole('button',{name:'필터 초기화',exact:true}),mobile);
  if(mobile){await page.screenshot({path:'docs/collection-restore/catalog-390.png',scale:'css'});await writeFile('docs/collection-restore/review-save.json',exportBackup(game));}
  await touch(dialog.getByTestId('collection-list-'+animals[0].id),mobile);await expect(page.getByRole('dialog')).toContainText(animals[0].name+' 상세');await expect(page.getByRole('dialog')).toContainText('분양 예상가');await page.keyboard.press('Escape');
  expect(await saved(page)).toEqual(game);await page.reload();await expect(page.getByRole('heading',{name:/^보유 개체/})).toContainText('37 / 80');expect(await saved(page)).toEqual(game);
});

test('selling through existing confirmation updates the restored collection, quote and preserved lineage record',async({page},info)=>{
  const mobile=info.project.name.startsWith('mobile'),game=referenceHomeGame(),g=Object.values(game.individuals)[0];await restore(page,game,mobile);
  await openCollectionCatalog(page,mobile);await page.getByRole('dialog').getByRole('button',{name:g.name+' 상세보기',exact:true}).click();
  const expected=valueGecko(g).sell;await touch(page.getByRole('button',{name:'분양 준비 · ₩'+expected.toLocaleString('ko-KR'),exact:true}),mobile);await touch(page.getByRole('button',{name:'분양 확정',exact:true}),mobile);await page.keyboard.press('Escape');
  await expect(page.locator('.home-card')).toHaveCount(5);const next=await saved(page);expect(next.money).toBe(game.money+expected);expect(next.individuals[g.id].status).toBe('sold');expect(next.individuals[g.id].genetics).toEqual(g.genetics);expect(next.individuals[g.id].parents).toEqual(g.parents);
  await openCollectionCatalog(page,mobile);await expect(page.getByRole('dialog').getByTestId('collection-list-'+g.id)).toHaveCount(0);await page.keyboard.press('Escape');
  await navigateGame(page,'상점',mobile);await navigateGame(page,'컬렉션',mobile);expect(await saved(page)).toEqual(next);
});
