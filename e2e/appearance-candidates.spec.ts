import {test,expect,type Locator} from '@playwright/test';
import {fixtureGenome} from '../src/engine/regional/fixtures';
import {renderComparison} from '../src/lab/appearance/candidates';
import {COMPARISONS} from '../src/lab/appearance/policies';
import {createHash} from 'node:crypto';
import {mkdir} from 'node:fs/promises';
const morphs=['normal','lilly','axanthic','cappuccino','highway','sable'] as const;
async function pixels(canvas:Locator){return canvas.evaluate(async(n:HTMLCanvasElement)=>{
 const c=document.createElement('canvas');c.width=c.height=96;const ctx=c.getContext('2d')!;ctx.imageSmoothingEnabled=false;ctx.drawImage(n,0,0,96,96);
 const digest=await crypto.subtle.digest('SHA-256',ctx.getImageData(0,0,96,96).data);return Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');
});}
test('five comparisons use actual Node pixels at native and enlarged sizes with no player storage access',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  (window as any).__writes=[];const open=indexedDB.open.bind(indexedDB);indexedDB.open=((...a:Parameters<IDBFactory['open']>)=>{(window as any).__writes.push('IDB '+a[0]);return open(...a);}) as IDBFactory['open'];
  const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){(window as any).__writes.push('storage '+k);return set.call(this,k,v);};
 });
 await page.goto('/lab/appearance');await page.getByRole('link',{name:/원화 보존 후보 A\/B\/C 비교/}).click();
 await expect(page.getByRole('heading',{name:'원화 보존 후보 비교'})).toBeVisible();
 for(const m of morphs)for(const c of COMPARISONS){
  const expected=createHash('sha256').update(renderComparison({genome:fixtureGenome('typical',m),seed:'regional-review-01'},c.id).pixels).digest('hex');
  await expect.poll(()=>pixels(page.getByTestId('native-'+m+'-'+c.id))).toBe(expected);
  expect(await pixels(page.getByTestId('zoom-'+m+'-'+c.id))).toBe(expected);
 }
 expect(await page.evaluate(()=>(window as any).__writes)).toEqual([]);expect(errors).toEqual([]);
});
test('profile, seed and fire are shared by every column, including high Lilly and light/dark Ax',async({page})=>{
 await page.goto('/lab/appearance/candidates');
 for(const profile of ['low','high','dark','bright'] as const){
  await page.getByRole('combobox',{name:'공통 유전 배경'}).selectOption(profile);
  for(const id of COMPARISONS)for(const m of ['lilly','axanthic'] as const){
   const expected=createHash('sha256').update(renderComparison({genome:fixtureGenome(profile,m),seed:'regional-review-01'},id.id).pixels).digest('hex');
   await expect.poll(()=>pixels(page.getByTestId('native-'+m+'-'+id.id))).toBe(expected);
  }
 }
 await page.getByRole('textbox',{name:'공통 외형 시드'}).fill('candidate-replay');await page.getByRole('button',{name:'파이어 업',exact:true}).click();
 for(const c of COMPARISONS){const expected=createHash('sha256').update(renderComparison({genome:fixtureGenome('bright','lilly'),seed:'candidate-replay',fire:'down'},c.id).pixels).digest('hex');await expect.poll(()=>pixels(page.getByTestId('native-lilly-'+c.id))).toBe(expected);}
});
test('360–430px shows sharp native pixels and scrolls the comparison pane, never the page width',async({page},info)=>{
 await page.goto('/lab/appearance/candidates');
 for(const width of [360,390,430]){
  await page.setViewportSize({width,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const pane=page.getByTestId('candidate-viewport');expect(await pane.evaluate(el=>el.scrollWidth>el.clientWidth)).toBe(true);
  const canvas=page.getByTestId('native-normal-A');await expect(canvas).toHaveAttribute('width','96');expect(await canvas.evaluate(el=>getComputedStyle(el).imageRendering)).toBe('pixelated');
  expect(await page.getByTestId('zoom-lilly-C').evaluate((el:HTMLCanvasElement)=>el.getContext('2d')!.imageSmoothingEnabled)).toBe(false);
  await pane.evaluate(el=>{el.scrollIntoView({block:'start'});el.scrollLeft=el.scrollWidth;});await expect(page.getByTestId('native-normal-C')).toBeInViewport();
 }
 if(info.project.name==='mobile-chromium'){
  const pane=page.getByTestId('candidate-viewport');await pane.evaluate(el=>{el.scrollIntoView({block:'start'});el.scrollLeft=0;});
  const box=(await pane.boundingBox())!,cdp=await page.context().newCDPSession(page),y=Math.max(100,box.y+210);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:300,y}]});
  for(let n=1;n<=12;n++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:300-n*18,y}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await expect.poll(()=>pane.evaluate(el=>el.scrollLeft)).toBeGreaterThan(30);await cdp.detach();
 }
 await page.getByRole('button',{name:'3배 확대 켜짐',exact:true}).click();await expect(page.locator('canvas')).toHaveCount(30);
 await page.getByRole('button',{name:'3배 확대 꺼짐',exact:true}).click();
 await mkdir('docs/appearance-candidates',{recursive:true});
 if(info.project.name==='mobile-chromium'){
  await page.setViewportSize({width:390,height:844});await page.getByTestId('candidate-viewport').evaluate(el=>{el.scrollIntoView({block:'start'});el.scrollLeft=3*310;});
  await page.screenshot({path:'docs/appearance-candidates/mobile-390.png',scale:'css'});
  await page.screenshot({path:'docs/appearance-candidates/mobile-390-full.png',fullPage:true,scale:'css'});
 }else{
  await page.setViewportSize({width:1640,height:1000});await page.getByTestId('candidate-viewport').evaluate(el=>el.scrollLeft=0);
  await page.screenshot({path:'docs/appearance-candidates/browser-desktop.png',fullPage:true,scale:'css'});
 }
});
