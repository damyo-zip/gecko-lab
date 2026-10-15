import {test,expect,type Page,type Locator} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {growthScaleGame} from './fixtures/growth-scale';
import {touch,navigateGame,finishTurn,openCollectionCatalog,chooseBreedingParent} from './helpers/hardcore-navigation';
import {exportBackup} from '../src/game/hardcore/save';
import {actWithTime} from '../src/game/hardcore/time-source';
import {specimen} from '../src/game/hardcore/adapter';
import {renderSprite} from '../src/engine/render';
import type {HardcoreGame} from '../src/game/hardcore/model';

const SCALES={hatchling:.5,juvenile:.75,adult:1},DATE='2026-10-15';
async function saved(page:Page){return page.evaluate(async()=>{
  const db=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open('gecko-lab',1);r.onsuccess=()=>resolve(r.result);});
  return new Promise<HardcoreGame>(resolve=>{const tx=db.transaction('games'),r=tx.objectStore('games').get('active');r.onsuccess=()=>resolve(r.result.save.game);tx.oncomplete=()=>db.close();});
});}
async function boot(page:Page,game:HardcoreGame,mobile:boolean){
  await page.clock.setFixedTime(new Date(DATE+'T03:00:00Z'));await page.goto('/');
  await touch(page.getByRole('button',{name:'저장 및 게임 설정',exact:true}),mobile);
  await page.getByLabel('JSON 백업 파일',{exact:true}).setInputFiles({name:'growth.json',mimeType:'application/json',buffer:Buffer.from(exportBackup(game))});
  await touch(page.getByRole('button',{name:'복원 실행',exact:true}),mobile);await expect(page.getByRole('dialog')).toHaveCount(0);
}
async function close(page:Page,mobile:boolean){await touch(page.getByRole('dialog').last().getByRole('button',{name:'상세 창 닫기',exact:true}),mobile);}
/** Measure the actual painted rectangle against its existing full-size box.
 * Temporarily changing only the CSS scale also detects translation/flip drift. */
async function checkSprites(root:Locator){
  const rows=await root.locator('canvas[data-growth-stage]').evaluateAll(nodes=>nodes.map(node=>{
    const c=node as HTMLCanvasElement,stage=c.dataset.growthStage!,small=c.getBoundingClientRect(),parent=c.parentElement!.getBoundingClientRect(),css=getComputedStyle(c);
    const previous=c.style.getPropertyValue('--growth-scale');c.style.setProperty('--growth-scale','1');const full=c.getBoundingClientRect();c.style.setProperty('--growth-scale',previous);
    return {stage,ratioX:small.width/full.width,ratioY:small.height/full.height,centerX:(small.x+small.width/2)-(full.x+full.width/2),centerY:(small.y+small.height/2)-(full.y+full.height/2),layoutStable:JSON.stringify(parent.toJSON())===JSON.stringify(c.parentElement!.getBoundingClientRect().toJSON()),transition:css.transitionDuration,smoothing:c.getContext('2d')!.imageSmoothingEnabled};
  }));
  expect(rows.length).toBeGreaterThan(0);
  for(const row of rows){expect(row.ratioX).toBeCloseTo(SCALES[row.stage as keyof typeof SCALES],4);expect(row.ratioY).toBeCloseTo(row.ratioX,4);expect(Math.abs(row.centerX)).toBeLessThan(.05);expect(Math.abs(row.centerY)).toBeLessThan(.05);expect(row.layoutStable).toBe(true);expect(row.transition).toBe('0s');expect(row.smoothing).toBe(false);}
  return rows;
}
async function centered(canvas:Locator){
  const a=(await canvas.boundingBox())!,b=(await canvas.locator('..').boundingBox())!;
  expect(Math.abs(a.x+a.width/2-b.x-b.width/2)).toBeLessThan(1);expect(Math.abs(a.y+a.height/2-b.y-b.height/2)).toBeLessThan(1);
}
function hash(pixels:ArrayLike<number>){let value=2166136261;for(let i=0;i<pixels.length;i++)value=Math.imul(value^pixels[i],16777619);return value>>>0;}

