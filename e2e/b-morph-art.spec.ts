import {test,expect} from '@playwright/test';

test('fixed morph artwork is viewable at native, zoom and card sizes',async({page})=>{
 await page.goto('/lab/appearance/b-breeding/morph-art');
 await expect(page.getByRole('heading',{name:'B · 모프별 독립 아트',exact:true})).toBeVisible();
 for(const kind of ['native','zoom','collection','shop']){
  const images=page.getByTestId('morph-art-'+kind).locator('img');
  await expect(images).toHaveCount(6);
  await expect.poll(()=>images.evaluateAll(nodes=>nodes.every(node=>{
   const img=node as HTMLImageElement;
   return img.complete&&img.naturalWidth===96&&img.naturalHeight===96&&getComputedStyle(img).imageRendering==='pixelated';
  }))).toBe(true);
 }
 for(const width of [320,360,430,1280]){
  await page.setViewportSize({width,height:900});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  for(const kind of ['collection','shop'])expect(await page.getByTestId('morph-art-'+kind).locator('img').evaluateAll(images=>images.every(image=>{
   const box=image.getBoundingClientRect(),parent=image.parentElement!.getBoundingClientRect();
   return box.left>=parent.left-0.5&&box.right<=parent.right+0.5;
  }))).toBe(true);
 }
 await expect(page.locator('#png a[download]')).toHaveCount(6);
});
