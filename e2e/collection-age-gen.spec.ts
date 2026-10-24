import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';
import {referenceHomeGame,REFERENCE_DATE} from './helpers/forge-fixtures';
import {lineageFixture} from './helpers/forge-fixtures';
import {touch,openCollectionCatalog} from './helpers/hardcore-navigation';
import {exportBackup} from '../src/game/hardcore/save';
import {act} from '../src/game/hardcore/play';
import {addDays} from '../src/game/hardcore/time';
import {validateGame} from '../src/game/hardcore/validation';
import type {HardcoreGame} from '../src/game/hardcore/model';

async function saved(p:Page):Promise<HardcoreGame>{return p.evaluate(async()=>{
 const db=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open('gecko-lab',1);r.onsuccess=()=>resolve(r.result);});
 return new Promise(resolve=>{const tx=db.transaction('games'),r=tx.objectStore('games').get('active');r.onsuccess=()=>resolve(r.result.save.game);tx.oncomplete=()=>db.close();});
});}
async function restore(p:Page,g:HardcoreGame,mobile:boolean){
 await touch(p.getByRole('button',{name:'저장 및 게임 설정',exact:true}),mobile);await p.getByLabel('JSON 백업 파일',{exact:true}).setInputFiles({name:'age-gen.json',mimeType:'application/json',buffer:Buffer.from(exportBackup(g))});await touch(p.getByRole('button',{name:'복원 실행',exact:true}),mobile);await expect(p.getByRole('dialog')).toHaveCount(0);
}
const age=(p:Page)=>p.locator('.home-facts>div').filter({has:p.locator('dt').filter({hasText:/^나이$/})}).locator('dd');
const tree=(p:Page)=>p.getByRole('dialog',{name:'가족 혈통도',exact:true});
const errors=new WeakMap<Page,string[]>();
test.beforeEach(async({page})=>{errors.set(page,[]);page.on('pageerror',e=>errors.get(page)!.push(e.message));await page.clock.setFixedTime(new Date(REFERENCE_DATE+'T03:00:00Z'));await page.goto('/');await expect(page.getByRole('heading',{name:/^보유 개체/})).toBeVisible();});
test.afterEach(({page})=>{expect(errors.get(page)).toEqual([]);});

test('age replaces image dimensions; panel, cards, sprite and Gen badge geometry match the previous build exactly',async({page},info)=>{
 const mobile=info.project.name.startsWith('mobile'),game=referenceHomeGame();await restore(page,game,mobile);await expect(age(page)).toHaveText('1년 6개월');await expect(page.locator('.home-info')).not.toContainText('96×96');await expect(page.locator('.home-facts>div').filter({has:page.locator('dt').filter({hasText:/^성장$/})})).toHaveText('성장성체');
 const baseline=JSON.parse(readFileSync('docs/collection-age-gen/before-geometry-'+info.project.name+'.json','utf8'));await mkdir('docs/collection-age-gen',{recursive:true});
 for(const width of [360,390,430]){
  await page.setViewportSize({width,height:844});
  const actual=await page.evaluate(()=>{
   const selectors=['.home-info','.home-facts>div','.home-card-grid .home-card','.home-gen-badge','.home-card-grid canvas','.home-hero-art canvas'];
   return Object.fromEntries(selectors.map(s=>[s,Array.from(document.querySelectorAll(s),n=>{const r=n.getBoundingClientRect(),css=getComputedStyle(n);return {x:r.x,y:r.y,width:r.width,height:r.height,...(s==='.home-gen-badge'?{fontSize:css.fontSize,lineHeight:css.lineHeight,fontWeight:css.fontWeight,color:css.color,background:css.background,border:css.border,padding:css.padding}:{})};})]));
  });expect(actual).toEqual(baseline[width]);
  await expect(page.locator('button button')).toHaveCount(0);expect(await page.locator('.reference-content').evaluate(n=>n.scrollHeight<=n.clientHeight+1)).toBe(true);
  if(mobile&&width===390)await page.screenshot({path:'docs/collection-age-gen/after-390.png',scale:'css'});
 }
 expect(await saved(page)).toEqual(game);
});

