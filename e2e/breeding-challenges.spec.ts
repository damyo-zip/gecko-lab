import {test,expect,type Page} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {newGame,act} from '../src/game/hardcore/play';
import {BREEDING_CHALLENGES} from '../src/game/hardcore/challenge-rules';
import {challengePreview} from '../src/game/hardcore/challenge-previews';
import {renderSprite} from '../src/engine/render';
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
 await expect(page.getByTestId('challenge-preview')).toHaveCount(0);
 const black=dialog.locator('.challenge-goal').filter({has:page.getByRole('heading',{name:'칠흑의 완성',exact:true})});await touch(black.getByRole('button',{name:'이 목표 선택',exact:true}),mobile);
 await expect(black.getByRole('button')).toHaveText('현재 선택한 목표');await expect(dialog.getByRole('button',{name:'잠금 · 10턴',exact:true})).toHaveCount(4);
 await page.keyboard.press('Escape');await expect(page.locator('.breeding-challenge-panel')).toContainText('목표 변경까지 10턴');
 await expect(page.locator('.challenge-preview')).toHaveAttribute('data-challenge-id','midnight');
 for(let n=0;n<9;n++)await turn(page,mobile);await expect(page.locator('.breeding-challenge-panel')).toContainText('목표 변경까지 1턴');
 await page.reload();await expect(page.getByTestId('game-day')).toHaveText('9');await navigateGame(page,'혈통도',mobile);await expect(page.locator('.breeding-challenge-panel')).toContainText('목표 변경까지 1턴');
 await turn(page,mobile);await expect(page.locator('.breeding-challenge-panel')).toContainText('칠흑의 완성');await expect(page.locator('.breeding-challenge-panel')).toContainText('변경 가능');
 dialog=await goals(page,mobile);await touch(dialog.locator('.challenge-goal').filter({has:page.getByRole('heading',{name:'타오르는 태양',exact:true})}).getByRole('button'),mobile);
 await expect.poll(async()=>(await saved(page)).breedingChallenges?.unlockTurn).toBe(20);await page.keyboard.press('Escape');
 await expect(page.locator('.challenge-preview')).toHaveAttribute('data-challenge-id','sun');
 if(mobile){await mkdir('docs/breeding-challenges',{recursive:true});await page.screenshot({path:'docs/breeding-challenges/lineage-360.png',scale:'css'});}
});

