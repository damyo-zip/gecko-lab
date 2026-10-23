import {test,expect,type Page,type Locator} from '@playwright/test';
import {referenceHomeGame,growthScaleGame,collectionStatusGame} from './helpers/forge-fixtures';
import {touch,navigateGame,openCollectionCatalog,manageResources,closeResources,chooseBreedingParent} from './helpers/hardcore-navigation';
import {exportBackup} from '../src/game/hardcore/save';
import {act} from '../src/game/hardcore/play';
import {actWithTime} from '../src/game/hardcore/time-source';
import {breedingRisk} from '../src/game/hardcore/breeding-risk';
import {foodDemand} from '../src/game/hardcore/lifecycle';
import {owned} from '../src/game/hardcore/survival';
import {collectionEntries} from '../src/components/hardcore/collection-query';
import {validateGame} from '../src/game/hardcore/validation';
import {productionSprite} from './helpers/forge';
import type {HardcoreGame} from '../src/game/hardcore/model';

test.setTimeout(120_000);
const DATE='2026-10-14';
function many(count:number){
 const game=referenceHomeGame(),source=owned(game);game.money=10_000_000;game.food=1;
 game.capacity=Math.max(count+4,20);game.rules.initialCapacity=game.capacity;game.rules.maxCapacity=Math.max(game.rules.maxCapacity,game.capacity);
 for(const g of source.slice(count))delete game.individuals[g.id];
 for(let i=6;i<count;i++){const g=structuredClone(source[i%6]);g.id=game.gameId+'-swipe-'+i;g.visualSeed=g.id;g.name='관찰 '+String(i).padStart(3,'0');game.individuals[g.id]=g;}
 for(const g of owned(game))g.hearts=5;
 validateGame(game);return game;
}
async function record(page:Page){return page.evaluate(async()=>{
 const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('gecko-lab',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
 return new Promise<{save:{game:HardcoreGame};writeRevision:number}>((resolve,reject)=>{const tx=db.transaction('games'),r=tx.objectStore('games').get('active');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);tx.oncomplete=()=>db.close();});
});}
async function restore(page:Page,game:HardcoreGame,mobile:boolean){
 await page.clock.setFixedTime(new Date(DATE+'T03:00:00Z'));await page.goto('/');
 await touch(page.getByRole('button',{name:'저장 및 게임 설정',exact:true}),mobile);
 await page.getByLabel('JSON 백업 파일',{exact:true}).setInputFiles({name:'convenience.json',mimeType:'application/json',buffer:Buffer.from(exportBackup(game))});
 await touch(page.getByRole('button',{name:'복원 실행',exact:true}),mobile);await expect(page.getByRole('dialog')).toHaveCount(0);
}
async function close(page:Page,mobile:boolean){await touch(page.getByRole('dialog').last().getByRole('button',{name:'상세 창 닫기',exact:true}),mobile);}
async function enableAuto(page:Page,mobile:boolean){await manageResources(page,mobile);await page.getByRole('checkbox',{name:'먹이 자동 구매',exact:true}).check();await closeResources(page,mobile);}
async function gesture(page:Page,mobile:boolean,direction:number,vertical=false){
 const grid=page.locator('.home-card-grid');
 if(!mobile)await grid.scrollIntoViewIfNeeded();
 const r=(await grid.boundingBox())!;
 const x=r.x+r.width*(direction>0?.84:.16),y=r.y+r.height*.25;
 const dx=vertical?8:-direction*r.width*.65,dy=vertical?r.height*.5:3;
 if(mobile){
  const cdp=await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
  for(let n=1;n<=8;n++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+dx*n/8,y:y+dy*n/8,id:1}]});await page.evaluate(()=>new Promise(requestAnimationFrame));}
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();
 }else{await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+dx,y+dy,{steps:8});await page.mouse.up();}
}
async function doubleImage(page:Page,image:Locator,mobile:boolean){
 if(mobile){const r=(await image.boundingBox())!;const x=r.x+r.width/2,y=r.y+r.height/2;await page.touchscreen.tap(x,y);await page.touchscreen.tap(x,y);}else await image.dblclick();
}
function hash(data:ArrayLike<number>){let v=2166136261;for(let i=0;i<data.length;i++)v=Math.imul(v^data[i],16777619);return v>>>0;}
async function checkObservation(page:Page,g:HardcoreGame['individuals'][string]){
 const dialog=page.locator('.observation-dialog');await expect(dialog).toBeVisible();await expect(dialog.getByRole('heading')).toHaveText(g.name);
 const canvas=dialog.getByTestId('observation-sprite');await expect(canvas).not.toHaveAttribute('data-growth-stage');
 const pixels=await canvas.evaluate(el=>{const c=el as HTMLCanvasElement,ctx=c.getContext('2d')!;let v=2166136261;for(const b of ctx.getImageData(0,0,96,96).data)v=Math.imul(v^b,16777619);return {hash:v>>>0,width:c.width,height:c.height,smoothing:ctx.imageSmoothingEnabled,rendering:getComputedStyle(c).imageRendering,filter:getComputedStyle(c).filter,box:c.getBoundingClientRect().toJSON()};});
 expect(pixels).toMatchObject({hash:hash(productionSprite(g).pixels),width:96,height:96,smoothing:false,rendering:'pixelated',filter:'none'});
 expect(pixels.box.width).toBeGreaterThan(250);
 expect(await dialog.evaluate(el=>{const r=el.getBoundingClientRect();return r.x>=0&&r.y>=0&&r.right<=innerWidth&&r.bottom<=innerHeight&&el.scrollWidth<=el.clientWidth;})).toBe(true);
}

