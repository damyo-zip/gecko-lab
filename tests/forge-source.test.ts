import {test,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {renderCompanionLineage} from '@/forge';
import type {CompanionLineageParameters} from '@/forge/engine/companion-lineage';
import source from '../docs/forge/source-manifest.json';
import fixtures from './fixtures/forge/lineage-v1.json';

test('all 62 imported pure source files match the approved Forge release',()=>{
 expect(source.files).toHaveLength(62);
 for(const f of source.files)expect(createHash('sha256').update(readFileSync('src/forge/'+f.file)).digest('hex'),f.file).toBe(f.sha256);
});
test.each(fixtures.samples)('approved native RGBA and observations remain exact: $id',s=>{
 const r=renderCompanionLineage(s.parameters as unknown as CompanionLineageParameters);
 expect(createHash('sha256').update(r.sprite.pixels).digest('hex')).toBe(s.rgbaSha256);
 expect(r.complexMetrics).toEqual(s.complexMetrics);expect(r.veilInheritance).toEqual(s.veilInheritance);
 expect(r.dorsalMetrics).toEqual(s.dorsalMetrics);expect(r.patternMetrics).toEqual(s.patternMetrics);
});
