import {test,expect} from '@playwright/test';

test('three fixed native artworks compare at current card sizes without player storage',async({page})=>{
 await page.addInitScript(()=>{
  const seen:string[]=[];(window as unknown as {trioStorageCalls:string[]}).trioStorageCalls=seen;
  const open=indexedDB.open.bind(indexedDB);indexedDB.open=(...args:Parameters<IDBFactory['open']>)=>{seen.push(args[0]);return open(...args);};
 });
 await page.goto('/lab/appearance/b-breeding/normal-trio');
 await expect(page.getByRole('heading',{name:'최초 B · 노멀 3종',exact:true})).toBeVisible();
 for(const kind of ['collection','shop','native','zoom']){
  const images=page.getByTestId('trio-'+kind).locator('img');await expect(images).toHaveCount(3);
  await expect.poll(()=>images.evaluateAll(nodes=>nodes.every(node=>{const img=node as HTMLImageElement;return img.complete&&img.naturalWidth===96&&img.naturalHeight===96&&getComputedStyle(img).imageRendering==='pixelated';}))).toBe(true);
 }
 for(const width of [320,360,390,430,1280]){
  await page.setViewportSize({width,height:900});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  for(const kind of ['collection','shop'])expect(await page.getByTestId('trio-'+kind).locator('img').evaluateAll(nodes=>nodes.every(img=>{
   const b=img.getBoundingClientRect(),p=img.parentElement!.getBoundingClientRect();
   return b.x+b.width*3/96>=p.x-0.5&&b.x+b.width*93/96<=p.right+0.5&&b.y+b.height*15/96>=p.y-0.5&&b.y+b.height*81/96<=p.bottom+0.5;
  }))).toBe(true);
 }
 await expect(page.locator('#png a[download]')).toHaveCount(3);
 expect(await page.evaluate(()=>(window as unknown as {trioStorageCalls:string[]}).trioStorageCalls)).toEqual([]);
});
