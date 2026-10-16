import {test,expect,type Page} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {newGame} from '../src/game/hardcore/play';
import {exportBackup} from '../src/game/hardcore/save';
import {challengeClutch,challengeTurn} from '../tests/helpers/challenge-game';
import type {HardcoreGame} from '../src/game/hardcore/model';
import {navigateGame,touch} from './helpers/hardcore-navigation';
const DATE='2026-10-16';
async function saved(page:Page):Promise<HardcoreGame>{return page.evaluate(async()=>{
 const db=await new Promise<IDBDatabase>(r=>{const q=indexedDB.open('gecko-lab',1);q.onsuccess=()=>r(q.result);});
 return new Promise(r=>{const tx=db.transaction('games','readonly'),q=tx.objectStore('games').get('active');q.onsuccess=()=>r(q.result.save.game);tx.oncomplete=()=>db.close();});
});}
async function restore(page:Page,g:HardcoreGame,mobile:boolean){
 await touch(page.getByRole('button',{name:'저장 및 게임 설정',exact:true}),mobile);
 await page.getByLabel('JSON 백업 파일',{exact:true}).setInputFiles({name:'challenge.json',mimeType:'application/json',buffer:Buffer.from(exportBackup(g))});
 await touch(page.getByRole('button',{name:'복원 실행',exact:true}),mobile);await expect(page.getByRole('dialog')).toHaveCount(0);await navigateGame(page,'혈통도',mobile);
}
async function turn(page:Page,mobile:boolean){const n=(await saved(page)).turn;await touch(page.getByRole('button',{name:'턴 넘기기',exact:true}),mobile);await expect(page.getByTestId('game-day')).toHaveText(String(n+1));await expect.poll(async()=>(await saved(page)).turn).toBe(n+1);}
async function goals(page:Page,mobile:boolean){await touch(page.getByRole('button',{name:'전체 도전 목표 보기',exact:true}),mobile);return page.getByRole('dialog',{name:'전체 도전 목표',exact:true});}
const errors=new WeakMap<Page,string[]>();
test.beforeEach(async({page})=>{const e:string[]=[];errors.set(page,e);page.on('pageerror',err=>e.push(err.message));await page.clock.setFixedTime(new Date(DATE+'T03:00:00Z'));await page.goto('/');await expect(page.getByRole('heading',{name:/보유 개체/})).toBeVisible();});
test.afterEach(async({page})=>expect(errors.get(page)).toEqual([]));

test('all five public goals, exact lock expiry, unchanged target after expiry and persistent selection',async({page},info)=>{
 const mobile=info.project.name.startsWith('mobile');await restore(page,newGame('challenge-browser-lock',DATE),mobile);
 await expect(page.locator('.album-toolbar,.album-favorites')).toHaveCount(0);await expect(page.locator('.breeding-challenge-panel')).toContainText('완료 0/5');
 let dialog=await goals(page,mobile);await expect(dialog.locator('.challenge-goal')).toHaveCount(5);
 const black=dialog.locator('.challenge-goal').filter({has:page.getByRole('heading',{name:'칠흑의 완성',exact:true})});await touch(black.getByRole('button',{name:'이 목표 선택',exact:true}),mobile);
 await expect(black.getByRole('button')).toHaveText('현재 선택한 목표');await expect(dialog.getByRole('button',{name:'잠금 · 10턴',exact:true})).toHaveCount(4);
 await page.keyboard.press('Escape');await expect(page.locator('.breeding-challenge-panel')).toContainText('목표 변경까지 10턴');
 for(let n=0;n<9;n++)await turn(page,mobile);await expect(page.locator('.breeding-challenge-panel')).toContainText('목표 변경까지 1턴');
 await page.reload();await expect(page.getByTestId('game-day')).toHaveText('9');await navigateGame(page,'혈통도',mobile);await expect(page.locator('.breeding-challenge-panel')).toContainText('목표 변경까지 1턴');
 await turn(page,mobile);await expect(page.locator('.breeding-challenge-panel')).toContainText('칠흑의 완성');await expect(page.locator('.breeding-challenge-panel')).toContainText('변경 가능');
 dialog=await goals(page,mobile);await touch(dialog.locator('.challenge-goal').filter({has:page.getByRole('heading',{name:'타오르는 태양',exact:true})}).getByRole('button'),mobile);
 await expect.poll(async()=>(await saved(page)).breedingChallenges?.unlockTurn).toBe(20);await page.keyboard.press('Escape');
 if(mobile){await mkdir('docs/breeding-challenges',{recursive:true});await page.screenshot({path:'docs/breeding-challenges/lineage-360.png',scale:'css'});}
});

