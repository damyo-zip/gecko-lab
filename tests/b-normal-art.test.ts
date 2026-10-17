import {test,expect} from 'vitest';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {NORMAL_ART} from '@/lab/appearance/b-breeding/normal-art/art';
import {renderNormalArt,normalPatternMask} from '@/lab/appearance/b-breeding/normal-art/render';
import {measureNormalArt} from '@/lab/appearance/b-breeding/normal-art/measure';
import {B_ANATOMY as A} from '@/lab/appearance/b-breeding/anatomy';
import {renderBase} from '@/lab/appearance/base-study/render';
import {renderFamily} from '@/lab/appearance/b-breeding/families/render';
import {fixtureGenome} from '@/engine/regional/fixtures';
import {newGame} from '@/game/hardcore/play';
import {exportBackup,parseBackup} from '@/game/hardcore/save';
import {specimen,visualName} from '@/game/hardcore/adapter';
import {renderSprite} from '@/engine/render';
import {valueGecko} from '@/game/hardcore/market';
import {BREEDING_CHALLENGES} from '@/game/hardcore/challenge-rules';
import {evaluateBreedingChallenge} from '@/game/hardcore/challenge-evaluator';
const hash=(p:Uint8Array|Uint8ClampedArray)=>createHash('sha256').update(p).digest('hex');

test('the first B PNG and its exact native pixels remain the unedited first of eight artworks',()=>{
 expect(hash(readFileSync('public/lab/base-study/B-normal.png'))).toBe('487aa44664d047f20a6875c48715f3a083ee876ddc524d5c01150ac9f03959de');
 expect(NORMAL_ART).toHaveLength(8);expect(NORMAL_ART[0].id).toBe('original');
 expect(hash(renderNormalArt('original').pixels)).toBe('8ebf9695758b0f95e93e0c2c4d0426917283a7d61949f507534ad2c83cdc51ad');
 expect(renderNormalArt('original').pixels).toEqual(renderBase('B').pixels);
});
test('all eight preserve the exact face, eye, ink, limb/tail silhouette and binary alpha at 96×96',()=>{
 let errors=0;
 for(const d of NORMAL_ART){const r=renderNormalArt(d.id),colors=new Set<string>();
  expect([r.width,r.height,r.pixels.length,r.mask.length]).toEqual([96,96,36864,9216]);
  for(let i=0;i<9216;i++){
   const x=i%96,y=Math.floor(i/96);errors+=Number(r.pixels[i*4+3]!==A.alpha[i]);
   if(!A.skin[i]||x<36&&y<38||!r.editable[i])for(let k=0;k<4;k++)errors+=Number(r.pixels[i*4+k]!==A.pixels[i*4+k]);
   if(A.alpha[i])colors.add(r.pixels.subarray(i*4,i*4+3).join());
  }expect(colors.size).toBeLessThanOrEqual(42);
 }expect(errors).toBe(0);
});
test('the designs differ in pattern topology, not only brightness or scale of the original cream mask',()=>{
 expect(new Set(NORMAL_ART.map(d=>hash(renderNormalArt(d.id).pixels))).size).toBe(8);
 for(const[a,n]of NORMAL_ART.map((d,n)=>[d,n] as const))for(const b of NORMAL_ART.slice(n+1)){
  const aa=renderNormalArt(a.id).mask,bb=renderNormalArt(b.id).mask;let xor=0,union=0;
  for(let i=0;i<9216;i++){xor+=Number(!!aa[i]!==!!bb[i]);union+=Number(!!aa[i]||!!bb[i]);}
  // More than half of the union differs even in the nearest pair. This is a
  // mask observation, not an automatic judgment that an artwork is beautiful.
  expect(xor/union).toBeGreaterThan(.5);
 }
 const broad=measureNormalArt('dorsal'),linked=measureNormalArt('linked'),fine=measureNormalArt('filigree');
 expect(Math.abs(broad.area-linked.area)/linked.area).toBeLessThan(.04); // similar coverage, different topology
 expect(broad.boundary).toBeLessThan(linked.boundary);
 expect(fine.components).toBeGreaterThan(20);expect(broad.components).toBeLessThan(5);
 expect(measureNormalArt('harlequin').limbs).toBeGreaterThan(measureNormalArt('low').limbs);
});
test('bright patterns retain multiple structural/texture steps and new low-pattern skin has no source cream ghosts',()=>{
 for(const d of NORMAL_ART.slice(1)){
  const r=renderNormalArt(d.id),patternColors=new Set<string>(),skinColors=new Set<string>();
  for(let i=0;i<9216;i++)if(r.editable[i]){const c=r.pixels.subarray(i*4,i*4+3).join();if(r.mask[i])patternColors.add(c);else skinColors.add(c);}
  expect(patternColors.size).toBeGreaterThanOrEqual(4);expect(skinColors.size).toBeGreaterThanOrEqual(5);
 }
 const low=renderNormalArt('low');for(let i=0;i<9216;i++)if(low.editable[i]&&A.cream[i]&&!low.mask[i])expect(low.pixels[i*4+1]).toBeLessThan(180);
});
test('art and exported masks are deterministic, finite and do not mutate original B or prior pattern families',()=>{
 const input={genome:fixtureGenome('typical','normal'),seed:'b-families-01'},before=renderFamily(input),oldHash=hash(before.pixels);
 for(let n=0;n<3;n++)for(const d of NORMAL_ART){const r=renderNormalArt(d.id);expect(hash(renderNormalArt(d.id).pixels)).toBe(hash(r.pixels));const mask=normalPatternMask(d.id);expect(hash(normalPatternMask(d.id).pixels)).toBe(hash(mask.pixels));expect(Uint8Array.from(mask.pixels.filter((_,i)=>i%4===3))).toEqual(A.alpha);}
 expect(hash(renderBase('B').pixels)).toBe('8ebf9695758b0f95e93e0c2c4d0426917283a7d61949f507534ad2c83cdc51ad');expect(hash(renderFamily(input).pixels)).toBe(oldHash);expect(hash(before.pixels)).toBe(oldHash);
 expect(()=>renderNormalArt('not-an-art')).toThrow('Unknown B normal art');
});
test('viewing the independent art does not change actual player genetics, production images, names, prices, challenges or saves',()=>{
 const game=newGame('normal-art-isolation','2026-10-17'),bytes=exportBackup(game),geckos=Object.values(game.shop.offers).map(o=>o.individual);
 const observe=()=>geckos.map(g=>({image:hash(renderSprite(specimen(g)).pixels),name:visualName(g),price:valueGecko(g),challenges:BREEDING_CHALLENGES.map(c=>evaluateBreedingChallenge(g,c.id))})),before=observe();
 for(const d of NORMAL_ART)renderNormalArt(d.id);expect(observe()).toEqual(before);expect(exportBackup(game)).toBe(bytes);expect(parseBackup(bytes,game.lastDate)).toEqual(game);
});
