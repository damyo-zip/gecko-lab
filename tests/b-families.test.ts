import {test,expect} from 'vitest';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {renderFamily,protectedPixel,familyCacheSize} from '@/lab/appearance/b-breeding/families/render';
import {selectFamily} from '@/lab/appearance/b-breeding/families/selection';
import {FAMILIES,MORPH_FAMILIES,type ArtMorph} from '@/lab/appearance/b-breeding/families/art-source';
import {FAMILY_ART} from '@/lab/appearance/b-breeding/families/art-data';
import {renderBase} from '@/lab/appearance/base-study/render';
import {B_ANATOMY as A} from '@/lab/appearance/b-breeding/anatomy';
import {fixtureGenome,type ProfileId} from '@/engine/regional/fixtures';
import {family,conditionExamples,selectionStudy} from '@/lab/appearance/b-breeding/samples';
import {POLY_IDS} from '@/genetics/advanced/polygenic';
import {newGame} from '@/game/hardcore/play';
import {exportBackup,parseBackup} from '@/game/hardcore/save';
import {specimen,visualName} from '@/game/hardcore/adapter';
import {renderSprite} from '@/engine/render';
import {valueGecko} from '@/game/hardcore/market';
import {BREEDING_CHALLENGES} from '@/game/hardcore/challenge-rules';
import {evaluateBreedingChallenge} from '@/game/hardcore/challenge-evaluator';
const hash=(p:Uint8Array|Uint8ClampedArray)=>createHash('sha256').update(p).digest('hex');
const seed='b-families-01',input=(m:ArtMorph='normal',p:ProfileId='typical',s=seed)=>({genome:fixtureGenome(p,m),seed:s});

