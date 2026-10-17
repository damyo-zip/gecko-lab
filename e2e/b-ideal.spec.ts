import {test,expect,type Locator} from '@playwright/test';
import {createHash} from 'node:crypto';
import {mkdir} from 'node:fs/promises';
import {MORPHS} from '../src/lab/appearance/b-breeding/ideal/art';
import {renderIdeal,renderInverse,idealMask} from '../src/lab/appearance/b-breeding/ideal/render';
import {controlGenome,deficitExamples,brightnessExamples,inheritanceFamily,breedingHistory,LAB_SEED} from '../src/lab/appearance/b-breeding/ideal/samples';
import {renderBase} from '../src/lab/appearance/base-study/render';
const path='/lab/appearance/b-breeding/ideal',hash=(p:Uint8ClampedArray)=>createHash('sha256').update(p).digest('hex');
async function pixels(canvas:Locator){return canvas.evaluate(async(el:HTMLCanvasElement)=>{const c=document.createElement('canvas');c.width=c.height=96;const ctx=c.getContext('2d')!;ctx.imageSmoothingEnabled=false;ctx.drawImage(el,0,0,96,96);const d=await crypto.subtle.digest('SHA-256',ctx.getImageData(0,0,96,96).data);return Array.from(new Uint8Array(d),v=>v.toString(16).padStart(2,'0')).join('');});}

