import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';
import {lineageFixture} from './helpers/forge-fixtures';
import {exportBackup} from '../src/game/hardcore/save';
import {act} from '../src/game/hardcore/play';
import type {HardcoreGame} from '../src/game/hardcore/model';
import {touch,navigateGame} from './helpers/hardcore-navigation';
import {visualName} from '../src/game/hardcore/adapter';

const family=(p:Page)=>p.getByRole('dialog',{name:'가족 혈통도',exact:true});
const current=(p:Page)=>family(p).locator('.album-tree-cell.is-current .album-tree-card');
async function saved(p:Page):Promise<HardcoreGame>{return p.evaluate(async()=>{
 const db=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open('gecko-lab',1);r.onsuccess=()=>resolve(r.result);});
 return new Promise(resolve=>{const tx=db.transaction('games'),r=tx.objectStore('games').get('active');r.onsuccess=()=>resolve(r.result.save.game);tx.oncomplete=()=>db.close();});
});}
async function restore(p:Page,g:HardcoreGame,mobile:boolean){
 await touch(p.getByRole('button',{name:'저장 및 게임 설정',exact:true}),mobile);await p.getByLabel('JSON 백업 파일',{exact:true}).setInputFiles({name:'family.json',mimeType:'application/json',buffer:Buffer.from(exportBackup(g))});await touch(p.getByRole('button',{name:'복원 실행',exact:true}),mobile);await expect(p.getByRole('dialog')).toHaveCount(0);
}
const errors=new WeakMap<Page,string[]>();
test.beforeEach(async({page})=>{errors.set(page,[]);page.on('pageerror',e=>errors.get(page)!.push(e.message));await page.clock.setFixedTime(new Date('2026-10-14T03:00:00Z'));await page.goto('/');await expect(page.getByRole('heading',{name:/^보유 개체/})).toBeVisible();});
test.afterEach(({page})=>{expect(errors.get(page)).toEqual([]);});

test('Gen renders only family and descendants, keeps natural height and scrolls internally only when necessary',async({page},info)=>{
 const mobile=info.project.name.startsWith('mobile'),f=lineageFixture(),g=f.game.individuals[f.selectedId];await restore(page,f.game,mobile);await touch(page.getByTestId('hc-card-'+g.id).getByRole('button',{name:g.name+' 가족 혈통도',exact:true}),mobile);
 const d=family(page);await expect(d).toBeVisible();await expect(current(page)).toHaveAttribute('data-id',g.id);await expect(d.locator('.dialog-heading h2')).toHaveText('가족 혈통도');await expect(d.getByRole('heading',{name:'가족 혈통도',exact:true})).toHaveCount(1);
 await expect(d.locator('.album-selected,.album-comparison,.breeding-challenge-panel,.album-save-note,.album-quick-select')).toHaveCount(0);await expect(d.locator('.album-family')).toHaveCount(1);await expect(d.locator('.album-children')).toContainText('후손 0마리');await expect(d.locator('.album-children')).toContainText('아직 후손이 없습니다. 부화한 자손은 이곳에 연결됩니다.');
 await mkdir('docs/gen-family-popup',{recursive:true});
 for(const [width,height] of [[360,640],[360,800],[390,844],[430,932]]){
  await page.setViewportSize({width,height});const bounds=(await d.boundingBox())!;expect(bounds.y).toBeGreaterThanOrEqual(0);expect(bounds.y+bounds.height).toBeLessThanOrEqual(height);expect(await d.evaluate(n=>n.scrollWidth<=n.clientWidth)).toBe(true);expect(await page.locator('.reference-content').evaluate(n=>n.scrollTop)).toBe(0);
  const title=(await d.locator('.dialog-heading h2').boundingBox())!,close=(await d.getByRole('button',{name:'상세 창 닫기',exact:true}).boundingBox())!;expect(close.x).toBeGreaterThan(title.x+title.width);expect(close.y+close.height).toBeLessThanOrEqual(bounds.y+bounds.height);
  if(height>=800){expect(await d.evaluate(n=>n.scrollHeight<=n.clientHeight+1)).toBe(true);expect(bounds.height).toBeLessThan(height-24);}
  if(await d.evaluate(n=>n.scrollHeight<=n.clientHeight+1)){const body=(await d.locator('.album-reference').boundingBox())!;expect(bounds.y+bounds.height-body.y-body.height).toBeLessThanOrEqual(12);}
  if(mobile&&width===390)await page.screenshot({path:'docs/gen-family-popup/compact-390.png',scale:'css'});
 }
 await page.setViewportSize({width:360,height:400});expect(await d.evaluate(n=>n.scrollHeight>n.clientHeight)).toBe(true);await d.evaluate(n=>n.scrollTop=n.scrollHeight);await expect(d.getByRole('button',{name:'상세 창 닫기',exact:true})).toBeInViewport();await touch(d.getByRole('button',{name:'상세 창 닫기',exact:true}),mobile);await expect(d).toHaveCount(0);expect(await saved(page)).toEqual(f.game);
});

