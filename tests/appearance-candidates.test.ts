import {test,expect,vi} from 'vitest';
import {createHash} from 'node:crypto';
import {readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {renderComparison,comparisonCacheSize} from '@/lab/appearance/candidates';
import {COMPARISONS} from '@/lab/appearance/policies';
import {fixtureGenome,MORPHS,comparisonSubject,PROFILES} from '@/engine/regional/fixtures';
import {anatomy as A,sourceBase as B} from '@/engine/regional/anatomy';
import {PART,artColor} from '@/engine/art';
import {renderSprite} from '@/engine/render';
import {specimen,visualName} from '@/game/hardcore/adapter';
import {newGame} from '@/game/hardcore/play';
import {exportBackup,parseBackup} from '@/game/hardcore/save';
import {valueGecko} from '@/game/hardcore/market';
import {evaluateBreedingChallenge} from '@/game/hardcore/challenge-evaluator';
import {BREEDING_CHALLENGES} from '@/game/hardcore/challenge-rules';
const seed='regional-review-01',ids=['A','B','C'] as const;
const hash=(p:Uint8ClampedArray)=>createHash('sha256').update(p).digest('hex');
const L=(p:Uint8ClampedArray,i:number)=>p[i*4]*.30+p[i*4+1]*.59+p[i*4+2]*.11;
const mean=(p:Uint8ClampedArray,predicate:(i:number)=>boolean)=>{let n=0,s=0;for(let i=0;i<9216;i++)if(A.skin[i]&&predicate(i)){n++;s+=L(p,i);}return s/n;};
vi.setConfig({testTimeout:60000});

test('historical comparison matches 60 outputs of the actual c934363 adapter and renderer, not a guessed reimplementation',()=>{
 const f=JSON.parse(readFileSync('tests/fixtures/authored-c934363-hashes.json','utf8'));
 expect(f.examples).toHaveLength(60);
 for(const c of f.examples)expect(hash(renderComparison({genome:fixtureGenome(c.profile,c.morph),seed:f.seed,fire:c.fire},'authored').pixels),JSON.stringify(c)).toBe(c.pixels);
});
test('normal including hidden Ax carrier is byte-identical to old art for all profiles, fire states and 12 seeds',()=>{
 for(const {id:profile}of PROFILES)for(const fire of ['up','down'] as const)for(let n=0;n<12;n++){
  const genome=fixtureGenome(profile,'normal'),input={genome,seed:'art-normal-'+n,fire},old=hash(renderComparison(input,'authored').pixels);
  for(const id of ids)expect(hash(renderComparison(input,id).pixels)).toBe(old);
  genome.mendelian.loci.axanthic=['A','ax'];for(const id of ids)expect(hash(renderComparison(input,id).pixels)).toBe(old);
 }
});
test('all morphs preserve exact alpha, original eye/nose/mouth/outline, crisp 96px pixels and source inputs',()=>{
 let errors=0;
 for(const profile of ['low','typical','high'] as const)for(const m of MORPHS.slice(0,6))for(const fire of ['up','down'] as const){
  const input={genome:fixtureGenome(profile,m.id),seed,fire},before=JSON.stringify(input),old=renderComparison(input,'authored');
  for(const id of ids){const r=renderComparison(input,id);expect([r.width,r.height,r.layers.length]).toEqual([96,96,8]);
   for(let i=0;i<9216;i++){
    errors+=Number(r.pixels[i*4+3]!==old.pixels[i*4+3]);
    if(A.protectedPixels[i])for(let k=0;k<4;k++)errors+=Number(r.pixels[i*4+k]!==old.pixels[i*4+k]);
   }
  }
  expect(JSON.stringify(input)).toBe(before);
 }
 expect(errors).toBe(0);
});
test('Lilly high expression expands to face/nose while retaining many discrete value clusters',()=>{
 const render=(p:'low'|'high',id:typeof ids[number])=>renderComparison({genome:fixtureGenome(p,'lilly'),seed},id).pixels;
 const low=render('low','C'),high=render('high','C');
 expect(mean(high,i=>B.parts[i]===PART.head)).toBeGreaterThan(mean(low,i=>B.parts[i]===PART.head)+25);
 expect(L(high,32*96+12)).toBeGreaterThan(L(low,32*96+12)+15);
 const values=new Set<string>();for(let i=0;i<9216;i++)if(A.skin[i]&&B.parts[i]===PART.head)values.add(high.subarray(i*4,i*4+3).join());
 // The authored indexed palette has few discrete skin clusters. Preserve their
 // ordering instead of manufacturing noise/colors merely to increase a count.
 expect(values.size).toBeGreaterThanOrEqual(12);
 let pairs=0,agree=0;for(let i=0;i<9216-96;i++)for(const j of [i+1,i+96])if(A.skin[i]&&A.skin[j]&&B.parts[i]===PART.head&&B.parts[j]===PART.head){
  const source=(n:number)=>{const c=artColor(B.details[n]);return c[0]*.30+c[1]*.59+c[2]*.11;},delta=source(i)-source(j);
  if(Math.abs(delta)>10){pairs++;agree+=Number(Math.sign(delta)===Math.sign(L(high,i)-L(high,j)));}
 }expect(pairs).toBeGreaterThan(10);expect(agree/pairs).toBeGreaterThan(.95);
});
test('Ax inherited lightness, Capp tail, Highway spread and Sable contrast are visible material differences',()=>{
 const pixels=(profile:'dark'|'bright'|'typical'|'high',m:typeof MORPHS[number]['id'],id:typeof COMPARISONS[number]['id']='C')=>renderComparison({genome:fixtureGenome(profile,m),seed},id).pixels;
 expect(mean(pixels('bright','axanthic'),()=>true)-mean(pixels('dark','axanthic'),()=>true)).toBeGreaterThan(25);
 const tailTip=(i:number)=>B.parts[i]===PART.tail&&A.tailProgress[i]>.90;
 expect(mean(pixels('high','cappuccino'),tailTip)).toBeLessThan(mean(pixels('high','cappuccino','authored'),tailTip)-15);
 const back=(i:number)=>B.parts[i]===PART.body&&A.dorsalDepth[i]<.50;
 expect(mean(pixels('typical','highway'),back)).toBeGreaterThan(mean(pixels('typical','highway','authored'),back)+5);
 const oldSable=pixels('typical','sable','authored'),neck=(i:number)=>B.parts[i]===PART.body&&L(oldSable,i)<130;
 expect(mean(pixels('typical','sable'),neck)).toBeLessThan(mean(oldSable,neck));
});
test('each candidate retains 12 deterministic individual patterns per morph across JSON restoration',()=>{
 for(const id of ids)for(const m of MORPHS.slice(0,6)){
  const seen=new Set<string>();for(let n=0;n<12;n++){
   const input={genome:fixtureGenome('typical',m.id),seed:'art-diversity-'+n},r=renderComparison(input,id);seen.add(hash(r.pixels));
   expect(hash(renderComparison(JSON.parse(JSON.stringify(input)),id).pixels)).toBe(hash(r.pixels));
  }expect(seen.size).toBe(12);
 }
});
test('A/B/C are distinct for expressed morphs and preserve per-morph variation beyond a single global tint',()=>{
 for(const m of MORPHS.slice(1,6)){
  // Brightness is the Ax expression axis; typical brightness is intentionally
  // identical across candidates. Other morphs use the high-expression profile.
  const input={genome:fixtureGenome(m.id==='axanthic'?'dark':'high',m.id),seed};
  expect(new Set(ids.map(id=>hash(renderComparison(input,id).pixels))).size,m.id).toBe(3);
 }
});
test('candidate evaluation cannot change production pixels, names, prices, challenges or a saved new game',()=>{
 const game=newGame('art-isolation','2026-10-17'),backup=exportBackup(game);
 const before=Object.values(game.shop.offers).map(o=>o.individual);
 const observe=(g:typeof before[number])=>({pixels:hash(renderSprite(specimen(g)).pixels),name:visualName(g),price:valueGecko(g),challenges:BREEDING_CHALLENGES.map(c=>evaluateBreedingChallenge(g,c.id))});
 const expected=before.map(observe);
 for(const g of before)for(const id of COMPARISONS)renderComparison({genome:g.genetics!.genome!,seed:g.visualSeed},id.id);
 expect(before.map(observe)).toEqual(expected);expect(exportBackup(game)).toBe(backup);expect(parseBackup(backup,game.lastDate)).toEqual(game);
 const normal=comparisonSubject(fixtureGenome('high','normal'),seed);expect(renderSprite(specimen(normal)).version).toBe('regional-2');
});
test('comparison cache is bounded and no production module imports lab or its UI',()=>{
 for(let n=0;n<90;n++)renderComparison({genome:fixtureGenome('typical','normal'),seed:'cache-art-'+n},'B');expect(comparisonCacheSize()).toBeLessThanOrEqual(60);
 function walk(dir:string):string[]{return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(dir,e.name)):/\.tsx?$/.test(e.name)?[join(dir,e.name)]:[]);}
 for(const file of walk('src').filter(f=>!f.startsWith('src/lab/')&&!f.includes('appearance-candidate-lab')&&!f.startsWith('src/app/lab/'))){
  expect(readFileSync(file,'utf8'),file).not.toMatch(/(?:from|import\()\s*['"][^'"]*(?:lab\/appearance|appearance-candidate-lab)/);
 }
});
