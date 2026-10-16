import {test,expect} from 'vitest';
import {fixtureGenome} from '@/engine/regional/fixtures';
import {regionalAppearance} from '@/engine/regional';
import {structureContrast,regionTones,headSkin} from '@/engine/regional/quality';
const seed='regional-review-01';
test('production v2 preserves readable anatomical creases on Normal and extreme white',()=>{
 for(const morph of ['normal','lilly'] as const){const r=regionalAppearance({genome:fixtureGenome(morph==='lilly'?'high':'typical',morph),seed});const probes=structureContrast(r.sprite);expect(probes.every(p=>p.valid&&p.sourceDirectionPreserved)).toBe(true);expect(probes.find(p=>p.id==='jaw')!.contrast).toBeGreaterThan(40);expect(probes.find(p=>p.id==='tail')!.contrast).toBeGreaterThan(5);}
});
test('extreme white head and bright/dark Ax keep local tonal range in both fire states',()=>{
 for(const fire of ['up','down'] as const){const white=regionalAppearance({genome:fixtureGenome('high','lilly'),seed,fire});const t=regionTones(white.sprite,headSkin);expect(t.p90-t.p10).toBeGreaterThan(45);for(const profile of ['dark','bright'] as const){const r=regionalAppearance({genome:fixtureGenome(profile,'axanthic'),seed,fire});expect(structureContrast(r.sprite).find(p=>p.id==='shoulder')!.contrast).toBeGreaterThan(15);}}
});
