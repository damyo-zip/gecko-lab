import {test,expect} from '@playwright/test';
import {fixtureGenome} from '../src/engine/regional/fixtures';
import {regionalAppearance} from '../src/engine/regional';
import {sourceBase,anatomy} from '../src/engine/regional/anatomy';
import {artColor} from '../src/engine/art';

test('there is one production renderer and no legacy or comparison switch in any lab entry point',async({page})=>{
 for(const path of ['/lab','/lab/appearance']){await page.goto(path);await expect(page.getByRole('heading',{name:'정식 외형 연구실'})).toBeVisible();await expect(page.getByRole('button',{name:/이전 아트|새 아트|복합 모프 비교/})).toHaveCount(0);for(const canvas of await page.locator('canvas').all())await expect(canvas).toHaveAttribute('data-renderer-version','regional-2');}
});
test('real browser v2 eye structure remains authored while skin responds to morph and expression',async({page})=>{
 await page.goto('/lab');await page.getByRole('button',{name:'96px 원본',exact:true}).click();
 for(const morph of ['normal','lilly','axanthic','cappuccino','highway','sable'] as const){
  const canvas=page.getByTestId('regional-sprite-'+morph);const actual=await canvas.evaluate((c:HTMLCanvasElement)=>Array.from(c.getContext('2d')!.getImageData(0,0,96,96).data));
  expect(actual).toEqual(Array.from(regionalAppearance({genome:fixtureGenome('typical',morph),seed:'regional-review-01'}).sprite.pixels));
  let errors=0;for(let i=0;i<9216;i++)if((sourceBase.eye[i]||anatomy.mouth[i]||anatomy.nostrils[i])&&!sourceBase.outline[i]){const color=[...artColor(sourceBase.details[i]),255];for(let k=0;k<4;k++)errors+=Number(actual[i*4+k]!==color[k]);}expect(errors).toBe(0);
 }
});
