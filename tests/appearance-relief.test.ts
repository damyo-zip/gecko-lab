import {test,expect} from 'vitest';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {comparison,fixtureGenome,MORPHS,PROFILES,type MorphId,type ProfileId} from '@/prototype/appearance/fixtures';
import {renderAppearanceRelief} from '@/prototype/appearance/render';
import {anatomy as A,sourceBase as B} from '@/prototype/appearance/anatomy';
import {structureContrast,localContrast,regionTones,headSkin} from '@/prototype/appearance/quality';
import {LAYER_ORDER} from '@/engine/model';
import {buildPatternPlan} from '@/engine/pattern-plan';
import {patternTraits} from '@/genetics/advanced/pattern-traits';

const seed='regional-review-01';
const hash=(p:ArrayBufferView)=>createHash('sha256').update(new Uint8Array(p.buffer,p.byteOffset,p.byteLength)).digest('hex');
test('production and frozen regional-v1 pixels match 100 pre-change golden cases including combinations and both fire states',()=>{
  const baseline=JSON.parse(readFileSync('tests/fixtures/regional-v1-hashes.json','utf8')) as {profile:ProfileId;morph:MorphId;fire:'up'|'down';production:string;v1:string}[];
  expect(baseline).toHaveLength(100);
  for(const t of baseline){
    const c=comparison(t.profile,t.morph,seed,t.fire);
    expect(hash(c.old.pixels),JSON.stringify(t)).toBe(t.production);
    expect(hash(c.improved.sprite.pixels),JSON.stringify(t)).toBe(t.v1);
  }
});

test('new finish preserves every pigment region, expression strength, silhouette and protected structure across all controlled comparisons',()=>{
  let alphaErrors=0,protectedErrors=0,escapedPattern=0;
  for(const profile of PROFILES)for(const m of MORPHS)for(const fire of ['up','down'] as const){
    const {improved:a,relief:b}=comparison(profile.id,m.id,seed,fire);
    expect(b.sprite.version).toBe('regional-prototype-2');
    expect(b.sprite.layers.map(l=>l.name)).toEqual(LAYER_ORDER);
    expect(b.phenotype).toEqual(a.phenotype);
    for(const field of ['white','dark','materials'] as const)expect(hash(b[field])).toBe(hash(a[field]));
    for(const k of ['whitePixels','headWhite','headSkin','dorsalWhite','flankWhite','tailBaseWhite','tailTipDark'] as const)expect(b.metrics[k]).toBe(a.metrics[k]);
    for(let i=0;i<9216;i++){
      alphaErrors+=Number(b.sprite.pixels[i*4+3]!==B.silhouette[i]);
      if(A.protectedPixels[i]){
        for(let k=0;k<4;k++)protectedErrors+=Number(a.sprite.pixels[i*4+k]!==b.sprite.pixels[i*4+k]);
        for(const l of b.sprite.layers.slice(4,7))escapedPattern+=Number(!!l.mask[i]);
      }
    }
  }
  expect({alphaErrors,protectedErrors,escapedPattern}).toEqual({alphaErrors:0,protectedErrors:0,escapedPattern:0});
});

test('Normal control recovers jaw, cheek, shoulder and tail contrast while pigment boundaries remain distinct',()=>{
  const c=comparison('typical','normal',seed),a=structureContrast(c.improved.sprite),b=structureContrast(c.relief.sprite);
  expect(b.every(p=>p.valid&&p.sourceDirectionPreserved)).toBe(true);
  for(const id of ['jaw','cheek','shoulder','tail']){
    expect(b.find(p=>p.id===id)!.contrast).toBeGreaterThan(a.find(p=>p.id===id)!.contrast+5);
  }
  const old=localContrast(c.improved.sprite,c.improved.materials),now=localContrast(c.relief.sprite,c.relief.materials);
  expect(now.withinMaterial).toBeGreaterThan(old.withinMaterial);
  expect(now.readableEdgeFraction).toBeGreaterThan(.94);
});

test('extreme white retains full facial/nose coverage with tonal jaw, cheek and tail form rather than reducing expression',()=>{
  for(const fire of ['up','down'] as const){
    const c=comparison('high','lilly',seed,fire);
    expect(c.relief.metrics.headWhite).toBe(c.relief.metrics.headSkin);
    expect(c.relief.white[32*96+12]).toBe(255);
    const a=structureContrast(c.improved.sprite),b=structureContrast(c.relief.sprite);
    for(const id of ['jaw','cheek','tail'])expect(b.find(p=>p.id===id)!.contrast).toBeGreaterThan(a.find(p=>p.id===id)!.contrast+5);
    expect(b.every(p=>p.sourceDirectionPreserved)).toBe(true);
    const tones=regionTones(c.relief.sprite,headSkin);
    expect(tones.p90-tones.p10).toBeGreaterThan(45);
  }
});

test('dark and bright Axanthic preserve inherited brightness and neutral pigments; dark folds and reflected light remain readable',()=>{
  for(const fire of ['up','down'] as const){
    const dark=comparison('dark','axanthic',seed,fire),bright=comparison('bright','axanthic',seed,fire);
    expect(bright.relief.metrics.meanSkinLuminance-dark.relief.metrics.meanSkinLuminance).toBeGreaterThan(80);
    const a=structureContrast(dark.improved.sprite),b=structureContrast(dark.relief.sprite);
    for(const id of ['jaw','shoulder','tail'])expect(b.find(p=>p.id===id)!.contrast).toBeGreaterThan(a.find(p=>p.id===id)!.contrast+5);
    for(const r of [dark.relief,bright.relief]){
      let maxChroma=0;for(let i=0;i<9216;i++)if(A.skin[i]){
        const rgb=[...r.sprite.pixels.subarray(i*4,i*4+3)];maxChroma=Math.max(maxChroma,Math.max(...rgb)-Math.min(...rgb));
      }
      expect(maxChroma).toBeLessThanOrEqual(8);
    }
  }
});

test('finish remains deterministic, genetically immutable and varied over twelve seeds per morph without altering the production pattern cache',()=>{
  for(const m of MORPHS.slice(0,6)){
    const genome=fixtureGenome('typical',m.id),before=JSON.stringify(genome),plan=buildPatternPlan(patternTraits(genome),seed),cache=hash(plan.dorsal)+hash(plan.flank);
    const unique=new Set<string>();
    for(let n=0;n<12;n++){
      const input={genome,seed:'relief-seed-'+n},a=renderAppearanceRelief(input);
      const restored=JSON.parse(JSON.stringify(input));unique.add(hash(a.sprite.pixels));
      expect(hash(renderAppearanceRelief(restored).sprite.pixels)).toBe(hash(a.sprite.pixels));
    }
    expect(unique.size).toBe(12);expect(JSON.stringify(genome)).toBe(before);
    expect(hash(plan.dorsal)+hash(plan.flank)).toBe(cache);
  }
});
