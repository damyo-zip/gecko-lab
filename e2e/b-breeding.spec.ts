import {test,expect,type Locator} from '@playwright/test';
import {createHash} from 'node:crypto';
import {mkdir} from 'node:fs/promises';
import {renderB} from '../src/lab/appearance/b-breeding/render';
import {renderBase} from '../src/lab/appearance/base-study/render';
import {CORE_MORPHS,LEVELS,conditionExamples,family,selectionStudy} from '../src/lab/appearance/b-breeding/samples';
import {fixtureGenome} from '../src/engine/regional/fixtures';

const seed='b-breeding-01';
const hash=(p:Uint8ClampedArray)=>createHash('sha256').update(p).digest('hex');
async function pixels(canvas:Locator){return canvas.evaluate(async(el:HTMLCanvasElement)=>{
 const c=document.createElement('canvas');c.width=c.height=96;const ctx=c.getContext('2d')!;ctx.imageSmoothingEnabled=false;ctx.drawImage(el,0,0,96,96);
 const digest=await crypto.subtle.digest('SHA-256',ctx.getImageData(0,0,96,96).data);return Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');
});}

test('B route uses real native outputs, retains original B, and never opens player storage',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  (window as any).__storage=[];const open=indexedDB.open.bind(indexedDB);
  indexedDB.open=((...args:Parameters<IDBFactory['open']>)=>{(window as any).__storage.push('IDB '+args[0]);return open(...args);}) as IDBFactory['open'];
  const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){(window as any).__storage.push(k);return set.call(this,k,v);};
 });
 await page.goto('/lab/appearance/bases');await page.getByRole('link',{name:'B · 모프 발현과 부모·자손 비교 →'}).click();
 await expect(page.getByRole('heading',{name:'B · 브리딩 감상형 발현 실험'})).toBeVisible();
 await expect.poll(()=>pixels(page.getByTestId('b-original'))).toBe(hash(renderBase('B').pixels));
 for(const m of CORE_MORPHS)for(const l of LEVELS){
  const expected=hash(renderB({genome:fixtureGenome(l.id,m.id),seed}).pixels),id=m.id+'-'+l.id;
  await expect(page.getByTestId('b-native-'+id)).toHaveAttribute('width','96');
  await expect.poll(()=>pixels(page.getByTestId('b-native-'+id))).toBe(expected);
  expect(await pixels(page.getByTestId('b-zoom-'+id))).toBe(expected);
 }
 expect(await page.evaluate(()=>(window as any).__storage)).toEqual([]);expect(errors).toEqual([]);
});

test('individual diversity, controlled pairs, and placement use actual genomes and a stable seed',async({page})=>{
 await page.goto('/lab/appearance/b-breeding');
 for(const morph of CORE_MORPHS){
  await page.getByLabel('비교 모프').selectOption(morph.id);
  for(const condition of ['diverse','brightness','pattern','seed'] as const){
   await page.getByLabel('비교 조건').selectOption(condition);
   const examples=conditionExamples(morph.id,condition,seed);
   await expect(page.locator('[data-testid^="b-native-variety-"]')).toHaveCount(examples.length);
   for(const [n,input] of examples.entries())await expect.poll(()=>pixels(page.getByTestId('b-native-variety-'+n))).toBe(hash(renderB(input).pixels));
  }
 }
 await page.getByLabel('무늬·자손 시드').fill('new-B-visual-seed');
 await expect.poll(()=>pixels(page.getByTestId('b-native-normal-typical'))).toBe(hash(renderB({genome:fixtureGenome('typical','normal'),seed:'new-B-visual-seed'}).pixels));
 await expect.poll(()=>pixels(page.getByTestId('b-original'))).toBe(hash(renderBase('B').pixels));
});

test('three families render first actual children and a reroll leaves both parents unchanged',async({page})=>{
 await page.goto('/lab/appearance/b-breeding');
 for(const id of ['lilly','axanthic','complex'] as const){
  await page.getByLabel('부모 조합').selectOption(id);const f=family(id,seed);
  await expect.poll(()=>pixels(page.getByTestId('b-native-father'))).toBe(hash(renderB(f.father).pixels));
  expect(await pixels(page.getByTestId('b-native-mother'))).toBe(hash(renderB(f.mother).pixels));
  for(const [n,c] of f.children.entries())await expect.poll(()=>pixels(page.getByTestId('b-native-child-'+n))).toBe(hash(renderB(c).pixels));
  await page.getByRole('button',{name:'다른 자손 조합 보기'}).click();const next=family(id,seed+':draw-1');
  for(const [n,c] of next.children.entries())await expect.poll(()=>pixels(page.getByTestId('b-native-child-'+n))).toBe(hash(renderB(c).pixels));
  expect(await pixels(page.getByTestId('b-native-father'))).toBe(hash(renderB(f.father).pixels));
  expect(await pixels(page.getByTestId('b-native-mother'))).toBe(hash(renderB(f.mother).pixels));
 }
});