test('auto food defaults OFF, persists per game, and purchases once from every turn entry',async({page},info)=>{
 const mobile=info.project.name.startsWith('mobile'),game=many(6);await restore(page,game,mobile);
 await manageResources(page,mobile);await expect(page.getByRole('checkbox',{name:'먹이 자동 구매',exact:true})).not.toBeChecked();await expect(page.getByRole('dialog').getByRole('button',{name:/사육장 \+/})).toHaveCount(0);await closeResources(page,mobile);
 await enableAuto(page,mobile);await page.reload();await manageResources(page,mobile);await expect(page.getByRole('checkbox',{name:'먹이 자동 구매',exact:true})).toBeChecked();await closeResources(page,mobile);
 for(const view of ['컬렉션','인큐베이터','상점','혈통도','전체 개체']){
  if(view==='전체 개체'){await navigateGame(page,'컬렉션',mobile);await openCollectionCatalog(page,mobile);}else await navigateGame(page,view,mobile);
  const before=await record(page),g=before.save.game,demand=foodDemand(g);
  const button=(view==='전체 개체'?page.getByRole('dialog',{name:'전체 개체',exact:true}):page.locator('.home-footer')).getByRole('button',{name:'턴 넘기기',exact:true});
  if(view==='컬렉션'){
   const r=(await button.boundingBox())!,x=r.x+r.width/2,y=r.y+r.height/2;
   if(mobile)await page.touchscreen.tap(x,y);else await page.mouse.click(x,y);
   await page.waitForTimeout(80);if(mobile)await page.touchscreen.tap(x,y);else await page.mouse.click(x,y);
  }else await button.evaluate(el=>{(el as HTMLButtonElement).click();(el as HTMLButtonElement).click();});
  await expect(page.getByTestId('game-day')).toHaveText(String(g.turn+1));await expect(page.locator('.game-tab-content')).toHaveAttribute('aria-busy','false');
  const after=await record(page);expect(after.writeRevision).toBe(before.writeRevision+1);expect(after.save.game.money).toBe(g.money-demand.missing*g.rules.foodUnitPrice);expect(after.save.game.food).toBe(0);expect(owned(after.save.game).every(g=>g.hearts===5)).toBe(true);
 }
 await close(page,mobile);await page.reload();const committed=await record(page);expect(committed.save.game.turn).toBe(5);
 await touch(page.getByRole('button',{name:'저장 및 게임 설정',exact:true}),mobile);await page.getByLabel('새 게임 시드',{exact:true}).fill(game.seed);await touch(page.getByRole('button',{name:'새 게임 준비',exact:true}),mobile);await touch(page.getByRole('button',{name:'새 게임 시작',exact:true}),mobile);await expect(page.getByRole('dialog')).toHaveCount(0);
 await manageResources(page,mobile);await expect(page.getByRole('checkbox',{name:'먹이 자동 구매',exact:true})).not.toBeChecked();await close(page,mobile);
});

