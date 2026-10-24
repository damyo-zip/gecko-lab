/** Actual Forge adapter output. Uses legal colour copies from real shop parents;
 * preset pattern copies provide six repeatable morphology comparisons. */
import {createServer} from 'vite';
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {chromium} from '@playwright/test';
import {encodePNG} from './png.mjs';

const folder='docs/natural-colours',date='2026-10-23';
await mkdir(folder,{recursive:true});
const vite=await createServer({configFile:'vitest.config.ts',server:{middlewareMode:true,hmr:false}});
try{
 const {newForgeGame}=await vite.ssrLoadModule('/src/game/hardcore/play.ts');
 const {forgeView}=await vite.ssrLoadModule('/src/game/hardcore/forge-appearance.ts');
 const {founderForge}=await vite.ssrLoadModule('/src/game/hardcore/forge-genetics.ts');
 const {createCompanionPatternsFounder}=await vite.ssrLoadModule('/src/forge/engine/companion-patterns-breeding.ts');
 const {B_ORIGIN_01:source}=await vite.ssrLoadModule('/src/forge/engine/art/b-origin-01.ts');
 const {polyScores}=await vite.ssrLoadModule('/src/genetics/advanced/polygenic.ts');
 const {legacyTraits}=await vite.ssrLoadModule('/src/genetics/advanced/phenotype.ts');
 const hash=data=>createHash('sha256').update(data).digest('hex');
 const parents=[];
 for(let n=0;n<4;n++){
  const game=newForgeGame('natural-review-'+n,date);
  parents.push(...Object.values(game.shop.offers).flatMap(o=>[o.family.father,o.family.mother]));
 }
 // Choose distributed luminance/hue examples from the actual catalog, never RGB overrides.
 parents.sort((a,b)=>polyScores(a.genetics.genome.polygenic).brightness-polyScores(b.genetics.genome.polygenic).brightness);
 const selected=Array.from({length:12},(_,n)=>parents[Math.round(n*(parents.length-1)/11)]);
 const rows=[],images=[];
 for(const morph of['base','lilly','axanthic','dalmatian','select-harlequin','tiger']){
  const cells=[];
  for(let n=0;n<12;n++){
   const id='natural-review-'+morph+'-'+n,f=createCompanionPatternsFounder({id,seed:id,name:id,sex:'female',morph}),parent=selected[n],g=structuredClone(parent);
   g.visualSeed=f.visualSeed;g.genetics.genome=f.genome;g.genetics.forge={...founderForge(id),extensions:f.extensions,patternColour:parent.genetics.forge.patternColour};
   for(const feature of['red','orange','brightness'])for(let i=0;i<6;i++)g.genetics.genome.polygenic.loci[feature+'-'+i]=parent.genetics.genome.polygenic.loci[feature+'-'+i];
   g.genotype={modelVersion:1,loci:{'lilly-white':f.genome.mendelian.loci['lilly-white'],axanthic:f.genome.mendelian.loci.axanthic}};g.potential=legacyTraits(polyScores(f.genome.polygenic));
   const old=structuredClone(g);delete old.genetics.forge.paletteVersion;delete old.genetics.forge.patternColour;
   const before=forgeView(old).description,after=forgeView(g).description;
   let protectedPixels=0,spotPixels=0;
   for(let i=0;i<9216;i++){
    if(before.sprite.pixels[i*4+3]!==after.sprite.pixels[i*4+3])throw Error('Alpha changed');
    for(const mask of['spotMask','pinMask','whiteMask'])if(before[mask][i]!==after[mask][i])throw Error(mask+' changed');
    if(source.protection[i]||before.spotMask[i])for(let c=0;c<4;c++)if(before.sprite.pixels[i*4+c]!==after.sprite.pixels[i*4+c])throw Error('Protected/spot pixel changed');
    if(source.protection[i])protectedPixels++;if(before.spotMask[i])spotPixels++;
   }
   rows.push({morph,seed:id,colourParent:parent.id,before:hash(before.sprite.pixels),after:hash(after.sprite.pixels),body:after.parameters.bodyColor,pattern:after.parameters.detailColor,protectedPixels,spotPixels});
   const png=d=>{const pixels=d.sprite.pixels.slice();for(let i=0;i<9216;i++)if(!source.foreground[i])pixels.fill(0,i*4,i*4+4);return'data:image/png;base64,'+encodePNG(96,96,pixels).toString('base64');};
   cells.push(`<article><small>${n+1}</small><div><img src="${png(before)}"><img src="${png(after)}"></div></article>`);
  }
  images.push(`<section><h2>${morph}</h2>${cells.join('')}</section>`);
 }
 const html=`<!doctype html><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;padding:20px;background:#eeeade;color:#424a37;font-family:sans-serif}h1{font-size:24px;margin:0 0 8px}p{margin:0 0 16px;font-size:14px}section{display:grid;grid-template-columns:100px repeat(12,192px);align-items:center;margin-bottom:8px}h2{font-size:13px}article{border:1px solid #c9cbbb;background:#f8f5eb}small{display:block;text-align:center;font-size:12px;padding-top:3px}article div{display:flex;height:96px}img{width:96px;height:96px;image-rendering:pixelated}</style><h1>GECKO LAB · Natural colours v2</h1><p>Each pair: BEFORE / AFTER · same native 96×96 source, seed, shape, spots and masks · legal colour copies from actual catalog parents</p>${images.join('')}`;
 await writeFile(folder+'/report.json',JSON.stringify({sourceRgbaSha256:source.sourceRgbaSha256,comparison:'before / after',samples:rows},null,2)+'\n');
 const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
 try{const page=await browser.newPage({viewport:{width:2444,height:850},deviceScaleFactor:1});await page.setContent(html);await page.locator('img').last().evaluate(el=>el.decode());await page.screenshot({path:folder+'/six-morphs-twelve-seeds.png',fullPage:true});}finally{await browser.close();}
 console.log(JSON.stringify({samples:rows.length,sourceRgbaSha256:source.sourceRgbaSha256,alpha:'unchanged',protectedPixels:'unchanged',spots:'unchanged',folder}));
}finally{await vite.close();}
