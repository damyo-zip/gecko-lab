import {test,expect,type Page} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {BREEDING_CHALLENGES} from '../src/game/hardcore/challenge-rules';
import {currentChallengeClutch,currentBreederRankGames} from '../tests/helpers/current-challenge-game';
import {challengeClutch,challengeTurn} from '../tests/helpers/challenge-game';
import {emptyChallenges} from '../src/game/hardcore/challenges';
import {act} from '../src/game/hardcore/play';
import {actWithTime} from '../src/game/hardcore/time-source';
import {exportBackup,makeSave} from '../src/game/hardcore/save';
import {touch,navigateGame} from './helpers/hardcore-navigation';
import {withoutForge} from './helpers/forge-fixtures';
import type {HardcoreGame} from '../src/game/hardcore/model';

test.setTimeout(120_000);
const DATE='2026-10-16';
async function saved(page:Page){return page.evaluate(async()=>{
 const db=await new Promise<IDBDatabase>(r=>{const q=indexedDB.open('gecko-lab',1);q.onsuccess=()=>r(q.result);});
 return new Promise<{save:{game:HardcoreGame};writeRevision:number}>(r=>{const tx=db.transaction('games'),q=tx.objectStore('games').get('active');q.onsuccess=()=>r(q.result);tx.oncomplete=()=>db.close();});
});}
async function restore(page:Page,g:HardcoreGame,mobile:boolean){
 await touch(page.getByRole('button',{name:'저장 및 게임 설정',exact:true}),mobile);
 await page.getByLabel('JSON 백업 파일',{exact:true}).setInputFiles({name:'eight-goals.json',mimeType:'application/json',buffer:Buffer.from(exportBackup(g))});
 await touch(page.getByRole('button',{name:'복원 실행',exact:true}),mobile);await expect(page.getByRole('dialog')).toHaveCount(0);
}
async function goals(page:Page,mobile:boolean){await navigateGame(page,'혈통도',mobile);await touch(page.getByRole('button',{name:'전체 도전 목표 보기',exact:true}),mobile);return page.getByRole('dialog',{name:'전체 도전 목표',exact:true});}
test.beforeEach(async({page})=>{await page.clock.setFixedTime(new Date(DATE+'T03:00:00Z'));await page.goto('/');await expect(page.getByTestId('breeder-rank')).toBeVisible();});

