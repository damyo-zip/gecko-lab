import {test,expect,type Locator} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {FOUNDATIONS,CORE_MORPHS,FOUNDATION_SEED as seed,renderBody,renderFoundation} from '../src/lab/appearance/b-breeding/foundation-study';
import {fixtureGenome} from '../src/engine/regional/fixtures';
import {renderB} from '../src/lab/appearance/b-breeding/render';
const hash=(p:Uint8ClampedArray)=>createHash('sha256').update(p).digest('hex');
async function pixels(canvas:Locator){return canvas.evaluate(async(el:HTMLCanvasElement)=>{
 const c=document.createElement('canvas');c.width=c.height=96;const ctx=c.getContext('2d')!;ctx.imageSmoothingEnabled=false;ctx.drawImage(el,0,0,96,96);
 const d=await crypto.subtle.digest('SHA-256',ctx.getImageData(0,0,96,96).data);return Array.from(new Uint8Array(d),v=>v.toString(16).padStart(2,'0')).join('');
});}
const path='/lab/appearance/b-breeding/bases';

test('three internal bodies and all 18 final specimens match native and enlarged renderer pixels without player storage',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  (window as any).__storage=[];const open=indexedDB.open.bind(indexedDB);
  indexedDB.open=((...a:Parameters<IDBFactory['open']>)=>{(window as any).__storage.push('IDB '+a[0]);return open(...a);}) as IDBFactory['open'];
  const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){(window as any).__storage.push(k);return set.call(this,k,v);};
 });
 await page.goto('/lab/appearance/b-breeding');await page.getByRole('link',{name:'현재·약한 패턴·패턴리스 바디 비교 →'}).click();
 await expect(page.getByRole('heading',{name:'B · 바디와 최종 표현형 분리'})).toBeVisible();
 for(const f of FOUNDATIONS){await expect.poll(()=>pixels(page.getByTestId('foundation-native-body-'+f.id))).toBe(hash(renderBody(f.id).pixels));
  for(const m of CORE_MORPHS){const expected=hash(renderFoundation({genome:fixtureGenome('typical',m.id),seed},f.id).pixels),id=m.id+'-'+f.id;
   await expect(page.getByTestId('foundation-native-'+id)).toHaveAttribute('width','96');await expect.poll(()=>pixels(page.getByTestId('foundation-native-'+id))).toBe(expected);
   expect(await pixels(page.getByTestId('foundation-zoom-'+id))).toBe(expected);
  }
 }
 expect(await page.evaluate(()=>(window as any).__storage)).toEqual([]);expect(errors).toEqual([]);
});

test('normal-pattern toggle, inherited profiles and seed affect finals while the internal body remains fixed',async({page})=>{
 await page.goto(path);
 for(const profile of ['low','high','dark','bright','typical'] as const){
  await page.getByLabel('공통 유전 배경',{exact:true}).selectOption(profile);
  for(const f of FOUNDATIONS){
   await expect.poll(()=>pixels(page.getByTestId('foundation-native-normal-'+f.id))).toBe(hash(renderFoundation({genome:fixtureGenome(profile,'normal'),seed},f.id).pixels));
   expect(await pixels(page.getByTestId('foundation-native-body-'+f.id))).toBe(hash(renderBody(f.id).pixels));
  }
 }
 await page.getByRole('button',{name:'노멀용 패턴 켜짐',exact:true}).click();
 for(const f of FOUNDATIONS)for(const m of CORE_MORPHS)await expect.poll(()=>pixels(page.getByTestId('foundation-native-'+m.id+'-'+f.id))).toBe(hash(renderFoundation({genome:fixtureGenome('typical',m.id),seed},f.id,false).pixels));
 await page.getByRole('button',{name:'노멀용 패턴 꺼짐',exact:true}).click();await page.getByLabel('공통 무늬 시드').fill('foundation-browser-seed');
 for(const f of FOUNDATIONS)await expect.poll(()=>pixels(page.getByTestId('foundation-native-normal-'+f.id))).toBe(hash(renderFoundation({genome:fixtureGenome('typical','normal'),seed:'foundation-browser-seed'},f.id).pixels));
});