test('collection, catalog and detail scale the same bitmap while preserving frames, centered art and saved records',async({page},info)=>{
  const mobile=info.project.name.startsWith('mobile'),f=growthScaleGame(),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await boot(page,f.game,mobile);
  const initial=await saved(page);
  for(const [width,height] of mobile?[[360,800],[390,844],[430,932]]:[[1280,900]]){
    await page.setViewportSize({width,height});const rows=await checkSprites(page.locator('.home-collection'));
    expect(new Set(rows.map(r=>r.stage))).toEqual(new Set(['hatchling','juvenile','adult']));
    for(const id of [f.hatchlingId,f.juvenileId])await centered(page.getByTestId('hc-card-'+id).locator('canvas'));
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
  for(const id of [f.hatchlingId,f.juvenileId,f.adultId]){
    const card=page.getByTestId('hc-card-'+id),g=f.game.individuals[id],before=await card.boundingBox();
    await touch(card.locator('.home-card-select'),mobile);await expect(page.getByTestId('home-hero-sprite')).toHaveAttribute('data-growth-stage',g.stage);
    const after=await card.boundingBox();expect(after!.width).toBe(before!.width);expect(after!.height).toBe(before!.height);await checkSprites(page.locator('.home-hero-art'));
    const actual=await card.locator('canvas').evaluate(node=>{const c=node as HTMLCanvasElement,ctx=c.getContext('2d')!,data=ctx.getImageData(0,0,c.width,c.height).data,factor=c.width/96;let value=2166136261;for(let y=0;y<96;y++)for(let x=0;x<96;x++)for(let n=0;n<4;n++)value=Math.imul(value^data[((y*factor)*c.width+x*factor)*4+n],16777619);return {hash:value>>>0,width:c.width,height:c.height};});
    expect(actual).toEqual({hash:hash(renderSprite(specimen(g)).pixels),width:288,height:288});
    await touch(card.locator('.home-card-more'),mobile);await checkSprites(page.getByRole('dialog'));await close(page,mobile);
  }
  await openCollectionCatalog(page,mobile);await checkSprites(page.getByRole('dialog'));await close(page,mobile);
  expect(await saved(page)).toEqual(initial);expect(errors).toEqual([]);
  if(mobile){await page.setViewportSize({width:390,height:844});await mkdir('docs/growth-scale',{recursive:true});await page.screenshot({path:'docs/growth-scale/collection-390.png',scale:'css'});}
});

test('breeding/picker, shop/family, lineage and hatch results share scaling and retain placement/flip and game data',async({page},info)=>{
  const mobile=info.project.name.startsWith('mobile'),f=growthScaleGame();await boot(page,f.game,mobile);const initial=await saved(page);
  await navigateGame(page,'교배',mobile);await chooseBreedingParent(page,'male',f.adultId,mobile);await chooseBreedingParent(page,'female',f.motherId,mobile);
  await checkSprites(page.getByRole('dialog',{name:'교배',exact:true}));
  const male=page.getByTestId('breed-parent-male').locator('canvas');expect(await male.evaluate(n=>new DOMMatrix(getComputedStyle(n).transform).a)).toBe(-1);
  await touch(page.getByRole('button',{name:'수컷 개체 변경',exact:true}),mobile);const picker=page.getByRole('dialog',{name:'수컷 개체 선택',exact:true});
  const candidates=await checkSprites(picker);expect(new Set(candidates.map(r=>r.stage))).toEqual(new Set(['hatchling','juvenile','adult']));await close(page,mobile);await close(page,mobile);
  await navigateGame(page,'상점',mobile);await checkSprites(page.locator('.shop-reference'));
  await touch(page.locator('.shop-parents').first(),mobile);await checkSprites(page.getByRole('dialog'));await close(page,mobile);
  await navigateGame(page,'혈통도',mobile);await page.getByLabel('혈통을 볼 개체',{exact:true}).selectOption(f.hatchlingId);await checkSprites(page.locator('.album-reference'));await centered(page.locator('.album-selected-art canvas'));
  if(mobile){await mkdir('docs/growth-scale',{recursive:true});await page.screenshot({path:'docs/growth-scale/lineage-360.png',scale:'css'});}
  await navigateGame(page,'인큐베이터',mobile);const hatches=await checkSprites(page.locator('.inc-results'));expect(hatches.some(r=>r.stage==='hatchling')).toBe(true);expect(hatches.some(r=>r.stage==='juvenile')).toBe(true);
  expect(await saved(page)).toEqual(initial);await page.reload();expect(await saved(page)).toEqual(initial);
});

test('existing six/twelve-turn boundaries instantly update scale, keep card geometry and restore the exact game',async({page},info)=>{
  const mobile=info.project.name.startsWith('mobile'),f=growthScaleGame();await boot(page,f.game,mobile);
  const young=page.getByTestId('hc-card-'+f.hatchlingId),older=page.getByTestId('hc-card-'+f.juvenileId);
  const before=await young.boundingBox();let expected=f.game;
  await expect(young.locator('canvas')).toHaveAttribute('data-growth-stage','hatchling');await expect(older.locator('canvas')).toHaveAttribute('data-growth-stage','juvenile');
  for(let t=1;t<=12;t++){
    await finishTurn(page,mobile);expected=actWithTime(expected,{type:'endTurn'},DATE);
    await expect(young.locator('canvas')).toHaveAttribute('data-growth-stage',t<6?'hatchling':t<12?'juvenile':'adult');
    await expect(older.locator('canvas')).toHaveAttribute('data-growth-stage',t<6?'juvenile':'adult');
    const box=await young.boundingBox();expect(box!.width).toBe(before!.width);expect(box!.height).toBe(before!.height);
  }
  await checkSprites(page.locator('.home-collection'));const final=await saved(page);
  // Node and Chromium's Math.exp can differ by one ULP in newly rolled shop
  // scores. Compare those at 12 decimals; all existing individual data is exact.
  const comparable=(game:HardcoreGame)=>JSON.parse(JSON.stringify(game,(_key,value)=>typeof value==='number'&&!Number.isInteger(value)?Number(value.toFixed(12)):value));
  expect(comparable(final)).toEqual(comparable(expected));expect(final.individuals).toEqual(expected.individuals);
  for(const id of [f.hatchlingId,f.juvenileId]){expect(final.individuals[id].genetics).toEqual(f.game.individuals[id].genetics);expect(final.individuals[id].visualSeed).toBe(f.game.individuals[id].visualSeed);}
  await page.reload();await expect(young.locator('canvas')).toHaveAttribute('data-growth-stage','adult');expect(await saved(page)).toEqual(final);
  await writeFile(info.outputPath('growth-save.json'),exportBackup(final));
});
