import {test,expect} from 'vitest';
import {createHash} from 'node:crypto';
import originals from './fixtures/b-breeding-original.json';
import {B_ANATOMY as A} from '@/lab/appearance/b-breeding/anatomy';
import {B_FOUNDATION as F,type FoundationId} from '@/lab/appearance/b-breeding/foundation';
import {FOUNDATIONS,CORE_MORPHS,renderBody,renderFoundation,FOUNDATION_SEED as seed,foundationEvidence} from '@/lab/appearance/b-breeding/foundation-study';
import {renderB,bCacheSize} from '@/lab/appearance/b-breeding/render';
import {fixtureGenome,type MorphId,type ProfileId} from '@/engine/regional/fixtures';
import {newGame} from '@/game/hardcore/play';
import {exportBackup,parseBackup} from '@/game/hardcore/save';
import {specimen,visualName} from '@/game/hardcore/adapter';
import {renderSprite} from '@/engine/render';
import {valueGecko} from '@/game/hardcore/market';
const hash=(p:Uint8ClampedArray)=>createHash('sha256').update(p).digest('hex');
const input=(m:MorphId='normal',profile:ProfileId='typical',visualSeed=seed)=>({genome:fixtureGenome(profile,m),seed:visualSeed});
const luminance=(p:Uint8ClampedArray,i:number)=>p[i*4]*.3+p[i*4+1]*.59+p[i*4+2]*.11;

