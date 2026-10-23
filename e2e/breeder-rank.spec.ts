import {test,expect,type Page} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {breederRankGames} from './helpers/forge-fixtures';
import {exportBackup} from '../src/game/hardcore/save';
import {BREEDER_TITLES} from '../src/game/hardcore/breeder-rank';
import type {HardcoreGame} from '../src/game/hardcore/model';
import {touch} from './helpers/hardcore-navigation';
const states=breederRankGames();
async function saved(page:Page):Promise<HardcoreGame>{return page.evaluate(async()=>{
 const db=await new Promise<IDBDatabase>(r=>{const q=indexedDB.open('gecko-lab',1);q.onsuccess=()=>r(q.result);});
 return new Promise(r=>{const tx=db.transaction('games'),q=tx.objectStore('games').get('active');q.onsuccess=()=>r(q.result.save.game);tx.oncomplete=()=>db.close();});
});}
async function restore(page:Page,g:HardcoreGame,mobile:boolean){
 await touch(page.getByRole('button',{name:'저장 및 게임 설정',exact:true}),mobile);
 await page.getByLabel('JSON 백업 파일',{exact:true}).setInputFiles({name:'rank.json',mimeType:'application/json',buffer:Buffer.from(exportBackup(g))});
 await touch(page.getByRole('button',{name:'복원 실행',exact:true}),mobile);await expect(page.getByRole('dialog')).toHaveCount(0);
}
const errors=new WeakMap<Page,string[]>();
test.beforeEach(async({page})=>{const e:string[]=[];errors.set(page,e);page.on('pageerror',err=>e.push(err.message));await page.clock.setFixedTime(new Date('2026-10-16T03:00:00Z'));await page.goto('/');await expect(page.getByTestId('breeder-rank')).toHaveText('견습 브리더');});
test.afterEach(async({page})=>expect(errors.get(page)).toEqual([]));

test('all six automatic ranks fit the original generation frame at mobile sizes, preserve hero geometry and apply gold only at five',async({page},info)=>{
 const mobile=info.project.name.startsWith('mobile');await page.setViewportSize({width:390,height:844});
 let originalHero:unknown;
 for(let count=0;count<=5;count++){
  await restore(page,states[count],mobile);const rank=page.getByTestId('breeder-rank');await expect(rank).toHaveText(BREEDER_TITLES[count]);
  await expect(rank.locator('button,svg')).toHaveCount(0);await expect(page.locator('.home-breeder-title')).toHaveCount(0);
  const hero=await page.locator('.home-hero-art').boundingBox();if(count===0)originalHero=hero;else expect(hero).toEqual(originalHero);
  for(const width of [360,390,430]){
   await page.setViewportSize({width,height:844});
   const r=(await rank.boundingBox())!,h=(await page.getByTestId('home-hero').boundingBox())!,id=(await page.locator('.home-id').boundingBox())!,panel=(await page.locator('.home-info').boundingBox())!;
   expect(r.x).toBeGreaterThanOrEqual(h.x);expect(r.x+r.width).toBeLessThan(id.x);expect(r.y+r.height<=panel.y||r.x+r.width<=panel.x).toBe(true);
   expect(await rank.locator('b').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
  await page.setViewportSize({width:390,height:844});
  const color=await rank.locator('b').evaluate(el=>getComputedStyle(el).color);if(count===5){await expect(rank).toHaveClass(/is-legendary/);const [r,g,b]=color.match(/\d+/g)!.map(Number);expect(r).toBeGreaterThan(g);expect(g).toBeGreaterThan(b);expect(b).toBeLessThan(180);}else await expect(rank).not.toHaveClass(/is-legendary/);
  expect(await saved(page)).toEqual(states[count]);
  if(mobile&&(count===0||count===5)){await mkdir('docs/breeder-rank',{recursive:true});await page.screenshot({path:'docs/breeder-rank/'+(count===0?'novice':'legendary')+'-390.png',scale:'css'});}
 }
});

test('legacy equipped data is ignored, switching and selling animals preserve rank, reload persists it and actual new game resets it',async({page},info)=>{
 const mobile=info.project.name.startsWith('mobile'),g=structuredClone(states[1]);g.breedingChallenges!.equippedTitle='midnight';await restore(page,g,mobile);
 await expect(page.getByTestId('breeder-rank')).toHaveText('신예 브리더');const before=await saved(page);expect(before.breedingChallenges!.equippedTitle).toBe('midnight');
 // The name is now a separate rename button; select through the card's morph row.
 const chosen=Object.values(g.individuals)[1];await touch(page.getByTestId('hc-card-'+chosen.id).locator('.home-card-select>.home-morph'),mobile);await expect(page.locator('.home-name')).toContainText(chosen.name);await expect(page.getByTestId('breeder-rank')).toHaveText('신예 브리더');
 await touch(page.getByTestId('hc-card-'+chosen.id).getByRole('button',{name:chosen.name+' 상세보기',exact:true}),mobile);
 const dialog=page.getByRole('dialog');await touch(dialog.getByRole('button',{name:/^분양 준비/}),mobile);await touch(dialog.getByRole('button',{name:'분양 확정',exact:true}),mobile);await expect(dialog).toContainText('판매 완료');await page.keyboard.press('Escape');
 await expect(page.getByTestId('breeder-rank')).toHaveText('신예 브리더');expect((await saved(page)).breedingChallenges).toEqual(before.breedingChallenges);
 await page.reload();await expect(page.getByTestId('breeder-rank')).toHaveText('신예 브리더');
 await touch(page.getByRole('button',{name:'저장 및 게임 설정',exact:true}),mobile);await page.getByLabel('새 게임 시드',{exact:true}).fill('browser-new-breeder');await touch(page.getByRole('button',{name:'새 게임 준비',exact:true}),mobile);await touch(page.getByRole('button',{name:'새 게임 시작',exact:true}),mobile);await expect(page.getByRole('dialog')).toHaveCount(0);
 await expect(page.getByTestId('breeder-rank')).toHaveText('견습 브리더');expect((await saved(page)).breedingChallenges).toBeUndefined();await page.reload();await expect(page.getByTestId('breeder-rank')).toHaveText('견습 브리더');
});
