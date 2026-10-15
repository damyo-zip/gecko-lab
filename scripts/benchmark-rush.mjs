/** Run against a production server; see docs/rush-performance.md. No shipping probes. */
import {chromium} from '@playwright/test';
import {createServer} from 'vite';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const label=process.env.PERF_LABEL??'local',url=process.env.PERF_URL??'http://127.0.0.1:3502';
const counts=(process.env.PERF_COUNTS??'6,60,300').split(',').map(Number),rate=Number(process.env.PERF_CPU_RATE??4);
const output=root+'docs/rush-performance/';await mkdir(output,{recursive:true});
const vite=await createServer({root,configFile:root+'vitest.config.ts',server:{middlewareMode:true}});
const {rushPerformanceBackup}=await vite.ssrLoadModule('/e2e/fixtures/rush-performance.ts');
const fixtures=new Map(counts.map(n=>[n,rushPerformanceBackup(n)]));await vite.close();
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined});
const results=[];
try{for(const count of counts){
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true,serviceWorkers:'block'});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
    let enabled=false,last;const seenProps=new WeakSet();
    const stats=window.__rushPerf={frames:[],longTasks:[],clones:[],fullSnapshots:0,puts:[],paints:0,mutations:0,collectionCommits:0};
    window.__rushPerfStart=()=>{last=undefined;enabled=true;};window.__rushPerfStop=()=>enabled=false;
    // A DevTools hook counts Collection owner prop commits, without wrapping app components.
    window.__REACT_DEVTOOLS_GLOBAL_HOOK__={supportsFiber:true,renderers:new Map(),inject(renderer){this.renderers.set(1,renderer);return 1;},onCommitFiberRoot(id,root){
      const visit=node=>{if(!node)return;
        if(node.type==='section'&&node.memoizedProps?.className==='home-collection'){
          let owner=node.return;while(owner&&typeof owner.type!=='function')owner=owner.return;
          if(owner&&owner.memoizedProps!==owner.alternate?.memoizedProps&&!seenProps.has(owner.memoizedProps)){seenProps.add(owner.memoizedProps);if(enabled)stats.collectionCommits++;}
        }
        visit(node.child);visit(node.sibling);
      };visit(root.current);
    },onCommitFiberUnmount(){}};
    const clone=window.structuredClone;window.structuredClone=function(...args){const at=performance.now();try{return clone.apply(this,args);}finally{if(enabled){stats.clones.push(performance.now()-at);if(args[0]?.individuals&&args[0]?.gameId)stats.fullSnapshots++;}}};
    const put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(value,key){const at=performance.now();try{return put.call(this,value,key);}finally{if(enabled)stats.puts.push({key,ms:performance.now()-at});}};
    for(const name of ['putImageData','drawImage']){const draw=CanvasRenderingContext2D.prototype[name];CanvasRenderingContext2D.prototype[name]=function(...args){if(enabled&&this.canvas.closest('.home-collection'))stats.paints++;return draw.apply(this,args);};}
    new PerformanceObserver(list=>{if(enabled)for(const e of list.getEntries())stats.longTasks.push(e.duration);}).observe({entryTypes:['longtask']});
    function frame(at){if(enabled){if(last!==undefined)stats.frames.push(at-last);last=at;}requestAnimationFrame(frame);}requestAnimationFrame(frame);
  });
  await page.goto(url);await page.getByRole('button',{name:'저장 및 게임 설정',exact:true}).tap();
  await page.getByLabel('JSON 백업 파일',{exact:true}).setInputFiles({name:'load.json',mimeType:'application/json',buffer:Buffer.from(fixtures.get(count))});
  await page.getByRole('button',{name:'복원 실행',exact:true}).tap();await page.getByRole('dialog').waitFor({state:'hidden',timeout:30000});
  await page.getByRole('button',{name:'크레 러시 아르바이트',exact:true}).tap();
  await page.getByRole('dialog',{name:'크레 러시',exact:true}).waitFor();
  // Observe worker writes too: moving a write is different from dropping one.
  for(const worker of page.workers())await worker.evaluate(()=>{
    self.__rushWorkerPerf={clones:0,fullSnapshots:0,cloneMs:0,activeWrites:0,replyBytes:[]};
    const clone=self.structuredClone;self.structuredClone=function(...args){const at=performance.now();try{return clone.apply(this,args);}finally{self.__rushWorkerPerf.clones++;if(args[0]?.individuals&&args[0]?.gameId)self.__rushWorkerPerf.fullSnapshots++;self.__rushWorkerPerf.cloneMs+=performance.now()-at;}};
    const put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(value,key){if(key==='active')self.__rushWorkerPerf.activeWrites++;return put.call(this,value,key);};
    const post=self.postMessage;self.postMessage=function(message,...args){self.__rushWorkerPerf.replyBytes.push(JSON.stringify(message).length);return post.call(this,message,...args);};
  });
  const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate});
  // Start profiling before the measured interval, excluding profiler setup stalls.
  await cdp.send('Profiler.enable');await cdp.send('Profiler.start');
  await page.getByRole('button',{name:'알바 시작',exact:true}).tap();await page.getByTestId('rush-stage').waitFor({timeout:30000});
  await page.evaluate(()=>{
    new MutationObserver(list=>window.__rushPerf.mutations+=list.length).observe(document.querySelector('.home-collection'),{subtree:true,childList:true,attributes:true,characterData:true});
    window.__rushPerfStart();
  });
  await page.getByTestId('rush-pay').waitFor({timeout:65000});await page.evaluate(()=>window.__rushPerfStop());
  const {profile}=await cdp.send('Profiler.stop');
  const data=await page.evaluate(()=>window.__rushPerf),workers=await Promise.all(page.workers().map(w=>w.evaluate(()=>self.__rushWorkerPerf)));
  const saved=await page.evaluate(async()=>{
    const db=await new Promise(resolve=>{const r=indexedDB.open('gecko-lab',1);r.onsuccess=()=>resolve(r.result);});
    return new Promise(resolve=>{const tx=db.transaction('games'),r=tx.objectStore('games').get('active');r.onsuccess=()=>{const g=r.result.save.game;resolve({count:Object.keys(g.individuals).length,turn:g.turn,money:g.money,writeRevision:r.result.writeRevision,rush:g.cafeRush});};tx.oncomplete=()=>db.close();});
  });
  const sorted=data.frames.slice().sort((a,b)=>a-b),sum=a=>a.reduce((s,v)=>s+v,0);
  const row={count,rate,frames:{count:sorted.length,p50:sorted[Math.floor(sorted.length*.5)],p95:sorted[Math.floor(sorted.length*.95)],p99:sorted[Math.floor(sorted.length*.99)],max:sorted.at(-1),over33:data.frames.filter(n=>n>33.4).length,over50:data.frames.filter(n=>n>50).length},longTasks:{count:data.longTasks.length,totalMs:sum(data.longTasks),maxMs:Math.max(0,...data.longTasks)},mainClones:{count:data.clones.length,totalMs:sum(data.clones)},mainFullSnapshots:data.fullSnapshots,mainActiveWrites:data.puts.filter(p=>p.key==='active').length,backgroundPaints:data.paints,backgroundMutations:data.mutations,collectionCommits:data.collectionCommits,workers,saved,errors};
  results.push(row);console.log(JSON.stringify(row));
  // Full sampling profiles remain temporary; the checked-in report contains measured counters.
  await writeFile('/tmp/rush-'+label+'-'+count+'.cpuprofile',JSON.stringify(profile));
  await writeFile(output+label+'.json',JSON.stringify({label,browser:browser.version(),viewport:{width:390,height:844},cpuThrottle:rate,method:'Production build; no video; full 25s round without input; browser rAF, Long Tasks, React hook, canvas, clone and IDB probes. CPU profile includes pre-start work; counters start after stage appears.',results},null,2)+'\n');
  await context.close();
}}finally{await browser.close();}
