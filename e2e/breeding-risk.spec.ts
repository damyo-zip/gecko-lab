import {test,expect,type Page} from '@playwright/test';
import {breedingRiskFixture} from './fixtures/breeding-risk';
import {exportBackup} from '../src/game/hardcore/save';
import {touch,navigateGame,inspectGenetics,closeGenetics,finishTurn} from './helpers/hardcore-navigation';
import {freeSlots,reserved} from '../src/game/hardcore/survival';
import type {HardcoreGame} from '../src/game/hardcore/model';
const DATE='2026-10-14';
test.setTimeout(90_000);
async function saved(page:Page):Promise<HardcoreGame>{return page.evaluate(async()=>{const db=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open('gecko-lab',1);r.onsuccess=()=>resolve(r.result);});return new Promise(resolve=>{const tx=db.transaction('games','readonly'),r=tx.objectStore('games').get('active');r.onsuccess=()=>resolve(r.result.save.game);tx.oncomplete=()=>db.close();});});}
async function restore(page:Page,g:HardcoreGame,mobile:boolean){await touch(page.getByRole('button',{name:'저장 및 게임 설정',exact:true}),mobile);await page.getByLabel('JSON 백업 파일',{exact:true}).setInputFiles({name:'breeding-risk.json',mimeType:'application/json',buffer:Buffer.from(exportBackup(g))});await touch(page.getByRole('button',{name:'복원 실행',exact:true}),mobile);await expect(page.getByRole('dialog')).toHaveCount(0);}
async function choose(page:Page,f:string,m:string){await page.getByRole('combobox',{name:'수컷 부모',exact:true}).selectOption(f);await page.getByRole('combobox',{name:'암컷 부모',exact:true}).selectOption(m);}
test.beforeEach(async({page})=>{await page.clock.setFixedTime(new Date(DATE+'T03:00:00Z'));await page.goto('/');await expect(page.getByRole('heading',{name:/^보유 개체/})).toBeVisible();});
test('reference modal keeps two large live parents, actual pedigree/slots, independent information dialogs and no added page header/nav at 360/390/430',async({page},info)=>{
 const mobile=info.project.name.startsWith('mobile'),fixture=breedingRiskFixture(),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await restore(page,fixture.game,mobile);
 await touch(page.getByRole('button',{name:fixture.game.individuals[fixture.fatherId].name+' 상세보기',exact:true}),mobile);await touch(page.getByRole('button',{name:'부모로 선택',exact:true}),mobile);
 await choose(page,fixture.fatherId,fixture.motherId);const dialog=page.getByRole('dialog',{name:'교배',exact:true});await expect(dialog).toBeVisible();await expect(dialog.locator('.breed-parent')).toHaveCount(2);
 await expect(dialog.getByRole('navigation')).toHaveCount(0);await expect(dialog.locator('header')).toHaveCount(0);await expect(dialog.getByTestId('breeding-relationship')).toContainText('친형제자매');await expect(dialog.getByTestId('breeding-relationship')).toContainText('25.00%');
 expect(await dialog.getByTestId('breed-submit').evaluate(el=>el.nextElementSibling===null)).toBe(true);const before=await saved(page);
 for(const [width,height] of [[360,800],[390,844],[430,932]]){
  await page.setViewportSize({width,height});expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  for(const canvas of await dialog.locator('canvas').all()){const b=await canvas.boundingBox();expect(b!.width).toBeGreaterThan(125);expect(await canvas.evaluate(n=>!(n as HTMLCanvasElement).getContext('2d')!.imageSmoothingEnabled)).toBe(true);}
  const submit=await dialog.getByTestId('breed-submit').boundingBox();expect(submit!.height).toBeGreaterThanOrEqual(44);expect(submit!.y+submit!.height).toBeLessThan(height);
  if(mobile)await page.screenshot({path:`docs/breeding-risk/breeding-${width}.png`,scale:'css'});
 }
 await inspectGenetics(page,mobile);await expect(page.getByTestId('hardcore-forecast')).toContainText('비생존 · 25%');await expect(page.getByTestId('hardcore-forecast')).toContainText('33.3%');await expect(page.getByTestId('hardcore-forecast')).toContainText('66.7%');await closeGenetics(page,mobile);
 await touch(dialog.getByRole('button',{name:'혈통 비교',exact:true}),mobile);const comparison=page.getByRole('dialog',{name:'혈통 비교',exact:true});await expect(comparison).toContainText('비근친·상호 비혈연으로 가정');await expect(comparison).toContainText(fixture.normalId);await touch(comparison.getByRole('button',{name:'상세 창 닫기',exact:true}),mobile);
 await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);expect(await saved(page)).toEqual(before);expect(errors).toEqual([]);
});
test('combined sibling/Lilly warning cancels without mutations, confirms once, survives reload, lays two eggs and independently resolves a genetic failure and viable hatch',async({page},info)=>{
 const mobile=info.project.name.startsWith('mobile'),fixture=breedingRiskFixture(),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await restore(page,fixture.game,mobile);await navigateGame(page,'교배',mobile);await choose(page,fixture.fatherId,fixture.motherId);
 await touch(page.getByTestId('breed-submit'),mobile);const warning=page.getByRole('dialog',{name:'교배 전 위험 확인',exact:true});await expect(warning).toContainText('근친교배 주의');await expect(warning).toContainText('위험 유전자 조합');await expect(warning).toContainText('친형제자매');await expect(warning).toContainText('25.00%');await expect(warning).not.toContainText('embryonic-vigor');await expect(warning).not.toContainText('fertility');
 if(mobile){await page.setViewportSize({width:390,height:844});await page.screenshot({path:'docs/breeding-risk/combined-warning-390.png',scale:'css'});}
 const before=await saved(page);await touch(warning.getByRole('button',{name:'취소',exact:true}),mobile);expect(await saved(page)).toEqual(before);
 await touch(page.getByTestId('breed-submit'),mobile);await touch(page.getByRole('button',{name:'위험을 확인하고 교배하기',exact:true}),mobile);await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.getByRole('heading',{name:'인큐베이터',exact:true})).toBeVisible();
 let game=await saved(page);expect(game.nextClutch).toBe(before.nextClutch+1);expect(reserved(game)).toBe(2);const mating=Object.values(game.matings).at(-1)!;const fixed=structuredClone(mating.lifecycle!.offspring);
 await page.reload();await expect(page.getByTestId('game-day')).toHaveText(String(before.turn));expect(await saved(page)).toEqual(game);await navigateGame(page,'인큐베이터',mobile);
 for(let n=0;n<6;n++){await finishTurn(page,mobile);game=await saved(page);const eggs=Object.values(game.eggs).filter(e=>e.matingId===mating.id);if(n===0)expect(eggs).toHaveLength(0);else expect(eggs).toHaveLength(2);if(n>=1&&n<5)expect(eggs.every(e=>e.status==='incubating')).toBe(true);}
 const eggs=Object.values(game.eggs).filter(e=>e.matingId===mating.id),failure=eggs.find(e=>e.lifecycle!.failure==='genetic')!,survivor=eggs.find(e=>e.status==='hatched')!;
 expect(failure).toBeDefined();expect(survivor).toBeDefined();expect(game.individuals[failure.embryo.id]).toBeUndefined();expect(game.individuals[survivor.embryo.id].parents).toEqual(mating.parents);expect(game.individuals[survivor.embryo.id]).not.toHaveProperty('development');expect(reserved(game)).toBe(0);expect(freeSlots(game)).toBe(freeSlots(before)-1);expect(game.matings[mating.id].lifecycle!.offspring).toEqual(fixed);
 await expect(page.getByTestId('hc-egg-'+failure.id)).toContainText('유전적 비생존');if(mobile)await page.screenshot({path:'docs/breeding-risk/incubator-outcomes-390.png',fullPage:true,scale:'css'});
 await page.reload();await expect(page.getByTestId('game-day')).toHaveText(String(game.turn));expect(await saved(page)).toEqual(game);expect(errors).toEqual([]);
});
test('lineal crosses warn and ordinary unrelated crosses execute without another confirmation',async({page},info)=>{
 const mobile=info.project.name.startsWith('mobile'),f=breedingRiskFixture();await restore(page,f.game,mobile);await navigateGame(page,'교배',mobile);await choose(page,f.normalId,f.motherId);
 await touch(page.getByTestId('breed-submit'),mobile);await expect(page.getByRole('dialog',{name:'교배 전 위험 확인',exact:true})).toContainText('부모·자식');await touch(page.getByRole('button',{name:'취소',exact:true}),mobile);
 await choose(page,f.normalId,f.lillyFemaleId);await touch(page.getByTestId('breed-submit'),mobile);await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.getByRole('heading',{name:'인큐베이터',exact:true})).toBeVisible();
 expect((await saved(page)).nextClutch).toBe(f.game.nextClutch+1);
});

