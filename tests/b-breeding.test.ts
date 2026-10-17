import {test,expect} from 'vitest';
import {createHash} from 'node:crypto';
import {readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {renderB,bCacheSize} from '@/lab/appearance/b-breeding/render';
import {B_ANATOMY as A} from '@/lab/appearance/b-breeding/anatomy';
import {bPhenotype} from '@/lab/appearance/b-breeding/phenotype';
import {CORE_MORPHS,LEVELS,conditionExamples,family,selectionStudy} from '@/lab/appearance/b-breeding/samples';
import {fixtureGenome} from '@/engine/regional/fixtures';
import {POLY_IDS} from '@/genetics/advanced/polygenic';
import {newGame} from '@/game/hardcore/play';
import {exportBackup,parseBackup} from '@/game/hardcore/save';
import {renderSprite} from '@/engine/render';
import {specimen,visualName} from '@/game/hardcore/adapter';
import {valueGecko} from '@/game/hardcore/market';
import {BREEDING_CHALLENGES} from '@/game/hardcore/challenge-rules';
import {evaluateBreedingChallenge} from '@/game/hardcore/challenge-evaluator';
const seed='b-breeding-01',hash=(p:Uint8ClampedArray)=>createHash('sha256').update(p).digest('hex');
test('six morphs across five backgrounds preserve B native silhouette, eye and crisp limited colors',()=>{
 let errors=0;
 for(const m of CORE_MORPHS)for(const profile of ['low','typical','high','dark','bright'] as const){
  const input={genome:fixtureGenome(profile,m.id),seed},before=JSON.stringify(input),r=renderB(input),colors=new Set<string>();
  expect([r.width,r.height,r.pixels.length]).toEqual([96,96,36864]);
  for(let i=0;i<9216;i++){
   errors+=Number(r.pixels[i*4+3]!==A.alpha[i]);if(A.eye[i])for(let k=0;k<4;k++)errors+=Number(r.pixels[i*4+k]!==A.pixels[i*4+k]);
   if(r.pixels[i*4+3])colors.add(r.pixels.subarray(i*4,i*4+3).join());
  }expect(colors.size).toBeLessThanOrEqual(64);expect(JSON.stringify(input)).toBe(before);
 }expect(errors).toBe(0);
});
test('morph-specific regional expression is visible and increases with inherited modifier strength',()=>{
 const r=(m:typeof CORE_MORPHS[number]['id'],p:'low'|'high'|'typical')=>renderB({genome:fixtureGenome(p,m),seed});
 expect(r('lilly','high').metrics.white).toBeGreaterThan(r('lilly','low').metrics.white*2);
 expect(r('lilly','high').metrics.headWhite).toBeGreaterThan(250);expect(r('lilly','low').metrics.headWhite).toBe(0);
 expect(r('lilly','high').materials[30*96+12]).toBe(4);
 expect(r('cappuccino','high').metrics.tailBaseWhite).toBeGreaterThan(r('cappuccino','low').metrics.tailBaseWhite*2);
 expect(r('cappuccino','high').metrics.tailTipDark).toBeGreaterThan(r('cappuccino','low').metrics.tailTipDark);
 expect(r('highway','high').metrics.dorsalWhite).toBeGreaterThan(r('highway','low').metrics.dorsalWhite*1.5);
 expect(r('highway','high').metrics.sideCream).toBeLessThan(r('normal','high').metrics.sideCream);
 expect(r('sable','high').metrics.headWhite).toBeGreaterThan(r('sable','low').metrics.headWhite*3);
 expect(new Set(CORE_MORPHS.map(m=>hash(r(m.id,'typical').pixels))).size).toBe(6);
});
test('Ax brightness and contrast are material-specific; hidden carrier is visually Normal',()=>{
 const pair=conditionExamples('axanthic','brightness',seed),dark=renderB(pair[0]),bright=renderB(pair[1]);
 expect(bright.metrics.meanSkinLuminance-dark.metrics.meanSkinLuminance).toBeGreaterThan(55);
 for(const r of [dark,bright])for(let i=0;i<9216;i++)if(A.skin[i]){const c=[...r.pixels.subarray(i*4,i*4+3)];expect(Math.max(...c)-Math.min(...c)).toBeLessThanOrEqual(12);}
 const g=fixtureGenome('typical','normal'),a=hash(renderB({genome:g,seed}).pixels);g.mendelian.loci.axanthic=['A','ax'];expect(hash(renderB({genome:g,seed}).pixels)).toBe(a);
});
test('high white preserves authored internal value ordering and facial structure',()=>{
 const r=renderB({genome:fixtureGenome('high','lilly'),seed});const colors=new Set<string>(),values=[];
 for(let i=0;i<9216;i++)if(A.head[i]&&r.materials[i]===4){colors.add(r.pixels.subarray(i*4,i*4+3).join());values.push(r.pixels[i*4]*.3+r.pixels[i*4+1]*.59+r.pixels[i*4+2]*.11);}
 expect(colors.size).toBeGreaterThanOrEqual(5);expect(Math.max(...values)-Math.min(...values)).toBeGreaterThan(40);
 for(let i=0;i<9216;i++)if(A.structure[i])expect([...r.pixels.subarray(i*4,i*4+4)]).toEqual([...A.pixels.subarray(i*4,i*4+4)]);
});
test('same-morph individual diversity and JSON restoration are deterministic across 12 seeds',()=>{
 for(const m of CORE_MORPHS){const genes=new Set<string>(),images=new Set<string>();
  for(const e of conditionExamples(m.id,'diverse',seed)){genes.add(JSON.stringify(e.genome));images.add(hash(renderB(e).pixels));}expect(genes.size).toBe(4);expect(images.size).toBe(4);
  const placements=new Set<string>();for(let n=0;n<12;n++){const input={genome:fixtureGenome('typical',m.id),seed:'b-diverse-'+n},r=renderB(input);placements.add(hash(r.pixels));expect(hash(renderB(JSON.parse(JSON.stringify(input))).pixels)).toBe(hash(r.pixels));}expect(placements.size).toBeGreaterThanOrEqual(10);
 }
});
test('controlled lightness pairs change only the six intended loci, not pattern genotypes or seed',()=>{
 for(const m of CORE_MORPHS){const [a,b]=conditionExamples(m.id,'brightness',seed);expect(a.seed).toBe(b.seed);expect(a.genome.mendelian).toEqual(b.genome.mendelian);
  expect(POLY_IDS.filter(id=>JSON.stringify(a.genome.polygenic.loci[id])!==JSON.stringify(b.genome.polygenic.loci[id]))).toEqual(POLY_IDS.filter(id=>id.startsWith('brightness-')));
 }
});
test('the first four actual children inherit exactly one allele per parent at every locus and parents survive rerolls',()=>{
 for(const id of ['lilly','axanthic','complex'] as const){const f=family(id,seed),other=family(id,'another-offspring');
  expect(other.father).toEqual(f.father);expect(other.mother).toEqual(f.mother);expect(other.children).not.toEqual(f.children);
  for(const c of f.children){expect(c.parents).toEqual([f.father.id,f.mother.id]);for(const locus of Object.keys(c.genome.mendelian.loci)){expect(f.father.genome.mendelian.loci[locus]).toContain(c.genome.mendelian.loci[locus][0]);expect(f.mother.genome.mendelian.loci[locus]).toContain(c.genome.mendelian.loci[locus][1]);}
   for(const locus of POLY_IDS){expect(f.father.genome.polygenic.loci[locus]).toContain(c.genome.polygenic.loci[locus][0]);expect(f.mother.genome.polygenic.loci[locus]).toContain(c.genome.polygenic.loci[locus][1]);}
  }expect(new Set(f.children.map(c=>hash(renderB(c).pixels))).size).toBe(4);
 }
 const ax=family('axanthic',seed);expect(ax.children.every(c=>bPhenotype(c.genome).expressed.axanthic)).toBe(true);
});
test('five generations select actual offspring without mutation or changing the displayed Highway dosage',()=>{
 const history=selectionStudy();expect(history).toHaveLength(6);
 for(const row of history){for(const selected of row.selected){expect(row.children).toContain(selected);expect([...selected.genome.mendelian.loci['cappuccino-complex']].sort()).toEqual(['H','n']);}
  if(row.generation>0){expect(row.children).toHaveLength(48);for(const c of row.children)for(const id of POLY_IDS){expect(row.parents[0].genome.polygenic.loci[id]).toContain(c.genome.polygenic.loci[id][0]);expect(row.parents[1].genome.polygenic.loci[id]).toContain(c.genome.polygenic.loci[id][1]);}}
 }
 expect(history[5].mean-history[0].mean).toBeGreaterThan(.15);
 expect(renderB(history[5].selected[0]).metrics.dorsalWhite).toBeGreaterThan(renderB(history[0].selected[0]).metrics.dorsalWhite+30);
});
test('existing supported combinations compose without mutation; existing nonviable Lilly is still rejected',()=>{
 for(const a of ['n','C','S','H'])for(const b of ['n','C','S','H'])for(const lw of [false,true])for(const ax of [false,true]){
  const g=fixtureGenome('typical',lw?'lilly':'normal');g.mendelian.loci['cappuccino-complex']=[a,b];if(ax)g.mendelian.loci.axanthic=['ax','ax'];const before=JSON.stringify(g);expect(renderB({genome:g,seed}).pixels.length).toBe(36864);expect(JSON.stringify(g)).toBe(before);
 }
 const g=fixtureGenome('high','lilly');g.mendelian.loci['lilly-white']=['Lw','Lw'];expect(()=>renderB({genome:g,seed})).toThrow('비생존');
});
test('lab calculations leave game images, names, prices, challenge decisions and saves unchanged; cache is bounded',()=>{
 const game=newGame('B-experiment-isolation','2026-10-17'),backup=exportBackup(game),owned=Object.values(game.shop.offers).map(o=>o.individual);
 const observe=()=>owned.map(g=>({image:hash(renderSprite(specimen(g)).pixels),name:visualName(g),price:valueGecko(g),challenges:BREEDING_CHALLENGES.map(c=>evaluateBreedingChallenge(g,c.id))})),before=observe();
 for(const g of owned)renderB({genome:g.genetics!.genome!,seed:g.visualSeed});expect(observe()).toEqual(before);expect(exportBackup(game)).toBe(backup);expect(parseBackup(backup,game.lastDate)).toEqual(game);
 for(let n=0;n<70;n++)renderB({genome:fixtureGenome('typical','lilly'),seed:'bounded-B-'+n});expect(bCacheSize()).toBeLessThanOrEqual(48);
});
test('no production source imports the B expression experiment',()=>{
 const walk=(dir:string):string[]=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(dir,e.name)):/\.tsx?$/.test(e.name)?[join(dir,e.name)]:[]);
 for(const file of walk('src').filter(f=>!f.startsWith('src/lab/')&&!f.startsWith('src/app/lab/'))){expect(readFileSync(file,'utf8'),file).not.toMatch(/from\s*['"][^'"]*(?:b-breeding|appearance\/pixels)/);}
});
