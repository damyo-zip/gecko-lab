import {test,expect} from 'vitest';
import {readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {decodePNG} from '../scripts/png.mjs';
import {renderBase,baseAnatomy,baseCacheSize} from '@/lab/appearance/base-study/render';
import {DESIGNS,VARIANTS} from '@/lab/appearance/base-study/designs';
import {BASE_ART} from '@/lab/appearance/base-study/art-data';
import {referenceSprite} from '@/lab/appearance/base-study/reference';
import {regionalAppearance} from '@/engine/regional';
import {fixtureGenome} from '@/engine/regional/fixtures';
import {newGame} from '@/game/hardcore/play';
import {exportBackup,parseBackup} from '@/game/hardcore/save';
import {specimen,visualName} from '@/game/hardcore/adapter';
import {renderSprite} from '@/engine/render';
import {valueGecko} from '@/game/hardcore/market';
const hash=(p:Uint8Array|Uint8ClampedArray)=>createHash('sha256').update(p).digest('hex');
const L=(p:Uint8ClampedArray,i:number)=>p[i*4]*.30+p[i*4+1]*.59+p[i*4+2]*.11;

test('new art export is reproducible from its new source; native PNG matches runtime pixels',()=>{
 expect(()=>execFileSync('node',['scripts/compile-base-study.mjs','--check'],{encoding:'utf8'})).not.toThrow();
 const m=JSON.parse(readFileSync('public/lab/base-study/manifest.json','utf8'));
 for(const d of DESIGNS){const file=readFileSync('public/lab/base-study/'+d.id+'-normal.png'),decoded=decodePNG(file),r=renderBase(d.id);
  expect([decoded.width,decoded.height,r.width,r.height]).toEqual([96,96,96,96]);expect(hash(decoded.pixels)).toBe(hash(r.pixels));expect(hash(file)).toBe(m.sprites.find((v:{id:string})=>v.id===d.id).sha256);expect(BASE_ART[d.id].palette.length).toBeLessThanOrEqual(23);
 }
});
test('three bases have genuinely different silhouettes, not recolors of the old gecko or each other',()=>{
 const masks=DESIGNS.map(d=>renderBase(d.id).pixels.filter((_,i)=>i%4===3));masks.push(referenceSprite('normal','authored').pixels.filter((_,i)=>i%4===3));
 expect(new Set(masks.map(hash)).size).toBe(4);
 for(let a=0;a<masks.length;a++)for(let b=a+1;b<masks.length;b++){let intersection=0,union=0;for(let i=0;i<9216;i++){intersection+=Number(!!masks[a][i]&&!!masks[b][i]);union+=Number(!!masks[a][i]||!!masks[b][i]);}expect(intersection/union).toBeLessThan(.85);}
});
test('all 15 variants have binary alpha, bounded palette, intact margins and invariant eyes/structure',()=>{
 for(const d of DESIGNS){const baseline=renderBase(d.id).pixels,protect=baseAnatomy(d.id).protectedPixels;
  for(const v of VARIANTS){const p=renderBase(d.id,v.id).pixels,colors=new Set<string>();let errors=0;
   for(let i=0;i<9216;i++){
    errors+=Number(p[i*4+3]!==baseline[i*4+3]);if(protect[i])for(let k=0;k<4;k++)errors+=Number(p[i*4+k]!==baseline[i*4+k]);
    if(p[i*4+3])colors.add(p.subarray(i*4,i*4+3).join());
    expect(p[i*4+3]===0||p[i*4+3]===255).toBe(true);
    if(i<96||i>=9120||i%96===0||i%96===95)expect(p[i*4+3]).toBe(0);
   }expect(errors).toBe(0);expect(colors.size).toBeLessThanOrEqual(34);
   expect([...p.subarray((d.eye.y*96+d.eye.x)*4,(d.eye.y*96+d.eye.x)*4+3)]).toEqual([30,23,22]);
  }
 }
});
test('brightness and pigment coverage variants are measurable on each torso, not name-only options',()=>{
 for(const d of DESIGNS){const mask=baseAnatomy(d.id).torso;
  const metrics=(v:typeof VARIANTS[number]['id'])=>{const p=renderBase(d.id,v).pixels;let total=0,n=0,light=0;for(let i=0;i<9216;i++)if(mask[i]){const r=p[i*4],g=p[i*4+1],b=p[i*4+2];n++;total+=L(p,i);light+=Number(L(p,i)>145&&r-g<45&&g-b>8);}return {mean:total/n,light};};
  const normal=metrics('normal');expect(metrics('bright').mean).toBeGreaterThan(normal.mean+20);expect(metrics('dark').mean).toBeLessThan(normal.mean-30);
  expect(metrics('sparse').light).toBeLessThan(normal.light);expect(metrics('rich').light).toBeGreaterThan(normal.light+50);
 }
});
test('seeded rich pigment patterns are reproducible, distinct across 12 seeds and do not mutate the base',()=>{
 for(const d of DESIGNS){const before=hash(renderBase(d.id).pixels),seen=new Set<string>();for(let n=0;n<12;n++){const seed='base-variety-'+n,a=renderBase(d.id,'rich',seed),b=renderBase(d.id,'rich',JSON.parse(JSON.stringify(seed)));expect(hash(a.pixels)).toBe(hash(b.pixels));seen.add(hash(a.pixels));}expect(seen.size).toBe(12);expect(hash(renderBase(d.id).pixels)).toBe(before);}
 for(let n=0;n<60;n++)renderBase('A','rich','cache-'+n);expect(baseCacheSize()).toBeLessThanOrEqual(48);
});
test('art exploration does not mutate a game, backup, production appearance, names or prices',()=>{
 const game=newGame('new-base-isolation','2026-10-17'),backup=exportBackup(game),individuals=Object.values(game.shop.offers).map(o=>o.individual);
 const observe=()=>individuals.map(g=>({name:visualName(g),price:valueGecko(g),pixels:hash(renderSprite(specimen(g)).pixels)})),before=observe();
 for(const d of DESIGNS)for(const v of VARIANTS)renderBase(d.id,v.id);expect(observe()).toEqual(before);expect(exportBackup(game)).toBe(backup);expect(parseBackup(backup,game.lastDate)).toEqual(game);
 const input={genome:fixtureGenome('typical','normal'),seed:'base-study-01',fire:'up' as const};expect(hash(referenceSprite('normal','regional').pixels)).toBe(hash(regionalAppearance(input).sprite.pixels));
});
test('production source never imports new base art, study renderer or its page',()=>{
 const walk=(dir:string):string[]=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(dir,e.name)):/\.tsx?$/.test(e.name)?[join(dir,e.name)]:[]);
 for(const file of walk('src').filter(f=>!f.startsWith('src/lab/')&&!f.startsWith('src/app/lab/'))){expect(readFileSync(file,'utf8'),file).not.toMatch(/from\s*['"][^'"]*(?:base-study|appearance\/bases)/);}
});
