import {test,expect} from 'vitest';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {IDEALS,MORPHS} from '@/lab/appearance/b-breeding/ideal/art';
import {renderIdeal,renderInverse,idealProtected,idealCacheSize} from '@/lab/appearance/b-breeding/ideal/render';
import {idealTraits} from '@/lab/appearance/b-breeding/ideal/traits';
import {observeIdeal} from '@/lab/appearance/b-breeding/ideal/observe';
import {controlGenome,deficitExamples,brightnessExamples,inheritanceFamily,breedingHistory,offspring,LAB_SEED,selectionValue} from '@/lab/appearance/b-breeding/ideal/samples';
import {B_ANATOMY as A} from '@/lab/appearance/b-breeding/anatomy';
import {renderBase} from '@/lab/appearance/base-study/render';
import {POLY_IDS} from '@/genetics/advanced/polygenic';
import {LOCI} from '@/genetics/advanced/loci';
import {newGame} from '@/game/hardcore/play';
import {exportBackup,parseBackup} from '@/game/hardcore/save';
import {specimen,visualName} from '@/game/hardcore/adapter';
import {renderSprite} from '@/engine/render';
import {valueGecko} from '@/game/hardcore/market';
import {BREEDING_CHALLENGES} from '@/game/hardcore/challenge-rules';
import {evaluateBreedingChallenge} from '@/game/hardcore/challenge-evaluator';
const hash=(p:Uint8Array|Uint8ClampedArray)=>createHash('sha256').update(p).digest('hex');