test('Gen opens the existing real three-generation popup without selecting a card; archived parents and manager remain available',async({page},info)=>{
 const mobile=info.project.name.startsWith('mobile'),f=lineageFixture(),game=act(f.game,{type:'sell',id:f.fatherId},f.game.lastDate);await restore(page,game,mobile);
 const child=game.individuals[f.selectedId],hero=await page.locator('.home-name').textContent(),card=page.getByTestId('hc-card-'+child.id);await expect(card.locator('.home-card-select')).toHaveAttribute('aria-pressed','false');
 const open=async(target:ReturnType<Page['getByTestId']>)=>{await touch(target.getByRole('button',{name:child.name+' 가족 혈통도',exact:true}),mobile);await expect(tree(page)).toBeVisible();await expect(tree(page).locator('.album-tree-cell.is-current .album-tree-card')).toHaveAttribute('data-id',child.id);await expect(tree(page).getByRole('heading',{name:'가족 혈통도',exact:true})).toBeVisible();};
 await open(card);const family=tree(page);await expect(family.locator('.album-tree-card[data-id="'+f.fatherId+'"]')).toContainText('판매 완료');await expect(family.locator('.album-tree-card')).toHaveCount(7);
 await touch(family.getByRole('button',{name:'아버지 '+game.individuals[f.fatherId].name+' 혈통 보기',exact:true}),mobile);await expect(family.locator('.album-tree-cell.is-current .album-tree-card')).toHaveAttribute('data-id',f.fatherId);
 await touch(family.getByRole('button',{name:'상세 창 닫기',exact:true}),mobile);await expect(family).toHaveCount(0);expect(await page.locator('.home-name').textContent()).toBe(hero);await expect(card.locator('.home-card-select')).toHaveAttribute('aria-pressed','false');
 await touch(card.locator('.home-card-select>.home-morph'),mobile);await expect(card.locator('.home-card-select')).toHaveAttribute('aria-pressed','true');
 await openCollectionCatalog(page,mobile);const manager=page.getByRole('dialog',{name:'전체 개체',exact:true}),entry=manager.getByTestId('collection-list-'+child.id),scroll=await manager.locator('.collection-list-scroll').evaluate(n=>n.scrollTop);
 await open(entry);if(mobile){await mkdir('docs/gen-family-popup',{recursive:true});await page.screenshot({path:'docs/gen-family-popup/from-manager-360.png',scale:'css'});}await touch(tree(page).getByRole('button',{name:'상세 창 닫기',exact:true}),mobile);await expect(manager).toBeVisible();expect(await manager.locator('.collection-list-scroll').evaluate(n=>n.scrollTop)).toBe(scroll);await expect(entry.locator('.home-card-select')).toHaveAttribute('aria-pressed','true');expect(await saved(page)).toEqual(game);await expect(page.locator('.game-tab-content')).toHaveAttribute('data-view','collection');
});

test('age uses the same game turns after a month boundary and reload without changing growth rules',async({page},info)=>{
 const mobile=info.project.name.startsWith('mobile'),game=referenceHomeGame(),g=Object.values(game.individuals)[0];g.stage='juvenile';g.birthTurn=-7;g.birthDate=addDays(game.lastDate,-49);g.nextBreedTurn=5;g.cycleAnchor=g.recoverUntil=addDays(game.lastDate,35);validateGame(game);await restore(page,game,mobile);await expect(age(page)).toHaveText('7개월');
 const before=structuredClone(g);
 for(let n=1;n<=2;n++){
  await touch(page.getByRole('button',{name:'턴 넘기기',exact:true}),mobile);await expect(page.getByTestId('game-day')).toHaveText(String(n));await expect(age(page)).toHaveText(n===1?'8개월':'9개월');
 }
 const progressed=await saved(page),child=progressed.individuals[g.id];expect(child.stage).toBe('juvenile');expect(child.birthTurn).toBe(before.birthTurn);expect(child.genotype).toEqual(before.genotype);expect(child.genetics).toEqual(before.genetics);expect(progressed.rules).toEqual(game.rules);expect(progressed.food).toBe(game.food-12);
 await page.reload();await expect(age(page)).toHaveText('9개월');expect(await saved(page)).toEqual(progressed);
});