test('eight exact criteria and real acceptance/rejection examples remain readable at 360/390/430px without changing the save',async({page},info)=>{
 const mobile=info.project.name.startsWith('mobile'),before=await saved(page),dialog=await goals(page,mobile);
 for(const c of BREEDING_CHALLENGES){
  const goal=dialog.locator('.challenge-goal').filter({has:page.getByRole('heading',{name:c.name,exact:true})});
  await touch(goal.locator('.challenge-criteria summary'),mobile);await expect(goal.locator('.challenge-criteria li')).not.toHaveCount(0);
  await touch(goal.getByRole('button',{name:'인정·불인정 예시 보기',exact:true}),mobile);
  await expect(goal.locator('.challenge-examples canvas')).toHaveCount(4);await expect(goal.locator('[data-accepted=true]')).toHaveCount(2);await expect(goal.locator('[data-accepted=false]')).toHaveCount(2);
  for(const w of [360,390,430]){await page.setViewportSize({width:w,height:844});expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
  if(c.id==='lilly-dalmatian'){
   await expect(goal.locator('.challenge-criteria')).toContainText('베일 발현 · 90% 이상');await expect(goal.locator('.challenge-criteria')).toContainText('선명한 검은 점 · 40 이상');
   if(mobile){await page.setViewportSize({width:390,height:844});await goal.locator('.challenge-examples').scrollIntoViewIfNeeded();await mkdir('docs/eight-challenges',{recursive:true});await page.screenshot({path:'docs/eight-challenges/examples-390.png',scale:'css'});}
  }
  await touch(goal.locator('.challenge-criteria summary'),mobile);
 }
 expect(await saved(page)).toEqual(before);
});

test('failed reward save rolls back hatch, money, food and trophy together; rapid retry and a stale tab cannot double pay',async({page,context},info)=>{
 const mobile=info.project.name.startsWith('mobile');let {game}=currentChallengeClutch('lilly-dalmatian');game=act(game,{type:'selectChallenge',challengeId:'lilly-dalmatian'},game.lastDate);for(let n=0;n<3;n++)game=challengeTurn(game);
 await restore(page,game,mobile);const other=await context.newPage();await other.clock.setFixedTime(new Date(DATE+'T03:00:00Z'));await other.goto('/');await expect(other.getByTestId('game-day')).toHaveText('5');const before=await saved(page);
 await page.evaluate(()=>{const original=IDBObjectStore.prototype.put;(window as any).__challengePut=original;IDBObjectStore.prototype.put=function(value:any,key?:IDBValidKey){if(key==='active')throw new DOMException('도전 저장 실패 테스트','QuotaExceededError');return original.call(this,value,key);};});
 await touch(page.getByRole('button',{name:'턴 넘기기',exact:true}),mobile);await expect(page.locator('.game-error-banner')).toContainText('도전 저장 실패');expect(await saved(page)).toEqual(before);await expect(page.getByRole('dialog',{name:'브리딩 도전 성공!',exact:true})).toHaveCount(0);await expect(page.getByTestId('game-day')).toHaveText('5');
 await page.evaluate(()=>{IDBObjectStore.prototype.put=(window as any).__challengePut;delete (window as any).__challengePut;});
 await expect(page.getByRole('button',{name:'턴 넘기기',exact:true})).toBeEnabled();
 await page.getByRole('button',{name:'턴 넘기기',exact:true}).evaluate(el=>{(el as HTMLButtonElement).click();(el as HTMLButtonElement).click();});
 const success=page.getByRole('dialog',{name:'브리딩 도전 성공!',exact:true});await expect(success).toContainText('지원금 150,000원 · 사료 30개 지급 완료');const after=await saved(page);
 expect(after.writeRevision).toBe(before.writeRevision+1);const expected=actWithTime(before.save.game,{type:'endTurn'},DATE),comparison=structuredClone(after.save.game);
 // Node and Chromium Math.exp can differ by a final binary digit on newly
 // generated shop potentials. Check those derived floats at 12 decimals and
 // keep exact equality for the whole save, genomes, prices and rewards.
 for(const [id,offer]of Object.entries(comparison.shop.offers)){
  const other=expected.shop.offers[id];
  for(const [actual,wanted]of [[offer.individual,other.individual],[offer.family!.father,other.family!.father],[offer.family!.mother,other.family!.mother]]){
   for(const key of Object.keys(wanted.potential) as (keyof typeof wanted.potential)[])expect(actual.potential[key]).toBeCloseTo(wanted.potential[key],12);
   actual.potential=structuredClone(wanted.potential);
  }
 }
 expect(comparison).toEqual(expected);expect(after.save.game.money).toBe(game.money+150_000);expect(after.save.game.food).toBe(game.food-2+30);expect(after.save.game.breedingChallenges!.completed).toHaveLength(1);
 await touch(other.getByRole('button',{name:'턴 넘기기',exact:true}),mobile);await expect(other.locator('.game-error-banner')).toContainText('다른');expect(await saved(other)).toEqual(after);
 await page.reload();await expect(success).toBeVisible();expect(await saved(page)).toEqual(after);await other.close();
});

test('eight-goal completion and trophy representative persist through IndexedDB reload with no extra grant',async({page},info)=>{
 const mobile=info.project.name.startsWith('mobile'),g=currentBreederRankGames()[8];await restore(page,g,mobile);await expect(page.getByTestId('breeder-rank')).toHaveText('전설의 브리더');await expect(page.getByTestId('breeder-rank')).toHaveClass(/is-legendary/);
 let dialog=await goals(page,mobile);await expect(dialog).toContainText('8개 완주!');await expect(dialog).toContainText('매 턴 최대 4마리 먹이 면제');await expect(dialog).toContainText('300,000원 · 획득 완료');
 const c=g.breedingChallenges!.completed.find(c=>c.trophyEggIds!.length>1)!,target=BREEDING_CHALLENGES.find(x=>x.id===c.challengeId)!,goal=dialog.locator('.challenge-goal').filter({has:page.getByRole('heading',{name:target.name,exact:true})}),eggId=c.trophyEggIds!.at(-1)!;
 const before=await saved(page);await goal.getByRole('combobox').selectOption(eggId);await expect.poll(async()=>(await saved(page)).save.game.breedingChallenges!.completed.find(x=>x.challengeId===c.challengeId)!.representativeEggId).toBe(eggId);
 const after=await saved(page);expect(after.save.game.money).toBe(before.save.game.money);expect(after.save.game.food).toBe(before.save.game.food);expect(after.save.game.turn).toBe(before.save.game.turn);
 await touch(goal.getByRole('button',{name:'대표 개체 확대 관찰',exact:true}),mobile);await expect(page.locator('.observation-dialog')).toBeVisible();await page.locator('.observation-dialog').getByRole('button',{name:'상세 창 닫기',exact:true}).click();await expect(dialog).toBeVisible();
 await page.reload();await expect(page.getByTestId('breeder-rank')).toHaveText('전설의 브리더');expect(await saved(page)).toEqual(after);dialog=await goals(page,mobile);await expect(dialog.getByRole('combobox',{name:target.target+' 트로피 대표',exact:true})).toHaveValue(eggId);
});

test('loading an old active slot archives and clears only old challenges, preserving all other gameplay records',async({page},info)=>{
 let {game}=challengeClutch('sun');game=act(game,{type:'selectChallenge',challengeId:'sun'},game.lastDate);for(let n=0;n<4;n++)game=challengeTurn(game);const envelope=makeSave(game);
 await page.evaluate(async save=>{
  const db=await new Promise<IDBDatabase>(r=>{const q=indexedDB.open('gecko-lab',1);q.onsuccess=()=>r(q.result);});await new Promise<void>(r=>{const tx=db.transaction('games','readwrite');tx.objectStore('games').put({save,writeRevision:50},'active');tx.oncomplete=()=>{db.close();r();};});
 },envelope);
 await page.reload();await expect(page.getByTestId('game-day')).toHaveText('6');const next=await saved(page),expected=structuredClone(game);expected.breedingChallenges=emptyChallenges(2,game.turn);expected.revision++;
 expect(withoutForge(next.save.game)).toEqual(expected);expect(next.writeRevision).toBe(51);
 const archived=await page.evaluate(async()=>{const db=await new Promise<IDBDatabase>(r=>{const q=indexedDB.open('gecko-lab',1);q.onsuccess=()=>r(q.result);});return new Promise<any>(r=>{const tx=db.transaction('games'),q=tx.objectStore('games').get('archive-v10-51');q.onsuccess=()=>r(q.result);tx.oncomplete=()=>db.close();});});expect(archived.save).toEqual(envelope);await expect(page.getByTestId('breeder-rank')).toHaveText('견습 브리더');
});

test('the default goal is selected without a lock and a manual replacement can change again after exactly five turns',async({page},info)=>{
 const mobile=info.project.name.startsWith('mobile'),initial=await saved(page);expect(initial.save.game.breedingChallenges).toMatchObject({activeId:'lilly-dalmatian',unlockTurn:0,initialSelection:true});
 let dialog=await goals(page,mobile);const halloween=dialog.locator('.challenge-goal').filter({has:page.getByRole('heading',{name:'할로윈의 밤',exact:true})});await touch(halloween.getByRole('button',{name:'이 목표 선택',exact:true}),mobile);await expect.poll(async()=>(await saved(page)).save.game.breedingChallenges!.unlockTurn).toBe(5);await page.keyboard.press('Escape');
 for(let n=0;n<4;n++){await touch(page.getByRole('button',{name:'턴 넘기기',exact:true}),mobile);await expect(page.getByTestId('game-day')).toHaveText(String(n+1));}
 dialog=await goals(page,mobile);await expect(dialog.getByRole('button',{name:'잠금 · 1턴',exact:true})).toHaveCount(7);await page.keyboard.press('Escape');await touch(page.getByRole('button',{name:'턴 넘기기',exact:true}),mobile);await expect(page.getByTestId('game-day')).toHaveText('5');
 dialog=await goals(page,mobile);await touch(dialog.locator('.challenge-goal').filter({has:page.getByRole('heading',{name:'황금의 호랑이',exact:true})}).getByRole('button',{name:'이 목표 선택',exact:true}),mobile);await expect.poll(async()=>(await saved(page)).save.game.breedingChallenges!.unlockTurn).toBe(10);await page.reload();await expect(page.getByTestId('game-day')).toHaveText('5');expect((await saved(page)).save.game.breedingChallenges).toMatchObject({activeId:'gold-tiger',unlockTurn:10,initialSelection:false});
});
