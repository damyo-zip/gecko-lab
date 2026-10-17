import {test,expect,type Locator} from '@playwright/test';
import {renderBase} from '../src/lab/appearance/base-study/render';
import {DESIGNS,VARIANTS} from '../src/lab/appearance/base-study/designs';
import {referenceSprite} from '../src/lab/appearance/base-study/reference';
import {createHash} from 'node:crypto';
import {mkdir} from 'node:fs/promises';
const hash=(p:Uint8ClampedArray)=>createHash('sha256').update(p).digest('hex');
async function pixels(c:Locator){return c.evaluate(async(el:HTMLCanvasElement)=>{
 const canvas=document.createElement('canvas');canvas.width=canvas.height=96;const ctx=canvas.getContext('2d')!;ctx.imageSmoothingEnabled=false;ctx.drawImage(el,0,0,96,96);
 const d=await crypto.subtle.digest('SHA-256',ctx.getImageData(0,0,96,96).data);return Array.from(new Uint8Array(d),v=>v.toString(16).padStart(2,'0')).join('');
});}
test('new bases and all expression variants match actual 96px source and do not open player storage',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>{
  (window as any).__storage=[];const open=indexedDB.open.bind(indexedDB);indexedDB.open=((...a:Parameters<IDBFactory['open']>)=>{(window as any).__storage.push('IDB '+a[0]);return open(...a);}) as IDBFactory['open'];
  const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){(window as any).__storage.push(k);return set.call(this,k,v);};
 });
 await page.goto('/lab/appearance');await page.getByRole('link',{name:'새 96px 베이스 A/B/C 탐색 →',exact:true}).click();
 await expect(page.getByRole('heading',{name:'새 96px 베이스 탐색'})).toBeVisible();
 for(const d of DESIGNS)for(const v of VARIANTS){const expected=hash(renderBase(d.id,v.id).pixels);await expect.poll(()=>pixels(page.getByTestId('base-native-'+v.id+'-'+d.id))).toBe(expected);expect(await pixels(page.getByTestId('base-zoom-'+v.id+'-'+d.id))).toBe(expected);}
 expect(await pixels(page.getByTestId('base-native-normal-reference'))).toBe(hash(referenceSprite('normal','authored').pixels));
 await page.getByLabel('패턴 배치 시드').fill('alternate-base-pattern');
 for(const d of DESIGNS){await expect.poll(()=>pixels(page.getByTestId('base-native-rich-'+d.id))).toBe(hash(renderBase(d.id,'rich','alternate-base-pattern').pixels));expect(await pixels(page.getByTestId('base-native-normal-'+d.id))).toBe(hash(renderBase(d.id).pixels));}
 await page.getByLabel('기존 참고 외형').selectOption('regional');await expect.poll(()=>pixels(page.getByTestId('base-native-normal-reference'))).toBe(hash(referenceSprite('normal','regional').pixels));
 expect(await page.evaluate(()=>(window as any).__storage)).toEqual([]);expect(errors).toEqual([]);
});
test('48/72/96px and integer enlargement use only exact source colors with smoothing disabled',async({page})=>{
 await page.goto('/lab/appearance/bases');
 for(const d of DESIGNS)for(const size of [48,72,96]){
  const c=page.getByTestId('growth-'+d.id+'-'+size),source=Array.from(renderBase(d.id).pixels);
  await expect(c).toHaveAttribute('width',String(size));const result=await c.evaluate((canvas:HTMLCanvasElement,source)=>{
   const colors=new Set<string>();for(let i=0;i<9216;i++)colors.add(source.slice(i*4,i*4+4).join());
   const ctx=canvas.getContext('2d')!,p=ctx.getImageData(0,0,canvas.width,canvas.height).data;let invalid=0;for(let i=0;i<p.length;i+=4)invalid+=Number(!colors.has(Array.from(p.subarray(i,i+4)).join()));
   return {invalid,smoothing:ctx.imageSmoothingEnabled,css:getComputedStyle(canvas).imageRendering};
  },source);expect(result).toEqual({invalid:0,smoothing:false,css:'pixelated'});
 }
 await page.getByRole('button',{name:'3배 확대 켜짐',exact:true}).click();await expect(page.locator('[data-testid^="base-zoom-"]')).toHaveCount(0);await expect(page.locator('[data-testid^="base-native-"]')).toHaveCount(20);
});
test('all five game-like layouts fit mobile widths and incubator uses exactly the 50% specimen',async({page},info)=>{
 await mkdir('docs/base-study',{recursive:true});await page.goto('/lab/appearance/bases');
 for(const width of [360,390,430]){
  await page.setViewportSize({width,height:844});for(const layout of ['collection','shop','breeding','incubator','lineage']){
   await page.getByLabel('화면 구성').selectOption(layout);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   const phone=page.getByTestId('base-game-preview');expect(await phone.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
   await expect(phone.locator('nav button')).toHaveText(['컬렉션','인큐베이터','혈통도','상점']);
   if(layout==='incubator')await expect(page.getByTestId('preview-baby-0')).toHaveAttribute('width','48');
   if(width===390&&info.project.name==='desktop-chromium')await phone.screenshot({path:'docs/base-study/preview-'+layout+'-390.png',scale:'css'});
  }
 }
 await page.getByLabel('화면 구성').selectOption('collection');await page.getByLabel('선택 후보').selectOption('C');await expect.poll(()=>pixels(page.getByTestId('preview-hero'))).toBe(hash(renderBase('C').pixels));
 await page.getByLabel('표현 변형').selectOption('dark');await expect.poll(()=>pixels(page.getByTestId('preview-hero'))).toBe(hash(renderBase('C','dark').pixels));
 if(info.project.name==='desktop-chromium'){
  await page.setViewportSize({width:1420,height:1000});await page.getByLabel('표현 변형').selectOption('normal');await page.screenshot({path:'docs/base-study/browser-desktop.png',fullPage:true,scale:'css'});
 }
});
test('360px touch swipe compares columns without moving the page sideways',async({page},info)=>{
 await page.setViewportSize({width:360,height:800});await page.goto('/lab/appearance/bases');
 const pane=page.getByTestId('base-comparison');await pane.evaluate(el=>el.scrollIntoView({block:'start'}));
 expect(await pane.evaluate(el=>el.scrollWidth>el.clientWidth)).toBe(true);
 if(info.project.name==='mobile-chromium'){
  const cdp=await page.context().newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:300,y:220}]});
  for(let n=1;n<=12;n++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:300-n*18,y:220}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await expect.poll(()=>pane.evaluate(el=>el.scrollLeft)).toBeGreaterThan(30);await cdp.detach();
 }
 await pane.evaluate(el=>el.scrollLeft=el.scrollWidth);await expect(page.getByTestId('base-native-normal-C')).toBeInViewport();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
