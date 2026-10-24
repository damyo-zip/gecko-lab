/** Compare production builds using isolated throwaway browser saves. */
import {chromium,expect} from '@playwright/test';
import {createServer} from 'vite';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),url=process.env.PERF_URL??'http://127.0.0.1:3503';
const label=process.env.PERF_LABEL??'local',rate=Number(process.env.PERF_CPU_RATE??1);
const vite=await createServer({root,configFile:root+'vitest.config.ts',server:{middlewareMode:true}});
const {rushPerformanceGame}=await vite.ssrLoadModule('/e2e/helpers/forge-fixtures.ts');
const {exportBackup}=await vite.ssrLoadModule('/src/game/hardcore/save.ts');
const fixtures=(process.env.PERF_COUNTS??'6,60,300').split(',').map(Number).map(count=>{const game=rushPerformanceGame(count);return{count,game,backup:exportBackup(game)};});await vite.close();
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined});
const results=[];
try{for(const {count,game,backup} of fixtures){
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  let active=false,last,at=0;const stats={frames:[],longTasks:[],fullCopies:0};
  const original=window.structuredClone;window.structuredClone=function(value,...args){if(active&&value?.gameId&&value?.individuals)stats.fullCopies++;return original.call(this,value,...args);};
  new PerformanceObserver(list=>{if(active)for(const e of list.getEntries())if(e.startTime>=at)stats.longTasks.push(e.duration);}).observe({entryTypes:['longtask']});
  const frame=now=>{if(active){if(last!==undefined)stats.frames.push(now-last);last=now;}requestAnimationFrame(frame);};requestAnimationFrame(frame);
  window.__startGamePerf=()=>{stats.frames=[];stats.longTasks=[];stats.fullCopies=0;last=undefined;at=performance.now();active=true;};
  window.__endGamePerf=()=>{active=false;return{...stats,durationMs:performance.now()-at};};
 });
 await page.goto(url);await page.getByRole('button',{name:'저장 및 게임 설정',exact:true}).tap();
 await page.getByLabel('JSON 백업 파일',{exact:true}).setInputFiles({name:'perf.json',mimeType:'application/json',buffer:Buffer.from(backup)});
 await page.getByRole('button',{name:'복원 실행',exact:true}).tap();await expect(page.getByRole('dialog')).toHaveCount(0);
 const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate});
 const samples=[];
 for(let turn=1;turn<=3;turn++){
  await page.evaluate(()=>window.__startGamePerf());await page.getByRole('button',{name:'턴 넘기기',exact:true}).tap();
  await expect(page.getByTestId('game-day')).toHaveText(String(turn));await expect(page.locator('.game-tab-content')).toHaveAttribute('aria-busy','false');
  await page.waitForTimeout(50);samples.push(await page.evaluate(()=>window.__endGamePerf()));
 }
 const saved=await page.evaluate(async()=>{const db=await new Promise(resolve=>{const r=indexedDB.open('gecko-lab',1);r.onsuccess=()=>resolve(r.result);});return new Promise(resolve=>{const tx=db.transaction('games'),r=tx.objectStore('games').get('active');r.onsuccess=()=>resolve(r.result.save.game);tx.oncomplete=()=>db.close();});});
 expect(saved.turn).toBe(3);expect(saved.food).toBe(game.food-count*3);expect(saved.money).toBe(game.money);expect(Object.keys(saved.individuals)).toEqual(Object.keys(game.individuals));
 for(const id of Object.keys(game.individuals)){expect(saved.individuals[id].genetics).toEqual(game.individuals[id].genetics);expect(saved.individuals[id].visualSeed).toBe(game.individuals[id].visualSeed);}
 await page.reload();await expect(page.getByTestId('game-day')).toHaveText('3');expect(errors).toEqual([]);
 const round=n=>+n.toFixed(2),med=a=>[...a].sort((a,b)=>a-b)[Math.floor(a.length/2)];
 const result={count,samples,medianMs:round(med(samples.map(s=>s.durationMs))),medianFullCopies:med(samples.map(s=>s.fullCopies)),longTaskMs:round(samples.reduce((sum,s)=>sum+s.longTasks.reduce((a,b)=>a+b,0),0)),maxFrameMs:round(Math.max(...samples.flatMap(s=>s.frames))),persisted:{turn:saved.turn,food:saved.food,records:Object.keys(saved.individuals).length}};
 results.push(result);console.log(JSON.stringify({label,count,medianMs:result.medianMs,longTaskMs:result.longTaskMs,medianFullCopies:result.medianFullCopies}));await context.close();
 }
 const output=root+'docs/game-performance/';await mkdir(output,{recursive:true});await writeFile(output+label+'-browser.json',JSON.stringify({url,viewport:'390x844',cpuRate:rate,chromium:browser.version(),results},null,2));
}finally{await browser.close();}
