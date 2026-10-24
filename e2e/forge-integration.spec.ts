import {test,expect,type Page} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {newGame,newMonthlyGame} from '../src/game/hardcore/play';
import {exportBackup,makeSave} from '../src/game/hardcore/save';
import {migrateMonthly} from '../src/game/hardcore/migrate-monthly';
import {migrateForge} from '../src/game/hardcore/migrate-forge';
import {specimen,visualName} from '../src/game/hardcore/adapter';
import {forgeSurface} from '../src/forge/surface';
import {createCompanionPatternsFounder} from '../src/forge/engine/companion-patterns-breeding';
import {createCompanionLineageFounder} from '../src/forge/engine/companion-lineage-breeding';
import {legacyTraits} from '../src/genetics/advanced/phenotype';
import {polyScores} from '../src/genetics/advanced/polygenic';
import {unknownKnowledge} from '../src/genetics/advanced/inference';
import {cachedGenotype} from '../src/game/hardcore/genetics';
import {validateGame} from '../src/game/hardcore/validation';
import type {HardcoreGame} from '../src/game/hardcore/model';
import {touch} from './helpers/hardcore-navigation';

const DATE='2026-10-22';
async function database(page:Page){return page.evaluate(async()=>{
 const db=await new Promise<IDBDatabase>(r=>{const q=indexedDB.open('gecko-lab',1);q.onsuccess=()=>r(q.result);});
 return new Promise<Record<string,unknown>>(r=>{const out:Record<string,unknown>={},tx=db.transaction('games'),q=tx.objectStore('games').openCursor();q.onsuccess=()=>{const c=q.result;if(c){out[String(c.key)]=c.value;c.continue();}};tx.oncomplete=()=>{db.close();r(out);};});
});}
function gallery(){
 const game=newMonthlyGame('forge-gallery',DATE,{initialMoney:1_000_000,initialCapacity:24}),template=Object.values(game.shop.offers)[0].family!.father;
 const morphs=['base','lilly','axanthic','dalmatian','select-harlequin','tiger','sable','highway']as const;
 for(const morph of morphs)for(let n=0;n<2;n++){
  const id='forge-review-'+morph+'-'+n,input={id,seed:id,name:morph+' '+n,sex:n?'female' as const:'male' as const};
  const f=morph==='sable'||morph==='highway'?createCompanionLineageFounder({...input,morph}):createCompanionPatternsFounder({...input,morph});
  const g=structuredClone(template);g.id=id;g.name=f.name;g.sex=f.sex;g.parents=null;g.status='owned';g.provenance='known';g.visualSeed=f.visualSeed;
  g.genetics={version:1,genome:f.genome,appearanceVersion:'patterns-1',knowledge:unknownKnowledge(),forge:{version:1,...(f.extensions?{extensions:f.extensions}:{})}};
  g.genotype=cachedGenotype(g.genetics,g.genotype);g.potential=legacyTraits(polyScores(f.genome.polygenic));game.individuals[id]=g;
 }
 validateGame(game);return game;
}
test('native body, 16 seed/morph samples, mobile presentation and exact IndexedDB restore',async({page},info)=>{
 test.setTimeout(120_000);const mobile=info.project.name.startsWith('mobile'),game=gallery(),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.clock.setFixedTime(new Date(DATE+'T03:00:00Z'));await page.goto('/');
 await touch(page.getByRole('button',{name:'저장 및 게임 설정',exact:true}),mobile);
 await page.getByLabel('JSON 백업 파일',{exact:true}).setInputFiles({name:'forge-gallery.json',mimeType:'application/json',buffer:Buffer.from(exportBackup(game))});
 await touch(page.getByRole('button',{name:'복원 실행',exact:true}),mobile);await expect(page.getByRole('dialog')).toHaveCount(0);
 const pictures:{name:string;png:string}[]=[];
 for(const g of Object.values(game.individuals)){
  const canvas=page.getByTestId('home-hero-sprite');await expect(canvas).toHaveAttribute('data-renderer-version','b-origin-01-companion-lineage-1');
  const expected=createHash('sha256').update(forgeSurface(specimen(g))!.pixels).digest('hex');
  const pixels=async()=>canvas.evaluate(el=>{const c=el as HTMLCanvasElement,p=c.getContext('2d')!.getImageData(0,0,c.width,c.height).data,scale=c.width/96,out:number[]=[];for(let y=0;y<96;y++)for(let x=0;x<96;x++)out.push(...p.slice((y*scale*c.width+x*scale)*4,(y*scale*c.width+x*scale)*4+4));return out;});
  await expect.poll(async()=>createHash('sha256').update(Buffer.from(await pixels())).digest('hex')).toBe(expected);
  expect(await canvas.evaluate(el=>(el as HTMLCanvasElement).getContext('2d')!.imageSmoothingEnabled)).toBe(false);
  await expect(page.locator('.home-facts')).toContainText(visualName(g));expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  pictures.push({name:g.name,png:await canvas.evaluate(el=>(el as HTMLCanvasElement).toDataURL())});
  if(mobile&&pictures.length===1){await mkdir('docs/forge',{recursive:true});await page.screenshot({path:'docs/forge/game-360.png',scale:'css'});}
  await touch(page.getByRole('button',{name:'다음 개체',exact:true}),mobile);
 }
 if(mobile){
  const png=await page.evaluate(async rows=>{const c=document.createElement('canvas');c.width=1152;c.height=1280;const x=c.getContext('2d')!;x.fillStyle='#1e2925';x.fillRect(0,0,c.width,c.height);x.imageSmoothingEnabled=false;
   for(const[r,a]of rows.entries()){const img=new Image();img.src=a.png;await img.decode();x.drawImage(img,(r%4)*288,Math.floor(r/4)*320,288,288);x.fillStyle='#fff1d6';x.font='18px sans-serif';x.fillText(a.name,(r%4)*288+12,Math.floor(r/4)*320+309);}
   return c.toDataURL().split(',')[1];},pictures);
  await writeFile('docs/forge/native-gallery.png',Buffer.from(png,'base64'));
 }
 const before=await database(page);expect((before.active as {save:{game:HardcoreGame}}).save.game).toEqual(game);
 await page.reload();await expect(page.getByTestId('home-hero-sprite')).toHaveAttribute('data-renderer-version','b-origin-01-companion-lineage-1');expect(await database(page)).toEqual(before);expect(errors).toEqual([]);
});
test('existing v10 active save is archived byte-for-byte once before appearance migration',async({page})=>{
 await page.clock.setFixedTime(new Date(DATE+'T03:00:00Z'));await page.goto('/');await expect(page.getByTestId('game-day')).toHaveText('0');
 const old=newGame('forge-old-active',DATE),record={save:makeSave(old),writeRevision:17};
 await page.evaluate(async record=>{const db=await new Promise<IDBDatabase>(r=>{const q=indexedDB.open('gecko-lab',1);q.onsuccess=()=>r(q.result);});await new Promise<void>(r=>{const tx=db.transaction('games','readwrite');tx.objectStore('games').put(record,'active');tx.oncomplete=()=>{db.close();r();};});},record);
 await page.reload();await expect(page.getByTestId('game-day')).toHaveText('0');
 await expect.poll(async()=>((await database(page)).active as {writeRevision:number}).writeRevision).toBe(18);
 const migrated=await database(page);expect(migrated['archive-v10-18']).toEqual(record);expect((migrated.active as {save:{game:HardcoreGame}}).save.game).toEqual(migrateMonthly(migrateForge(old)));
 await page.reload();await expect(page.getByTestId('game-day')).toHaveText('0');expect(await database(page)).toEqual(migrated);
});
