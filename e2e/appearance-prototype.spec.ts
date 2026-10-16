import {test,expect,type Locator} from '@playwright/test';
import {fixtureGenome,MORPHS} from '../src/engine/regional/fixtures';
import {regionalAppearance} from '../src/engine/regional';
import {createHash} from 'node:crypto';
import {mkdir,readFile} from 'node:fs/promises';
const hash=(p:Uint8ClampedArray)=>createHash('sha256').update(p).digest('hex');
async function pixels(canvas:Locator){return canvas.evaluate(async(n:HTMLCanvasElement)=>{
 const c=document.createElement('canvas');c.width=c.height=96;const ctx=c.getContext('2d')!;ctx.imageSmoothingEnabled=false;ctx.drawImage(n,0,0,96,96);
 const digest=await crypto.subtle.digest('SHA-256',ctx.getImageData(0,0,96,96).data);return Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');
});}
test('production v2 gallery and all C/S/H compound specimens match actual Node pixels without player storage access',async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{(window as any).__db=[];const open=indexedDB.open.bind(indexedDB);indexedDB.open=((...a:Parameters<IDBFactory['open']>)=>{(window as any).__db.push(a[0]);return open(...a);}) as IDBFactory['open'];});
 await page.goto('/lab/appearance');await expect(page.getByRole('heading',{name:'정식 외형 연구실'})).toBeVisible();
 for(const m of MORPHS){const c=page.getByTestId('regional-sprite-'+m.id);await expect(c).toHaveAttribute('data-renderer-version','regional-2');expect(await pixels(c)).toBe(hash(regionalAppearance({genome:fixtureGenome('typical',m.id),seed:'regional-review-01'}).sprite.pixels));}
 expect(await page.evaluate(()=>(window as any).__db)).toEqual([]);expect(errors).toEqual([]);
 await mkdir('docs/regional-engine',{recursive:true});await page.screenshot({path:'docs/regional-engine/gallery-'+info.project.name+'.png',fullPage:true,scale:'css'});
});
test('low/high, bright/dark, seed and fire changes all use the sole v2 renderer',async({page})=>{
 await page.goto('/lab/appearance');
 for(const profile of ['low','high','dark','bright'] as const){await page.getByRole('combobox',{name:'공통 유전 배경'}).selectOption(profile);for(const m of ['lilly','axanthic'] as const)await expect.poll(()=>pixels(page.getByTestId('regional-sprite-'+m))).toBe(hash(regionalAppearance({genome:fixtureGenome(profile,m),seed:'regional-review-01'}).sprite.pixels));}
 await page.getByRole('textbox',{name:'공통 외형 시드'}).fill('production-replay');await page.getByRole('button',{name:'파이어 업',exact:true}).click();
 await expect.poll(()=>pixels(page.getByTestId('regional-sprite-lilly'))).toBe(hash(regionalAppearance({genome:fixtureGenome('bright','lilly'),seed:'production-replay',fire:'down'}).sprite.pixels));
});
test('96px and integer enlargement remain sharp and fit 360–430px with pane scrolling',async({page})=>{
 await page.goto('/lab/appearance');
 for(const width of [360,390,430]){await page.setViewportSize({width,height:844});for(const scale of [1,3,4]){
  await page.getByRole('button',{name:scale===1?'96px 원본':scale+'배 확대',exact:true}).click();const canvas=page.getByTestId('regional-sprite-normal');await expect(canvas).toHaveAttribute('width',String(96*scale));expect(await canvas.evaluate((c:HTMLCanvasElement)=>c.getContext('2d')!.imageSmoothingEnabled)).toBe(false);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }}
});

test('old active bytes survive load failure; explicit new game archives them and starts the sole regional engine',async({page})=>{
 await page.goto('/');await expect(page.getByRole('heading',{name:/^보유 개체/})).toBeVisible();
 const record={save:JSON.parse(await readFile('tests/fixtures/pre-pattern-v7.json','utf8')),writeRevision:12};
 await page.evaluate(async record=>{const db=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open('gecko-lab',1);r.onsuccess=()=>resolve(r.result);});await new Promise<void>(resolve=>{const tx=db.transaction('games','readwrite');tx.objectStore('games').put(record,'active');tx.oncomplete=()=>{db.close();resolve();};});},record);
 const active=()=>page.evaluate(async()=>{const db=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open('gecko-lab',1);r.onsuccess=()=>resolve(r.result);});return new Promise<any>(resolve=>{const tx=db.transaction('games'),r=tx.objectStore('games').get('active');r.onsuccess=()=>resolve(r.result);tx.oncomplete=()=>db.close();});});
 await page.reload();await expect(page.getByRole('alert').filter({hasText:'새 외형 엔진이 적용'})).toBeVisible();expect(await active()).toEqual(record);
 await page.getByRole('button',{name:'백업 복원 또는 새 게임',exact:true}).click();await page.getByLabel('새 게임 시드',{exact:true}).fill('regional-explicit-start');await page.getByRole('button',{name:'새 게임 준비',exact:true}).click();expect(await active()).toEqual(record);await page.getByRole('button',{name:'새 게임 시작',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
 const fresh=await active();expect(fresh.save.version).toBe(11);expect(fresh.save.game.seed).toBe('regional-explicit-start');expect(Object.values(fresh.save.game.shop.offers).every((o:any)=>o.individual.genetics.appearanceVersion==='regional-2')).toBe(true);
 const archives=await page.evaluate(async()=>{const db=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open('gecko-lab',1);r.onsuccess=()=>resolve(r.result);});return new Promise<any[]>(resolve=>{const tx=db.transaction('games'),r=tx.objectStore('games').getAll();r.onsuccess=()=>resolve(r.result);tx.oncomplete=()=>db.close();});});expect(archives).toContainEqual(record);
 await page.reload();await expect(page.getByRole('heading',{name:/^보유 개체/})).toBeVisible();expect(await active()).toEqual(fresh);
});
