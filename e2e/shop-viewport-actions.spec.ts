import {test,expect,type Page} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {newGame,act} from '../src/game/hardcore/play';
import {actWithTime} from '../src/game/hardcore/time-source';
import {exportBackup} from '../src/game/hardcore/save';
import {expansionPrice} from '../src/game/hardcore/economy';
import {freeSlots} from '../src/game/hardcore/survival';
import {touch,navigateGame} from './helpers/hardcore-navigation';
import type {HardcoreGame} from '../src/game/hardcore/model';
import beforeGeometry from '../docs/shop-viewport-actions/before-geometry.json' with {type:'json'};
const DATE='2026-10-16';
// Node/Chromium Math.exp can differ by one ULP. Only newly generated stock's
// derived display scores are rounded; genomes, money and existing records stay exact.
function portable(game:HardcoreGame){
 const shop=structuredClone(game.shop);
 for(const o of Object.values(shop.offers))for(const g of [o.individual,...(o.family?[o.family.father,o.family.mother]:[])])
  for(const k of Object.keys(g.potential) as (keyof typeof g.potential)[])g.potential[k]=Math.round(g.potential[k]*1e12)/1e12;
 return {...game,shop};
}
function fixture(){
 let g=newGame('shop-viewport-full',DATE,{initialCapacity:4,initialMoney:3_000_000});
 for(const o of Object.values(g.shop.offers))g=act(g,{type:'buyGecko',offerId:o.id},DATE);
 g=act(g,{type:'buyFood',amount:100},DATE);return actWithTime(g,{type:'endTurn'},DATE);
}
async function saved(page:Page):Promise<HardcoreGame>{return page.evaluate(async()=>{
 const db=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open('gecko-lab',1);r.onsuccess=()=>resolve(r.result);});
 return new Promise(resolve=>{const tx=db.transaction('games'),r=tx.objectStore('games').get('active');r.onsuccess=()=>resolve(r.result.save.game);tx.oncomplete=()=>db.close();});
});}
async function restore(page:Page,g:HardcoreGame,mobile:boolean){
 await touch(page.getByRole('button',{name:'저장 및 게임 설정',exact:true}),mobile);
 await page.getByLabel('JSON 백업 파일',{exact:true}).setInputFiles({name:'shop-height.json',mimeType:'application/json',buffer:Buffer.from(exportBackup(g))});
 await touch(page.getByRole('button',{name:'복원 실행',exact:true}),mobile);await expect(page.getByRole('dialog')).toHaveCount(0);await navigateGame(page,'상점',mobile);
}
const errors=new WeakMap<Page,string[]>();
test.beforeEach(async({page})=>{const e:string[]=[];errors.set(page,e);page.on('pageerror',v=>e.push(v.message));page.on('console',v=>{if(v.type()==='error')e.push(v.text());});await page.clock.setFixedTime(new Date(DATE+'T03:00:00Z'));await page.goto('/');await expect(page.getByRole('heading',{name:/보유 개체/})).toBeVisible();});
test.afterEach(async({page})=>expect(errors.get(page)).toEqual([]));
test('four offers and shared chrome fit real portrait heights, retain fonts and touch sizes, and never hide overflow',async({page},info)=>{
 const mobile=info.project.name.startsWith('mobile'),g=fixture(),reports=[];await restore(page,g,mobile);
 expect(g.notices.join(' ')).toContain('자동 급여');await expect(page.locator('.shop-reference .hc-notices,.shop-market-note')).toHaveCount(0);await expect(page.locator('.shop-reference')).not.toContainText('임시 게임 가격');
 for(const [width,height] of [[360,640],[360,800],[390,844],[412,720],[412,760],[412,869],[430,932],[480,760],[480,900]])for(const safe of [false,true]){
  await page.setViewportSize({width,height});const style=safe?await page.addStyleTag({content:'.hc-shell.reference-shell.shop-shell{--home-safe-top:44px;--home-safe-bottom:34px;}'}):null;
  if(safe)expect(await page.locator('.shop-shell').evaluate(e=>[getComputedStyle(e).getPropertyValue('--home-safe-top'),getComputedStyle(e).getPropertyValue('--home-safe-bottom')])).toEqual(['44px','34px']);
  const measured=await page.locator('.reference-content').evaluate(e=>({client:e.clientHeight,scroll:e.scrollHeight,overflow:getComputedStyle(e).overflowY}));
  // A 640px browser area plus 78px synthetic insets is below the retained
  // text/44px-control minimum. Keep every item reachable instead of clipping.
  if(height===640&&safe){expect(measured.overflow).toBe('auto');await page.locator('.reference-content').evaluate(e=>e.scrollTop=e.scrollHeight);await expect(page.locator('.shop-buy').last()).toBeInViewport();reports.push({width,height,safe,...measured,fallback:true});await style!.evaluate(e=>e.parentNode?.removeChild(e));await page.locator('.reference-content').evaluate(e=>e.scrollTop=0);continue;}
  expect(measured.scroll,`${width}x${height} safe=${safe}`).toBeLessThanOrEqual(measured.client+1);expect(measured.overflow).toBe('auto');expect(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight&&document.documentElement.scrollWidth<=innerWidth&&scrollY===0)).toBe(true);
  const cta=(await page.locator('.home-turn-cta').boundingBox())!,nav=(await page.locator('.home-nav').boundingBox())!,content=(await page.locator('.reference-content').boundingBox())!;
  expect(cta.y+cta.height).toBeLessThanOrEqual(nav.y);
  for(const el of await page.locator('.shop-offer').all()){
   const rect=(await el.boundingBox())!;expect(rect.y).toBeGreaterThanOrEqual(content.y);expect(rect.y+rect.height).toBeLessThanOrEqual(content.y+content.height+1);expect(rect.y+rect.height).toBeLessThan(cta.y);
   for(const control of await el.locator('.shop-buy,.shop-parents').all()){const r=(await control.boundingBox())!;expect(r.height).toBeGreaterThanOrEqual(44);}
   for(const element of await el.locator('.shop-offer-art,h3,.shop-morph,.shop-age,.shop-price,.shop-buy').all())await expect(element).toBeVisible();
  }
  const metrics=await page.locator('.shop-offer').first().evaluate(e=>Object.fromEntries(['.shop-offer-art','h3','.shop-morph','.shop-age','.shop-price','.shop-buy'].map(s=>{const n=e.querySelector(s)!,r=n.getBoundingClientRect(),c=getComputedStyle(n);return [s,{height:r.height,fontSize:c.fontSize}];})));
  const before=beforeGeometry.find(r=>r.width===width&&r.height===height);
  for(const [selector,key] of [['h3','name'],['.shop-morph','morph'],['.shop-age','age'],['.shop-price','price'],['.shop-buy','buy']] as const)if(before)expect(metrics[selector].fontSize).toBe(before[key].fontSize);
  if(before&&!safe&&height>=740)expect(metrics['.shop-offer-art'].height).toBeCloseTo(before.art.height,1);
  reports.push({width,height,safe,...measured,metrics});if(mobile&&!safe&&[640,760,844,869].includes(height)){await mkdir('docs/shop-viewport-actions',{recursive:true});await page.screenshot({path:`docs/shop-viewport-actions/after-${width}x${height}.png`,scale:'css'});}
  if(style)await style.evaluate(e=>e.parentNode?.removeChild(e));
 }
 // Desktop keeps its original large art instead of receiving the mobile compaction.
 await page.setViewportSize({width:1280,height:900});const desktopArt=await page.locator('.shop-offer-art').first().boundingBox();expect(desktopArt!.height).toBeCloseTo(desktopArt!.width*203/365,1);
 // A physically shorter landscape retains a scrollable middle rather than clipping cards.
 await page.setViewportSize({width:844,height:390});expect(await page.locator('.reference-content').evaluate(e=>getComputedStyle(e).overflowY)).toBe('auto');await page.locator('.reference-content').evaluate(e=>e.scrollTop=e.scrollHeight);await expect(page.locator('.shop-buy').last()).toBeInViewport();
 expect(await saved(page)).toEqual(g);if(mobile)await writeFile('docs/shop-viewport-actions/after-geometry.json',JSON.stringify(reports,null,2));
});
test('space-needed retains exact disabled styling, opens existing housing, updates capacity and then purchases without changing stock',async({page},info)=>{
 const mobile=info.project.name.startsWith('mobile'),g=fixture();await restore(page,g,mobile);expect(freeSlots(g)).toBe(0);
 const o=Object.values(g.shop.offers)[0],b=page.getByTestId('shop-offer-'+o.id).getByRole('button',{name:o.individual.name+' 구매',exact:true});await expect(b).toBeEnabled();await expect(b).toHaveText('공간 부족');
 const visual=await b.evaluate(el=>{const read=()=>{const c=getComputedStyle(el);return Object.fromEntries(['opacity','background','boxShadow','color','border','fontSize','padding','height'].map(k=>[k,c.getPropertyValue(k.replace(/[A-Z]/g,c=>'-'+c.toLowerCase()))]));};const enabled=read();(el as HTMLButtonElement).disabled=true;const disabled=read();(el as HTMLButtonElement).disabled=false;return {enabled,disabled};});expect(visual.enabled).toEqual(visual.disabled);expect(visual.enabled.opacity).toBe('0.6');expect(visual.enabled.boxShadow).toBe('none');
 await touch(b,mobile);const dialog=page.getByRole('dialog',{name:'사료 및 사육장 관리',exact:true});await expect(dialog).toBeVisible();expect(await saved(page)).toEqual(g);await page.keyboard.press('Escape');await expect(page.locator('.game-tab-content')).toHaveAttribute('data-view','shop');await expect(b).toHaveText('공간 부족');
 await touch(b,mobile);await touch(dialog.getByRole('button',{name:/사육장 \+/}),mobile);await expect(dialog).toContainText('여유 공간 '+g.rules.expansionSlots+'칸');const expanded=await saved(page);expect(expanded.capacity).toBe(g.capacity+g.rules.expansionSlots);expect(expanded.money).toBe(g.money-expansionPrice(g));expect(expanded.shop).toEqual(g.shop);expect(expanded.individuals).toEqual(g.individuals);
 await page.keyboard.press('Escape');await expect(b).toHaveText('구매하기');await touch(b,mobile);const bought=await saved(page);expect(bought.individuals[o.id]).toEqual(o.individual);expect(bought.money).toBe(expanded.money-o.askPrice);await expect(b).toBeDisabled();await expect(b).toHaveText('구매 완료');await page.reload();await expect(page.getByTestId('game-day')).toHaveText('1');expect(await saved(page)).toEqual(bought);
});
test('instant reroll charges once for burst and delayed double taps, persists exact catalog and uses the unchanged next-turn engine',async({page},info)=>{
 const mobile=info.project.name.startsWith('mobile'),g=fixture();await restore(page,g,mobile);const b=page.getByRole('button',{name:'발품팔기 2,000원',exact:true});
 await b.evaluate(async el=>{(el as HTMLButtonElement).click();(el as HTMLButtonElement).click();await new Promise(r=>setTimeout(r,120));(el as HTMLButtonElement).click();});await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.locator('.game-tab-content')).toHaveAttribute('aria-busy','false');
 const next=await saved(page),expected=actWithTime(g,{type:'refreshShop'},DATE);expect(portable(next)).toEqual(portable(expected));expect(next.money).toBe(g.money-2000);expect(next.turn).toBe(g.turn);expect(next.revision).toBe(g.revision+1);
 await page.waitForTimeout(450);await touch(b,mobile);await expect(page.locator('.game-tab-content')).toHaveAttribute('aria-busy','false');const again=await saved(page);expect(again.money).toBe(next.money-2000);expect(again.shop.batch).toBe(next.shop.batch!+1);expect(portable(again)).toEqual(portable(actWithTime(next,{type:'refreshShop'},DATE)));
 await page.reload();await expect(page.getByTestId('game-day')).toHaveText('1');await navigateGame(page,'상점',mobile);expect(await saved(page)).toEqual(again);
 await touch(page.getByRole('button',{name:'턴 넘기기',exact:true}),mobile);await expect(page.getByTestId('game-day')).toHaveText('2');const turn=await saved(page);expect(portable(turn)).toEqual(portable(actWithTime(again,{type:'endTurn'},DATE)));expect(turn.food).toBe(again.food-4);await expect(page.locator('.shop-reference .hc-notices')).toHaveCount(0);
});