test('insufficient funds keep the warning, food navigation and explicit unfed turn; OFF never buys',async({page},info)=>{
 const mobile=info.project.name.startsWith('mobile'),game=many(6);game.money=4999;await restore(page,game,mobile);await enableAuto(page,mobile);
 await touch(page.getByRole('button',{name:'턴 넘기기',exact:true}),mobile);let warning=page.getByRole('dialog',{name:'턴 종료 전 사료 부족',exact:true});await expect(warning).toBeVisible();expect((await record(page)).save.game).toEqual(game);
 await touch(warning.getByRole('button',{name:'사료 구입하러 가기',exact:true}),mobile);await expect(page.getByRole('dialog',{name:'사료 구매',exact:true})).toBeVisible();await close(page,mobile);
 await touch(page.getByRole('button',{name:'턴 넘기기',exact:true}),mobile);await touch(warning.getByRole('button',{name:'사료 부족 상태로 턴 마치기',exact:true}),mobile);await expect(page.getByTestId('game-day')).toHaveText('1');await expect(page.locator('.game-tab-content')).toHaveAttribute('aria-busy','false');
 const after=(await record(page)).save.game;expect(after.money).toBe(game.money);expect(after.food).toBe(0);expect(owned(after).filter(g=>g.hearts<5)).toHaveLength(5);
 await manageResources(page,mobile);await page.getByRole('checkbox',{name:'먹이 자동 구매',exact:true}).uncheck();await close(page,mobile);
 await touch(page.getByRole('button',{name:'턴 넘기기',exact:true}),mobile);await expect(warning).toBeVisible();expect((await record(page)).save.game.turn).toBe(1);
});

test('two stale windows cannot partially commit or duplicate an automatic purchase',async({page,context},info)=>{
 const mobile=info.project.name.startsWith('mobile');await restore(page,many(6),mobile);await enableAuto(page,mobile);
 const other=await context.newPage();await other.goto('/');await expect(other.getByTestId('game-day')).toHaveText('0');const before=await record(page);
 await touch(page.getByRole('button',{name:'턴 넘기기',exact:true}),mobile);await expect(page.getByTestId('game-day')).toHaveText('1');
 await touch(other.getByRole('button',{name:'턴 넘기기',exact:true}),mobile);await expect(other.locator('.game-error-banner')).toContainText('다른');
 const after=await record(page);expect(after.writeRevision).toBe(before.writeRevision+1);expect(after.save.game.money).toBe(before.save.game.money-5000);expect(after.save.game.food).toBe(0);expect(after.save.game.turn).toBe(1);
 await other.reload();expect((await record(other)).save.game).toEqual(after.save.game);
});

for(const count of [0,1,2,3,4,5,6,7,12,13,37])test(`${count} collection animals page in groups of six, clamp at ends and ignore vertical drags`,async({page},info)=>{
 const mobile=info.project.name.startsWith('mobile'),game=many(count);await restore(page,game,mobile);
 const cards=page.locator('.home-card-grid .home-card'),animals=owned(game);await expect(cards).toHaveCount(Math.min(6,count));if(!count)return;
 for(const width of mobile&&count===13?[360,390,430]:[mobile?360:1280]){
 await page.setViewportSize({width,height:mobile?844:900});
 if(!mobile)await page.locator('.home-card-grid').scrollIntoViewIfNeeded();
 const frame=await cards.first().boundingBox(),hero=await page.locator('.home-hero').boundingBox(),footer=await page.locator('.home-footer').boundingBox();
 const initial=await cards.first().getAttribute('data-testid');await gesture(page,mobile,1,true);await expect(cards.first()).toHaveAttribute('data-testid',initial!);
 const pages=Math.ceil(count/6);
 for(let n=1;n<=pages;n++){
  await gesture(page,mobile,1);const index=Math.min(n,pages-1)*6;
  await expect(cards).toHaveCount(Math.min(6,count-index));await expect(cards.first()).toHaveAttribute('data-testid','hc-card-'+animals[index].id);
  if(pages>1)await expect(page.locator('.home-name')).toContainText(animals[index].name);
  const nextFrame=await cards.first().boundingBox();expect(nextFrame!.width).toBe(frame!.width);expect(nextFrame!.height).toBe(frame!.height);expect(await page.locator('.home-hero').boundingBox()).toEqual(hero);expect(await page.locator('.home-footer').boundingBox()).toEqual(footer);
  if(mobile&&count===13&&n===1)await page.screenshot({path:info.outputPath('swipe-'+width+'.png')});
 }
 for(let n=pages-2;n>=0;n--){await gesture(page,mobile,-1);await expect(cards.first()).toHaveAttribute('data-testid','hc-card-'+animals[n*6].id);}
 await expect(page.getByRole('dialog')).toHaveCount(0);
 }
 expect((await record(page)).save.game).toEqual(game);
});