test('selected generations, collection cards and provisional compounds match the same renderer',async({page})=>{
 await page.goto('/lab/appearance/b-breeding');
 for(const g of selectionStudy().filter(g=>[0,1,3,5].includes(g.generation)))await expect.poll(()=>pixels(page.getByTestId('b-native-generation-'+g.generation))).toBe(hash(renderB(g.selected[0]).pixels));
 for(const m of CORE_MORPHS)expect(await pixels(page.getByTestId('b-card-'+m.id))).toBe(await pixels(page.getByTestId('b-native-'+m.id+'-typical')));
 await page.getByRole('button',{name:'아잔틱 다양성 보기',exact:true}).click();await expect(page.getByLabel('비교 모프')).toHaveValue('axanthic');
 await page.getByText('복합 모프 확장 점검',{exact:true}).click();
 for(const id of ['lilly-axanthic','frappuccino','lilly-sable','cappuccino-highway'] as const)await expect.poll(()=>pixels(page.getByTestId('b-native-compound-'+id))).toBe(hash(renderB({genome:fixtureGenome('typical',id),seed}).pixels));
});

test('native and enlarged canvases retain exact palette colors without interpolation',async({page})=>{
 await page.goto('/lab/appearance/b-breeding');
 const source=Array.from(renderB({genome:fixtureGenome('high','lilly'),seed}).pixels);
 const r=await page.getByTestId('b-zoom-lilly-high').evaluate((c:HTMLCanvasElement,source)=>{
  const colors=new Set<string>();for(let i=0;i<source.length;i+=4)colors.add(source.slice(i,i+4).join());
  const ctx=c.getContext('2d')!,p=ctx.getImageData(0,0,c.width,c.height).data;let invalid=0;
  for(let i=0;i<p.length;i+=4)invalid+=Number(!colors.has(Array.from(p.subarray(i,i+4)).join()));
  return {invalid,smoothing:ctx.imageSmoothingEnabled,css:getComputedStyle(c).imageRendering,width:c.width};
 },source);
 expect(r).toEqual({invalid:0,smoothing:false,css:'pixelated',width:288});
 const natives=await page.locator('[data-testid^="b-native-"]').count();
 await page.getByRole('button',{name:'3배 확대 켜짐',exact:true}).click();
 await expect(page.locator('[data-testid^="b-zoom-"]')).toHaveCount(0);await expect(page.locator('[data-testid^="b-native-"]')).toHaveCount(natives);
});

test('360–430px layout has no page overflow and the comparison table supports touch swipe',async({page},info)=>{
 await mkdir('docs/b-breeding',{recursive:true});await page.goto('/lab/appearance/b-breeding');
 for(const width of [360,390,430]){
  await page.setViewportSize({width,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const cards=page.getByTestId('b-collection-preview');expect(await cards.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
  await expect(cards.locator('article')).toHaveCount(6);
  if(width===390&&info.project.name==='desktop-chromium'){
   await cards.screenshot({path:'docs/b-breeding/collection-390.png',scale:'css'});
   await page.getByTestId('b-family').screenshot({path:'docs/b-breeding/family-390.png',scale:'css'});
   await page.screenshot({path:'docs/b-breeding/browser-390.png',fullPage:true,scale:'css'});
  }
 }
 await page.setViewportSize({width:360,height:800});const pane=page.getByTestId('b-morph-table');await pane.evaluate(el=>el.scrollIntoView({block:'start'}));
 if(info.project.name==='mobile-chromium'){
  const cdp=await page.context().newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:300,y:220}]});
  for(let n=1;n<=12;n++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:300-n*18,y:220}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await expect.poll(()=>pane.evaluate(el=>el.scrollLeft)).toBeGreaterThan(30);await cdp.detach();
 }
 await pane.evaluate(el=>el.scrollLeft=el.scrollWidth);await expect(page.getByTestId('b-native-normal-high')).toBeInViewport();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 if(info.project.name==='desktop-chromium'){
  await pane.evaluate(el=>el.scrollLeft=0);await page.setViewportSize({width:1420,height:1000});await page.screenshot({path:'docs/b-breeding/browser-desktop.png',fullPage:true,scale:'css'});
 }
});