test('the first B is unchanged, and the normal ideal is exactly that original artwork, not a neutral reconstruction',()=>{
 expect(hash(readFileSync('public/lab/base-study/B-normal.png'))).toBe('487aa44664d047f20a6875c48715f3a083ee876ddc524d5c01150ac9f03959de');
 expect(hash(renderIdeal('normal').pixels)).toBe('8ebf9695758b0f95e93e0c2c4d0426917283a7d61949f507534ad2c83cdc51ad');
 expect(renderIdeal('normal').pixels).toEqual(renderBase('B').pixels);expect(IDEALS).toHaveLength(6);
 expect(new Set(MORPHS.map(m=>hash(renderIdeal(m.id).pixels))).size).toBe(6);
 for(const m of MORPHS)expect(renderInverse({genome:controlGenome(m.id,0),seed:LAB_SEED}).pixels).toEqual(renderIdeal(m.id).pixels);
 expect(()=>renderIdeal('normal','missing-art')).toThrow('Unknown ideal art');
 expect(()=>renderIdeal('normal',IDEALS[1].id)).toThrow('Unknown ideal art');
});
test('six morphs × five real modifier recipes × twelve seeds remain native, deterministic and preserve eye, face landmarks, outline and silhouette',()=>{
 let errors=0;for(const m of MORPHS)for(let level=0;level<5;level++)for(let n=0;n<12;n++){
  const input={genome:controlGenome(m.id,level),seed:'inverse-reproduction-'+n},before=JSON.stringify(input),r=renderInverse(input);
  expect([r.width,r.height,r.pixels.length]).toEqual([96,96,36864]);expect(hash(renderInverse(JSON.parse(before)).pixels)).toBe(hash(r.pixels));expect(JSON.stringify(input)).toBe(before);
  const colors=new Set<string>();for(let i=0;i<9216;i++){errors+=Number(r.pixels[i*4+3]!==A.alpha[i]);if(idealProtected(i))for(let k=0;k<4;k++)errors+=Number(r.pixels[i*4+k]!==A.pixels[i*4+k]);if(A.alpha[i])colors.add(r.pixels.subarray(i*4,i*4+3).join());}expect(colors.size).toBeLessThanOrEqual(64);
 }expect(errors).toBe(0);expect(idealCacheSize()).toBeLessThanOrEqual(32);
});
test('all five stages change actual material contours as well as colors, while weak ordinary animals retain several tonal steps',()=>{
 for(const m of MORPHS){const rows=Array.from({length:5},(_,n)=>renderInverse({genome:controlGenome(m.id,n),seed:LAB_SEED}));
  expect(new Set(rows.map(r=>hash(r.pixels))).size).toBe(5);expect(new Set(rows.map(r=>hash(r.materials))).size).toBeGreaterThanOrEqual(4);
  const colors=new Set<string>();for(let i=0;i<9216;i++)if(A.body[i]&&!idealProtected(i))colors.add(rows[4].pixels.subarray(i*4,i*4+3).join());expect(colors.size).toBeGreaterThanOrEqual(8);
 }
});
test('coverage, patch connection, facial reach and contrast are separate traits with observable pixel consequences',()=>{
 const full=renderInverse({genome:controlGenome('lilly',0),seed:LAB_SEED}),d=deficitExamples('lilly').map(renderInverse),observations=d.map(observeIdeal);
 expect(d[1].expression.cream).toBe(1);expect(d[1].expression.bridge).toBe(0);
 expect(d[0].expression.cream).toBeLessThan(.2);expect(d[0].expression.bridge).toBe(1);
 expect(observations[1].whiteArea).toBeGreaterThan(observations[0].whiteArea+300);
 expect(observeIdeal(full).whiteArea).toBeGreaterThan(observations[1].whiteArea);
 expect(d[2].materials).toEqual(full.materials);expect(observations[2].materialContrast).toBeLessThan(observeIdeal(full).materialContrast-20);
 expect(observeIdeal(full).faceWhite).toBeGreaterThan(observations[0].faceWhite+150);
 const dark=brightnessExamples('axanthic')[0],bright=brightnessExamples('axanthic')[1],a=renderInverse(dark),b=renderInverse(bright),mean=(r:typeof a)=>{let sum=0,n=0;for(let i=0;i<9216;i++)if(A.skin[i]&&!idealProtected(i)){sum+=r.pixels[i*4];n++;}return sum/n;};
 expect(mean(b)-mean(a)).toBeGreaterThan(60);
 expect(observeIdeal(renderIdeal('cappuccino')).tailDark).toBeGreaterThan(20);
});
test('core genotype gates are retained, and identical visible recessive carriers cannot reveal hidden Ax through this renderer',()=>{
 const a=controlGenome('normal',2),b=structuredClone(a);b.mendelian.loci.axanthic=['A','ax'];
 expect(hash(renderInverse({genome:a,seed:LAB_SEED}).pixels)).toBe(hash(renderInverse({genome:b,seed:LAB_SEED}).pixels));
 for(const m of MORPHS)expect(idealTraits(controlGenome(m.id,0)).morph).toBe(m.id);
 const invalid=controlGenome('lilly',0);invalid.mendelian.loci['lilly-white']=['Lw','Lw'];expect(()=>renderInverse({genome:invalid,seed:LAB_SEED})).toThrow('비생존');
});
test('the first six siblings really inherit one allele from each parent at every locus, retain their original genomes, and include distinct visible outcomes',()=>{
 for(const m of MORPHS){const family=inheritanceFamily(m.id),before=JSON.stringify(family);expect(family.children).toHaveLength(6);const hashes=new Set<string>();
  for(const[c,n]of family.children.map((c,n)=>[c,n] as const)){
   expect(c).toEqual(offspring(family.father,family.mother,LAB_SEED+':'+m.id+':sibling-'+n));
   for(const id of POLY_IDS){expect(family.father.genome.polygenic.loci[id]).toContain(c.genome.polygenic.loci[id][0]);expect(family.mother.genome.polygenic.loci[id]).toContain(c.genome.polygenic.loci[id][1]);}
   for(const l of LOCI){expect(family.father.genome.mendelian.loci[l.id]).toContain(c.genome.mendelian.loci[l.id][0]);expect(family.mother.genome.mendelian.loci[l.id]).toContain(c.genome.mendelian.loci[l.id][1]);}
   if(c.viable)hashes.add(hash(renderInverse(c).pixels));
  }expect(hashes.size).toBeGreaterThanOrEqual(3);expect(JSON.stringify(family)).toBe(before);
 }
});
test('six generations select from actual unscreened cohorts without strengthened alleles, and poor offspring remain in the records',()=>{
 for(const m of MORPHS){const history=breedingHistory(m.id),before=JSON.stringify(history);expect(history).toHaveLength(7);let worse=0;
  for(const g of history.slice(1)){expect(g.children).toHaveLength(48);const parentBest=Math.max(...g.parents.map(p=>selectionValue(idealTraits(p.genome).expression,m.id)));
   for(const c of g.children){for(const id of POLY_IDS){expect(g.parents[0].genome.polygenic.loci[id]).toContain(c.genome.polygenic.loci[id][0]);expect(g.parents[1].genome.polygenic.loci[id]).toContain(c.genome.polygenic.loci[id][1]);}if(c.viable&&selectionValue(idealTraits(c.genome).expression,m.id)<parentBest)worse++;}
   for(const p of g.selected)expect(g.children).toContain(p);
  }expect(worse).toBeGreaterThan(0);expect(history[6].mean).toBeGreaterThan(history[0].mean+.2);expect(JSON.stringify(history)).toBe(before);
 }
});
test('the art experiment never changes production sprites, genetics, display names, prices, challenges or saved player data',()=>{
 const game=newGame('ideal-isolation','2026-10-17'),bytes=exportBackup(game),geckos=Object.values(game.shop.offers).map(o=>o.individual);
 const observe=()=>geckos.map(g=>({image:hash(renderSprite(specimen(g)).pixels),name:visualName(g),price:valueGecko(g),challenges:BREEDING_CHALLENGES.map(c=>evaluateBreedingChallenge(g,c.id))})),before=observe();
 for(const m of MORPHS){renderIdeal(m.id);deficitExamples(m.id).forEach(renderInverse);breedingHistory(m.id);}
 expect(observe()).toEqual(before);expect(exportBackup(game)).toBe(bytes);expect(parseBackup(bytes,game.lastDate)).toEqual(game);
});
