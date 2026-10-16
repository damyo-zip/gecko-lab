/** Sole production engine report. Writes developer evidence, never player data. */
import {appearanceRuntime} from './appearance-runtime.mjs';
import {encodePNG} from './png.mjs';
import sharp from 'sharp';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const folder='docs/regional-engine',seed='regional-review-01';
const hash=p=>createHash('sha256').update(p).digest('hex');
await appearanceRuntime(async load=>{
 const {regionalAppearance,regionalObservation,regionalCacheSize,APPEARANCE_VERSION}=await load('engine/regional/index');
 const {fixtureGenome,MORPHS}=await load('engine/regional/fixtures');
 const {patternTraits}=await load('genetics/advanced/pattern-traits');
 const {buildPatternPlan}=await load('engine/pattern-plan');
 const {PATTERN_PRICE_RULES:R}=await load('phenotype/rules');
 const {classifyPattern}=await load('phenotype/names');
 const {phenotype}=await load('genetics/advanced/phenotype');
 await mkdir(folder,{recursive:true});const report={version:APPEARANCE_VERSION,source:'regional-prototype-2',seed,frozenV2Matches:0,examples:[],compounds:[],performance:{},priceCalibration:{}};
 for(const row of JSON.parse(await readFile('tests/fixtures/regional-v2-hashes.json','utf8'))){const r=regionalAppearance({genome:fixtureGenome(row.profile,row.morph),seed,fire:row.fire});if(hash(r.sprite.pixels)!==row.pixels)throw Error('v2 pixel mismatch '+JSON.stringify(row));report.frozenV2Matches++;}
 const label=(text,w,h,size=16)=>({input:Buffer.from(`<svg width="${w}" height="${h}"><text x="8" y="${h*.7}" fill="#cde4cb" font-family="sans-serif" font-size="${size}">${text}</text></svg>`)});
 async function sheet(profile,morphs,scale){
  const size=96*scale,col=size+18,cols=3,width=Math.max(690,col*cols),rowHeight=size+70,height=60+Math.ceil(morphs.length/cols)*rowHeight,overlays=[{...label('GECKO LAB · 정식 regional-2 · '+profile+' · '+(scale===1?'96px 원본':scale+'배 확대'),width,40,19),left:0,top:0}];
  for(const [n,m]of morphs.entries()){
   const genome=fixtureGenome(profile,m.id),input={genome,seed},r=regionalAppearance(input),p=regionalObservation(input),names=classifyPattern(p.traits,p.observation,phenotype(genome).geneticMorphs),x=Math.floor((width-cols*col)/2)+(n%cols)*col,y=50+Math.floor(n/cols)*rowHeight;
   const png=encodePNG(96,96,r.sprite.pixels);overlays.push({input:await sharp(png).resize(size,size,{kernel:'nearest'}).png().toBuffer(),left:x+8,top:y});overlays.push({...label(m.label,col,26,13),left:x,top:y+size+2});
   if(scale===1){await writeFile(`${folder}/${profile}-${m.id}-96.png`,png);report.examples.push({profile,morph:m.id,pixels:hash(r.sprite.pixels),names,observation:p.observation});}
  }
  await sharp({create:{width,height,channels:4,background:'#0b1822'}}).composite(overlays).png().toFile(`${folder}/${profile}-${morphs.length===6?'core':'compounds'}-${scale}x.png`);
 }
 for(const profile of ['low','typical','high','dark','bright'])for(const scale of [1,4])await sheet(profile,MORPHS.slice(0,6),scale);
 for(const scale of [1,3])await sheet('typical',MORPHS.slice(6),scale);
 const alleles=['n','C','S','H'];for(let a=0;a<4;a++)for(let b=a;b<4;b++)for(const lilly of [false,true])for(const ax of [false,true]){
  const genome=fixtureGenome('typical',lilly?'lilly':'normal');genome.mendelian.loci['cappuccino-complex']=[alleles[a],alleles[b]];if(ax)genome.mendelian.loci.axanthic=['ax','ax'];const input={genome,seed},r=regionalAppearance(input),p=regionalObservation(input);report.compounds.push({pair:[alleles[a],alleles[b]],lilly,ax,pixels:hash(r.sprite.pixels),names:classifyPattern(p.traits,p.observation,phenotype(genome).geneticMorphs)});
 }
 // Cold vs cached measured appearances: fixed genes, unique visual seeds.
 const genome=fixtureGenome('typical','lilly'),inputs=Array.from({length:300},(_,n)=>({genome,seed:'production-performance-'+n}));
 const measure=run=>{const start=performance.now();run();return performance.now()-start;};
 const cold=measure(()=>inputs.forEach(i=>regionalObservation(i))),warm=measure(()=>inputs.forEach(i=>regionalObservation(i)));
 const visible=Array.from({length:24},(_,n)=>({genome,seed:'production-visible-cold-'+n})),coldPixels=measure(()=>visible.forEach(i=>regionalAppearance(i))),warmPixels=measure(()=>visible.forEach(i=>regionalAppearance(i)));
 report.performance={environment:'Node 24 cloud CPU; not Android device timing',individuals:300,coldObservationMs:cold,cachedObservationMs:warm,visibleSprites:24,coldPixelsMs:coldPixels,cachedPixelsMs:warmPixels,cache:regionalCacheSize()};
 const ratios=[];for(const profile of ['low','typical','high','dark','bright'])for(const m of MORPHS.slice(0,6)){
  const genome=fixtureGenome(profile,m.id),t=patternTraits(genome),old=buildPatternPlan(t,seed).observation,now=regionalObservation({genome,seed});
  const factor=(o,c)=>.85+R.pattern*(o.dorsal+o.flank+o.limbs)/3+R.continuity*o.pin.reduce((a,l)=>a+l.longestRun/l.length,0)/2+R.spots*Math.min(1,o.spots/100)+R.contrast*c;
  const before=factor(old,t.contrast),after=factor(now.observation,now.observation.contrast);ratios.push({profile,morph:m.id,before,after,ratio:after/before});
 }
 report.priceCalibration={note:'Same market bases, coefficients and rounding. Compare only the appearance multiplier on a controlled grid, not observed domestic prices.',meanRatio:ratios.reduce((s,r)=>s+r.ratio,0)/ratios.length,minRatio:Math.min(...ratios.map(r=>r.ratio)),maxRatio:Math.max(...ratios.map(r=>r.ratio)),examples:ratios};
 await writeFile(folder+'/report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({frozenV2Matches:report.frozenV2Matches,compounds:report.compounds.length,performance:report.performance,priceCalibration:{meanRatio:report.priceCalibration.meanRatio,minRatio:report.priceCalibration.minRatio,maxRatio:report.priceCalibration.maxRatio}},null,2));
});
