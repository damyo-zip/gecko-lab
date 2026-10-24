import {test,expect,type Page} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {breederRankGames} from './helpers/forge-fixtures';
import {forgeChallengeClutch as challengeClutch} from '../tests/helpers/forge-challenge-game';
import {act} from '../src/game/hardcore/play';
import {exportBackup} from '../src/game/hardcore/save';
import type {HardcoreGame} from '../src/game/hardcore/model';
import {touch,navigateGame} from './helpers/hardcore-navigation';
const states=breederRankGames();
async function saved(page:Page):Promise<HardcoreGame>{return page.evaluate(async()=>{
 const db=await new Promise<IDBDatabase>(r=>{const q=indexedDB.open('gecko-lab',1);q.onsuccess=()=>r(q.result);});
 return new Promise(r=>{const tx=db.transaction('games'),q=tx.objectStore('games').get('active');q.onsuccess=()=>r(q.result.save.game);tx.oncomplete=()=>db.close();});
});}
async function restore(page:Page,g:HardcoreGame,mobile:boolean){
 await touch(page.getByRole('button',{name:'저장 및 게임 설정',exact:true}),mobile);
 await page.getByLabel('JSON 백업 파일',{exact:true}).setInputFiles({name:'feeding.json',mimeType:'application/json',buffer:Buffer.from(exportBackup(g))});
 await touch(page.getByRole('button',{name:'복원 실행',exact:true}),mobile);await expect(page.getByRole('dialog')).toHaveCount(0);
}
async function turn(page:Page,mobile:boolean){const n=(await saved(page)).turn;await touch(page.getByRole('button',{name:'턴 넘기기',exact:true}),mobile);await expect(page.getByTestId('game-day')).toHaveText(String(n+1));}
const errors=new WeakMap<Page,string[]>();
test.beforeEach(async({page})=>{const e:string[]=[];errors.set(page,e);page.on('pageerror',err=>e.push(err.message));await page.clock.setFixedTime(new Date('2026-10-16T03:00:00Z'));await page.goto('/');await expect(page.getByTestId('breeder-rank')).toBeVisible();});
test.afterEach(async({page})=>expect(errors.get(page)).toEqual([]));

test('restored four-goal reward reduces actual meals and every tab uses the same shortage calculation',async({page},info)=>{
 const mobile=info.project.name.startsWith('mobile'),g=structuredClone(states[4]);g.food=14;
 await restore(page,g,mobile);
 await touch(page.getByRole('button',{name:'먹이 구입하기',exact:true}),mobile);
 await expect(page.getByRole('dialog')).toContainText('보유 16마리 · 면제 2마리 · 필요 사료 14개');await page.keyboard.press('Escape');
 await turn(page,mobile);await expect(page.getByTestId('game-food')).toHaveText('0');await expect(page.getByRole('dialog')).toHaveCount(0);
 let state=await saved(page);expect(state.food).toBe(0);expect(state.breedingChallenges).toEqual(g.breedingChallenges);expect(Object.values(state.individuals).filter(g=>g.status==='owned').every(g=>g.hearts===5)).toBe(true);
 await page.reload();await expect(page.getByTestId('game-day')).toHaveText(String(g.turn+1));
 for(const tab of ['컬렉션','인큐베이터','혈통도','상점']){
  await navigateGame(page,tab,mobile);const before=await saved(page);
  await touch(page.getByRole('button',{name:'턴 넘기기',exact:true}),mobile);
  const warning=page.getByRole('dialog',{name:'턴 종료 전 사료 부족',exact:true});
  await expect(warning).toContainText('생존 개체 16마리 · 먹이 면제 2마리 · 필요 사료 14개 · 재고 0개 · 부족 14개');expect(await saved(page)).toEqual(before);
  await page.keyboard.press('Escape');
 }
 await touch(page.getByRole('button',{name:'턴 넘기기',exact:true}),mobile);await touch(page.getByRole('button',{name:'사료 부족 상태로 턴 마치기',exact:true}),mobile);
 state=await saved(page);const hearts=Object.values(state.individuals).filter(g=>g.status==='owned').map(g=>g.hearts);expect(hearts.filter(h=>h===5)).toHaveLength(2);expect(hearts.filter(h=>h===4)).toHaveLength(14);expect(state.food).toBe(0);
 await navigateGame(page,'혈통도',mobile);await touch(page.getByRole('button',{name:'전체 도전 목표 보기',exact:true}),mobile);
 const dialog=page.getByRole('dialog',{name:'전체 도전 목표',exact:true});await expect(dialog).toContainText('매 턴 최대 2마리 먹이 면제');await expect(dialog).not.toContainText('슬롯');
 if(mobile){await page.setViewportSize({width:390,height:844});await dialog.locator('.challenge-rewards').scrollIntoViewIfNeeded();await mkdir('test-results/eight-goals/challenge-feeding',{recursive:true});await page.screenshot({path:'test-results/eight-goals/challenge-feeding/rewards-390.png',scale:'css'});}
 await page.keyboard.press('Escape');
 await touch(page.getByRole('button',{name:'먹이 구입하기',exact:true}),mobile);await page.getByLabel('먹이 구매 수량',{exact:true}).fill('14');
 await touch(page.getByRole('button',{name:'먹이 구입 · ₩14,000',exact:true}),mobile);await expect(page.getByTestId('game-food')).toHaveText('14');await page.keyboard.press('Escape');
 await turn(page,mobile);await expect(page.getByTestId('game-food')).toHaveText('0');state=await saved(page);expect(Object.values(state.individuals).filter(g=>g.status==='owned').every(g=>g.hearts===5)).toBe(true);
});