test('real hatch earns once before manual receipt, restores celebration, keeps award portrait and equips title only on request',async({page},info)=>{
 const mobile=info.project.name.startsWith('mobile'),fixture=challengeClutch('white');let g=fixture.game;for(let n=0;n<3;n++)g=challengeTurn(g);
 await restore(page,g,mobile);let dialog=await goals(page,mobile);await touch(dialog.locator('.challenge-goal').filter({has:page.getByRole('heading',{name:'순백의 계승자',exact:true})}).getByRole('button'),mobile);await page.keyboard.press('Escape');
 const before=await saved(page);await turn(page,mobile);
 const success=page.getByRole('dialog',{name:'브리딩 도전 성공!',exact:true});await expect(success).toContainText('순백의 계승자');await expect(success).toContainText('잠금 해제');
 let state=await saved(page),record=state.breedingChallenges!.completed[0];expect(state.individuals[record.specimen.id]).toBeUndefined();expect(state.breedingChallenges!.equippedTitle).toBeNull();expect(state.breedingChallenges!.completed).toHaveLength(1);expect(state.money).toBe(before.money);
 expect(state.eggs[record.eggId].status).toBe('hatched');expect(state.eggs[record.eggId].care!.settledTurn).toBeNull();
 if(mobile){await page.setViewportSize({width:390,height:844});await mkdir('docs/breeding-challenges',{recursive:true});await page.screenshot({path:'docs/breeding-challenges/success-390.png',scale:'css'});}
 await page.reload();await expect(success).toBeVisible();await touch(success.getByRole('button',{name:'확인',exact:true}),mobile);await expect(success).toHaveCount(0);
 await navigateGame(page,'혈통도',mobile);await expect(page.locator('.breeding-challenge-panel')).toContainText('완료 1/5');await expect(page.locator('.breeding-challenge-panel')).toContainText('변경 가능');
 dialog=await goals(page,mobile);await expect(dialog.locator('.challenge-history')).toContainText(record.specimen.name);await expect(dialog.getByRole('button',{name:'이 목표 선택',exact:true})).toHaveCount(4);
 await dialog.getByLabel('컬렉션 칭호',{exact:true}).selectOption('white');await expect.poll(async()=>(await saved(page)).breedingChallenges?.equippedTitle).toBe('white');
 if(mobile)await page.screenshot({path:'docs/breeding-challenges/goals-390.png',scale:'css'});await page.keyboard.press('Escape');await navigateGame(page,'컬렉션',mobile);await expect(page.getByLabel('착용 중인 칭호',{exact:true})).toHaveText('순백의 브리더');
 await navigateGame(page,'인큐베이터',mobile);await expect(page.getByTestId('receive-hatchling-'+record.eggId)).toBeVisible();await touch(page.getByTestId('receive-hatchling-'+record.eggId),mobile);
 state=await saved(page);expect(state.individuals[record.specimen.id]).toBeDefined();expect(state.breedingChallenges!.completed).toHaveLength(1);expect(state.breedingChallenges!.completed[0].specimen).toEqual(record.specimen);
 await page.reload();await expect(page.getByTestId('game-day')).toHaveText('6');await expect(success).toHaveCount(0);expect((await saved(page)).breedingChallenges).toEqual(state.breedingChallenges);
});

test('mobile 360–430px keeps shared chrome, readable goal controls and no horizontal overflow',async({page},info)=>{
 const mobile=info.project.name.startsWith('mobile');await restore(page,newGame('challenge-layout',DATE),mobile);
 for(const width of [360,390,430]){
  await page.setViewportSize({width,height:800});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const panel=(await page.locator('.breeding-challenge-panel').boundingBox())!,footer=(await page.locator('.home-turn-cta').boundingBox())!;expect(panel.y+panel.height).toBeLessThan(footer.y);
  const dialog=await goals(page,mobile);expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  const last=dialog.locator('.challenge-goal').last().getByRole('button');await last.scrollIntoViewIfNeeded();await expect(last).toBeVisible();expect((await last.boundingBox())!.height).toBeGreaterThanOrEqual(44);await page.keyboard.press('Escape');
 }
 await navigateGame(page,'상점',mobile);await expect(page.locator('.shop-offer')).toHaveCount(4);await navigateGame(page,'인큐베이터',mobile);await expect(page.getByRole('region',{name:'인큐베이터 화면',exact:true})).toBeVisible();
});
