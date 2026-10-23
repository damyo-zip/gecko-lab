import {chooseBreedingParent} from './helpers/hardcore-navigation';
import {test,expect,type Page} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {collectionStatusGame} from './helpers/forge-fixtures';
import {REFERENCE_DATE} from './helpers/forge-fixtures';
import {touch,finishTurn} from './helpers/hardcore-navigation';
import {exportBackup} from '../src/game/hardcore/save';
import {expansionPrice} from '../src/game/hardcore/economy';
import {owned,reserved} from '../src/game/hardcore/survival';
import type {HardcoreGame} from '../src/game/hardcore/model';

async function saved(page:Page):Promise<HardcoreGame>{return page.evaluate(async()=>{
  const db=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open('gecko-lab',1);r.onsuccess=()=>resolve(r.result);});
  return new Promise(resolve=>{const tx=db.transaction('games'),r=tx.objectStore('games').get('active');r.onsuccess=()=>resolve(r.result.save.game);tx.oncomplete=()=>db.close();});
});}
async function restore(page:Page,game:HardcoreGame,mobile:boolean){
  await page.clock.setFixedTime(new Date(REFERENCE_DATE+'T03:00:00Z'));await page.goto('/');await expect(page.getByRole('heading',{name:/^보유 개체/})).toBeVisible();
  await touch(page.getByRole('button',{name:'저장 및 게임 설정',exact:true}),mobile);
  await page.getByLabel('JSON 백업 파일',{exact:true}).setInputFiles({name:'status.json',mimeType:'application/json',buffer:Buffer.from(exportBackup(game))});
  await touch(page.getByRole('button',{name:'복원 실행',exact:true}),mobile);await expect(page.getByRole('dialog')).toHaveCount(0);
}
async function close(page:Page,mobile:boolean){await touch(page.getByRole('dialog').getByRole('button',{name:'상세 창 닫기',exact:true}),mobile);await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.locator('.game-tab-content')).toHaveAttribute('data-view','collection');}
const status=(page:Page,id:string)=>page.getByTestId('collection-status-'+id);
async function tapStatusText(page:Page,id:string,mobile:boolean){
  const text=status(page,id).locator('.home-status-label');await text.scrollIntoViewIfNeeded();const r=(await text.boundingBox())!;
  // Exercise even the right edge of the actual text, beside the card's More button.
  if(mobile)await page.touchscreen.tap(r.x+r.width-2,r.y+r.height/2);else await page.mouse.click(r.x+r.width-2,r.y+r.height/2);
}

