import {test,expect} from 'vitest';
import {newForgeGame} from '@/game/hardcore/play';
import {visualName,morphDescription,specimen} from '@/game/hardcore/adapter';
import {forgeView} from '@/game/hardcore/forge-appearance';
import {FORGE_MORPH_PRIORITY,forgeRepresentativeMorphName} from '@/game/hardcore/forge-display-name';
import {createCompanionLineageFounder,type LineagePresetId} from '@/forge/engine/companion-lineage-breeding';
import {editFeature} from '@/forge/engine/editing';
import {unknownKnowledge} from '@/genetics/advanced/inference';
import {cachedGenotype} from '@/game/hardcore/genetics';
import {polyScores} from '@/genetics/advanced/polygenic';
import {legacyTraits} from '@/genetics/advanced/phenotype';
import {valueGecko} from '@/game/hardcore/market';
import {forgeSurface} from '@/forge/surface';
import {exportBackup} from '@/game/hardcore/save';
import {collectionEntries} from '@/components/hardcore/collection-query';
import {parentCandidates,filterParents,DEFAULT_PARENT_QUERY} from '@/components/hardcore/parent-search-query';

function fixture(morph:LineagePresetId){
 const game=newForgeGame('forge-display-test','2026-10-23'),g=structuredClone(Object.values(game.shop.offers)[0].family!.father);
 const f=createCompanionLineageFounder({id:'display-'+morph,seed:'display-'+morph,morph,sex:g.sex,name:'내 게코'});
 g.id=f.id;g.name=f.name;g.status='owned';g.parents=null;g.visualSeed=f.visualSeed;
 g.genetics={version:1,genome:editFeature(f.genome,'spots',3.8),knowledge:unknownKnowledge(),appearanceVersion:'patterns-1',forge:{version:1,extensions:f.extensions}};
 g.genotype=cachedGenotype(g.genetics,g.genotype);g.potential=legacyTraits(polyScores(g.genetics.genome!.polygenic));
 game.individuals={[g.id]:g};return {game,g};
}
test.each([
 ['sable','세이블'],['sable-lilly','릴리화이트'],['sable-axanthic','아잔틱'],
 ['highway','하이웨이'],['highway-lilly','릴리화이트'],['highway-axanthic','아잔틱'],
 ['lilly-line','릴리화이트'],['cappuccino','카푸치노'],['frappuccino','프라푸치노'],
]as const)('native %s displays only %s despite overlapping patterns and spots',(morph,expected)=>{
 const {g}=fixture(morph),v=forgeView(g)!;
 expect(v.description.spotMetrics.count).toBeGreaterThan(0);expect(morphDescription(g)).toContain('달마시안');
 expect(visualName(g)).toBe(expected);expect(visualName(structuredClone(g))).toBe(expected);
});
test('observed feature priority is order-independent, with one label and no concatenation',()=>{
 const d=forgeView(fixture('normal-line').g)!.description;
 for(const [features,expected]of [
  [['달마시안','화이트월','풀 핀스트라이프'],'화이트월'],
  [['달마시안','쿼드스트라이프','슈퍼스트라이프'],'슈퍼스트라이프'],
  [['리버스 핀스트라이프','엠티백'],'리버스 핀스트라이프'],
 ]as const){expect(forgeRepresentativeMorphName(d,features)).toBe(expected);expect(forgeRepresentativeMorphName(d,[...features].reverse())).toBe(expected);}
 expect(new Set(FORGE_MORPH_PRIORITY).size).toBe(FORGE_MORPH_PRIORITY.length);
});
test('omitted native features remain searchable/filterable; naming preserves DNA, save, price and pixels',()=>{
 const {game,g}=fixture('lilly-line'),before=exportBackup(game),pixels=forgeSurface(specimen(g))!.pixels.slice(),price=valueGecko(g);
 expect(visualName(g)).toBe('릴리화이트');
 const rows=parentCandidates(game,g.sex,'');expect(filterParents(rows,{...DEFAULT_PARENT_QUERY,search:'달마시안'}).map(r=>r.gecko.id)).toContain(g.id);
 expect(collectionEntries([g],{morph:'pattern:달마시안',stage:'all',sort:'default'}).map(r=>r.id)).toContain(g.id);
 expect(valueGecko(g)).toEqual(price);expect(forgeSurface(specimen(g))!.pixels).toEqual(pixels);expect(exportBackup(game)).toBe(before);expect(g.name).toBe('내 게코');
});
test('an unexpressed recessive carrier never affects the representative',()=>{
 const {g:a}=fixture('normal-line'),b=structuredClone(a);
 a.genetics!.genome!.mendelian.loci.axanthic=['A','A'];b.genetics!.genome!.mendelian.loci.axanthic=['A','ax'];
 a.genotype=cachedGenotype(a.genetics!,a.genotype);b.genotype=cachedGenotype(b.genetics!,b.genotype);
 expect(visualName(a)).toBe(visualName(b));expect(visualName(b)).not.toBe('아잔틱');
});
