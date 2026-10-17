import {test,expect,type Locator} from '@playwright/test';
import {createHash} from 'node:crypto';
import {mkdir} from 'node:fs/promises';
import {NORMAL_ART} from '../src/lab/appearance/b-breeding/normal-art/art';
import {renderNormalArt,normalPatternMask} from '../src/lab/appearance/b-breeding/normal-art/render';
const path='/lab/appearance/b-breeding/normal-art',hash=(p:Uint8ClampedArray)=>createHash('sha256').update(p).digest('hex');
async function pixels(canvas:Locator){return canvas.evaluate(async(el:HTMLCanvasElement)=>{const c=document.createElement('canvas');c.width=c.height=96;const ctx=c.getContext('2d')!;ctx.imageSmoothingEnabled=false;ctx.drawImage(el,0,0,96,96);const d=await crypto.subtle.digest('SHA-256',ctx.getImageData(0,0,96,96).data);return Array.from(new Uint8Array(d),v=>v.toString(16).padStart(2,'0')).join('');});}

test('eight native and enlarged artworks match renderer pixels; the independent route never opens player storage',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{(window as any).__storage=[];const open=indexedDB.open.bind(indexedDB);indexedDB.open=((...a:Parameters<IDBFactory['open']>)=>{(window as any).__storage.push(a[0]);return open(...a);}) as IDBFactory['open'];const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){(window as any).__storage.push(k);return set.call(this,k,v);};});
 await page.goto('/lab/appearance/b-breeding');await page.getByRole('link',{name:'노멀 독립 패턴 아트 8종 →'}).click();
 await expect(page.getByRole('heading',{name:'B · 노멀 패턴 아트 8종'})).toBeVisible();
 for(const d of NORMAL_ART){const expected=hash(renderNormalArt(d.id).pixels);await expect.poll(()=>pixels(page.getByTestId('normal-native-'+d.id))).toBe(expected);await expect.poll(()=>pixels(page.getByTestId('normal-zoom-'+d.id))).toBe(expected);}
 expect(await page.evaluate(()=>(window as any).__storage)).toEqual([]);expect(errors).toEqual([]);
});
test('pattern masks show the actual eight contours; 3x enlargement introduces no interpolated colours',async({page})=>{
 await page.goto(path);await page.getByText('주요 패턴 마스크 보기',{exact:true}).click();
 for(const d of NORMAL_ART){await expect.poll(()=>pixels(page.getByTestId('normal-mask-'+d.id))).toBe(hash(normalPatternMask(d.id).pixels));
  const source=Array.from(renderNormalArt(d.id).pixels),result=await page.getByTestId('normal-zoom-'+d.id).evaluate((c:HTMLCanvasElement,p)=>{const colors=new Set<string>();for(let i=0;i<p.length;i+=4)colors.add(p.slice(i,i+4).join());const ctx=c.getContext('2d')!,data=ctx.getImageData(0,0,c.width,c.height).data;let invalid=0;for(let i=0;i<data.length;i+=4)invalid+=Number(!colors.has(Array.from(data.subarray(i,i+4)).join()));return {invalid,width:c.width,smoothing:ctx.imageSmoothingEnabled,css:getComputedStyle(c).imageRendering};},source);
  expect(result).toEqual({invalid:0,width:288,smoothing:false,css:'pixelated'});
 }
});
test('all eight fit collection and shop cards at 360–430px, with one centred 50/75/100 percent display scale',async({page},info)=>{
 await mkdir('docs/b-normal-art',{recursive:true});await page.goto(path);
 for(const width of [360,390,430]){
  await page.setViewportSize({width,height:844});
  for(const view of ['collection','shop'] as const){await page.getByRole('button',{name:view==='collection'?'컬렉션 3열':'상점 2열',exact:true}).click();const grid=page.getByTestId('normal-'+view+'-grid');await expect(grid.locator('article')).toHaveCount(8);
   expect(await grid.evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length)).toBe(view==='collection'?3:2);
   for(const stage of ['adult','juvenile','hatchling'] as const){await page.getByLabel('성장 표시',{exact:true}).selectOption(stage);const scale={adult:1,juvenile:.75,hatchling:.5}[stage];expect(await page.getByTestId('normal-growth-original').evaluate(el=>getComputedStyle(el).transform)).toBe(`matrix(${scale}, 0, 0, ${scale}, 0, 0)`);
    const clipped=await grid.locator('canvas').evaluateAll(items=>items.some(el=>{const r=el.getBoundingClientRect(),card=el.closest('article')!.getBoundingClientRect(); // Source B's opaque bounds: conservative 4..93 x 15..81.
     return r.left+r.width*4/96<card.left||r.left+r.width*93/96>card.right||r.top+r.height*15/96<card.top||r.top+r.height*81/96>card.bottom;
    }));expect(clipped).toBe(false);
    if(width===390&&info.project.name==='desktop-chromium')await page.getByTestId('normal-cards').screenshot({path:`docs/b-normal-art/cards-${view}-${stage}-390.png`,scale:'css'});
   }
   await page.getByLabel('성장 표시',{exact:true}).selectOption('adult');
  }expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }
});
test('the native comparison pans inside mobile width; desktop and mobile art captures are produced',async({page},info)=>{
 await mkdir('docs/b-normal-art',{recursive:true});await page.goto(path);await page.setViewportSize({width:360,height:800});
 const pane=page.getByTestId('normal-native-pane');await pane.evaluate(el=>el.scrollIntoView({block:'start'}));expect(await pane.evaluate(el=>el.scrollWidth>el.clientWidth)).toBe(true);
 if(info.project.name==='mobile-chromium'){
  const box=(await pane.boundingBox())!,cdp=await page.context().newCDPSession(page),y=box.y+80;
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:300,y}]});for(let n=1;n<=12;n++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:300-n*18,y}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await expect.poll(()=>pane.evaluate(el=>el.scrollLeft)).toBeGreaterThan(30);await cdp.detach();
 }
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 if(info.project.name==='desktop-chromium'){
  await page.setViewportSize({width:1420,height:1000});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'docs/b-normal-art/browser-desktop.png',fullPage:true,scale:'css'});
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:'docs/b-normal-art/browser-390.png',fullPage:true,scale:'css'});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'docs/b-normal-art/first-screen-390.png',scale:'css'});
 }
});