import {newGame,act} from '../src/game/hardcore/play';
function shopComplexPair(){
 let game=newGame('actual-complex-ui',DATE,{initialMoney:5_000_000,initialCapacity:30}),fatherId='',motherId='';game.food=200;
 for(let batch=0;batch<40&&(!fatherId||!motherId);batch++){
  for(const o of Object.values(game.shop.offers)){
   const g=o.individual;if(o.purchased||g.stage!=='adult'||g.genotype.loci['lilly-white'].includes('Lw')||g.genetics!.genome!.mendelian.loci['cappuccino-complex'].every(a=>a==='n'))continue;
   if((g.sex==='male'&&!fatherId)||(g.sex==='female'&&!motherId)){game=act(game,{type:'buyGecko',offerId:o.id},DATE);if(g.sex==='male')fatherId=o.id;else motherId=o.id;}
  }
  if(!fatherId||!motherId)game=act(game,{type:'refreshShop'},DATE);
 }
 if(!fatherId||!motherId)throw new Error('Actual C/S/H family pair not found');return {game,fatherId,motherId};
}
test('real shop-derived complex parents show a provisional warning and breed without invented lethal embryos',async({page},info)=>{
 const mobile=info.project.name.startsWith('mobile'),f=shopComplexPair();await restore(page,f.game,mobile);await navigateGame(page,'교배',mobile);await choose(page,f.fatherId,f.motherId);
 await expect(page.getByTestId('breed-submit')).toBeEnabled();await expect(page.getByTestId('breeding-caution')).toContainText('복합 유전자');await inspectGenetics(page,mobile);await expect(page.getByTestId('hardcore-forecast')).toContainText('치사 확률이나 실제 생존 자손 비율은 계산하지 않습니다');await closeGenetics(page,mobile);
 await touch(page.getByTestId('breed-submit'),mobile);const d=page.getByRole('dialog',{name:'교배 전 위험 확인',exact:true});await expect(d).toContainText('복합 유전자 조합');await expect(d).toContainText('잠정');await expect(d).not.toContainText('Lilly 동형접합');
 if(mobile)await page.screenshot({path:'docs/breeding-risk/complex-warning-390.png',scale:'css'});
 await touch(page.getByRole('button',{name:'위험을 확인하고 교배하기',exact:true}),mobile);await expect(page.getByRole('dialog')).toHaveCount(0);const game=await saved(page),mating=Object.values(game.matings).at(-1)!;
 expect(mating.parents).toEqual({fatherId:f.fatherId,motherId:f.motherId});expect(reserved(game)).toBe(2);expect(mating.lifecycle!.offspring.every(o=>o.embryo.development!.viable)).toBe(true);await page.reload();await expect(page.getByTestId('game-day')).toHaveText('0');expect(await saved(page)).toEqual(game);
});