test('sort and filter reset paging; single selections survive and manager remains windowed',async({page},info)=>{
 const mobile=info.project.name.startsWith('mobile'),game=many(300);await restore(page,game,mobile);await gesture(page,mobile,1);
 await page.getByLabel('개체 정렬',{exact:true}).selectOption('name');const sorted=collectionEntries(owned(game),{morph:'all',stage:'all',sort:'name'});
 await expect(page.locator('.home-card-grid .home-card').first()).toHaveAttribute('data-testid','hc-card-'+sorted[0].id);await gesture(page,mobile,1);await expect(page.locator('.home-card-grid .home-card').first()).toHaveAttribute('data-testid','hc-card-'+sorted[6].id);
 await page.getByLabel('모프 필터',{exact:true}).selectOption('lilly');const filtered=collectionEntries(owned(game),{morph:'lilly',stage:'all',sort:'name'});
 await expect(page.locator('.home-card-grid .home-card').first()).toHaveAttribute('data-testid','hc-card-'+filtered[0].id);await gesture(page,mobile,1);await expect(page.locator('.home-card-grid .home-card').first()).toHaveAttribute('data-testid','hc-card-'+filtered[6].id);
 await openCollectionCatalog(page,mobile);const manager=page.getByRole('dialog',{name:'전체 개체',exact:true});expect(await manager.locator('.collection-list-row').count()).toBeLessThanOrEqual(30);
 await manager.locator('.collection-list-scroll').evaluate(el=>el.scrollTop=el.scrollHeight);const last=filtered.at(-1)!;await expect(manager.getByTestId('collection-list-'+last.id)).toBeVisible();await touch(manager.getByTestId('collection-list-'+last.id).locator('.home-card-select'),mobile);await close(page,mobile);await expect(page.locator('.home-name')).toContainText(last.name);await expect(page.getByTestId('hc-card-'+last.id)).toBeVisible();
});

test('hero, cards, manager and shop open original pixels; separate animal taps and buttons do not zoom',async({page},info)=>{
 const mobile=info.project.name.startsWith('mobile'),f=growthScaleGame();await restore(page,f.game,mobile);const g=f.game.individuals[f.hatchlingId];
 const first=page.getByTestId('hc-card-'+f.hatchlingId),second=page.getByTestId('hc-card-'+f.juvenileId);
 await touch(first.locator('.home-card-art'),mobile);await expect(first.locator('.home-card-select')).toHaveAttribute('aria-pressed','true');await touch(second.locator('.home-card-art'),mobile);await expect(page.locator('.observation-dialog')).toHaveCount(0);
 await doubleImage(page,first.locator('.home-card-art'),mobile);await checkObservation(page,g);
 for(const [width,height] of mobile?[[360,800],[390,844],[430,932]]:[[1280,900]]){await page.setViewportSize({width,height});await checkObservation(page,g);await page.screenshot({path:info.outputPath(`observation-${width}.png`)});}
 await close(page,mobile);await doubleImage(page,page.locator('.home-hero-art'),mobile);await checkObservation(page,g);await close(page,mobile);
 await touch(first.locator('.home-card-name'),mobile);await expect(page.locator('.observation-dialog')).toHaveCount(0);await touch(page.getByRole('dialog',{name:'이름 수정',exact:true}).getByRole('button',{name:'취소',exact:true}),mobile);
 await openCollectionCatalog(page,mobile);const catalog=page.getByRole('dialog',{name:'전체 개체',exact:true}),row=catalog.getByTestId('collection-list-'+g.id);await doubleImage(page,row.locator('.home-card-art'),mobile);await checkObservation(page,g);await close(page,mobile);await expect(catalog).toBeVisible();await close(page,mobile);
 await navigateGame(page,'상점',mobile);const offer=Object.values(f.game.shop.offers)[0];await touch(page.getByTestId('hardcore-sprite-'+offer.id),mobile);await checkObservation(page,offer.individual);await close(page,mobile);await touch(page.locator('.shop-parents').first(),mobile);await expect(page.getByRole('dialog')).toContainText('부모 정보');expect((await record(page)).save.game).toEqual(f.game);
});

