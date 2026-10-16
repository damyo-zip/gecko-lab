import {test,expect,type Page,type Locator} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {comparison,fixtureGenome} from '../src/prototype/appearance/fixtures';
import {createHash} from 'node:crypto';
import {touch} from './helpers/hardcore-navigation';

const hash=(p:Uint8ClampedArray)=>createHash('sha256').update(p).digest('hex');
async function pixelHash(canvas:Locator){return canvas.evaluate(async(n:HTMLCanvasElement)=>{
 const logical=document.createElement('canvas');logical.width=logical.height=96;const ctx=logical.getContext('2d')!;ctx.imageSmoothingEnabled=false;ctx.drawImage(n,0,0,96,96);
 const digest=await crypto.subtle.digest('SHA-256',ctx.getImageData(0,0,96,96).data);
 return Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');
});}
const errors=new WeakMap<Page,string[]>();
test.beforeEach(async({page})=>{
 errors.set(page,[]);page.on('pageerror',e=>errors.get(page)!.push(e.message));
 await page.addInitScript(()=>{
  (window as any).__appearanceDbOpens=[];
  const open=indexedDB.open.bind(indexedDB);
  indexedDB.open=((...args:Parameters<IDBFactory['open']>)=>{(window as any).__appearanceDbOpens.push(args[0]);return open(...args);}) as IDBFactory['open'];
 });
});
test.afterEach(({page})=>{expect(errors.get(page)).toEqual([]);});

test('actual browser pixels match controlled reports; only genotype changes and the lab never opens player storage',async({page},info)=>{
 await page.goto('/lab/appearance');await expect(page.getByRole('heading',{name:'모프 외형 비교 연구실'})).toBeVisible();
 await expect(page.locator('[data-testid^="appearance-pair-"]')).toHaveCount(6);
 for(const id of ['normal','lilly','axanthic','cappuccino','highway','sable'] as const){
  const c=comparison('typical',id,'regional-review-01');
  expect(c.genome.polygenic).toEqual(fixtureGenome('typical','normal').polygenic);
  await expect.poll(()=>pixelHash(page.getByTestId('appearance-old-'+id))).toBe(hash(c.old.pixels));
  await expect.poll(()=>pixelHash(page.getByTestId('appearance-new-'+id))).toBe(hash(c.improved.sprite.pixels));
  await expect.poll(()=>pixelHash(page.getByTestId('appearance-relief-'+id))).toBe(hash(c.relief.sprite.pixels));
 }
 expect(await page.evaluate(()=>(window as any).__appearanceDbOpens)).toEqual([]);
 await mkdir('docs/appearance-relief',{recursive:true});
 await page.screenshot({path:'docs/appearance-relief/lab-'+info.project.name+'.png',fullPage:true,scale:'css'});
});

test('low/high facial expression, independent brightness, seed replay, fire and compound previews respond without rerolling genes',async({page},info)=>{
 const mobile=info.project.name.startsWith('mobile');await page.goto('/lab/appearance');
 const select=page.getByRole('combobox',{name:'공통 유전 배경'});
 for(const profile of ['low','high','dark','bright'] as const){
  await select.selectOption(profile);
  for(const id of ['lilly','axanthic'] as const){
   const c=comparison(profile,id,'regional-review-01');await expect.poll(()=>pixelHash(page.getByTestId('appearance-new-'+id))).toBe(hash(c.improved.sprite.pixels));
   await expect.poll(()=>pixelHash(page.getByTestId('appearance-relief-'+id))).toBe(hash(c.relief.sprite.pixels));
  }
 }
 await select.selectOption('typical');const original=await pixelHash(page.getByTestId('appearance-new-cappuccino'));
 await page.getByRole('textbox',{name:'공통 외형 시드'}).fill('mobile-replay-02');await touch(page.getByRole('button',{name:'시드 적용',exact:true}),mobile);
 await expect.poll(()=>pixelHash(page.getByTestId('appearance-new-cappuccino'))).not.toBe(original);
 await touch(page.getByRole('button',{name:'파이어 업',exact:true}),mobile);
 await expect.poll(()=>pixelHash(page.getByTestId('appearance-new-axanthic'))).toBe(hash(comparison('typical','axanthic','mobile-replay-02','down').improved.sprite.pixels));
 await expect.poll(()=>pixelHash(page.getByTestId('appearance-relief-axanthic'))).toBe(hash(comparison('typical','axanthic','mobile-replay-02','down').relief.sprite.pixels));
 await touch(page.getByRole('button',{name:'복합 모프 비교',exact:true}),mobile);await expect(page.locator('[data-testid^="appearance-pair-"]')).toHaveCount(10);
 await expect.poll(()=>pixelHash(page.getByTestId('appearance-new-lilly-axanthic'))).toBe(hash(comparison('typical','lilly-axanthic','mobile-replay-02','down').improved.sprite.pixels));
 await expect.poll(()=>pixelHash(page.getByTestId('appearance-relief-lilly-axanthic'))).toBe(hash(comparison('typical','lilly-axanthic','mobile-replay-02','down').relief.sprite.pixels));
 await touch(page.getByRole('button',{name:/저발현 · 일반 · 극단 발현 한눈에 보기/}),mobile);
 await expect(page.getByTestId('expression-gallery').locator('canvas')).toHaveCount(45);
 await expect.poll(()=>pixelHash(page.getByTestId('expression-lilly-high'))).toBe(hash(comparison('high','lilly','mobile-replay-02','down').improved.sprite.pixels));
 await expect.poll(()=>pixelHash(page.getByTestId('expression-v2-lilly-high'))).toBe(hash(comparison('high','lilly','mobile-replay-02','down').relief.sprite.pixels));
 expect(await page.evaluate(()=>(window as any).__appearanceDbOpens)).toEqual([]);
});