test('original B is unedited since its first commit, and the classic Normal is exactly its original pixels',()=>{
 // The first-commit digest also works in shallow CI checkouts. Git byte
 // comparison is recorded by the provenance report in a full local checkout.
 const file='public/lab/base-study/B-normal.png',original=readFileSync(file);
 expect(hash(original)).toBe('487aa44664d047f20a6875c48715f3a083ee876ddc524d5c01150ac9f03959de');
 expect(hash(renderFamily(input(),{family:'classic',cadence:'a'}).pixels)).toBe(hash(renderBase('B').pixels));
 for(let n=0;n<12;n++)expect(hash(renderFamily(input('normal','typical','original-check-'+n)).pixels)).toBe(hash(renderBase('B').pixels));
});
test('48 full-pose maps reproduce from authored contours and form four genuinely different families per morph',()=>{
 expect(()=>execFileSync('node',['scripts/compile-b-families.mjs','--check'])).not.toThrow();expect(FAMILY_ART).toHaveLength(48);
 for(const a of FAMILY_ART){expect(a.rows).toHaveLength(96);expect(a.rows.every(r=>r.length===96&&/^[0-4]+$/.test(r))).toBe(true);for(let i=0;i<9216;i++)if(protectedPixel(i))expect(a.rows[Math.floor(i/96)][i%96]).toBe('0');}
 for(const m of MORPH_FAMILIES){const prints=FAMILIES.map(f=>hash(renderFamily(input(m.id),{family:f.id,cadence:'a'}).pixels));expect(new Set(prints).size).toBe(4);for(const f of FAMILIES){const pair=FAMILY_ART.filter(a=>a.morph===m.id&&a.family===f.id);expect(pair[0].rows.join('')).not.toBe(pair[1].rows.join(''));}}
});
test('six morphs, five inherited backgrounds and 12 seeds retain original silhouette and exact protected face/eye pixels',()=>{
 let errors=0;for(const m of MORPH_FAMILIES)for(const p of ['low','typical','high','dark','bright'] as const)for(let n=0;n<12;n++){
  const g=input(m.id,p,'family-stability-'+n),before=JSON.stringify(g),r=renderFamily(g),colors=new Set<string>();expect([r.width,r.height,r.pixels.length]).toEqual([96,96,36864]);
  expect(hash(renderFamily(JSON.parse(before)).pixels)).toBe(hash(r.pixels));expect(JSON.stringify(g)).toBe(before);
  for(let i=0;i<9216;i++){errors+=Number(r.pixels[i*4+3]!==A.alpha[i]);if(protectedPixel(i))for(let k=0;k<4;k++)errors+=Number(r.pixels[i*4+k]!==A.pixels[i*4+k]);if(A.alpha[i])colors.add(r.pixels.subarray(i*4,i*4+3).join());}expect(colors.size).toBeLessThanOrEqual(64);
 }expect(errors).toBe(0);expect(familyCacheSize()).toBeLessThanOrEqual(32);
});
test('a seed only breaks close genetic matches, while low/high backgrounds select appropriate families',()=>{
 expect(selectFamily(input('normal','low').genome,seed).family).toBe('narrow');expect(selectFamily(input().genome,seed).family).toBe('classic');expect(['broad','flow']).toContain(selectFamily(input('normal','high').genome,seed).family);
 const wide=fixtureGenome('high','normal');for(let n=0;n<6;n++)wide.polygenic.loci['pinstripe-'+n]=[2,2];expect(selectFamily(wide,seed).family).toBe('broad');
 for(const e of conditionExamples('lilly','diverse',seed))for(let n=0;n<20;n++){const r=selectFamily(e.genome,'tie-'+n),distance=r.ranked.find(f=>f.id===r.family)!.distance;expect(distance-r.ranked[0].distance).toBeLessThanOrEqual(.01500001);expect(r.coverage).toBe(selectFamily(e.genome,seed).coverage);}
 const g=input().genome,before=JSON.stringify(g);g.polygenic.loci['pinstripe-0']=[4,4];expect(selectFamily(g,seed).connection).toBeGreaterThan(selectFamily(JSON.parse(before),seed).connection);
});
test('morph identity is visible: white expansion, inward Highway, Capp tail markers and Sable crown',()=>{
 const r=(m:ArtMorph,f:typeof FAMILIES[number]['id'])=>renderFamily(input(m),{family:f,cadence:'a'});
 const count=(m:ArtMorph,f:typeof FAMILIES[number]['id'],region:Uint8Array,ink:number)=>r(m,f).map.reduce((sum,v,i)=>sum+Number(!!region[i]&&v===ink),0);
 expect(count('lilly','flow',A.head,4)).toBeGreaterThan(150);expect(count('lilly','narrow',A.head,4)).toBe(0);
 expect(count('highway','broad',A.body,4)).toBeGreaterThan(count('highway','narrow',A.body,4));
 expect(count('cappuccino','classic',A.tail,4)).toBeGreaterThan(10);expect(count('cappuccino','classic',A.tail,3)).toBeGreaterThan(5);
 expect(count('sable','classic',A.head,4)).toBeGreaterThan(10);expect(count('sable','classic',A.tail,3)).toBe(0);
 expect(new Set(MORPH_FAMILIES.map(m=>hash(r(m.id,'classic').pixels))).size).toBe(6);
});
test('brightness changes palette independently of whole pattern map; Ax carrier remains Normal',()=>{
 const dark=renderFamily(input('axanthic','dark'),{family:'classic',cadence:'a'}),bright=renderFamily(input('axanthic','bright'),{family:'classic',cadence:'a'});expect(dark.map).toEqual(bright.map);
 const mean=(p:Uint8ClampedArray)=>{let sum=0,n=0;for(let i=0;i<9216;i++)if(A.skin[i]&&!protectedPixel(i)){sum+=p[i*4];n++;}return sum/n;};expect(mean(bright.pixels)-mean(dark.pixels)).toBeGreaterThan(45);
 for(const r of [dark,bright])for(let i=0;i<9216;i++)if(A.skin[i]&&!protectedPixel(i)){const c=[...r.pixels.subarray(i*4,i*4+3)];expect(Math.max(...c)-Math.min(...c)).toBeLessThanOrEqual(4); // +3 cool tint can round to 4 after inherited contrast.
}
 const carrier=input();carrier.genome.mendelian.loci.axanthic=['A','ax'];expect(hash(renderFamily(carrier).pixels)).toBe(hash(renderFamily(input()).pixels));
});
test('actual first siblings inherit parental alleles and their own scores select art rather than inheriting a picture name',()=>{
 for(const cross of ['lilly','axanthic','complex'] as const){const f=family(cross,seed),before=JSON.stringify(f);for(const c of f.children){for(const id of POLY_IDS){expect(f.father.genome.polygenic.loci[id]).toContain(c.genome.polygenic.loci[id][0]);expect(f.mother.genome.polygenic.loci[id]).toContain(c.genome.polygenic.loci[id][1]);}const rendered=renderFamily(c);expect(rendered.family).toBe(selectFamily(c.genome,c.seed).family);}expect(JSON.stringify(f)).toBe(before);expect(new Set(f.children.map(c=>hash(renderFamily(c).pixels))).size).toBe(4);}
 const history=selectionStudy(),before=JSON.stringify(history);for(const g of history)g.selected.forEach(c=>renderFamily(c));expect(JSON.stringify(history)).toBe(before);expect(selectFamily(history[5].selected[0].genome,seed).coverage).toBeGreaterThan(selectFamily(history[0].selected[0].genome,seed).coverage);expect(renderFamily(history[5].selected[0]).family).toBe('flow');expect(renderFamily(history[0].selected[0]).family).toBe('classic');
});
test('same-morph diversity comes from real gene backgrounds and source B remains intact after all alternatives',()=>{
 for(const m of MORPH_FAMILIES){const examples=conditionExamples(m.id,'diverse',seed);expect(new Set(examples.map(e=>hash(renderFamily(e).pixels))).size).toBe(4);}
 const before=hash(renderBase('B').pixels);for(const m of MORPH_FAMILIES)for(const f of FAMILIES)renderFamily(input(m.id),{family:f.id,cadence:'b'});expect(hash(renderBase('B').pixels)).toBe(before);
});
test('lab family rendering leaves production names, prices, challenge outcomes, saved bytes and production pixels unchanged',()=>{
 const game=newGame('B-family-isolation','2026-10-17'),bytes=exportBackup(game),geckos=Object.values(game.shop.offers).map(o=>o.individual);
 const observe=()=>geckos.map(g=>({image:hash(renderSprite(specimen(g)).pixels),name:visualName(g),price:valueGecko(g),challenges:BREEDING_CHALLENGES.map(c=>evaluateBreedingChallenge(g,c.id))})),before=observe();for(const g of geckos)renderFamily({genome:g.genetics!.genome!,seed:g.visualSeed});expect(observe()).toEqual(before);expect(exportBackup(game)).toBe(bytes);expect(parseBackup(bytes,game.lastDate)).toEqual(game);
});