test('existing descendants, archived parents and other-individual picker navigate the same family without changing game data',async({page},info)=>{
 const mobile=info.project.name.startsWith('mobile'),f=lineageFixture(),game=act(f.game,{type:'sell',id:f.fatherId},f.game.lastDate),child=game.individuals[f.selectedId];await restore(page,game,mobile);
 const hero=await page.locator('.home-name').textContent();await touch(page.getByTestId('hc-card-'+child.id).getByRole('button',{name:child.name+' 가족 혈통도',exact:true}),mobile);const d=family(page);
 await touch(d.getByRole('button',{name:'아버지 '+game.individuals[f.fatherId].name+' 혈통 보기',exact:true}),mobile);await expect(current(page)).toHaveAttribute('data-id',f.fatherId);await expect(current(page)).toContainText('판매 완료');await expect(d.locator('.album-children>div').first()).toContainText('후손 2마리');await expect(d.locator('.album-child-grid>button')).toHaveCount(2);
 const grandfatherId=game.individuals[f.fatherId].parents!.fatherId;
 await touch(d.getByRole('button',{name:'아버지 '+game.individuals[grandfatherId].name+' 혈통 보기',exact:true}),mobile);await expect(current(page)).toHaveAttribute('data-id',grandfatherId);await expect(d.locator('.album-tree-missing')).toHaveCount(6);await expect(d.locator('.album-children')).toContainText('후손 3마리');
 await touch(d.locator('.album-child-grid>button[data-id="'+f.fatherId+'"]'),mobile);await expect(current(page)).toHaveAttribute('data-id',f.fatherId);await expect(d.locator('.album-children')).toContainText('후손 2마리');
 await d.getByRole('searchbox',{name:'후손 검색',exact:true}).fill('존재하지않는후손');await expect(d.locator('.album-children')).toContainText('검색한 후손이 없습니다.');await expect(d.locator('.album-children')).toContainText('후손 2마리');await d.getByRole('searchbox',{name:'후손 검색',exact:true}).fill(child.id);
 await touch(d.getByRole('button',{name:child.name+' 후손 혈통 보기',exact:true}),mobile);await expect(current(page)).toHaveAttribute('data-id',child.id);await expect(d.locator('.album-children')).toContainText('후손 0마리');
 const picker=page.getByRole('dialog',{name:'혈통을 볼 개체 선택',exact:true});await touch(d.getByRole('button',{name:'다른 개체 보기',exact:true}),mobile);await expect(picker).toBeVisible();await touch(picker.getByRole('button',{name:'상세 창 닫기',exact:true}),mobile);await expect(current(page)).toHaveAttribute('data-id',child.id);
 await touch(d.getByRole('button',{name:'다른 개체 보기',exact:true}),mobile);await picker.getByLabel('이름 또는 고유 ID',{exact:true}).fill(f.motherId);await touch(picker.getByRole('button',{name:game.individuals[f.motherId].name+' 혈통 선택',exact:true}),mobile);await expect(picker).toHaveCount(0);await expect(current(page)).toHaveAttribute('data-id',f.motherId);await expect(d.locator('.album-children')).toContainText('후손 2마리');await expect(d.locator('.album-child-grid>button')).toHaveCount(2);
 if(mobile)await page.screenshot({path:'docs/gen-family-popup/descendants-360.png',scale:'css'});await touch(d.getByRole('button',{name:'상세 창 닫기',exact:true}),mobile);expect(await page.locator('.home-name').textContent()).toBe(hero);expect(await saved(page)).toEqual(game);
});

