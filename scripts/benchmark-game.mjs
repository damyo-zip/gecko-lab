/** Deterministic Node/Vite CPU benchmark, never connects to a player's storage. */
import {createServer} from 'vite';
import {Session} from 'node:inspector';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const vite=await createServer({root,configFile:root+'vitest.config.ts',server:{middlewareMode:true}});
const {rushPerformanceGame}=await vite.ssrLoadModule('/e2e/helpers/forge-fixtures.ts');
const {currentChallengeClutch}=await vite.ssrLoadModule('/tests/helpers/current-challenge-game.ts');
const {act}=await vite.ssrLoadModule('/src/game/hardcore/play.ts');
const {actWithTime}=await vite.ssrLoadModule('/src/game/hardcore/time-source.ts');
const {makeSave,readMonthlySave,checksum}=await vite.ssrLoadModule('/src/game/hardcore/save.ts');
const {validateGame}=await vite.ssrLoadModule('/src/game/hardcore/validation.ts');
const inspector=new Session();inspector.connect();
const post=(method)=>new Promise((resolve,reject)=>inspector.post(method,(e,r)=>e?reject(e):resolve(r)));
const results=[];
let clones=0;const clone=globalThis.structuredClone;
globalThis.structuredClone=(...args)=>{clones++;return clone(...args);};
async function measure(label,fn){
 clones=0;const times=[];await post('Profiler.enable');await post('Profiler.start');
 for(let n=0;n<3;n++){const at=performance.now();fn();times.push(performance.now()-at);}
 const {profile}=await post('Profiler.stop'),nodes=new Map(profile.nodes.map(n=>[n.id,n])),samples=new Map();
 for(let i=0;i<profile.samples.length;i++){const node=nodes.get(profile.samples[i]),key=node.callFrame.functionName+' @ '+node.callFrame.url.split('/').slice(-2).join('/');samples.set(key,(samples.get(key)??0)+profile.timeDeltas[i]);}
 const result={label,ms:times.map(v=>+v.toFixed(2)),medianMs:+[...times].sort((a,b)=>a-b)[1].toFixed(2),clonesPerCall:clones/3,hotspots:[...samples].sort((a,b)=>b[1]-a[1]).slice(0,12).map(([name,us])=>({name,ms:Math.round(us/1000)}))};
 results.push(result);console.log(JSON.stringify(result));
}
try{
 for(const count of (process.env.PERF_COUNTS??'6,60,300').split(',').map(Number)){
  const game=rushPerformanceGame(count),save=makeSave(game);
  await measure(count+' animals: endTurn',()=>actWithTime(game,{type:'endTurn'},game.lastDate));
  await measure(count+' animals: makeSave',()=>makeSave(game));
  await measure(count+' animals: load',()=>readMonthlySave(save,game.lastDate));
 }
 let game=currentChallengeClutch('lilly-dalmatian',true).game;game.food=100000;game.capacity=500;
 const mating=Object.values(game.matings)[0],fatherId=mating.parents.fatherId,motherId=mating.parents.motherId;
 const turn=()=>{game=actWithTime(game,{type:'endTurn'},game.lastDate);};
 const settle=()=>{for(const e of Object.values(game.eggs))if(e.care?.settledTurn===null&&e.status!=='incubating')game=act(game,{type:e.status==='hatched'?'receiveHatchling':'removeFailedEgg',eggId:e.id},game.lastDate);};
 for(let n=1;n<=Number(process.env.PERF_CLUTCHES??24);n++){
  if(n>1){while(game.turn<game.individuals[motherId].nextBreedTurn)turn();game=act(game,{type:'breed',fatherId,motherId},game.lastDate);turn();const m=Object.values(game.matings).at(-1);game=act(game,{type:'collectEggs',matingId:m.id},game.lastDate);}
  for(let j=0;j<3;j++)turn();settle();
  if([1,8,24].includes(n)){
   validateGame(game);const source=game,save=makeSave(source);
   results.push({label:n+' clutches: fixture',animals:Object.keys(source.individuals).length,eggs:Object.keys(source.eggs).length,turn:source.turn,checksum:checksum(source)});
   await measure(n+' clutches: endTurn',()=>actWithTime(source,{type:'endTurn'},source.lastDate));
   await measure(n+' clutches: makeSave',()=>makeSave(source));
   await measure(n+' clutches: load',()=>readMonthlySave(save,source.lastDate));
  }
 }
 const output=process.env.PERF_OUTPUT??'/tmp/gecko-game-performance.json';await mkdir(output.substring(0,output.lastIndexOf('/')),{recursive:true});await writeFile(output,JSON.stringify({node:process.version,results},null,2));
}finally{globalThis.structuredClone=clone;inspector.disconnect();await vite.close();}