test('previous B finals retain all 18 pre-experiment pixel hashes',()=>{
 for(const fixture of originals)expect(hash(renderB(input(fixture.morph as MorphId,fixture.profile as ProfileId,fixture.seed)).pixels)).toBe(fixture.hash);
});
test('body changes stay inside the annotated torso and preserve face, eye, crest, tail, limbs and alpha',()=>{
 const current=renderBody('current');expect(hash(current.pixels)).toBe(hash(A.pixels));
 for(const f of FOUNDATIONS){const r=renderBody(f.id);let errors=0,changed=0;
  expect([r.width,r.height,r.pixels.length]).toEqual([96,96,36864]);
  for(let i=0;i<9216;i++){
   errors+=Number(r.pixels[i*4+3]!==A.alpha[i]);
   if(!F.mask[i])for(let k=0;k<4;k++)errors+=Number(r.pixels[i*4+k]!==A.pixels[i*4+k]);
   else changed+=Number(r.pixels.subarray(i*4,i*4+3).join()!==A.pixels.subarray(i*4,i*4+3).join());
  }expect(errors).toBe(0);if(f.id!=='current')expect(changed).toBeGreaterThan(300);
 }
});
test('weak pigment is genuinely weaker; clean body removes authored torso pigment while retaining local relief',()=>{
 const contrast=(id:FoundationId)=>{
  const p=renderBody(id).pixels,bins=Array.from({length:6},()=>[[] as number[],[] as number[]]);
  for(let i=0;i<9216;i++)if(F.mask[i])bins[F.tone[i]][Number(!!A.cream[i])].push(luminance(p,i));
  const deltas=bins.filter(b=>b.every(a=>a.length)).map(b=>b[1].reduce((a,v)=>a+v,0)/b[1].length-b[0].reduce((a,v)=>a+v,0)/b[0].length);
  return deltas.reduce((a,v)=>a+v,0)/deltas.length;
 };
 expect(contrast('current')).toBeGreaterThan(35);expect(contrast('weak')).toBeGreaterThan(1);expect(contrast('weak')).toBeLessThan(contrast('current')*.35);expect(Math.abs(contrast('clean'))).toBeLessThan(.001);
 const body=renderBody('clean'),values=[];for(let i=0;i<9216;i++)if(F.mask[i])values.push(Math.round(luminance(body.pixels,i)));
 expect(new Set(values).size).toBeGreaterThanOrEqual(4);expect(Math.max(...values)-Math.min(...values)).toBeGreaterThan(60);
 let creases=0;for(let i=0;i<9216;i++)if(F.creases[i]){creases++;expect([...body.pixels.subarray(i*4,i*4+4)]).toEqual([...A.pixels.subarray(i*4,i*4+4)]);}expect(creases).toBeGreaterThan(5);
 expect(foundationEvidence(body).authored).toBe(0);
});
test('final Normal has its own genotype and seed patterns, independently switchable from the internal clean body',()=>{
 const g=input(),on=renderFoundation(g,'clean'),off=renderFoundation(g,'clean',false);
 expect(hash(off.pixels)).toBe(hash(renderBody('clean').pixels));expect(hash(on.pixels)).not.toBe(hash(off.pixels));
 expect(foundationEvidence(on).generated).toBeGreaterThan(150);expect(foundationEvidence(off).generated).toBe(0);
 expect(foundationEvidence(renderFoundation(input('normal','high'),'clean')).generated).toBeGreaterThan(foundationEvidence(renderFoundation(input('normal','low'),'clean')).generated);
 const seeds=new Set(Array.from({length:12},(_,n)=>hash(renderFoundation(input('normal','typical','foundation-seed-'+n),'clean').pixels)));expect(seeds.size).toBe(12);
});
test('same generated pattern and morph paint masks are used across all three foundations at typical expression',()=>{
 for(const m of CORE_MORPHS){const results=FOUNDATIONS.map(f=>renderFoundation(input(m.id),f.id));
  expect(new Set(results.map(r=>hash(r.pixels))).size).toBe(3);
  const masks=results.map(r=>Array.from(r.origins,(v,i)=>F.mask[i]&&(v===2||v===3)?v:0));expect(masks[1]).toEqual(masks[0]);expect(masks[2]).toEqual(masks[0]);
  expect(foundationEvidence(results[2]).authored).toBe(0);
 }
});
test('morph expressions survive torso removal at low, typical and high levels',()=>{
 for(const f of ['weak','clean'] as const){const r=(m:MorphId,p:ProfileId)=>renderFoundation(input(m,p),f);
  expect(r('lilly','high').metrics.headWhite).toBeGreaterThan(250);expect(r('lilly','high').metrics.white).toBeGreaterThan(r('lilly','low').metrics.white);
  expect(r('cappuccino','high').metrics.tailBaseWhite).toBeGreaterThan(r('cappuccino','low').metrics.tailBaseWhite);
  expect(r('cappuccino','high').metrics.tailTipDark).toBeGreaterThan(r('cappuccino','low').metrics.tailTipDark);
  expect(r('highway','high').metrics.dorsalWhite).toBeGreaterThan(r('highway','low').metrics.dorsalWhite);
  expect(r('sable','high').metrics.headWhite).toBeGreaterThan(r('sable','low').metrics.headWhite);
  expect(new Set(CORE_MORPHS.map(m=>hash(r(m.id,'typical').pixels))).size).toBe(6);
  expect(r('axanthic','bright').metrics.meanSkinLuminance-r('axanthic','dark').metrics.meanSkinLuminance).toBeGreaterThan(40);
 }
});
test('all morphs retain exact eye pixels, binary alpha, limited colors and deterministic JSON restoration across 12 seeds',()=>{
 for(const f of FOUNDATIONS)for(const m of CORE_MORPHS)for(let n=0;n<12;n++){
  const g=input(m.id,'typical','foundation-repeat-'+n),r=renderFoundation(g,f.id),colors=new Set();let errors=0;
  expect(hash(renderFoundation(JSON.parse(JSON.stringify(g)),f.id).pixels)).toBe(hash(r.pixels));
  for(let i=0;i<9216;i++){errors+=Number(r.pixels[i*4+3]!==A.alpha[i]);if(A.eye[i])for(let k=0;k<4;k++)errors+=Number(r.pixels[i*4+k]!==A.pixels[i*4+k]);if(A.alpha[i])colors.add(r.pixels.subarray(i*4,i*4+3).join());}
  expect(errors).toBe(0);expect(colors.size).toBeLessThanOrEqual(64);
 }expect(bCacheSize()).toBeLessThanOrEqual(48);
});
test('foundation experimentation cannot change actual game records, saved bytes, prices, names or production pixels',()=>{
 const game=newGame('foundation-isolation','2026-10-17'),bytes=exportBackup(game),geckos=Object.values(game.shop.offers).map(o=>o.individual);
 const observe=()=>geckos.map(g=>({image:hash(renderSprite(specimen(g)).pixels),name:visualName(g),price:valueGecko(g)})),before=observe();
 for(const g of geckos){const data=JSON.stringify(g);for(const f of FOUNDATIONS)renderFoundation({genome:g.genetics!.genome!,seed:g.visualSeed},f.id);expect(JSON.stringify(g)).toBe(data);}
 expect(exportBackup(game)).toBe(bytes);expect(parseBackup(bytes,game.lastDate)).toEqual(game);expect(observe()).toEqual(before);
});
