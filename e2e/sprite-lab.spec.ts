import {test,expect} from '@playwright/test';
import {fixtureGenome} from '../src/engine/regional/fixtures';
import {regionalAppearance} from '../src/engine/regional';

test.beforeEach(async({page})=>{await page.goto('/lab');await expect(page.getByTestId('regional-sprite-normal')).toHaveAttribute('data-renderer-version','regional-2');});
test('six core morphs and all compound examples remain distinct in Korean with no page overflow',async({page},info)=>{
 await expect(page.locator('html')).toHaveAttribute('lang','ko');const images=[];
 for(const id of ['normal','lilly','axanthic','cappuccino','highway','sable'])images.push(await page.getByTestId('regional-sprite-'+id).evaluate((c:HTMLCanvasElement)=>c.toDataURL()));
 expect(new Set(images).size).toBe(6);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:info.outputPath('regional-gallery.png'),fullPage:true,scale:'css'});
});
test('3× and 4× pixels exactly match logical RGBA with smoothing disabled',async({page})=>{
 const expected=Array.from(regionalAppearance({genome:fixtureGenome('typical','normal'),seed:'regional-review-01'}).sprite.pixels);
 for(const scale of [3,4]){await page.getByRole('button',{name:scale+'배 확대',exact:true}).click();const canvas=page.getByTestId('regional-sprite-normal');await expect(canvas).toHaveAttribute('width',String(96*scale));
 const result=await canvas.evaluate((c:HTMLCanvasElement,{scale,expected})=>{const ctx=c.getContext('2d')!,p=ctx.getImageData(0,0,c.width,c.height).data;let mismatches=0;for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)for(let k=0;k<4;k++)mismatches+=Number(p[(y*c.width+x)*4+k]!==expected[(Math.floor(y/scale)*96+Math.floor(x/scale))*4+k]);return {mismatches,smoothing:ctx.imageSmoothingEnabled};},{scale,expected});expect(result).toEqual({mismatches:0,smoothing:false});}
});
test('gene background, seed and fire controls update reproducibly',async({page})=>{
 const image=()=>page.getByTestId('regional-sprite-lilly').evaluate((c:HTMLCanvasElement)=>c.toDataURL()),initial=await image();await page.getByRole('combobox',{name:'공통 유전 배경'}).selectOption('high');await expect.poll(image).not.toBe(initial);const high=await image();await page.getByRole('button',{name:'파이어 업',exact:true}).click();await expect.poll(image).not.toBe(high);await page.getByRole('button',{name:'파이어 다운',exact:true}).click();await expect.poll(image).toBe(high);await page.getByLabel('공통 외형 시드').fill('replay');await expect.poll(image).not.toBe(high);await page.getByLabel('공통 외형 시드').fill('regional-review-01');await expect.poll(image).toBe(high);
});
test('production renderer has no comparison controls and exposes its actual version',async({page})=>{
 await expect(page.getByRole('button',{name:/이전 아트|새 아트|전환|비교/})).toHaveCount(0);for(const canvas of await page.locator('canvas').all())await expect(canvas).toHaveAttribute('data-renderer-version','regional-2');
});
test('loaded render code works offline and keeps native 96px output',async({page,context})=>{
 await context.setOffline(true);await page.getByRole('button',{name:'96px 원본',exact:true}).click();await page.getByRole('combobox',{name:'공통 유전 배경'}).selectOption('high');const c=page.getByTestId('regional-sprite-lilly');await expect(c).toHaveAttribute('width','96');expect(await c.evaluate((n:HTMLCanvasElement)=>n.getContext('2d')!.getImageData(0,0,96,96).data.some((v,i)=>i%4===3&&v===255))).toBe(true);await context.setOffline(false);
});
test('portrait PWA metadata and local icons use no external API',async({page,request})=>{
 const external:string[]=[];page.on('request',r=>{const u=new URL(r.url());if(u.protocol.startsWith('http')&&!['127.0.0.1','localhost'].includes(u.hostname))external.push(u.hostname);});await page.reload();const r=await request.get('/manifest.webmanifest'),manifest=await r.json();expect(manifest.orientation).toBe('portrait-primary');for(const icon of manifest.icons)expect((await request.get(icon.src)).ok()).toBe(true);expect(external).toEqual([]);
});
