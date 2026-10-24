/** Reproducible acceptance / rejection sheet from the production evaluator. */
import {createServer} from 'vite';
import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {encodePNG} from './png.mjs';
const folder='docs/eight-challenges';await mkdir(folder,{recursive:true});
const vite=await createServer({configFile:'vitest.config.ts',server:{middlewareMode:true,hmr:false}});
try{
 const {BREEDING_CHALLENGES}=await vite.ssrLoadModule('/src/game/hardcore/challenge-rules.ts');
 const {challengeExamples}=await vite.ssrLoadModule('/src/game/hardcore/challenge-examples.ts');
 const {inspectChallenge}=await vite.ssrLoadModule('/src/game/hardcore/challenge-observation.ts');
 const {forgeView}=await vite.ssrLoadModule('/src/game/hardcore/forge-appearance.ts');
 const {B_ORIGIN_01:source}=await vite.ssrLoadModule('/src/forge/engine/art/b-origin-01.ts');
 const rows=[],report=[];
 for(const goal of BREEDING_CHALLENGES){
  const cells=[];
  for(const ex of challengeExamples(goal.id)){
   const d=forgeView(ex.gecko).description,result=inspectChallenge(ex.gecko,goal.id);
   if(result.passed!==ex.accepted)throw Error('Example disagreement: '+goal.id);
   const rgba=d.sprite.pixels.slice();for(let i=0;i<9216;i++)if(!source.foreground[i])rgba.fill(0,i*4,i*4+4);
   const png=encodePNG(96,96,rgba),hash=createHash('sha256').update(rgba).digest('hex');
   const n=cells.length;
   cells.push(`<article><strong class="${ex.accepted?'pass':'fail'}">${ex.accepted?'인정':'불인정'}</strong><img src="data:image/png;base64,${png.toString('base64')}"><p>${ex.reason}</p></article>`);
   report.push({id:goal.id,sample:n,accepted:ex.accepted,reason:ex.reason,nativeRgbaSha256:hash,checks:result.checks});
  }
  rows.push(`<section><h2>${goal.target}</h2>${cells.join('')}</section>`);
 }
 const html=`<!doctype html><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;padding:24px;background:#ece8dc;color:#3b4435;font-family:"Noto Sans CJK KR",sans-serif}h1{font-size:24px}section{display:grid;grid-template-columns:240px repeat(4,216px);gap:10px;margin:12px 0;align-items:center}h2{font-size:16px}article{background:#f9f6ed;border:1px solid #b6bba6;padding:10px;min-height:300px;border-radius:7px}img{display:block;width:192px;height:192px;image-rendering:pixelated}p{font-size:11px;line-height:1.5}strong{font-size:13px}.pass{color:#438139}.fail{color:#a34d3d}</style><h1>GECKO LAB · 8개 도전의 인정 / 불인정 예시</h1><p>현재 게임 렌더러 · 파이어 업 · 96×96 원본의 2배 정수 확대 · 각 행 앞 2개 인정 / 뒤 2개 불인정</p>${rows.join('')}`;
 await writeFile(folder+'/report.json',JSON.stringify({sourceRgbaSha256:source.sourceRgbaSha256,evaluatorVersion:3,samples:report},null,2)+'\n');
 const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
 try{const page=await browser.newPage({viewport:{width:1192,height:900},deviceScaleFactor:1});await page.setContent(html);await page.locator('img').evaluateAll(xs=>Promise.all(xs.map(x=>x.decode())));await page.screenshot({path:folder+'/acceptance-sheet.png',fullPage:true});}finally{await browser.close()}
 console.log(JSON.stringify({samples:report.length,allMatch:true,folder}));
}finally{await vite.close()}
