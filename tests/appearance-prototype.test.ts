import {test,expect} from 'vitest';
import {createHash} from 'node:crypto';
import {readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {comparison,fixtureGenome,MORPHS,comparisonSubject} from '@/prototype/appearance/fixtures';
import {renderAppearancePrototype,renderAppearanceRelief} from '@/prototype/appearance/render';
import {prototypePhenotype} from '@/prototype/appearance/phenotype';
import {anatomy,sourceBase as B} from '@/prototype/appearance/anatomy';
import {artColor,PART} from '@/engine/art';
import {renderSprite} from '@/engine/render';
import {buildPatternPlan} from '@/engine/pattern-plan';
import {patternTraits} from '@/genetics/advanced/pattern-traits';
import {specimen} from '@/game/hardcore/adapter';
import {founderPoly,inheritPoly,POLY_IDS} from '@/genetics/advanced/polygenic';
import {inherit} from '@/genetics/advanced/inheritance';
import {newGame,act} from '@/game/hardcore/play';
import {exportBackup,parseBackup} from '@/game/hardcore/save';
import {valueGecko} from '@/game/hardcore/market';
import {evaluateBreedingChallenge} from '@/game/hardcore/challenge-evaluator';
import {BREEDING_CHALLENGES} from '@/game/hardcore/challenge-rules';

const hash=(v:Uint8Array|Uint8ClampedArray)=>createHash('sha256').update(v).digest('hex');
const seed='regional-review-01';
test('controlled panels change only the morph genotype, never the background or visual seed; C/S/H gain real pixel differences',()=>{
 const rows=MORPHS.slice(0,6).map(m=>comparison('typical',m.id,seed));
 for(const row of rows)expect(row.genome.polygenic).toEqual(rows[0].genome.polygenic);
 expect(new Set([0,3,4,5].map(n=>hash(rows[n].old.pixels))).size).toBe(1);
 expect(new Set(rows.map(r=>hash(r.improved.sprite.pixels))).size).toBe(6);
 for(const r of rows)expect(hash(r.old.pixels)).toBe(hash(renderSprite(specimen(comparisonSubject(r.genome,seed))).pixels));
});

test('Lilly spans low to extreme, reaches the front snout and keeps nested coverage for inherited cream changes',()=>{
 const low=comparison('low','lilly',seed).improved,high=comparison('high','lilly',seed).improved;
 expect(low.metrics.headWhite/low.metrics.headSkin).toBeLessThan(.10);
 expect(high.metrics.headWhite/high.metrics.headSkin).toBeGreaterThan(.95);
 expect(high.metrics.whitePixels/high.metrics.skinPixels).toBeLessThan(.99);
 let noseSkin=0,noseWhite=0;
 for(let i=0;i<9216;i++)if(B.parts[i]===PART.head&&i%96<12&&Math.floor(i/96)>=30&&Math.floor(i/96)<34&&anatomy.skin[i]){noseSkin++;noseWhite+=Number(!!high.white[i]);}
 expect(noseSkin).toBeGreaterThan(10);expect(noseWhite).toBe(noseSkin);
 const g=fixtureGenome('typical','lilly');let previous:Uint8Array=new Uint8Array(9216);
 for(let a=0;a<=4;a++){
  for(let n=0;n<6;n++)g.polygenic.loci['cream-'+n]=[a,a];
  const next=renderAppearancePrototype({genome:g,seed});
  for(let i=0;i<9216;i++)if(previous[i])expect(next.white[i]).toBe(255);
  previous=next.white;
 }
});

test('all low/high expressions and both fire states preserve exact eye, nostril, mouth and authored silhouette pixels',()=>{
 for(const profile of ['low','high'] as const)for(const morph of MORPHS.slice(0,6))for(const fire of ['up','down'] as const){
  const {sprite}=renderAppearancePrototype({genome:fixtureGenome(profile,morph.id),seed,fire});
  let alphaErrors=0,structuralErrors=0,escapedPattern=0;
  for(let i=0;i<9216;i++){
   alphaErrors+=Number(sprite.pixels[i*4+3]!==B.silhouette[i]);
   if((B.eye[i]||anatomy.mouth[i]||anatomy.nostrils[i])&&!B.outline[i]){
    const source=[...artColor(B.details[i]),255];for(let k=0;k<4;k++)structuralErrors+=Number(sprite.pixels[i*4+k]!==source[k]);
   }
   if(anatomy.protectedPixels[i])for(const l of sprite.layers.slice(4,7))escapedPattern+=Number(!!l.mask[i]);
  }
  expect({alphaErrors,structuralErrors,escapedPattern}).toEqual({alphaErrors:0,structuralErrors:0,escapedPattern:0});
 }
});

test('high-white skin retains tonal pixel clusters rather than one flat white fill',()=>{
 const r=comparison('high','lilly',seed).improved,colors=new Set<string>();
 for(let i=0;i<9216;i++)if(r.white[i])colors.add([...r.sprite.pixels.subarray(i*4,i*4+3)].join());
 expect(colors.size).toBeGreaterThan(20);
});

test('Axanthic inherits real brightness in final skin and retains achromatic dark/light materials; hidden carriers do not change appearance',()=>{
 const dark=comparison('dark','axanthic',seed).improved,bright=comparison('bright','axanthic',seed).improved;
 expect(bright.metrics.meanSkinLuminance-dark.metrics.meanSkinLuminance).toBeGreaterThan(80);
 expect(hash(bright.sprite.pixels)).not.toBe(hash(dark.sprite.pixels));
 for(const r of [dark,bright])for(let i=0;i<9216;i++)if(anatomy.skin[i]){
  const c=[...r.sprite.pixels.subarray(i*4,i*4+3)];expect(Math.max(...c)-Math.min(...c)).toBeLessThanOrEqual(8);
 }
 const g=fixtureGenome('typical','normal'),before=hash(renderAppearancePrototype({genome:g,seed}).sprite.pixels);
 g.mendelian.loci.axanthic=['A','ax'];expect(hash(renderAppearancePrototype({genome:g,seed}).sprite.pixels)).toBe(before);
});

test('Cappuccino has variable tail-base white and distal darkening, Highway grows inward and reduces the lower flank, Sable has crown clusters',()=>{
 const c0=comparison('low','cappuccino',seed).improved,c1=comparison('high','cappuccino',seed).improved;
 expect(c1.metrics.tailBaseWhite).toBeGreaterThan(c0.metrics.tailBaseWhite);expect(c1.metrics.tailTipDark).toBeGreaterThan(c0.metrics.tailTipDark);
 const h0=comparison('low','highway',seed).improved,h1=comparison('high','highway',seed).improved;
 expect(h1.metrics.dorsalWhite).toBeGreaterThan(h0.metrics.dorsalWhite*2);expect(h1.metrics.flankWhite).toBe(0);
 const s0=comparison('low','sable',seed).improved,s1=comparison('high','sable',seed).improved;
 expect(s1.metrics.headWhite).toBeGreaterThan(s0.metrics.headWhite*3);expect(s1.metrics.tailBaseWhite).toBe(0);
 expect(s1.metrics.headWhite).toBeGreaterThan(h1.metrics.headWhite);expect(hash(s1.sprite.pixels)).not.toBe(hash(c1.sprite.pixels));
});

test('combinations compose pigment and regional effects; unsupported supers do not get fabricated phenotypes',()=>{
 for(const id of ['lilly-axanthic','frappuccino','lilly-sable','axanthic-highway'] as const){
  const c=comparison('typical',id,seed),p=c.improved.phenotype;
  expect(Object.values(p.expressed).filter(Boolean)).toHaveLength(2);
  expect(hash(c.improved.sprite.pixels)).not.toBe(hash(c.old.pixels));
 }
 const g=fixtureGenome('typical','cappuccino');g.mendelian.loci['cappuccino-complex']=['C','S'];
 expect(()=>prototypePhenotype(g)).toThrow('아직 모델링');g.mendelian.loci['cappuccino-complex']=['n','n'];g.mendelian.loci['lilly-white']=['Lw','Lw'];
 expect(()=>prototypePhenotype(g)).toThrow('비생존');
});

test('twelve seeds per morph preserve genetic strength, stay deterministic and do not mutate the shared production pattern cache',()=>{
 for(const m of MORPHS.slice(1,6)){
  const genome=fixtureGenome('typical',m.id),before=JSON.stringify(genome),t=patternTraits(genome),plan=buildPatternPlan(t,seed);
  const cacheBefore=hash(plan.dorsal)+hash(plan.flank)+hash(plan.spots),seen=new Set<string>(),strength=prototypePhenotype(genome).strength;
  for(let n=0;n<12;n++){
   const input={genome,seed:'regional-diversity-'+n},r=renderAppearancePrototype(input);
   expect(r.phenotype.strength).toEqual(strength);seen.add(hash(r.sprite.pixels));
   expect(hash(renderAppearancePrototype(JSON.parse(JSON.stringify(input))).sprite.pixels)).toBe(hash(r.sprite.pixels));
  }
  expect(seen.size).toBe(12);expect(JSON.stringify(genome)).toBe(before);
  expect(hash(plan.dorsal)+hash(plan.flank)+hash(plan.spots)).toBe(cacheBefore);
 }
});

test('existing allele inheritance produces varied siblings with inherited expression; previewing never changes inheritance',()=>{
 const father=fixtureGenome('typical','lilly'),mother=fixtureGenome('typical','normal');father.polygenic=founderPoly('proto-f');mother.polygenic=founderPoly('proto-m');
 const values=new Set<string>();
 for(let n=0;n<32;n++){
  const childSeed='prototype-child-'+n,polygenic=inheritPoly(father.polygenic,mother.polygenic,childSeed),mendelian=inherit(father.mendelian,mother.mendelian,childSeed),genome={version:1 as const,polygenic,mendelian};
   const r=renderAppearancePrototype({genome,seed:childSeed});values.add(JSON.stringify(r.phenotype.strength));
   expect(renderAppearanceRelief({genome,seed:childSeed}).phenotype).toEqual(r.phenotype);
  for(const id of POLY_IDS){expect(father.polygenic.loci[id]).toContain(polygenic.loci[id][0]);expect(mother.polygenic.loci[id]).toContain(polygenic.loci[id][1]);}
  expect(inheritPoly(father.polygenic,mother.polygenic,childSeed)).toEqual(polygenic);expect(inherit(father.mendelian,mother.mendelian,childSeed)).toEqual(mendelian);
 }
 expect(values.size).toBeGreaterThan(20);
});

test('current/legacy backups, production pixels, quotes, pending embryos and all challenge verdicts are unchanged after previewing',()=>{
 let game=newGame('prototype-isolation','2026-10-16',{initialMoney:10_000_000,initialCapacity:30});
 const [f,m]=Object.keys(game.shop.offers);for(const id of [f,m])game=act(game,{type:'buyGecko',offerId:id},game.lastDate);
 game=act(game,{type:'breed',fatherId:f,motherId:m},game.lastDate);
 const check=(g:typeof game)=>Object.values(g.individuals).concat(Object.values(g.shop.offers).map(o=>o.individual),Object.values(g.matings).flatMap(m=>m.lifecycle!.offspring.map(o=>o.embryo))).map(a=>({id:a.id,pixels:hash(renderSprite(specimen(a)).pixels),quote:valueGecko(a),challenges:BREEDING_CHALLENGES.map(c=>evaluateBreedingChallenge(a,c.id))}));
 const backup=exportBackup(game),before=check(game);
 for(const g of [...Object.values(game.individuals),...Object.values(game.shop.offers).map(o=>o.individual)])if(g.genetics?.genome)for(const render of [renderAppearancePrototype,renderAppearanceRelief])render({genome:g.genetics.genome,seed:g.visualSeed});
 expect(exportBackup(game)).toBe(backup);expect(check(game)).toEqual(before);expect(parseBackup(backup,game.lastDate)).toEqual(game);
 const legacy=readFileSync('tests/fixtures/pre-pattern-v7.json','utf8'),loaded=parseBackup(legacy,game.lastDate),original=exportBackup(loaded),old=check(loaded);
 for(const o of Object.values(loaded.shop.offers))if(o.individual.genetics?.genome)for(const render of [renderAppearancePrototype,renderAppearanceRelief])render({genome:o.individual.genetics.genome,seed:o.individual.visualSeed});
 expect(check(loaded)).toEqual(old);expect(exportBackup(loaded)).toBe(original);
});

test('gameplay, genetics, pricing, storage and production renderer cannot import the experimental path',()=>{
 function walk(dir:string):string[]{return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(dir,e.name)):/\.tsx?$/.test(e.name)?[join(dir,e.name)]:[]);}
 for(const dir of ['src/game','src/genetics','src/engine','src/phenotype','src/storage','src/components/hardcore'])for(const file of walk(dir))expect(readFileSync(file,'utf8'),file).not.toMatch(/(?:from\s*|import\s*\()['"][^'"]*prototype\/appearance/);
});