test('full lineage tab retains the original selected info, family, comparison markup and geometry',async({page},info)=>{
 const mobile=info.project.name.startsWith('mobile'),f=lineageFixture();await restore(page,f.game,mobile);await navigateGame(page,'혈통도',mobile);await page.getByLabel('혈통을 볼 개체',{exact:true}).selectOption(f.selectedId);
 const baseline=JSON.parse(readFileSync('docs/gen-family-popup/full-before-'+info.project.name+'.json','utf8'));
 for(const width of [360,390,430]){
  await page.setViewportSize({width,height:844});await page.locator('.reference-content').evaluate(n=>n.scrollTop=0);
  for(const node of await page.locator('.album-tree-card,.album-compare-card').all()){
   const id=(await node.getAttribute('data-id'))!;await expect(node).toContainText(visualName(f.game.individuals[id]));
   await expect(node.locator('canvas')).toHaveAttribute('data-renderer-version','b-origin-01-companion-lineage-1');
  }
  await expect(page.locator('.album-selected-facts dl>div:first-child>dd')).toHaveText(visualName(f.game.individuals[f.selectedId]));
  expect(await page.locator('.album-selected-facts dd,.album-compare-caption p').evaluateAll(nodes=>nodes.every(n=>n.scrollWidth<=n.clientWidth+1))).toBe(true);
  // New morph names can wrap onto extra lines, depending on the browser font.
  // Verify live labels above, then measure with the original labels so the
  // unchanged layout is compared using identical text on every runner.
  const labels='.album-tree-morph,.album-selected-facts dl>div:first-child>dd,.album-compare-caption>p';
  const liveLabels=await page.locator('.album-selected,.album-family,.album-comparison').evaluateAll((nodes,{rows,selector})=>nodes.map((node,i)=>{
   const reference=new DOMParser().parseFromString(rows[i].html,'text/html');
   const originals=Array.from(reference.querySelectorAll(selector));
   return Array.from(node.querySelectorAll(selector)).map((label,j)=>{const live=label.textContent;label.textContent=originals[j].textContent;return live;});
  }),{rows:baseline[width] as {html:string}[],selector:labels});
  try{
  const actual=await page.locator('.album-selected,.album-family,.album-comparison').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {className:n.className,html:n.outerHTML,rect:{x:r.x,y:r.y,width:r.width,height:r.height}};}));
  // Keep the original structural/geometry snapshot. Only the intentionally
  // replaced appearance fields are compared separately against the live model.
  const layout=(rows:typeof actual)=>rows.map(r=>({...r,html:r.html
   .replace(/data-renderer-version="[^"]+"/g,'data-renderer-version="appearance"')
   .replace(/(<span class="album-tree-morph">)[^<]*(<\/span>)/g,'$1appearance$2')
   .replace(/(<dt>모프<\/dt><dd>)[^<]*(<\/dd>)/g,'$1appearance$2')
   .replace(/(<div class="album-compare-caption">[\s\S]*?<p>)[^<]*(<\/p>)/g,'$1appearance$2')}));
  expect(layout(actual)).toEqual(layout(baseline[width]));
  }finally{
   await page.locator('.album-selected,.album-family,.album-comparison').evaluateAll((nodes,{rows,selector})=>nodes.forEach((node,i)=>{
    node.querySelectorAll(selector).forEach((label,j)=>{label.textContent=rows[i][j];});
   }),{rows:liveLabels,selector:labels});
  }
 }
 await expect(page.locator('.breeding-challenge-panel')).toBeVisible();await expect(page.locator('.album-save-note')).toHaveCount(1);expect(await saved(page)).toEqual(f.game);
});
