import {test,expect,type Page,type Locator} from '@playwright/test';
import {newMonthlyGame} from '../src/game/hardcore/play';
import {exportBackup} from '../src/game/hardcore/save';
import {addTargetParents} from '../tests/helpers/current-challenge-game';
import {turnDate} from '../src/game/hardcore/monthly-calendar';
import {BREEDING_CHALLENGES} from '../src/game/hardcore/challenge-rules';
import {touch,navigateGame,chooseBreedingParent,finishTurn} from './helpers/hardcore-navigation';
import type {HardcoreGame} from '../src/game/hardcore/model';
const DATE='2026-10-24';test.setTimeout(180_000);
function pair(){const game=newMonthlyGame('monthly',DATE,{initialMoney:2_000_000,initialCapacity:20});game.food=1000;const ids=addTargetParents(game,'gold-tiger');for(const id of ids){game.individuals[id].birthTurn=-18;game.individuals[id].birthDate=turnDate(game,-18);game.individuals[id].nextBreedTurn=0;}return {game,ids};}
async function saved(page:Page):Promise<HardcoreGame>{return page.evaluate(async()=>{const db=await new Promise<IDBDatabase>(r=>{const q=indexedDB.open('gecko-lab',1);q.onsuccess=()=>r(q.result);});return new Promise(r=>{const tx=db.transaction('games'),q=tx.objectStore('games').get('active');q.onsuccess=()=>r(q.result.save.game);tx.oncomplete=()=>db.close();});});}
async function boot(page:Page,game:HardcoreGame,mobile:boolean){await page.clock.setFixedTime(new Date(DATE+'T03:00:00Z'));await page.goto('/');await touch(page.getByRole('button',{name:'저장 및 게임 설정',exact:true}),mobile);await page.getByLabel('JSON 백업 파일',{exact:true}).setInputFiles({name:'monthly.json',mimeType:'application/json',buffer:Buffer.from(exportBackup(game))});await touch(page.getByRole('button',{name:'복원 실행',exact:true}),mobile);await expect(page.getByRole('dialog')).toHaveCount(0);}
const pixels=(c:Locator)=>c.evaluate(el=>{const c=el as HTMLCanvasElement,ctx=c.getContext('2d')!,data=ctx.getImageData(0,0,c.width,c.height).data,logical:number[]=[];const scale=c.width/96;for(let y=0;y<96;y++)for(let x=0;x<96;x++){const i=((y*scale)*c.width+x*scale)*4;logical.push(...data.slice(i,i+4));}return logical;});
test('monthly ages match the confirmed format and growth at 360, 390, 430px and desktop without mutating saves',async({page},info)=>{
 const mobile=info.project.name.startsWith('mobile'),{game,ids}=pair(),source=game.individuals[ids[0]];game.individuals={};
 for(const age of [0,7,12,18,38,144]){const g=structuredClone(source);g.id='monthly-age-'+age;g.name='나이 '+age;g.birthTurn=-age;g.birthDate=turnDate(game,-age);g.stage=age>=18?'adult':age>=6?'juvenile':'hatchling';g.visualSeed+=':'+age;g.nextBreedTurn=Math.max(0,18-age);game.individuals[g.id]=g;}
 await boot(page,game,mobile);const before=await saved(page);
 for(const width of [360,390,430,1280]){await page.setViewportSize({width,height:900});for(const [age,label] of [[0,'0개월'],[7,'7개월'],[12,'1년'],[18,'1년 6개월'],[38,'3년 2개월'],[144,'12년']] as const){await touch(page.getByTestId('hc-card-monthly-age-'+age).locator('.home-card-select'),mobile);await expect(page.locator('.home-facts').getByText(label,{exact:true})).toBeVisible();}expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
 expect(await saved(page)).toEqual(before);await page.reload();expect(await saved(page)).toEqual(before);
});
test('real monthly mating lays after one turn, hatches three turns after collection and preserves newborn nicknames',async({page},info)=>{
 const mobile=info.project.name.startsWith('mobile'),{game,ids}=pair();await boot(page,game,mobile);await navigateGame(page,'교배',mobile);
 await chooseBreedingParent(page,'male',ids[0],mobile);await chooseBreedingParent(page,'female',ids[1],mobile);await touch(page.getByTestId('breed-submit'),mobile);
 await expect(page.getByRole('dialog',{name:'교배',exact:true})).toHaveCount(0);await finishTurn(page,mobile);let g=await saved(page);expect(Object.keys(g.eggs)).toHaveLength(2);expect(g.individuals[ids[1]].nextBreedTurn).toBe(3);
 await navigateGame(page,'컬렉션',mobile);await touch(page.getByTestId('collect-eggs-'+ids[1]),mobile);await navigateGame(page,'인큐베이터',mobile);await expect(page.getByTestId('incubator-remaining')).toHaveText('3개월 (3턴)');
 for(let n=0;n<3;n++)await finishTurn(page,mobile);g=await saved(page);const egg=Object.values(g.eggs).find(e=>e.status==='hatched')!;expect(egg).toBeDefined();expect(egg.embryo.name).not.toMatch(/^해칭 /);
 await navigateGame(page,'인큐베이터',mobile);await touch(page.getByTestId('receive-hatchling-'+egg.id),mobile);g=await saved(page);expect(g.individuals[egg.embryo.id].name).toBe(egg.embryo.name);expect(g.individuals[egg.embryo.id].stage).toBe('hatchling');expect(g.individuals[egg.embryo.id].nextBreedTurn).toBe(22);await page.reload();expect(await saved(page)).toEqual(g);
});
test('all eight goal previews and all 32 accepted/rejected examples open exact native enlargement with one touch',async({page},info)=>{
 const mobile=info.project.name.startsWith('mobile');await boot(page,newMonthlyGame('monthly-zoom',DATE),mobile);const before=await saved(page);await navigateGame(page,'혈통도',mobile);await touch(page.getByRole('button',{name:'전체 도전 목표 보기',exact:true}),mobile);const dialog=page.getByRole('dialog',{name:'전체 도전 목표',exact:true});
 for(const goal of BREEDING_CHALLENGES){const card=dialog.locator('.challenge-goal').filter({has:page.getByRole('heading',{name:goal.name,exact:true})});
  const preview=card.locator('.challenge-preview'),original=await pixels(preview.locator('canvas'));await touch(preview,mobile);let zoom=page.locator('.observation-dialog');await expect(zoom).toBeVisible();expect(await pixels(zoom.locator('canvas'))).toEqual(original);await touch(zoom.getByRole('button',{name:'상세 창 닫기',exact:true}),mobile);
  await touch(card.locator('summary'),mobile);await touch(card.getByRole('button',{name:'인정·불인정 예시 보기',exact:true}),mobile);const examples=card.locator('.challenge-example-art');await expect(examples).toHaveCount(4);
  for(let n=0;n<4;n++){const button=examples.nth(n),expected=await pixels(button.locator('canvas'));await touch(button,mobile);zoom=page.locator('.observation-dialog');await expect(zoom).toBeVisible();expect(await pixels(zoom.locator('canvas'))).toEqual(expected);expect(await zoom.locator('canvas').evaluate(el=>(el as HTMLCanvasElement).getContext('2d')!.imageSmoothingEnabled)).toBe(false);await touch(zoom.getByRole('button',{name:'상세 창 닫기',exact:true}),mobile);}
 }
 expect(await saved(page)).toEqual(before);await page.reload();expect(await saved(page)).toEqual(before);
});
