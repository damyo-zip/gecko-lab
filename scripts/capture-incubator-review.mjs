import {chromium} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const url=process.argv[2]??'http://127.0.0.1:3300',folder='docs/incubator-reference';
const buffer=await readFile(folder+'/baseline-game.json'),original=JSON.parse(buffer).game;
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true});
const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.clock.setFixedTime(new Date('2026-10-14T03:00:00Z'));
await page.goto(url);await page.getByRole('heading',{name:/^보유 개체/}).waitFor();
await page.getByRole('button',{name:'저장 및 게임 설정',exact:true}).click();await page.getByLabel('JSON 백업 파일',{exact:true}).setInputFiles({name:'review.json',mimeType:'application/json',buffer});await page.getByRole('button',{name:'복원 실행',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
await page.getByRole('navigation',{name:'게임 탭'}).getByRole('button',{name:'인큐베이터',exact:true}).click();await page.getByRole('heading',{name:'인큐베이터',exact:true}).waitFor();
await page.evaluate(async()=>{await Promise.all(['/ui/incubator/scene.png','/ui/home-terrarium.png','/ui/home-wordmark.svg'].map(src=>new Promise((resolve,reject)=>{const img=new Image();img.onload=resolve;img.onerror=reject;img.src=src;})));await document.fonts.ready;});
const captures=[];
for(const [width,height] of [[390,844],[360,800],[430,932],[607,1280]]){
 await page.setViewportSize({width,height});await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:folder+`/after-${width}.png`,scale:'css',animations:'disabled'});
 if(width===390)await page.screenshot({path:folder+'/after-390-full.png',fullPage:true,scale:'css'});
 captures.push(await page.evaluate(()=>({width:innerWidth,height:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth,hero:document.querySelector('.inc-hero').getBoundingClientRect().toJSON(),grid:getComputedStyle(document.querySelector('.inc-slot-grid')).gridTemplateColumns,cta:document.querySelector('.inc-turn-cta').getBoundingClientRect().toJSON(),nav:document.querySelector('.home-nav').getBoundingClientRect().toJSON()})));
}
const game=await page.evaluate(async()=>{const db=await new Promise(resolve=>{const r=indexedDB.open('gecko-lab',1);r.onsuccess=()=>resolve(r.result);});return new Promise(resolve=>{const tx=db.transaction('games','readonly'),r=tx.objectStore('games').get('active');r.onsuccess=()=>resolve(r.result.save.game);tx.oncomplete=()=>db.close();});});
if(JSON.stringify(game)!==JSON.stringify(original))throw new Error('UI changed original game records');
await writeFile(folder+'/capture-report.json',JSON.stringify({url,unchangedGame:true,fixtureSha256:createHash('sha256').update(JSON.stringify(game)).digest('hex'),captures,errors},null,2));
await browser.close();console.log(JSON.stringify({unchangedGame:true,captures:captures.map(c=>({width:c.width,height:c.height,overflow:c.overflow,ctaBottom:c.cta.bottom,navTop:c.nav.top})),errors}));