test('360–430px mobile comparison and touch controls fit without horizontal overflow; portrait screenshots remain sharp',async({page},info)=>{
 await page.goto('/lab/appearance');
 for(const width of [360,390,430]){
  await page.setViewportSize({width,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  for(const button of await page.locator('main button').all()){
   const box=await button.boundingBox();expect(box!.height).toBeGreaterThanOrEqual(44);expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(width);
  }
  for(const canvas of await page.locator('canvas').all()){
   const box=await canvas.boundingBox();expect(box!.width).toBe(98);expect(box!.width/box!.height).toBeCloseTo(1,3);
   expect(await canvas.getAttribute('width')).toBe('96');
   expect(await canvas.evaluate(n=>getComputedStyle(n).imageRendering)).toBe('pixelated');
  }
 }
 if(info.project.name.startsWith('mobile')){await page.setViewportSize({width:390,height:844});await page.screenshot({path:'docs/appearance-relief/mobile-390.png',fullPage:true,scale:'css'});}
});

test('integer enlargement keeps identical logical pixels; only the comparison pane scrolls and structure measurements remain readable',async({page},info)=>{
 await page.goto('/lab/appearance');await page.setViewportSize({width:360,height:800});
 const canvas=page.getByTestId('appearance-relief-normal'),before=await pixelHash(canvas);
 for(const scale of [3,4]){
  await touch(page.getByRole('button',{name:scale+'배 확대',exact:true}),info.project.name.startsWith('mobile'));
  await expect(canvas).toHaveAttribute('width',String(96*scale));
  const box=await canvas.boundingBox();expect(box!.width).toBe(96*scale+2);
  expect(await pixelHash(canvas)).toBe(before);
  expect(await canvas.evaluate((n:HTMLCanvasElement)=>n.getContext('2d')!.imageSmoothingEnabled)).toBe(false);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }
 await page.getByRole('button',{name:'96px 원본',exact:true}).click();
 await page.getByTestId('appearance-pair-normal').getByText('구조·질감 측정',{exact:true}).click();
 const table=page.getByTestId('appearance-pair-normal').getByRole('table');await expect(table).toBeVisible();
 await expect(table.getByRole('row')).toHaveCount(8);
 const first=await page.getByTestId('appearance-old-normal').boundingBox(),third=await canvas.boundingBox();
 expect(first!.x).toBeGreaterThanOrEqual(0);expect(third!.x+third!.width).toBeLessThanOrEqual(360);
});

test('visiting the prototype leaves the actual persisted active game byte-identical',async({page})=>{
 await page.goto('/');await expect(page.getByRole('heading',{name:/^보유 개체/})).toBeVisible();
 const saved=()=>page.evaluate(async()=>{
  const db=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open('gecko-lab',1);r.onsuccess=()=>resolve(r.result);});
  return new Promise<string>(resolve=>{const tx=db.transaction('games'),req=tx.objectStore('games').get('active');req.onsuccess=()=>resolve(JSON.stringify(req.result));tx.oncomplete=()=>db.close();});
 });
 const before=await saved();await page.goto('/lab/appearance');
 await expect(page.getByRole('heading',{name:'모프 외형 비교 연구실'})).toBeVisible();
 await page.getByRole('combobox',{name:'공통 유전 배경'}).selectOption('high');
 await page.getByRole('button',{name:'복합 모프 비교',exact:true}).click();
 expect(await page.evaluate(()=>(window as any).__appearanceDbOpens)).toEqual([]);
 expect(await saved()).toBe(before);
});