test('newborn double tap preserves parent selection, hatch size and separate pickup',async({page},info)=>{
 const mobile=info.project.name.startsWith('mobile'),f=growthScaleGame();let game=f.game;const risk=breedingRisk(game,game.individuals[f.adultId],game.individuals[f.motherId]);
 game=act(game,{type:'breed',fatherId:f.adultId,motherId:f.motherId,riskAcknowledgement:risk.acknowledgement},DATE);const mating=Object.values(game.matings).at(-1)!;
 for(let i=0;i<6;i++){game=actWithTime(game,{type:'endTurn'},DATE);if(i===1)game=act(game,{type:'collectEggs',matingId:mating.id},DATE);}
 await restore(page,game,mobile);await navigateGame(page,'인큐베이터',mobile);const newborn=page.locator('.inc-newborn canvas[data-growth-stage]').first();await expect(newborn).toBeVisible();const egg=Object.values(game.eggs).find(e=>e.status==='hatched'&&e.care?.settledTurn===null)!;
 await touch(newborn,mobile);await expect(page.getByTestId('select-egg-'+egg.id)).toHaveAttribute('aria-pressed','true');expect((await record(page)).save.game).toEqual(game);
 await doubleImage(page,newborn,mobile);await checkObservation(page,{...egg.embryo,stage:'hatchling'});expect((await record(page)).save.game).toEqual(game);await close(page,mobile);await expect(newborn).toHaveAttribute('data-growth-stage','hatchling');
 await touch(page.getByTestId('receive-hatchling-'+egg.id),mobile);await expect(page.getByTestId('receive-hatchling-'+egg.id)).toHaveCount(0);await expect(page.locator('.observation-dialog')).toHaveCount(0);const received=(await record(page)).save.game;expect(received.individuals[egg.embryo.id].status).toBe('owned');expect(received.eggs[egg.id].care!.settledTurn).toBe(game.turn);
});

test('breeding shortage opens housing above the existing parent picker without changing rules',async({page},info)=>{
 const mobile=info.project.name.startsWith('mobile'),f=collectionStatusGame();f.game.capacity=owned(f.game).length+2;f.game.rules.initialCapacity=f.game.capacity;await restore(page,f.game,mobile);
 await navigateGame(page,'교배',mobile);await chooseBreedingParent(page,'male',f.father,mobile);await chooseBreedingParent(page,'female',f.female,mobile);
 await touch(page.getByTestId('breeding-slots').getByRole('button'),mobile);const housing=page.getByRole('dialog',{name:'사육장 구매',exact:true});await expect(housing).toBeVisible();await expect(housing.getByRole('checkbox')).toHaveCount(0);await expect(housing.getByLabel('먹이 구매 수량',{exact:true})).toHaveCount(0);expect((await record(page)).save.game).toEqual(f.game);
 await touch(housing.getByRole('button',{name:/사육장 \+/}),mobile);await close(page,mobile);await expect(page.getByTestId('breed-parent-male')).toHaveAttribute('data-parent-id',f.father);await expect(page.getByTestId('breed-parent-female')).toHaveAttribute('data-parent-id',f.female);await expect(page.getByTestId('breeding-slots')).toContainText('빈 슬롯 '+f.game.rules.expansionSlots+'개');
});

test('a completely full incubator opens housing directly from its space notice',async({page},info)=>{
 const mobile=info.project.name.startsWith('mobile'),game=many(6);game.capacity=6;game.rules.initialCapacity=6;await restore(page,game,mobile);await navigateGame(page,'인큐베이터',mobile);
 await touch(page.getByRole('button',{name:/사용 가능한 슬롯이 없습니다/}),mobile);await expect(page.getByRole('dialog',{name:'사육장 구매',exact:true})).toBeVisible();expect((await record(page)).save.game).toEqual(game);
});
