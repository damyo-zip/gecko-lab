import {test,expect,type Page,type Locator} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {incubatorFixture} from './fixtures/incubator-reference';
import {act} from '../src/game/hardcore/play';
import {actWithTime} from '../src/game/hardcore/time-source';
import {exportBackup} from '../src/game/hardcore/save';
import {specimen,visualName} from '../src/game/hardcore/adapter';
import {renderSprite} from '../src/engine/render';
import type {HardcoreGame,Gecko} from '../src/game/hardcore/model';
import {navigateGame,touch} from './helpers/hardcore-navigation';

async function saved(page:Page):Promise<HardcoreGame>{return page.evaluate(async()=>{
 const db=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open('gecko-lab',1);r.onsuccess=()=>resolve(r.result);});
 return new Promise(resolve=>{const tx=db.transaction('games'),r=tx.objectStore('games').get('active');r.onsuccess=()=>resolve(r.result.save.game);tx.oncomplete=()=>db.close();});
});}
async function boot(page:Page,g:HardcoreGame,mobile:boolean){
 await page.clock.setFixedTime(new Date('2026-10-14T03:00:00Z'));await page.goto('/');
 await touch(page.getByRole('button',{name:'저장 및 게임 설정',exact:true}),mobile);
 await page.getByLabel('JSON 백업 파일',{exact:true}).setInputFiles({name:'parents.json',mimeType:'application/json',buffer:Buffer.from(exportBackup(g))});
 await touch(page.getByRole('button',{name:'복원 실행',exact:true}),mobile);await expect(page.getByRole('dialog')).toHaveCount(0);
 await navigateGame(page,'인큐베이터',mobile);
}
function hash(pixels:ArrayLike<number>){let h=2166136261;for(let i=0;i<pixels.length;i++)h=Math.imul(h^pixels[i],16777619);return h>>>0;}
async function sameSprite(root:Locator,g:Gecko){
 const canvas=root.locator('canvas');await expect(canvas).toHaveCount(1);
 const actual=await canvas.evaluate(node=>{const c=node as HTMLCanvasElement,ctx=c.getContext('2d')!,p=ctx.getImageData(0,0,c.width,c.height).data,f=c.width/96;let h=2166136261;for(let y=0;y<96;y++)for(let x=0;x<96;x++)for(let n=0;n<4;n++)h=Math.imul(h^p[((y*f)*c.width+x*f)*4+n],16777619);return {hash:h>>>0,smoothing:ctx.imageSmoothingEnabled};});
 expect(actual).toEqual({hash:hash(renderSprite(specimen(g)).pixels),smoothing:false});
}
test('egg selection shows actual mother on left and father on right, changes immediately and never settles an egg',async({page},info)=>{
 const mobile=info.project.name.startsWith('mobile'),g=incubatorFixture(),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await boot(page,g,mobile);
 await expect(page.getByTestId('incubator-parent-empty')).toBeVisible();await expect(page.locator('.inc-parent canvas')).toHaveCount(0);
 await expect(page.locator('.inc-title,.inc-extra,.inc-results')).toHaveCount(0);await expect(page.getByRole('heading',{name:'인큐베이터',exact:true})).toHaveCount(0);
 const eggs=Object.values(g.eggs),first=eggs[0],different=eggs.find(e=>e.embryo.parents!.motherId!==first.embryo.parents!.motherId)!;
 for(const egg of [first,different]){
  const art=page.getByTestId('select-egg-'+egg.id);await touch(art,mobile);await expect(art).toHaveAttribute('aria-pressed','true');
  await expect(page.getByTestId('hc-egg-'+egg.id)).toHaveClass(/selected/);await expect(page.getByRole('dialog')).toHaveCount(0);
  const ids=egg.embryo.parents!,mother=g.individuals[ids.motherId],father=g.individuals[ids.fatherId];
  for(const [sex,parent] of [['female',mother],['male',father]] as const){
   const root=page.getByTestId('incubator-parent-'+sex);await expect(root).toHaveAttribute('data-parent-id',parent.id);await expect(root).toContainText(parent.name);await sameSprite(root,parent);
   await expect(page.getByTestId('incubator-parent-info')).toContainText(visualName(parent));
  }
  const a=(await page.getByTestId('incubator-parent-female').boundingBox())!,b=(await page.getByTestId('incubator-parent-male').boundingBox())!;expect(a.x+a.width).toBeLessThan(b.x);
  expect(await saved(page)).toEqual(g);
 }
 await touch(page.getByTestId('incubator-parent-female').getByRole('button'),mobile);await expect(page.getByRole('dialog')).toContainText(g.individuals[different.embryo.parents!.motherId].name);await page.keyboard.press('Escape');
 const geometry=[];
 for(const [width,height] of [[360,800],[390,844],[430,932],[360,640]]){
  await page.setViewportSize({width,height});
  const measured=await page.locator('.reference-content').evaluate(el=>({height:el.clientHeight,content:el.scrollHeight,scrollTop:el.scrollTop}));
  expect(measured.content).toBeLessThanOrEqual(measured.height+1);
  expect(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight&&document.documentElement.scrollWidth<=innerWidth&&scrollY===0)).toBe(true);
  for(const control of await page.locator('.inc-parent-art,.inc-select-egg,.inc-toolbar-button,.inc-pagination button,.home-turn-cta').all()){
   const r=(await control.boundingBox())!;expect(r.width).toBeGreaterThanOrEqual(44);expect(r.height).toBeGreaterThanOrEqual(44);expect(r.y+r.height).toBeLessThanOrEqual(height);
  }
  geometry.push({viewportWidth:width,viewportHeight:height,...measured});
  if(mobile){await mkdir('docs/incubator-parents',{recursive:true});await page.screenshot({path:`docs/incubator-parents/parents-${width}x${height}.png`,scale:'css'});}
 }
 if(mobile)await writeFile('docs/incubator-parents/geometry.json',JSON.stringify(geometry,null,2));
 await page.reload();await expect(page.getByTestId('game-day')).toHaveText(String(g.turn));expect(await saved(page)).toEqual(g);await navigateGame(page,'인큐베이터',mobile);await expect(page.getByTestId('incubator-parent-empty')).toBeVisible();expect(errors).toEqual([]);
});