test('eight completions cover a smaller herd for free on every screen, without stocking unused meals',async({page},info)=>{
 const mobile=info.project.name.startsWith('mobile');let g=structuredClone(states[8]);
 for(const animal of Object.values(g.individuals).filter(g=>g.status==='owned').slice(3))g=act(g,{type:'sell',id:animal.id},g.lastDate);
 g.food=0;await restore(page,g,mobile);
 for(const tab of ['컬렉션','인큐베이터','혈통도','상점']){await navigateGame(page,tab,mobile);await turn(page,mobile);await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.getByTestId('game-food')).toHaveText('0');}
 const state=await saved(page);expect(state.food).toBe(0);expect(state.breedingChallenges).toEqual(g.breedingChallenges);
 expect(Object.values(state.individuals).filter(g=>g.status==='owned')).toHaveLength(3);expect(Object.values(state.individuals).filter(g=>g.status==='owned').every(g=>g.hearts===5)).toBe(true);
 await page.reload();await expect(page.getByTestId('game-food')).toHaveText('0');await expect(page.getByTestId('breeder-rank')).toHaveText('전설의 브리더');
});

test('real first hatch pays supplies once, keeps feeding at zero exemptions, and manual receipt increases demand',async({page},info)=>{
 const mobile=info.project.name.startsWith('mobile'),fixture=challengeClutch('lilly-dalmatian');let g=fixture.game;g.food=8;
 g=act(g,{type:'selectChallenge',challengeId:'lilly-dalmatian'},g.lastDate);await restore(page,g,mobile);
 for(let n=0;n<4;n++)await turn(page,mobile);
 const success=page.getByRole('dialog',{name:'브리딩 도전 성공!',exact:true});await expect(success).toContainText('지원금 150,000원 · 사료 30개 지급 완료');await expect(success).toContainText('두 도전마다 급여 면제');await expect(success).not.toContainText('슬롯');
 let state=await saved(page);expect(state.food).toBe(30);expect(state.breedingChallenges!.completed).toHaveLength(1);expect(state.individuals[state.eggs[fixture.eggId].embryo.id]).toBeUndefined();
 await touch(success.getByRole('button',{name:'확인',exact:true}),mobile);await expect(success).toHaveCount(0);state=await saved(page);state.food=0;await restore(page,state,mobile);
 await touch(page.getByRole('button',{name:'턴 넘기기',exact:true}),mobile);await expect(page.getByRole('dialog')).toContainText('필요 사료 2개');await page.keyboard.press('Escape');
 await navigateGame(page,'인큐베이터',mobile);await touch(page.getByTestId('receive-hatchling-'+fixture.eggId),mobile);
 await touch(page.getByRole('button',{name:'턴 넘기기',exact:true}),mobile);await expect(page.getByRole('dialog')).toContainText('생존 개체 3마리 · 먹이 면제 0마리 · 필요 사료 3개');await page.keyboard.press('Escape');
 state=await saved(page);await page.reload();await expect(page.getByTestId('game-day')).toHaveText('6');expect((await saved(page)).breedingChallenges).toEqual(state.breedingChallenges);
});
