import {test,expect,vi} from 'vitest';
import {createHash} from 'node:crypto';
import {readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {fixtureGenome,MORPHS,comparisonSubject} from '@/engine/regional/fixtures';
import {renderRegional} from '@/engine/regional/render';
import {regionalAppearance,regionalObservation,regionalCacheSize} from '@/engine/regional';
import {anatomy as A,sourceBase as B} from '@/engine/regional/anatomy';
import {artColor,PART} from '@/engine/art';
import {renderSprite} from '@/engine/render';
import {specimen,visualName} from '@/game/hardcore/adapter';
import {founderPoly,inheritPoly,POLY_IDS} from '@/genetics/advanced/polygenic';
import {inherit} from '@/genetics/advanced/inheritance';
import {regionalPhenotype} from '@/engine/regional/phenotype';
import {observeRegional} from '@/engine/regional/observe';
import {buildPatternPlan} from '@/engine/pattern-plan';
import {patternTraits} from '@/genetics/advanced/pattern-traits';
import {newGame,act} from '@/game/hardcore/play';
import {makeSave,readSave,exportBackup,parseBackup} from '@/game/hardcore/save';
import {valueGecko} from '@/game/hardcore/market';
import {evaluateBreedingChallenge} from '@/game/hardcore/challenge-evaluator';
import {BREEDING_CHALLENGES} from '@/game/hardcore/challenge-rules';
const hash=(v:ArrayBufferView)=>createHash('sha256').update(new Uint8Array(v.buffer,v.byteOffset,v.byteLength)).digest('hex');
const seed='regional-review-01';
vi.setConfig({testTimeout:30000});

test('production is exactly the reviewed v2 pixels in all 100 fixed conditions, never the v1 finish',()=>{
 const cases=JSON.parse(readFileSync('tests/fixtures/regional-v2-hashes.json','utf8'));
 for(const c of cases){const genome=fixtureGenome(c.profile,c.morph),input=specimen(comparisonSubject(genome,seed),c.fire),r=renderSprite(input);
  expect(r.version).toBe('regional-2');expect(hash(r.pixels)).toBe(c.pixels);expect(hash(renderRegional({genome,seed,fire:c.fire}).sprite.pixels)).toBe(c.pixels);}
});
test('all C/S/H allele pairs, Ax and Lilly combinations render without invented viability rules or genome mutation',()=>{
 const alleles=['n','C','S','H'],seen=new Set<string>();
 for(let a=0;a<4;a++)for(let b=a;b<4;b++)for(const lilly of [false,true])for(const ax of [false,true]){
  const genome=fixtureGenome('typical',lilly?'lilly':'normal');genome.mendelian.loci['cappuccino-complex']=[alleles[a],alleles[b]];if(ax)genome.mendelian.loci.axanthic=['ax','ax'];
  const before=JSON.stringify(genome),r=renderRegional({genome,seed});expect(r.sprite.pixels.length).toBe(36864);expect(JSON.stringify(genome)).toBe(before);seen.add(hash(r.sprite.pixels));
 }
 expect(seen.size).toBeGreaterThan(24);
 const genome=fixtureGenome('high','lilly');genome.mendelian.loci['lilly-white']=['Lw','Lw'];expect(()=>renderRegional({genome,seed})).toThrow('비생존');
});
test('every morph, low/high expression and fire state preserve alpha, real eye, nostrils and mouth pixels',()=>{
 let alphaErrors=0,protectedErrors=0,escaped=0;
 for(const profile of ['low','high'] as const)for(const m of MORPHS)for(const fire of ['up','down'] as const){
  const r=renderRegional({genome:fixtureGenome(profile,m.id),seed,fire}).sprite;
  for(let i=0;i<9216;i++){
   alphaErrors+=Number(r.pixels[i*4+3]!==B.silhouette[i]);
   if((B.eye[i]||A.mouth[i]||A.nostrils[i])&&!B.outline[i]){const expected=[...artColor(B.details[i]),255];for(let k=0;k<4;k++)protectedErrors+=Number(r.pixels[i*4+k]!==expected[k]);}
   if(A.protectedPixels[i])for(const l of r.layers.slice(4,7))escaped+=Number(!!l.mask[i]);
  }
 }
 expect({alphaErrors,protectedErrors,escaped}).toEqual({alphaErrors:0,protectedErrors:0,escaped:0});
});
test('Lilly high expression reaches the nose while low expression remains distinct; white retains structure',()=>{
 const a=regionalAppearance({genome:fixtureGenome('low','lilly'),seed}),b=regionalAppearance({genome:fixtureGenome('high','lilly'),seed});
 expect(a.metrics.headWhite).toBe(0);expect(b.metrics.headWhite).toBe(b.metrics.headSkin);expect(b.white[32*96+12]).toBe(255);expect(b.metrics.whitePixels).toBeLessThan(b.metrics.skinPixels);
 const colors=new Set<string>();for(let i=0;i<9216;i++)if(b.white[i])colors.add([...b.sprite.pixels.subarray(i*4,i*4+3)].join());expect(colors.size).toBeGreaterThan(12);
});
test('Ax brightness is inherited and the skin stays neutral; an undisclosed recessive carrier has no visual effect',()=>{
 const dark=regionalAppearance({genome:fixtureGenome('dark','axanthic'),seed}),bright=regionalAppearance({genome:fixtureGenome('bright','axanthic'),seed});
 expect(bright.metrics.meanSkinLuminance-dark.metrics.meanSkinLuminance).toBeGreaterThan(80);
 let chroma=0;for(const r of [dark,bright])for(let i=0;i<9216;i++)if(A.skin[i]){const c=[...r.sprite.pixels.subarray(i*4,i*4+3)];chroma=Math.max(chroma,Math.max(...c)-Math.min(...c));}expect(chroma).toBeLessThanOrEqual(8);
 const g=fixtureGenome('typical','normal'),before=hash(renderRegional({genome:g,seed}).sprite.pixels);g.mendelian.loci.axanthic=['A','ax'];expect(hash(renderRegional({genome:g,seed}).sprite.pixels)).toBe(before);
});
test('Cappuccino tail markers, Highway dorsal expansion and Sable crown clusters remain distinct',()=>{
 const render=(profile:'low'|'high',m:typeof MORPHS[number]['id'])=>regionalAppearance({genome:fixtureGenome(profile,m),seed});
 expect(render('high','cappuccino').metrics.tailBaseWhite).toBeGreaterThan(render('low','cappuccino').metrics.tailBaseWhite);
 expect(render('high','highway').metrics.dorsalWhite).toBeGreaterThan(render('low','highway').metrics.dorsalWhite*2);
 expect(render('high','sable').metrics.headWhite).toBeGreaterThan(render('low','sable').metrics.headWhite*3);
});
test('blanket white cannot earn hidden drip, pin or spot observations from underlying intended geometry',()=>{
 const input={genome:fixtureGenome('high','normal'),seed},r=structuredClone(renderRegional(input));
 const mask=buildPatternPlan(patternTraits(input.genome),seed).shapes.drips[0];expect(mask).toBeDefined();
 // Controlled final materials exercise the observer, never the pixel renderer.
 for(let i=0;i<9216;i++)if(A.skin[i]){r.materials[i]=mask[i]?2:1;r.sprite.pixels.set(mask[i]?[230,230,230,255]:[50,50,50,255],i*4);}
 const before=observeRegional(input,r).observation;expect(before.drips).toBeGreaterThan(0);
 for(let i=0;i<9216;i++)if(A.skin[i]){r.materials[i]=4;r.sprite.pixels.set([230,230,230,255],i*4);}
 const after=observeRegional(input,r).observation;expect(after.drips).toBe(0);expect(after.spots).toBe(0);expect(after.pin.every(l=>l.coverage===0)).toBe(true);
});
test('material observations follow Lilly and Highway base-skin overrides instead of their former cream geometry',()=>{
 const lilly=renderRegional({genome:fixtureGenome('low','lilly'),seed});
 expect(lilly.materials.some(m=>m===2)).toBe(false);
 const highway=renderRegional({genome:fixtureGenome('typical','highway'),seed});
 const flank=Array.from({length:9216},(_,i)=>i).filter(i=>A.skin[i]&&B.parts[i]===PART.body&&A.dorsalDepth[i]>=.94);
 expect(flank.length).toBeGreaterThan(10);expect(flank.every(i=>highway.materials[i]===1)).toBe(true);
});
test('12 seeds per morph are deterministic through JSON and maintain inherited expression strength',()=>{
 for(const m of MORPHS){const genome=fixtureGenome('typical',m.id),before=JSON.stringify(genome),strength=regionalPhenotype(genome).strength,seen=new Set<string>();
  for(let n=0;n<12;n++){const input={genome,seed:'regional-diversity-'+n},r=regionalAppearance(input);expect(r.phenotype.strength).toEqual(strength);seen.add(hash(r.sprite.pixels));expect(hash(regionalAppearance(JSON.parse(JSON.stringify(input))).sprite.pixels)).toBe(hash(r.sprite.pixels));}
  expect(seen.size).toBe(12);expect(JSON.stringify(genome)).toBe(before);
 }
});
test('actual parent allele inheritance gives siblings different appearances without inheriting a morph name',()=>{
 const father=fixtureGenome('typical','cappuccino'),mother=fixtureGenome('typical','sable');father.polygenic=founderPoly('f');mother.polygenic=founderPoly('m');const seen=new Set<string>();
 for(let n=0;n<32;n++){const childSeed='offspring-'+n,polygenic=inheritPoly(father.polygenic,mother.polygenic,childSeed),mendelian=inherit(father.mendelian,mother.mendelian,childSeed),genome={version:1 as const,polygenic,mendelian};
  for(const id of POLY_IDS){expect(father.polygenic.loci[id]).toContain(polygenic.loci[id][0]);expect(mother.polygenic.loci[id]).toContain(polygenic.loci[id][1]);}
  seen.add(hash(renderRegional({genome,seed:childSeed}).sprite.pixels));expect(inheritPoly(father.polygenic,mother.polygenic,childSeed)).toEqual(polygenic);
 }
 expect(seen.size).toBe(32);
});
test('new game, real purchases, embryos, prices and challenge decisions survive storage exactly',()=>{
 let game=newGame('regional-state','2026-10-17',{initialMoney:10000000,initialCapacity:30});const [f,m]=Object.keys(game.shop.offers);for(const id of [f,m])game=act(game,{type:'buyGecko',offerId:id},game.lastDate);game=act(game,{type:'breed',fatherId:f,motherId:m},game.lastDate);
 const check=(g:typeof game)=>Object.values(g.individuals).concat(Object.values(g.shop.offers).map(o=>o.individual),Object.values(g.matings).flatMap(m=>m.lifecycle!.offspring.map(o=>o.embryo))).map(a=>({id:a.id,pixels:hash(renderSprite(specimen(a)).pixels),name:visualName(a),price:valueGecko(a),goals:BREEDING_CHALLENGES.map(c=>evaluateBreedingChallenge(a,c.id))}));
 const saved=exportBackup(game);expect(check(parseBackup(saved,game.lastDate))).toEqual(check(game));expect(readSave(makeSave(game),game.lastDate)).toEqual(game);
});
test('old save is rejected with a new-game message and its raw backup remains unchanged',()=>{
 const raw=readFileSync('tests/fixtures/pre-pattern-v7.json','utf8'),before=hash(new TextEncoder().encode(raw));expect(()=>parseBackup(raw,'2026-10-17')).toThrow('새 게임');expect(hash(new TextEncoder().encode(raw))).toBe(before);
});
test('bounded caches reuse pixels and observations for identical genome/seed/fire and never key by individual name',()=>{
 const input={genome:fixtureGenome('typical','lilly'),seed},a=regionalAppearance(input);expect(regionalAppearance(JSON.parse(JSON.stringify(input)))).toBe(a);
 for(let n=0;n<550;n++)regionalObservation({...input,seed:'cache-'+n});expect(regionalCacheSize().pixels).toBeLessThanOrEqual(32);expect(regionalCacheSize().observations).toBeLessThanOrEqual(4096);
},30000);
test('production contains no prototype, alternate shader or legacy renderer imports',()=>{
 function walk(dir:string):string[]{return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(dir,e.name)):/\.tsx?$/.test(e.name)?[join(dir,e.name)]:[]);}
 for(const file of walk('src'))expect(readFileSync(file,'utf8'),file).not.toMatch(/from\s*['"][^'"]*(?:prototype\/appearance|legacy\/render)/);
});