test('sold parents keep exact art and names, and extra real slots are paged without fabricated occupants',async({page},info)=>{
 const mobile=info.project.name.startsWith('mobile');let g=incubatorFixture();const egg=Object.values(g.eggs)[0],ids=egg.embryo.parents!;
 const otherMother=Object.values(g.eggs).find(e=>e.embryo.parents!.motherId!==ids.motherId)!.embryo.parents!.motherId;
 g=act(g,{type:'expand'},g.lastDate);
 // Produce eight real held eggs/newborns, without claiming or overwriting outcomes.
 while(g.turn<10){
  g=actWithTime(g,{type:'endTurn'},g.time.realtimeAnchorDate);
  if(g.turn===8||g.turn===10)for(const e of Object.values(g.eggs))if(e.care?.collectedTurn===null)g=act(g,{type:'collectEggs',matingId:e.matingId!},g.lastDate);
  if(g.turn===6||g.turn===8)g=act(g,{type:'breed',fatherId:ids.fatherId,motherId:g.turn===6?ids.motherId:otherMother},g.lastDate);
 }
 expect(Object.values(g.eggs)).toHaveLength(8);
 g=act(g,{type:'sell',id:ids.motherId},g.lastDate);g=act(g,{type:'sell',id:ids.fatherId},g.lastDate);await boot(page,g,mobile);
 await touch(page.getByTestId('select-egg-'+egg.id),mobile);
 await sameSprite(page.getByTestId('incubator-parent-female'),g.individuals[ids.motherId]);await sameSprite(page.getByTestId('incubator-parent-male'),g.individuals[ids.fatherId]);
 await expect(page.locator('.inc-slot-grid > *')).toHaveCount(6);await touch(page.getByRole('button',{name:'다음 슬롯',exact:true}),mobile);await expect(page.getByTestId('incubator-parent-empty')).toBeVisible();await expect(page.locator('.inc-slot-grid > *')).toHaveCount(6);
 const last=Object.values(g.eggs).at(-1)!;await touch(page.getByTestId('select-egg-'+last.id),mobile);await expect(page.getByTestId('incubator-parent-female')).toHaveAttribute('data-parent-id',last.embryo.parents!.motherId);
 await touch(page.getByRole('button',{name:'이전 슬롯',exact:true}),mobile);await expect(page.getByTestId('select-egg-'+egg.id)).toHaveAttribute('aria-pressed','false');expect(await saved(page)).toEqual(g);
});
