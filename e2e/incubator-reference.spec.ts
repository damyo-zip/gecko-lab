import {test,expect,type Page} from '@playwright/test';
import {incubatorFixture} from './fixtures/incubator-reference';
import {newGame,act} from '../src/game/hardcore/play';
import {exportBackup} from '../src/game/hardcore/save';
import {freeSlots} from '../src/game/hardcore/survival';
import {seededRandom} from '../src/genetics/random';
import {seasonEggSeed} from '../src/game/hardcore/season';
import type {HardcoreGame} from '../src/game/hardcore/model';
import {touch,navigateGame} from './helpers/hardcore-navigation';
const DATE='2026-10-14';
test.setTimeout(90_000);
async function saved(page:Page):Promise<HardcoreGame>{return page.evaluate(async()=>{const db=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open('gecko-lab',1);r.onsuccess=()=>resolve(r.result);});return new Promise(resolve=>{const tx=db.transaction('games','readonly'),r=tx.objectStore('games').get('active');r.onsuccess=()=>resolve(r.result.save.game);tx.oncomplete=()=>db.close();});});}
async function restore(page:Page,g:HardcoreGame,mobile:boolean){await touch(page.getByRole('button',{name:'저장 및 게임 설정',exact:true}),mobile);await page.getByLabel('JSON 백업 파일',{exact:true}).setInputFiles({name:'incubator.json',mimeType:'application/json',buffer:Buffer.from(exportBackup(g))});await touch(page.getByRole('button',{name:'복원 실행',exact:true}),mobile);await expect(page.getByRole('dialog')).toHaveCount(0);await navigateGame(page,'부화',mobile);}
async function next(page:Page,mobile:boolean){const before=Number(await page.getByTestId('game-day').textContent());await touch(page.getByRole('button',{name:'턴 넘기기',exact:true}),mobile);await expect(page.getByTestId('game-day')).toHaveText(String(before+1));await expect(page.locator('.game-tab-content')).toHaveAttribute('aria-busy','false');await expect(page.locator('.incubator-shell')).toBeVisible();}
function pair(seed='incubator-direct-turn',capacity=4){let g=newGame(seed,DATE,{initialCapacity:capacity,initialMoney:3_000_000});const [father,mother]=Object.keys(g.shop.offers);for(const id of [father,mother])g=act(g,{type:'buyGecko',offerId:id},g.lastDate);g=act(g,{type:'buyFood',amount:100},g.lastDate);return {g,father,mother};}
function failureFixture(kind:'infertile'|'hatch'){
 for(let n=0;n<200;n++){
  let {g,father,mother}=pair('incubator-'+kind+'-'+n);g=act(g,{type:'breed',fatherId:father,motherId:mother},g.lastDate);const m=Object.values(g.matings)[0];
  if(m.lifecycle!.offspring.some((o,i)=>kind==='infertile'?!o.fertilized:o.fertilized&&seededRandom(seasonEggSeed(m,1,i+1),'hatch')()>=.95))return g;
 }throw new Error('real failure fixture not found');
}
test.beforeEach(async({page})=>{await page.clock.setFixedTime(new Date(DATE+'T03:00:00Z'));await page.goto('/');await expect(page.getByRole('heading',{name:/^보유 개체/})).toBeVisible();});
test('reference geometry, real counts, unique crisp eggs and readable panels at 360/390/430/native widths',async({page},info)=>{
 const mobile=info.project.name.startsWith('mobile'),g=incubatorFixture(),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await restore(page,g,mobile);
 await page.evaluate(async()=>{await Promise.all(['/ui/incubator/scene.png','/ui/home-terrarium.png'].map(src=>new Promise((resolve,reject)=>{const img=new Image();img.onload=resolve;img.onerror=reject;img.src=src;})));});
 await expect(page.getByTestId('incubator-active')).toHaveText('4 / 6');await expect(page.getByTestId('incubator-free')).toHaveText('2');await expect(page.getByTestId('incubator-remaining')).toHaveText('7일 (1턴)');
 await expect(page.getByTestId('game-money')).toHaveText(g.money.toLocaleString('ko-KR'));await expect(page.getByTestId('game-food')).toHaveText(String(g.food));
 const nav=page.getByRole('navigation',{name:'게임 탭'});await expect(nav.getByRole('button')).toHaveCount(4);await expect(nav.getByRole('button',{name:'인큐베이터',exact:true})).toHaveAttribute('aria-pressed','true');
 for(const [width,height] of [[360,800],[390,844],[430,932],[607,1280]]){
  await page.setViewportSize({width,height});await page.evaluate(()=>window.scrollTo(0,0));expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const cards=page.locator('.inc-slot-grid > .inc-slot');await expect(cards).toHaveCount(6);const boxes=await cards.evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().toJSON()));
  expect(new Set(boxes.slice(0,3).map(b=>b.y)).size).toBe(1);expect(boxes[1].x).toBeGreaterThan(boxes[0].right);
  const cta=await page.getByRole('button',{name:'턴 넘기기',exact:true}).boundingBox(),tabs=await nav.boundingBox();expect(cta!.y+cta!.height).toBeLessThanOrEqual(tabs!.y);expect(cta!.height).toBeGreaterThanOrEqual(44);
  for(const control of [page.getByRole('button',{name:'컬렉션으로 돌아가기',exact:true}),...await nav.getByRole('button').all()]){const b=await control.boundingBox();expect(b!.width).toBeGreaterThanOrEqual(44);expect(b!.height).toBeGreaterThanOrEqual(44);}
  await page.screenshot({path:info.outputPath(`incubator-${width}.png`),scale:'css',animations:'disabled'});
 }
 const pixels=await page.locator('.inc-egg-picture canvas').evaluateAll(nodes=>nodes.map(node=>{const c=node as HTMLCanvasElement,ctx=c.getContext('2d')!;if(ctx.imageSmoothingEnabled)throw new Error('smoothing enabled');return Array.from(ctx.getImageData(0,0,c.width,c.height).data).join(',');}));expect(new Set(pixels).size).toBe(4);
 await touch(page.getByRole('button',{name:'부화 확률과 슬롯 규칙',exact:true}),mobile);await expect(page.getByRole('dialog')).toContainText('90.25%');await expect(page.getByRole('dialog')).toContainText('무정란 5%');await page.keyboard.press('Escape');expect(await saved(page)).toEqual(g);expect(errors).toEqual([]);
});
test('empty slot opens breeding without buying capacity; two reservations lay once and direct incubator turns hatch after four turns',async({page},info)=>{
 const mobile=info.project.name.startsWith('mobile'),fixture=pair();await restore(page,fixture.g,mobile);await expect(page.getByTestId('incubator-empty-slot')).toHaveCount(2);
 await touch(page.getByTestId('incubator-empty-slot').first(),mobile);await expect(page.getByRole('heading',{name:'브리딩',exact:true})).toBeVisible();expect(await saved(page)).toEqual(fixture.g);
 await page.getByRole('combobox',{name:'수컷 부모',exact:true}).selectOption(fixture.father);await page.getByRole('combobox',{name:'암컷 부모',exact:true}).selectOption(fixture.mother);await touch(page.getByRole('button',{name:'교배 일정 시작 · 공간 2칸 예약',exact:true}),mobile);
 await expect(page.getByTestId('incubator-reserved-slot')).toHaveCount(2);await expect(page.getByTestId('incubator-empty-slot')).toHaveCount(0);const fixed=Object.values((await saved(page)).matings)[0].lifecycle!.offspring;
 await next(page,mobile);await expect(page.locator('.inc-slot.egg-card')).toHaveCount(0);await next(page,mobile);await expect(page.locator('.inc-slot.egg-card')).toHaveCount(2);await expect(page.getByTestId('incubator-reserved-slot')).toHaveCount(0);await expect(page.getByTestId('incubator-remaining')).toHaveText('28일 (4턴)');
 const g=await saved(page);expect(g.capacity).toBe(4);expect(freeSlots(g)).toBe(0);for(let n=0;n<3;n++)await next(page,mobile);await expect(page.getByTestId('incubator-remaining')).toHaveText('7일 (1턴)');
 await next(page,mobile);const hatched=await saved(page);expect(Object.values(hatched.eggs)).toHaveLength(2);expect(Object.values(hatched.eggs).every(e=>e.status!=='incubating')).toBe(true);for(const o of fixed){const child=hatched.individuals[o.embryo.id];if(child)expect(child.genetics).toEqual(o.embryo.genetics);}
 await page.reload();await expect(page.getByTestId('game-day')).toHaveText('6');expect(await saved(page)).toEqual(hatched);await navigateGame(page,'부화',mobile);await expect(page.getByTestId('incubator-free')).toHaveText(String(freeSlots(hatched)));
});
for(const kind of ['infertile','hatch'] as const)test(`${kind} remains unrevealed until the fourth incubation turn, then releases the actual slot`,async({page},info)=>{
 const mobile=info.project.name.startsWith('mobile'),g=failureFixture(kind);await restore(page,g,mobile);for(let n=0;n<5;n++)await next(page,mobile);await expect(page.locator('.inc-slot.egg-card')).toHaveCount(2);await expect(page.locator('.inc-results')).toHaveCount(0);
 await next(page,mobile);const result=await saved(page),failed=Object.values(result.eggs).find(e=>e.lifecycle?.failure===kind)!;expect(failed).toBeDefined();await expect(page.getByTestId('hc-egg-'+failed.id)).toContainText(kind==='infertile'?'무정란':'부화 실패');expect(result.individuals[failed.embryo.id]).toBeUndefined();await expect(page.getByTestId('incubator-empty-slot')).toHaveCount(freeSlots(result));
});
test('large actual capacity is paged and long parents remain accessible without horizontal overflow',async({page},info)=>{
 const mobile=info.project.name.startsWith('mobile');let g=incubatorFixture();for(const id of Object.keys(g.individuals))g=act(g,{type:'rename',id,name:'아주긴이름의부모크레스티드게코테스트'},g.lastDate);g=act(g,{type:'expand'},g.lastDate);await restore(page,g,mobile);
 await expect(page.getByTestId('incubator-active')).toHaveText('4 / 10');await expect(page.locator('.inc-slot-grid > .inc-slot')).toHaveCount(6);await touch(page.getByRole('button',{name:'#E-001 부모 정보',exact:true}),mobile);await expect(page.getByRole('dialog')).toContainText('아주긴이름의부모크레스티드게코테스트');await page.keyboard.press('Escape');await touch(page.getByRole('button',{name:'다음 슬롯',exact:true}),mobile);await expect(page.getByTestId('incubator-empty-slot')).toHaveCount(4);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(await saved(page)).toEqual(g);
});
test('offline reload keeps incubation data and the standalone scene available',async({page,context},info)=>{
 const mobile=info.project.name.startsWith('mobile'),g=incubatorFixture();await restore(page,g,mobile);await page.evaluate(()=>navigator.serviceWorker.ready);await expect.poll(()=>page.evaluate(()=>Boolean(navigator.serviceWorker.controller))).toBe(true);await expect.poll(()=>page.evaluate(async()=>Boolean(await caches.match('/ui/incubator/scene.png')))).toBe(true);
 await context.setOffline(true);await page.reload();await expect(page.getByRole('heading',{name:/^보유 개체/})).toBeVisible();await navigateGame(page,'부화',mobile);await expect(page.getByTestId('incubator-active')).toHaveText('4 / 6');expect(await saved(page)).toEqual(g);expect(await page.evaluate(async()=>(await fetch('/ui/incubator/scene.png')).ok)).toBe(true);
});