test('growth countdown follows two real turns, reload and adulthood with unchanged card frames',async({page},info)=>{
  const mobile=info.project.name.startsWith('mobile'),f=collectionStatusGame(),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await restore(page,f.game,mobile);
  await expect(status(page,f.growing)).toHaveText('성장 중 · 2턴');const before=await page.getByTestId('hc-card-'+f.growing).boundingBox();
  await finishTurn(page,mobile);await expect(status(page,f.growing)).toHaveText('성장 중 · 1턴');await page.reload();await expect(status(page,f.growing)).toHaveText('성장 중 · 1턴');
  await finishTurn(page,mobile);await expect(status(page,f.growing)).toHaveText('브리딩 가능');const after=await page.getByTestId('hc-card-'+f.growing).boundingBox();expect(after!.width).toBe(before!.width);expect(after!.height).toBe(before!.height);
  const next=await saved(page);expect(next.individuals[f.growing].stage).toBe('adult');expect(next.individuals[f.growing].genetics).toEqual(f.game.individuals[f.growing].genetics);expect(next.individuals[f.growing].parents).toEqual(f.game.individuals[f.growing].parents);expect(errors).toEqual([]);
});
test('real post-laying rest counts 2 → 1 → ready and remains correct after reload',async({page},info)=>{
  const mobile=info.project.name.startsWith('mobile'),f=collectionStatusGame();await restore(page,f.game,mobile);
  await expect(status(page,f.mother)).toHaveText('휴식기 · 2턴');await finishTurn(page,mobile);await expect(status(page,f.mother)).toHaveText('휴식기 · 1턴');
  const one=await saved(page);await page.reload();await expect(status(page,f.mother)).toHaveText('휴식기 · 1턴');expect(await saved(page)).toEqual(one);
  await finishTurn(page,mobile);await expect(status(page,f.mother)).toHaveText('브리딩 가능');const next=await saved(page);expect(next.turn).toBe(f.game.turn+2);expect(next.individuals[f.mother].nextBreedTurn).toBe(next.turn);
});
test('space text reuses housing purchase, spends the actual price, refreshes status, and blocks insufficient funds',async({page},info)=>{
  const mobile=info.project.name.startsWith('mobile'),f=collectionStatusGame();f.game.capacity=owned(f.game).length+reserved(f.game)+1;f.game.rules.initialCapacity=f.game.capacity;
  await restore(page,f.game,mobile);await expect(status(page,f.father)).toHaveText('공간 확보 필요');await expect(status(page,f.growing)).toHaveText('성장 중 · 2턴');await expect(status(page,f.mother)).toHaveText('휴식기 · 2턴');
  const selected=await page.locator('.home-name').textContent(),price=expansionPrice(f.game);await tapStatusText(page,f.father,mobile);
  const popup=page.getByRole('dialog',{name:'사육장 구매',exact:true});await expect(popup).toBeVisible();await expect(popup.getByTestId('resource-balance')).toContainText('₩'+f.game.money.toLocaleString('ko-KR'));expect(await saved(page)).toEqual(f.game);
  await touch(popup.getByRole('button',{name:`사육장 +${f.game.rules.expansionSlots}칸 · ₩${price.toLocaleString('ko-KR')}`,exact:true}),mobile);await expect(page.locator('.game-tab-content')).toHaveAttribute('aria-busy','false');
  const next=await saved(page);expect(next.money).toBe(f.game.money-price);expect(next.capacity).toBe(f.game.capacity+f.game.rules.expansionSlots);expect(next.expansions).toBe(f.game.expansions+1);await expect(status(page,f.father)).toHaveText('브리딩 가능');await expect(popup.getByTestId('resource-balance')).toContainText('₩'+next.money.toLocaleString('ko-KR'));
  await close(page,mobile);expect(await page.locator('.home-name').textContent()).toBe(selected);await page.reload();expect(await saved(page)).toEqual(next);await expect(status(page,f.father)).toHaveText('브리딩 가능');
  f.game.money=price-1;await restore(page,f.game,mobile);await tapStatusText(page,f.father,mobile);await expect(page.getByRole('dialog').getByRole('button',{name:/^사육장 \+/})).toBeDisabled();expect(await saved(page)).toEqual(f.game);await close(page,mobile);
});
test('native status buttons preserve layout and selection, preload exact sex/ID, clear the mate, and reuse actual breeding',async({page},info)=>{
  const mobile=info.project.name.startsWith('mobile'),f=collectionStatusGame(),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await restore(page,f.game,mobile);
  const sizes=mobile?[[360,800],[390,844],[430,932]]:[[1280,900]];await mkdir('docs/collection-status',{recursive:true});
  for(const [width,height] of sizes){
    await page.setViewportSize({width,height});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await expect(page.locator('button button')).toHaveCount(0);
    for(const node of await page.locator('.home-card [data-testid^="collection-status-"]').all()){
      const text=node.locator('.home-status-label'),r=(await text.boundingBox())!,card=(await node.locator('xpath=ancestor::article').boundingBox())!;expect(r.x+r.width).toBeLessThanOrEqual(card.x+card.width);expect(r.y+r.height).toBeLessThanOrEqual(card.y+card.height);
      if(await node.evaluate(el=>el.tagName==='BUTTON'))expect((await node.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    if(mobile)await page.screenshot({path:`docs/collection-status/home-${width}.png`,scale:'css'});
  }
  const femaleCard=page.getByTestId('hc-card-'+f.female),maleCard=page.getByTestId('hc-card-'+f.otherMale);
  await touch(femaleCard.locator('.home-card-select>.home-morph'),mobile);await expect(femaleCard.locator('.home-card-select')).toHaveAttribute('aria-pressed','true');await expect(page.getByRole('dialog')).toHaveCount(0);
  await touch(maleCard.locator('.home-card-select>.home-morph'),mobile);await expect(maleCard.locator('.home-card-select')).toHaveAttribute('aria-pressed','true');await expect(page.getByRole('dialog')).toHaveCount(0);
  await touch(maleCard.getByRole('button',{name:'같은 이름 상세보기',exact:true}),mobile);await expect(page.getByRole('dialog')).toContainText('같은 이름 상세');await close(page,mobile);
  await touch(femaleCard.locator('.home-card-select>.home-morph'),mobile);
  const selected=await page.locator('.home-name').textContent();await tapStatusText(page,f.otherMale,mobile);
  await expect(page.getByRole('dialog',{name:'교배',exact:true})).toBeVisible();await expect(page.getByTestId('breed-parent-male')).toHaveAttribute('data-parent-id',f.otherMale);await expect(page.getByTestId('breed-parent-female')).toHaveAttribute('data-parent-id','');expect(await saved(page)).toEqual(f.game);expect(await page.locator('.home-name').textContent()).toBe(selected);
  await chooseBreedingParent(page,'female',f.female);await expect(page.getByTestId('breed-submit')).toBeEnabled();await close(page,mobile);
  await tapStatusText(page,f.female,mobile);await expect(page.getByTestId('breed-parent-female')).toHaveAttribute('data-parent-id',f.female);await expect(page.getByTestId('breed-parent-male')).toHaveAttribute('data-parent-id','');expect(await saved(page)).toEqual(f.game);
  await chooseBreedingParent(page,'male',f.otherMale);
  if(mobile){await page.screenshot({path:'docs/collection-status/breeding-selected.png',scale:'css'});await writeFile('docs/collection-status/review-save.json',exportBackup(f.game));}
  await touch(page.getByTestId('breed-submit'),mobile);await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.locator('.game-tab-content')).toHaveAttribute('data-view','incubator');
  const next=await saved(page),newMating=Object.values(next.matings).find(m=>!f.game.matings[m.id])!;expect(newMating.parents).toEqual({fatherId:f.otherMale,motherId:f.female});expect(newMating.lifecycle!.offspring).toHaveLength(2);expect(reserved(next)).toBe(reserved(f.game)+2);expect(errors).toEqual([]);
});
