import {test,expect} from 'vitest';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {representativeMorphName as name,koreanMorphText} from '@/phenotype/display-name';
import {visualName,visibleGeneticMorphs,morphDescription,specimen} from '@/game/hardcore/adapter';
import {newGame,act} from '@/game/hardcore/play';
import {parseBackup,exportBackup} from '@/game/hardcore/save';
import {appearanceProfile} from '@/game/hardcore/appearance';
import {valueGecko} from '@/game/hardcore/market';
import {renderSprite} from '@/engine/render';
import {collectionMorph} from '@/components/hardcore/collection-query';
import {parentCandidates,filterParents,DEFAULT_PARENT_QUERY,publicGeneticTags} from '@/components/hardcore/parent-search-query';
import {shopMorph} from '@/components/hardcore/shop';
import {exampleGenome} from '@/genetics/advanced/pattern-examples';
import {legacyTraits} from '@/genetics/advanced/phenotype';
import {polyScores} from '@/genetics/advanced/polygenic';
import baseline from './fixtures/pre-morph-display-hashes.json';
const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');

test.each([
 [['Lilly White'],'레드','할리퀸','레드 릴리'],
 [['Lilly White'],'옐로','트라이컬러 할리퀸','트라이컬러 릴리'],
 [['Lilly White'],'레드','트라이컬러 익스트림 할리퀸','트라이컬러 릴리'],
 [['Axanthic'],'회색','할리퀸','아잔틱'],
 [['Highway'],'옐로','플레임','하이웨이'],
 [[], '레드','플레임','레드 플레임'],
 [['Lilly White'],'크림','할리퀸','릴리화이트'],
 [['Frappuccino'],'레드','할리퀸','프라푸치노'],
 [['Luwak'],'다크','플레임','루왁'],
 [['Lilly White','Axanthic'],'회색','할리퀸','릴리 아잔틱'],
 [['Lilly White','Sable'],'레드','할리퀸','릴리 세이블'],
 [['Lilly White','Luwak'],'옐로','플레임','루왁 릴리'],
 [['Sorak · 건강 위험'],'다크','플레임','설악 · 건강 위험'],
] as const)('%j / %s / %s → %s',(geneticMorphs,color,pattern,expected)=>{
 expect(name({geneticMorphs,color,pattern,fallback:[geneticMorphs.join(' + '),color,pattern].filter(Boolean).join(' ')})).toBe(expected);
});
test('exact combination rules are order-independent; new components and unverified combinations keep complete explanatory names',()=>{
 expect(name({geneticMorphs:['Axanthic','Lilly White','Normal','Lilly White'],fallback:''})).toBe('릴리 아잔틱');
 for(const [labels,description,expected] of [
  [['Lilly White','Highway'],'릴리화이트 + Highway 옐로 플레임','릴리화이트 + 하이웨이 옐로 플레임'],
  [['Frappuccino','Axanthic'],'Frappuccino + 아잔틱 할리퀸','프라푸치노 + 아잔틱 할리퀸'],
  [['Sable/Highway · 미검증'],'Sable/Highway · 미검증 옐로 플레임','세이블/하이웨이 · 미검증 옐로 플레임'],
  [['Super Highway · 미검증'],'Super Highway · 미검증 다크 할리퀸','슈퍼 하이웨이 · 미검증 다크 할리퀸'],
  [['Future Morph'],'Future Morph 레드 플레임','Future Morph 레드 플레임'],
 ] as const)expect(name({geneticMorphs:labels,fallback:description})).toBe(expected);
 expect(name({geneticMorphs:['Future Morph'],fallback:''})).toBe('Future Morph');
 expect(name({geneticMorphs:[],fallback:''})).toBe('노멀');
});
test('translation preserves genotype keys, warnings, public het probabilities and unknown names',()=>{
 expect(koreanMorphText('Super Cappuccino / Lilly White / Sorak · 건강 위험 / 66.7% possible het Axanthic · A/ax · FutureMorph')).toBe('슈퍼 카푸치노 / 릴리화이트 / 설악 · 건강 위험 / 66.7% possible het 아잔틱 · A/ax · FutureMorph');
});
test('actual observed pixels decide Lilly color/pattern exceptions, while custom individual names never change',()=>{
 const game=newGame('display-profile',baseline.date),original=Object.values(game.shop.offers)[0].individual;
 for(const example of ['harlequin','tricolor']){
  const g=structuredClone(original),genome=exampleGenome(example);genome.mendelian.loci['lilly-white']=['n','Lw'];
  g.genetics!.genome=genome;g.genotype.loci['lilly-white']=['n','Lw'];g.potential=legacyTraits(polyScores(genome.polygenic));g.name='내가 지은 English 이름';
  const before=structuredClone(g),profile=appearanceProfile(g)!,expected=profile.names.base.includes('트라이컬러')?'트라이컬러 릴리':profile.names.color==='레드'?'레드 릴리':'릴리화이트';
  expect(visualName(g)).toBe(expected);expect(collectionMorph(g)).toBe(expected);expect(shopMorph(g)).toBe(expected);
  expect(morphDescription(g)).toContain(profile.names.base);expect(g).toEqual(before);
 }
});
test('identical visible traits cannot reveal a hidden recessive carrier through a representative or search',()=>{
 const game=newGame('hidden-display',baseline.date,{initialCapacity:20}),o=Object.values(game.shop.offers)[0];
 const a=structuredClone(o.individual),b=structuredClone(a);a.genotype.loci.axanthic=['A','A'];b.genotype.loci.axanthic=['A','ax'];
 a.genetics!.genome!.mendelian.loci.axanthic=['A','A'];b.genetics!.genome!.mendelian.loci.axanthic=['A','ax'];
 expect(visibleGeneticMorphs(a)).toEqual(visibleGeneticMorphs(b));expect(visualName(a)).toBe(visualName(b));expect(publicGeneticTags(a)).toEqual(publicGeneticTags(b));
 const candidates=(g:typeof a)=>parentCandidates({...game,individuals:{[g.id]:g}},g.sex,'').map(({gecko,...row})=>row);
 expect(candidates(a)).toEqual(candidates(b));
});
test('short representatives do not break complex or omitted-pattern search/filter keys',()=>{
 let game=newGame('display-filter-keys',baseline.date,{initialMoney:100_000_000,initialCapacity:100}),checked=0;
 for(let batch=0;batch<20&&checked<3;batch++){
  for(const o of Object.values(game.shop.offers)){
   const tag=publicGeneticTags(o.individual).confirmed.find(t=>t.id.startsWith('cappuccino-complex:'));
   if(!tag||o.individual.stage!=='adult')continue;
   game=act(game,{type:'buyGecko',offerId:o.id},game.lastDate);const g=game.individuals[o.id],rows=parentCandidates(game,g.sex,''),key=tag.id.slice('cappuccino-complex:'.length);
   expect(filterParents(rows,{...DEFAULT_PARENT_QUERY,morph:'visible:'+key}).map(r=>r.gecko.id)).toContain(g.id);
   expect(filterParents(rows,{...DEFAULT_PARENT_QUERY,search:tag.label}).map(r=>r.gecko.id)).toContain(g.id);
   const pattern=appearanceProfile(g)!.names.base;
   expect(filterParents(rows,{...DEFAULT_PARENT_QUERY,search:pattern}).map(r=>r.gecko.id)).toContain(g.id);checked++;
  }
  game=act(game,{type:'refreshShop'},game.lastDate);
 }
 expect(checked).toBeGreaterThanOrEqual(3);
});
test('144 current-engine records keep names, pixels, prices and games stable through display and reload',()=>{
 for(const c of baseline.cases){
  let game=newGame(c.seed,baseline.date,{initialMoney:100_000_000,initialCapacity:30});
  for(const batch of c.batches){
   // Exercise every new display route before checking the original data snapshots.
   const original=exportBackup(game);
   const records=Object.values(game.shop.offers).flatMap(o=>[o.individual,o.family!.father,o.family!.mother]);
   for(const g of records){expect(collectionMorph(g)).toBe(visualName(g));expect(shopMorph(g)).toBe(visualName(g));morphDescription(g);}
   expect(exportBackup(game)).toBe(original);
   const expected=records.map(g=>({id:g.id,name:visualName(g),pixels:hash(Array.from(renderSprite(specimen(g)).pixels)),price:valueGecko(g)}));
   const restored=parseBackup(exportBackup(game),baseline.date);expect(restored).toEqual(game);
   for(const [n,g] of records.entries()){const copy=structuredClone(g);expect(visualName(copy)).toBe(expected[n].name);expect(hash(Array.from(renderSprite(specimen(copy)).pixels))).toBe(expected[n].pixels);expect(valueGecko(copy)).toEqual(expected[n].price);}
   game=act(game,{type:'refreshShop'},baseline.date);
  }
 }
},30_000);
test('old saves are left intact and require a new regional game',()=>{
 const raw=readFileSync('tests/fixtures/pre-pattern-v7.json','utf8');
 expect(()=>parseBackup(raw,'2026-10-17')).toThrow('새 게임');
 expect(readFileSync('tests/fixtures/pre-pattern-v7.json','utf8')).toBe(raw);
});