test('five reference sprites match real renderer pixels, fit beside the copy and survive reload without save writes',async({page},info)=>{
 const mobile=info.project.name.startsWith('mobile'),measurements:{id:string;width:number;height:number;panelHeight:number;spriteWidth:number}[]=[];
 for(const c of BREEDING_CHALLENGES){
  const game=act(newGame('challenge-preview-browser',DATE),{type:'selectChallenge',challengeId:c.id},DATE);
  await restore(page,game,mobile);const before=await saved(page),canvas=page.getByTestId('challenge-preview');
  await expect(canvas).toBeVisible();
  const expected=Array.from(renderSprite(challengePreview(c.id)).pixels);
  // Read one pixel from each nearest-neighbour 3×3 block; no substitute image.
  await expect.poll(()=>canvas.evaluate((el)=>{
   const c=el as HTMLCanvasElement,ctx=c.getContext('2d')!,rgba=ctx.getImageData(0,0,c.width,c.height).data,result:number[]=[];
   for(let y=0;y<96;y++)for(let x=0;x<96;x++){const i=((y*3+1)*c.width+x*3+1)*4;result.push(...rgba.slice(i,i+4));}
   return result;
  })).toEqual(expected);
  for(const {width,height} of [{width:360,height:640},{width:390,height:844},{width:430,height:932}]){
   await page.setViewportSize({width,height});
   const panel=(await page.locator('.breeding-challenge-panel').boundingBox())!,copy=(await page.locator('.challenge-summary-copy').boundingBox())!,art=(await canvas.boundingBox())!,frame=(await page.locator('.challenge-preview').boundingBox())!;
   measurements.push({id:c.id,width,height,panelHeight:panel.height,spriteWidth:art.width});
   expect(panel.height).toBeLessThan(220);expect(copy.x+copy.width).toBeLessThanOrEqual(art.x);
   expect(art.width).toBeCloseTo(art.height,0);expect(art.x).toBeGreaterThanOrEqual(frame.x);expect(art.y).toBeGreaterThanOrEqual(frame.y);
   expect(art.x+art.width).toBeLessThanOrEqual(frame.x+frame.width);expect(art.y+art.height).toBeLessThanOrEqual(frame.y+frame.height);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   expect(await page.locator('.challenge-summary-copy').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
   await expect(page.locator('.breeding-challenge-panel').getByText(/목표 모습/)).toHaveCount(0);
  }
  if(mobile){await page.setViewportSize({width:390,height:844});await mkdir('docs/challenge-previews',{recursive:true});await page.screenshot({path:`docs/challenge-previews/${c.id}-390.png`,scale:'css'});}
  expect(await saved(page)).toEqual(before);
  await page.reload();await navigateGame(page,'혈통도',mobile);await expect(page.locator('.challenge-preview')).toHaveAttribute('data-challenge-id',c.id);
  expect(await saved(page)).toEqual(before);
 }
 if(mobile)await writeFile('docs/challenge-previews/layout.json',JSON.stringify(measurements,null,2)+'\n');
});

test('goal dialog and turn countdown reuse the preview canvas without repainting its pixels',async({page},info)=>{
 const mobile=info.project.name.startsWith('mobile'),g=act(newGame('challenge-preview-cache',DATE),{type:'selectChallenge',challengeId:'white'},DATE);
 await restore(page,g,mobile);await expect(page.getByTestId('challenge-preview')).toBeVisible();
 await expect.poll(()=>page.getByTestId('challenge-preview').evaluate(el=>(el as HTMLCanvasElement).getContext('2d')!.getImageData(0,0,288,288).data.some((v,i)=>i%4===3&&v>0))).toBe(true);
 await page.evaluate(()=>{
  const w=window as typeof window&{previewDraws:number};w.previewDraws=0;
  const draw=CanvasRenderingContext2D.prototype.drawImage;
  CanvasRenderingContext2D.prototype.drawImage=new Proxy(draw,{apply(target,context:CanvasRenderingContext2D,args){if(context.canvas.dataset.testid==='challenge-preview')w.previewDraws++;return Reflect.apply(target,context,args);}});
 });
 const before=await saved(page);await goals(page,mobile);await page.keyboard.press('Escape');expect(await saved(page)).toEqual(before);
 await turn(page,mobile);await expect(page.locator('.breeding-challenge-panel')).toContainText('목표 변경까지 9턴');
 expect(await page.evaluate(()=>(window as typeof window&{previewDraws:number}).previewDraws)).toBe(0);
 const after=await saved(page);expect(after.breedingChallenges!.completed).toHaveLength(0);expect(after.breedingChallenges!.activeId).toBe('white');
 expect(Object.keys(after.individuals)).toEqual(Object.keys(before.individuals));expect(after.money).toBe(before.money);
});

test('real hatch earns once before manual receipt, restores celebration and automatically promotes the player rank',async({page},info)=>{
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
 await expect(dialog.getByLabel('컬렉션 칭호',{exact:true})).toHaveCount(0);await expect(dialog).toContainText('현재 칭호: 신예 브리더');
 if(mobile)await page.screenshot({path:'docs/breeding-challenges/goals-390.png',scale:'css'});await page.keyboard.press('Escape');await navigateGame(page,'컬렉션',mobile);await expect(page.getByTestId('breeder-rank')).toHaveText('신예 브리더');
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

test('goal picker shows all five matching live previews with readable mobile copy and unchanged selection rules',async({page},info)=>{
 const mobile=info.project.name.startsWith('mobile');await restore(page,newGame('goal-picker-previews',DATE),mobile);
 const before=await saved(page),dialog=await goals(page,mobile);
 await expect(dialog.getByTestId('challenge-goal-preview')).toHaveCount(5);
 for(const c of BREEDING_CHALLENGES){
  const goal=dialog.locator('.challenge-goal').filter({has:page.getByRole('heading',{name:c.name,exact:true})}),canvas=goal.getByTestId('challenge-goal-preview');
  await canvas.scrollIntoViewIfNeeded();await expect(canvas).toBeVisible();await expect(goal.locator('.challenge-preview')).toHaveAttribute('data-challenge-id',c.id);
  await expect.poll(()=>canvas.evaluate(el=>{
   const canvas=el as HTMLCanvasElement,rgba=canvas.getContext('2d')!.getImageData(0,0,canvas.width,canvas.height).data,result:number[]=[];
   for(let y=0;y<96;y++)for(let x=0;x<96;x++){const i=((y*3+1)*canvas.width+x*3+1)*4;result.push(...rgba.slice(i,i+4));}
   return result;
  })).toEqual(Array.from(renderSprite(challengePreview(c.id)).pixels));
 }
 for(const width of [360,390,430]){
  await page.setViewportSize({width,height:800});expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  for(const goal of await dialog.locator('.challenge-goal').all()){
   await goal.scrollIntoViewIfNeeded();
   const copy=(await goal.locator('.challenge-goal-copy').boundingBox())!,frame=(await goal.locator('.challenge-preview').boundingBox())!,art=(await goal.getByTestId('challenge-goal-preview').boundingBox())!;
   expect(copy.x+copy.width).toBeLessThan(frame.x);expect(art.width).toBeCloseTo(art.height,0);
   expect(art.x).toBeGreaterThanOrEqual(frame.x);expect(art.y).toBeGreaterThanOrEqual(frame.y);expect(art.x+art.width).toBeLessThanOrEqual(frame.x+frame.width);expect(art.y+art.height).toBeLessThanOrEqual(frame.y+frame.height);
   expect(await goal.locator('.challenge-goal-copy').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
   expect((await goal.getByRole('button').boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
 }
 expect(await saved(page)).toEqual(before);
 if(mobile){
  await page.setViewportSize({width:390,height:844});await dialog.locator('.challenge-goal').first().scrollIntoViewIfNeeded();
  await page.screenshot({path:'docs/challenge-previews/picker-top-390.png',scale:'css'});
  await dialog.locator('.challenge-goal').last().scrollIntoViewIfNeeded();await page.screenshot({path:'docs/challenge-previews/picker-bottom-390.png',scale:'css'});
 }
 const sun=dialog.locator('.challenge-goal').filter({has:page.getByRole('heading',{name:'타오르는 태양',exact:true})});
 await sun.getByRole('button').scrollIntoViewIfNeeded();await touch(sun.getByRole('button'),mobile);
 await expect(sun.getByRole('button')).toHaveText('현재 선택한 목표');await expect(dialog.getByRole('button',{name:'잠금 · 10턴',exact:true})).toHaveCount(4);
 await expect(dialog.getByTestId('challenge-goal-preview')).toHaveCount(5);
 const selected=await saved(page);expect(selected.breedingChallenges!.activeId).toBe('sun');expect(selected.breedingChallenges!.completed).toHaveLength(0);expect(selected.money).toBe(before.money);
 await page.keyboard.press('Escape');await expect(page.locator('.breeding-challenge-panel .challenge-preview')).toHaveAttribute('data-challenge-id','sun');
});