test('the six designed ideals and all thirty controlled genomes render the actual native pixels, without opening player storage',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>{(window as any).__storage=[];const open=indexedDB.open.bind(indexedDB);indexedDB.open=((...a:Parameters<IDBFactory['open']>)=>{(window as any).__storage.push(a[0]);return open(...a);}) as IDBFactory['open'];const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){(window as any).__storage.push(k);return set.call(this,k,v);};});
 await page.goto('/lab/appearance/b-breeding');await page.getByRole('link',{name:'최초 B 이상형 역산 실험 →'}).click();await expect(page.getByRole('heading',{name:'최초 B · 이상형에서 출발하기'})).toBeVisible();
 for(const m of MORPHS){const expected=hash(renderIdeal(m.id).pixels);await expect.poll(()=>pixels(page.getByTestId('ideal-native-art-'+m.id))).toBe(expected);await expect.poll(()=>pixels(page.getByTestId('ideal-zoom-art-'+m.id))).toBe(expected);
  for(let n=0;n<5;n++)await expect.poll(()=>pixels(page.getByTestId('ideal-native-step-'+m.id+'-'+n))).toBe(hash(renderInverse({genome:controlGenome(m.id,n),seed:LAB_SEED}).pixels));
 }expect(await page.evaluate(()=>(window as any).__storage)).toEqual([]);expect(errors).toEqual([]);
});
test('the original B, regional and protected maps remain inspectable, with no interpolated colours in the enlarged art',async({page})=>{
 await page.goto(path);await page.getByText('최초 B 무수정 대조군과 영역 확인',{exact:true}).click();for(const id of ['original','normal-reference'])await expect.poll(()=>pixels(page.getByTestId('ideal-native-'+id))).toBe(hash(renderBase('B').pixels));
 for(const mode of ['regions','protected','materials'] as const){await page.getByLabel('영역 표시',{exact:true}).selectOption(mode);for(const m of MORPHS)await expect.poll(()=>pixels(page.getByTestId('ideal-native-mask-'+m.id))).toBe(hash(idealMask(renderIdeal(m.id),mode).pixels));}
 const source=Array.from(renderIdeal('lilly').pixels),result=await page.getByTestId('ideal-zoom-art-lilly').evaluate((c:HTMLCanvasElement,p)=>{const allowed=new Set<string>();for(let i=0;i<p.length;i+=4)allowed.add(p.slice(i,i+4).join());const ctx=c.getContext('2d')!,data=ctx.getImageData(0,0,c.width,c.height).data;let invalid=0;for(let i=0;i<data.length;i+=4)invalid+=Number(!allowed.has(Array.from(data.subarray(i,i+4)).join()));return {invalid,width:c.width,smoothing:ctx.imageSmoothingEnabled,css:getComputedStyle(c).imageRendering};},source);expect(result).toEqual({invalid:0,width:288,smoothing:false,css:'pixelated'});
});
test('independent deficits, inherited lightness, actual first siblings and collection cards change consistently with each selected morph',async({page})=>{
 await page.goto(path);for(const m of MORPHS){await page.getByLabel('비교 모프',{exact:true}).selectOption(m.id);
  for(const[d,n]of deficitExamples(m.id).map((d,n)=>[d,n] as const))await expect.poll(()=>pixels(page.getByTestId('ideal-native-deficit-'+n))).toBe(hash(renderInverse(d).pixels));
  const f=inheritanceFamily(m.id);for(const[g,id]of [[f.father,'father'],[f.mother,'mother'],...f.children.map((c,n)=>[c,'sibling-'+n] as const)] as const){if(g.viable)await expect.poll(()=>pixels(page.getByTestId('ideal-native-'+id))).toBe(hash(renderInverse(g).pixels));else await expect(page.getByTestId('ideal-unviable-'+id)).toBeVisible();}
  await expect(page.getByTestId('ideal-siblings').locator('figure')).toHaveCount(6);const expected=[renderIdeal(m.id),...Array.from({length:5},(_,n)=>renderInverse({genome:controlGenome(m.id,n),seed:LAB_SEED}))];for(let n=0;n<6;n++)await expect.poll(()=>pixels(page.getByTestId('ideal-card-'+n))).toBe(hash(expected[n].pixels));
 }
 await page.getByText('같은 패턴의 밝고 어두운 명도',{exact:true}).click();for(const[e,n]of brightnessExamples('sable').map((e,n)=>[e,n] as const))await expect.poll(()=>pixels(page.getByTestId('ideal-native-light-'+n))).toBe(hash(renderInverse(e).pixels));
});
test('six actual selected generations and unfiltered first embryos retain records, including nonviable and weaker siblings',async({page})=>{
 await page.goto(path);await page.getByLabel('상속·선택교배 시드',{exact:true}).fill('inverse-browser-family');const history=breedingHistory('lilly','inverse-browser-family');
 for(const n of [0,2,4,6])await expect.poll(()=>pixels(page.getByTestId('ideal-native-generation-'+n))).toBe(hash(renderInverse(history[n].selected[0]).pixels));
 for(const n of [1,3,6]){await page.getByLabel('미선별 세대',{exact:true}).selectOption(String(n));await expect(page.getByTestId('ideal-cohort').locator('figure')).toHaveCount(6);for(const[c,i]of history[n].children.slice(0,6).map((c,i)=>[c,i] as const)){if(c.viable)await expect.poll(()=>pixels(page.getByTestId('ideal-native-cohort-'+i))).toBe(hash(renderInverse(c).pixels));else await expect(page.getByTestId('ideal-unviable-cohort-'+i)).toBeVisible();}}
 const table=page.getByRole('table');await expect(table.locator('tbody tr')).toHaveCount(7);for(const g of history)await expect(table.locator('tbody tr').nth(g.generation)).toContainText(g.mean.toFixed(3));
});
test('360–430px native galleries and collection cards fit, the step table swipes internally, and actual mobile captures are generated',async({page},info)=>{
 await mkdir('docs/b-ideal-appearance',{recursive:true});await page.goto(path);
 for(const width of [360,390,430]){await page.setViewportSize({width,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const cards=page.getByTestId('ideal-card-preview');await expect(cards.locator('article')).toHaveCount(6);expect(await cards.locator('canvas').evaluateAll(items=>items.some(el=>{const r=el.getBoundingClientRect(),a=el.closest('article')!.getBoundingClientRect();return r.left+r.width*4/96<a.left||r.left+r.width*93/96>a.right;}))).toBe(false);
  if(width===390&&info.project.name==='desktop-chromium')for(const m of MORPHS){await page.getByLabel('비교 모프',{exact:true}).selectOption(m.id);await cards.screenshot({path:`docs/b-ideal-appearance/cards-${m.id}-390.png`,scale:'css'});}
 }
 await page.setViewportSize({width:360,height:800});const pane=page.getByTestId('ideal-steps-pane');await pane.evaluate(el=>el.scrollIntoView({block:'start'}));expect(await pane.evaluate(el=>el.scrollWidth>el.clientWidth)).toBe(true);
 if(info.project.name==='mobile-chromium'){const box=(await pane.boundingBox())!,y=box.y+100,cdp=await page.context().newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:300,y}]});for(let n=1;n<=12;n++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:300-n*18,y}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await expect.poll(()=>pane.evaluate(el=>el.scrollLeft)).toBeGreaterThan(30);await cdp.detach();}
 if(info.project.name==='desktop-chromium'){await page.setViewportSize({width:1420,height:1000});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'docs/b-ideal-appearance/browser-desktop.png',fullPage:true,scale:'css'});await page.setViewportSize({width:390,height:844});await page.screenshot({path:'docs/b-ideal-appearance/browser-390.png',fullPage:true,scale:'css'});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'docs/b-ideal-appearance/first-screen-390.png',scale:'css'});}
});
