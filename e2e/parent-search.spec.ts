import {test,expect,type Page} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {collectionStatusGame} from './fixtures/collection-status';
import {breedingRiskFixture} from './fixtures/breeding-risk';
import {touch,navigateGame,chooseBreedingParent,closeBreeding,finishTurn} from './helpers/hardcore-navigation';
import {exportBackup} from '../src/game/hardcore/save';
import type {HardcoreGame} from '../src/game/hardcore/model';
const DATE='2026-10-14';
const picker=(page:Page,sex:'male'|'female')=>page.getByRole('dialog',{name:sex==='male'?'수컷 개체 선택':'암컷 개체 선택',exact:true});
async function open(page:Page,sex:'male'|'female',mobile:boolean){await touch(page.getByRole('button',{name:sex==='male'?'수컷 개체 변경':'암컷 개체 변경',exact:true}),mobile);await expect(picker(page,sex)).toBeVisible();}
async function saved(page:Page):Promise<HardcoreGame>{return page.evaluate(async()=>{const db=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open('gecko-lab',1);r.onsuccess=()=>resolve(r.result);});return new Promise(resolve=>{const tx=db.transaction('games','readonly'),r=tx.objectStore('games').get('active');r.onsuccess=()=>resolve(r.result.save.game);tx.oncomplete=()=>db.close();});});}
async function restore(page:Page,game:HardcoreGame,mobile:boolean){
  await page.clock.setFixedTime(new Date(DATE+'T03:00:00Z'));await page.goto('/');await expect(page.getByRole('heading',{name:/^보유 개체/})).toBeVisible();
  await touch(page.getByRole('button',{name:'저장 및 게임 설정',exact:true}),mobile);await page.getByLabel('JSON 백업 파일',{exact:true}).setInputFiles({name:'parent-search.json',mimeType:'application/json',buffer:Buffer.from(exportBackup(game))});await touch(page.getByRole('button',{name:'복원 실행',exact:true}),mobile);await navigateGame(page,'교배',mobile);
}
test('stacked mobile picker keeps opposite/previous selections, filters adult sex, and shows unsexed growing animals in both lists',async({page},info)=>{
  const mobile=info.project.name.startsWith('mobile'),f=collectionStatusGame(),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await restore(page,f.game,mobile);
  await chooseBreedingParent(page,'male',f.father,mobile);await chooseBreedingParent(page,'female',f.female,mobile);const before=await saved(page);
  await open(page,'male',mobile);const d=picker(page,'male');await expect(page.locator('dialog[open]')).toHaveCount(2);await expect(d.getByTestId('parent-candidate-'+f.father)).toContainText('선택됨');await expect(d.getByTestId('parent-candidate-'+f.female)).toHaveCount(0);
  const growing=d.getByTestId('parent-candidate-'+f.growing);await expect(growing).toContainText('성별 미구분');await expect(growing).toContainText('성장 중 · 2턴');await expect(growing.getByRole('button',{name:'성체 후 선택 가능',exact:true})).toBeDisabled();
  if(mobile)await mkdir('docs/parent-search',{recursive:true});
  for(const [width,height] of mobile?[[360,800],[390,844],[430,932]]:[[1280,900]]){
    await page.setViewportSize({width,height});expect(await d.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    const box=(await d.boundingBox())!,results=(await d.locator('.parent-search-results').boundingBox())!;expect(box.y).toBeGreaterThanOrEqual(0);expect(box.y+box.height).toBeLessThanOrEqual(height);expect(results.height).toBeGreaterThan(160);
    expect((await d.getByRole('button',{name:'취소',exact:true}).boundingBox())!.height).toBeGreaterThanOrEqual(44);expect(await d.locator('canvas').first().evaluate(el=>!(el as HTMLCanvasElement).getContext('2d')!.imageSmoothingEnabled)).toBe(true);
    if(mobile)await page.screenshot({path:`docs/parent-search/male-${width}.png`,scale:'css'});
  }
  await d.getByRole('searchbox',{name:'개체 이름·번호·모프 검색',exact:true}).fill(f.otherMale);await touch(d.getByRole('button',{name:'취소',exact:true}),mobile);await expect(page.getByTestId('breed-parent-male')).toHaveAttribute('data-parent-id',f.father);await expect(page.getByTestId('breed-parent-female')).toHaveAttribute('data-parent-id',f.female);
  await chooseBreedingParent(page,'male',f.otherMale,mobile);await expect(page.getByTestId('breed-parent-female')).toHaveAttribute('data-parent-id',f.female);
  await open(page,'female',mobile);await expect(picker(page,'female').getByTestId('parent-candidate-'+f.growing)).toContainText('성별 미구분');await expect(picker(page,'female').getByTestId('parent-candidate-'+f.otherMale)).toHaveCount(0);
  await page.keyboard.press('Escape');await expect(picker(page,'female')).toHaveCount(0);await expect(page.getByRole('dialog',{name:'교배',exact:true})).toBeVisible();expect(await saved(page)).toEqual(before);await closeBreeding(page,mobile);expect(errors).toEqual([]);
});
test('combined name/ID/morph, growth/rest/generation and relationship conditions reset cleanly, and remaining turns restore',async({page},info)=>{
  const mobile=info.project.name.startsWith('mobile'),f=collectionStatusGame();await restore(page,f.game,mobile);await chooseBreedingParent(page,'male',f.father,mobile);await open(page,'female',mobile);const d=picker(page,'female');
  await d.getByLabel('교배 상태 필터',{exact:true}).selectOption('rest');await expect(d.locator('.parent-search-card')).toHaveCount(1);await expect(d.getByTestId('parent-candidate-'+f.mother)).toContainText('휴식기 · 2턴');
  await touch(d.locator('summary'),mobile);await d.getByLabel('성장 단계 필터',{exact:true}).selectOption('adult');await d.getByLabel('세대 필터',{exact:true}).selectOption(String(f.game.individuals[f.mother].generation));await d.getByLabel('모프 필터',{exact:true}).selectOption('lilly');await d.getByLabel('혈통 관계 필터',{exact:true}).selectOption('unknown');await d.getByRole('searchbox').fill(f.mother);await expect(d.locator('.parent-search-card')).toHaveCount(1);
  await d.getByRole('searchbox').fill('없는 개체');await expect(d.getByText('조건에 맞는 개체가 없습니다.',{exact:true})).toBeVisible();await touch(d.getByRole('button',{name:'필터 초기화',exact:true}),mobile);await expect(d.getByRole('searchbox')).toHaveValue('');await expect(d.locator('.parent-search-card')).toHaveCount(4);
  await d.getByLabel('성장 단계 필터',{exact:true}).selectOption('growing');await expect(d.locator('.parent-search-card')).toHaveCount(1);await expect(d.getByTestId('parent-candidate-'+f.growing)).toBeVisible();
  await closeBreeding(page,mobile);await finishTurn(page,mobile);await page.reload();await expect(page.getByTestId('game-day')).toHaveText(String(f.game.turn+1));await navigateGame(page,'교배',mobile);await open(page,'female',mobile);await picker(page,'female').getByLabel('교배 상태 필터',{exact:true}).selectOption('rest');await expect(picker(page,'female').getByTestId('parent-candidate-'+f.mother)).toContainText('휴식기 · 1턴');
});
test('real sibling and parent relationships update with the opponent, never restrict choice, and retain execution-time warnings',async({page},info)=>{
  const mobile=info.project.name.startsWith('mobile'),f=breedingRiskFixture();await restore(page,f.game,mobile);await chooseBreedingParent(page,'female',f.motherId,mobile);await open(page,'male',mobile);const d=picker(page,'male');
  const brother=d.getByTestId('parent-candidate-'+f.fatherId),father=d.getByTestId('parent-candidate-'+f.normalId);await expect(brother.locator('.parent-relation')).toHaveText('친형제자매');await expect(father.locator('.parent-relation')).toHaveText('부모 ↔ 자식');await expect(brother.getByRole('button',{name:'이 개체 선택',exact:true})).toBeEnabled();
  await touch(d.locator('summary'),mobile);await d.getByLabel('혈통 관계 필터',{exact:true}).selectOption('close');await d.getByLabel('개체 정렬',{exact:true}).selectOption('distant');await expect(brother).toBeVisible();
  if(mobile){await mkdir('docs/parent-search',{recursive:true});await page.setViewportSize({width:390,height:844});await page.screenshot({path:'docs/parent-search/relationships-390.png',scale:'css'});await writeFile('docs/parent-search/review-save.json',exportBackup(f.game));}
  await touch(brother.getByRole('button',{name:'이 개체 선택',exact:true}),mobile);const before=await saved(page);await touch(page.getByTestId('breed-submit'),mobile);const warning=page.getByRole('dialog',{name:'교배 전 위험 확인',exact:true});await expect(warning).toContainText('친형제자매');await expect(warning).toContainText('위험 유전자 조합');await touch(warning.getByRole('button',{name:'취소',exact:true}),mobile);expect(await saved(page)).toEqual(before);
  await chooseBreedingParent(page,'female',f.lillyFemaleId,mobile);await open(page,'male',mobile);await expect(picker(page,'male').getByTestId('parent-candidate-'+f.fatherId).locator('.parent-relation')).toHaveText('부모 ↔ 자식');await touch(picker(page,'male').getByRole('button',{name:'취소',exact:true}),mobile);await expect(page.getByTestId('breed-parent-male')).toHaveAttribute('data-parent-id',f.fatherId);
});