test('previous exact B finals stay independently available and canvas enlargement adds no palette colors',async({page})=>{
 await page.goto(path);await page.getByText('직전 B 실험의 정확한 결과 확인',{exact:true}).click();
 for(const m of CORE_MORPHS)await expect.poll(()=>pixels(page.getByTestId('foundation-native-previous-'+m.id))).toBe(hash(renderB({genome:fixtureGenome('typical',m.id),seed}).pixels));
 const source=Array.from(renderFoundation({genome:fixtureGenome('typical','normal'),seed},'clean').pixels);
 const result=await page.getByTestId('foundation-zoom-normal-clean').evaluate((c:HTMLCanvasElement,source)=>{
  const colors=new Set<string>();for(let i=0;i<source.length;i+=4)colors.add(source.slice(i,i+4).join());
  const ctx=c.getContext('2d')!,p=ctx.getImageData(0,0,c.width,c.height).data;let invalid=0;
  for(let i=0;i<p.length;i+=4)invalid+=Number(!colors.has(Array.from(p.subarray(i,i+4)).join()));
  return {invalid,width:c.width,css:getComputedStyle(c).imageRendering,smoothing:ctx.imageSmoothingEnabled};
 },source);expect(result).toEqual({invalid:0,width:288,css:'pixelated',smoothing:false});
 await page.getByRole('button',{name:'3배 확대 켜짐',exact:true}).click();await expect(page.locator('[data-testid^="foundation-zoom-"]')).toHaveCount(0);await expect(page.locator('[data-testid^="foundation-native-"]')).toHaveCount(27);
});

test('collection-size previews remain consistent across foundations at 360–430px and fit inside the card',async({page},info)=>{
 await mkdir('docs/b-foundations',{recursive:true});await page.goto(path);
 for(const width of [360,390,430]){
  await page.setViewportSize({width,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  for(const f of FOUNDATIONS){
   await page.getByRole('button',{name:f.label,exact:true}).click();const phone=page.getByTestId('foundation-card-preview');await expect(phone.locator('article')).toHaveCount(6);
   for(const m of CORE_MORPHS)await expect.poll(()=>pixels(page.getByTestId('foundation-card-'+m.id))).toBe(hash(renderFoundation({genome:fixtureGenome('typical',m.id),seed},f.id).pixels));
   const clipped=await phone.locator('canvas').evaluateAll(items=>items.some(el=>{const r=el.getBoundingClientRect(),p=el.closest('article')!.getBoundingClientRect();return r.left<p.left+1||r.right>p.right-1;}));expect(clipped).toBe(false);
   if(width===390&&info.project.name==='desktop-chromium')await phone.screenshot({path:'docs/b-foundations/cards-'+f.id+'-390.png',scale:'css'});
  }
 }
 if(info.project.name==='desktop-chromium'){
  await page.setViewportSize({width:1420,height:1000});await page.screenshot({path:'docs/b-foundations/browser-desktop.png',fullPage:true,scale:'css'});
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:'docs/b-foundations/browser-390.png',fullPage:true,scale:'css'});
 }
});

test('touch comparison panes scroll horizontally without shifting the whole page',async({page},info)=>{
 await page.setViewportSize({width:360,height:800});await page.goto(path);
 for(const id of ['foundation-body-table','foundation-morph-table']){
  const pane=page.getByTestId(id);await pane.evaluate(el=>el.scrollIntoView({block:'start'}));expect(await pane.evaluate(el=>el.scrollWidth>el.clientWidth)).toBe(true);
  if(info.project.name==='mobile-chromium'){
   const cdp=await page.context().newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:300,y:220}]});
   for(let n=1;n<=12;n++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:300-n*18,y:220}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
   await expect.poll(()=>pane.evaluate(el=>el.scrollLeft)).toBeGreaterThan(30);await cdp.detach();
  }
  await pane.evaluate(el=>el.scrollLeft=el.scrollWidth);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }
});
