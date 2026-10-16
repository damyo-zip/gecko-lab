import {createHash} from 'node:crypto';
import {expect,test} from 'vitest';
import {createBaseSprite,artColor} from '@/engine/art';
import {fixtureGenome,comparisonSubject} from '@/engine/regional/fixtures';
import {renderSprite} from '@/engine/render';
import {specimen} from '@/game/hardcore/adapter';
const B=createBaseSprite(),hash=(p:Uint8ClampedArray)=>createHash('sha256').update(p).digest('hex');
test('authored iris/pupil survive every regional morph while surrounding skin changes with actual genes',()=>{
 expect(B.eye.filter(Boolean)).toHaveLength(66);const skins=new Set<string>();
 for(const m of ['normal','lilly','axanthic','cappuccino','highway','sable'] as const){const r=renderSprite(specimen(comparisonSubject(fixtureGenome('high',m),'eye-review'))),skin:number[]=[];let errors=0;
  for(let i=0;i<9216;i++){if(B.eye[i]){const c=[...artColor(B.details[i]),255];for(let k=0;k<4;k++)errors+=Number(c[k]!==r.pixels[i*4+k]);}if(B.eyeSurround[i])skin.push(...r.pixels.subarray(i*4,i*4+3));}expect(errors).toBe(0);skins.add(JSON.stringify(skin));
 }expect(skins.size).toBe(6);
});
test('Ax periocular skin is neutral and extreme Lilly face reaches cream without flattening all tones',()=>{
 for(const m of ['axanthic','lilly'] as const){const r=renderSprite(specimen(comparisonSubject(fixtureGenome('high',m),'eye-review'))),colors=new Set<string>();for(let i=0;i<9216;i++)if(B.eyeSurround[i]){const c=[...r.pixels.subarray(i*4,i*4+3)];colors.add(c.join());if(m==='axanthic')expect(Math.max(...c)-Math.min(...c)).toBeLessThanOrEqual(8);}expect(colors.size).toBeGreaterThan(4);}
});
test('gene expression and fire changes replay deterministically with the same eye structure',()=>{
 for(const profile of ['low','high'] as const)for(const fire of ['up','down'] as const){const g=specimen(comparisonSubject(fixtureGenome(profile,'lilly'),'eye-review'),fire);expect(hash(renderSprite(g).pixels)).toBe(hash(renderSprite(JSON.parse(JSON.stringify(g))).pixels));}
});
