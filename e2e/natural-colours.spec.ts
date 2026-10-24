import {test,expect,type Page,type Locator} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {newMonthlyGame,act} from '../src/game/hardcore/play';
import {exportBackup} from '../src/game/hardcore/save';
import {specimen} from '../src/game/hardcore/adapter';
import {forgeSurface} from '../src/forge/surface';
import {navigateGame,touch} from './helpers/hardcore-navigation';
import type {HardcoreGame,Gecko} from '../src/game/hardcore/model';

const DATE='2026-10-23';
async function saved(page:Page){return page.evaluate(async()=>{
 const db=await new Promise<IDBDatabase>(r=>{const q=indexedDB.open('gecko-lab',1);q.onsuccess=()=>r(q.result);});
 return new Promise<{save:{game:HardcoreGame}}>(r=>{const tx=db.transaction('games'),q=tx.objectStore('games').get('active');q.onsuccess=()=>r(q.result);tx.oncomplete=()=>db.close();});
});}
async function restore(page:Page,backup:string,mobile:boolean){
 await page.clock.setFixedTime(new Date(DATE+'T03:00:00Z'));await page.goto('/');
 await touch(page.getByRole('button',{name:'저장 및 게임 설정',exact:true}),mobile);
 await page.getByLabel('JSON 백업 파일',{exact:true}).setInputFiles({name:'colours.json',mimeType:'application/json',buffer:Buffer.from(backup)});
 await touch(page.getByRole('button',{name:'복원 실행',exact:true}),mobile);await expect(page.getByRole('dialog')).toHaveCount(0);
}
async function nativePixels(canvas:Locator,g:Gecko){
 const expected=createHash('sha256').update(forgeSurface(specimen(g))!.pixels).digest('hex');
 await expect.poll(async()=>{
  const pixels=await canvas.evaluate(el=>{const c=el as HTMLCanvasElement,ctx=c.getContext('2d')!,data=ctx.getImageData(0,0,c.width,c.height).data,out:number[]=[],scale=c.width/96;
   for(let y=0;y<96;y++)for(let x=0;x<96;x++)out.push(...data.slice((Math.floor(y*scale)*c.width+Math.floor(x*scale))*4,(Math.floor(y*scale)*c.width+Math.floor(x*scale))*4+4));return out;
  });return createHash('sha256').update(Buffer.from(pixels)).digest('hex');
 }).toBe(expected);
 expect(await canvas.evaluate(el=>(el as HTMLCanvasElement).getContext('2d')!.imageSmoothingEnabled)).toBe(false);
}
for(const width of[360,390,430,1280])test(`natural colours: native pixels, touch and exact IndexedDB restore at ${width}px`,async({page},info)=>{
 test.setTimeout(120_000);const mobile=info.project.name.startsWith('mobile');await page.setViewportSize({width,height:900});
 let game=newMonthlyGame('natural-browser-'+width,DATE,{initialMoney:10_000_000,initialCapacity:20});
 const offer=Object.values(game.shop.offers)[0];game=act(game,{type:'buyGecko',offerId:offer.id},DATE);const g=game.individuals[offer.individual.id];
 await restore(page,exportBackup(game),mobile);await nativePixels(page.getByTestId('home-hero-sprite'),g);
 await nativePixels(page.getByTestId('hardcore-sprite-'+g.id),g);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 if(info.project.name==='mobile-chromium'&&width!==1280)await page.screenshot({path:`test-results/natural-colours-${width}.png`,fullPage:true});
 await navigateGame(page,'상점',mobile);const row=page.getByTestId('shop-offer-'+offer.id);await nativePixels(row.locator('canvas'),offer.individual);
 await touch(row.getByRole('button',{name:offer.individual.name+' 부모',exact:true}),mobile);
 const dialog=page.getByRole('dialog');await nativePixels(dialog.locator('.shop-family-art canvas').first(),offer.family!.father);
 await touch(dialog.getByRole('button',{name:'상세 창 닫기',exact:true}),mobile);
 const before=await saved(page);expect(before.save.game).toEqual(game);await page.reload();await expect(page.getByTestId('game-day')).toHaveText('0');expect(await saved(page)).toEqual(before);
});
test('a real old backup retains legacy colours through browser restore and reload',async({page},info)=>{
 test.setTimeout(120_000);const backup=readFileSync('tests/fixtures/natural-colours/previous-backup.json','utf8'),game=JSON.parse(backup).game as HardcoreGame;
 await restore(page,backup,info.project.name.startsWith('mobile'));
 const g=Object.values(game.individuals).find(g=>g.status==='owned')!;await nativePixels(page.getByTestId('home-hero-sprite'),g);
 const before=await saved(page);expect(before.save.game).toEqual(game);await page.reload();await nativePixels(page.getByTestId('home-hero-sprite'),g);expect(await saved(page)).toEqual(before);
});
