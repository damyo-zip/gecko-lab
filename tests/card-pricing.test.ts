import {expect,test} from 'vitest';
import {createHash} from 'node:crypto';
import {referenceHomeGame,REFERENCE_DATE} from '../e2e/fixtures/reference-home';
import {newGame} from '@/game/hardcore/play';
import {valueGecko} from '@/game/hardcore/market';

// Snapshot captured before extracting factors: prices/rounding and return shape
// must remain byte-for-byte identical for legacy and current generated records.
test('existing quotes are unchanged across genomes, growth stages and public knowledge',()=>{
 const records=Object.values(referenceHomeGame().individuals);
 for(let seed=0;seed<12;seed++)for(const offer of Object.values(newGame('sale-prices-'+seed,REFERENCE_DATE).shop.offers)){
  records.push(offer.individual,...(offer.family?[offer.family.father,offer.family.mother]:[]));
 }
 const quotes=records.flatMap(g=>(['hatchling','juvenile','adult'] as const).map(stage=>valueGecko({...g,stage})));
 expect(createHash('sha256').update(JSON.stringify(quotes)).digest('hex')).toMatchInlineSnapshot(`"433cfffc55e6f46fcc3078502ff3b4ea5cd9284d0e28e5d6e02b830d55248afd"`);
});

import {salePriceTags} from '@/components/hardcore/sale-price-tags';
import {MARKET,valuationFactors} from '@/game/hardcore/market';
import {act} from '@/game/hardcore/play';
import {validatedGeckoName} from '@/game/hardcore/names';
import {parseBackup,exportBackup} from '@/game/hardcore/save';
import {freeSlots} from '@/game/hardcore/survival';

test('tags explain actual non-neutral terms without fake retirement or inbreeding deductions',()=>{
 const g=Object.values(referenceHomeGame().individuals)[0],before=structuredClone(g);
 const tags=salePriceTags(g);
 expect(tags).toContainEqual({id:'base',label:'릴리화이트 기준가',tone:'positive'});
 expect(tags).toContainEqual({id:'sex',label:'성체 암컷',tone:'positive'});
 expect(tags.some(t=>t.id==='age')).toBe(false);
 for(const stage of ['hatchling','juvenile'] as const){
  const young={...g,stage},f=valuationFactors(young);
  expect(salePriceTags(young)).toContainEqual({id:'age',label:stage==='hatchling'?'유체 단계':'아성체 단계',tone:'negative'});
  expect(f.age).toBeLessThan(1);expect(salePriceTags(young).some(t=>t.id==='sex')).toBe(false);
 }
 expect(salePriceTags({...g,birthTurn:-90})).toEqual(tags);
 expect(tags.map(t=>t.label).join(' ')).not.toMatch(/노령|은퇴|근친|건강|번식 가능/);
 expect(g).toEqual(before);
});
test('neutral terms produce no tags, and net appearance deductions are red',()=>{
 const g=Object.values(referenceHomeGame().individuals)[1];
 g.potential={bodyTone:0,redIntensity:0,creamCoverage:0,dorsalIntensity:0,flankIntensity:0,spotDensity:0};
 expect(salePriceTags(g)).toEqual([{id:'appearance',label:'외형 감산',tone:'negative'}]);
 g.potential.redIntensity=1;
 expect(valuationFactors(g).appearance).toBe(1);expect(salePriceTags(g)).toEqual([]);
});
test('only publicly priced carrier knowledge produces carrier tags, including seller reliability',()=>{
 const g=Object.values(referenceHomeGame().individuals)[1];
 const unknown=structuredClone(g);unknown.genotype.loci.axanthic=['A','ax'];
 expect(salePriceTags(unknown)).toEqual(salePriceTags(g));
 const known=structuredClone(g);known.genetics!.knowledge.loci.axanthic={...known.genetics!.knowledge.loci.axanthic,probabilities:{'A/A':0,'A/ax':1,'ax/ax':0},source:'seller'};
 expect(valuationFactors(known).carrier).toBeCloseTo(1.4);
 expect(salePriceTags(known)).toContainEqual({id:'carrier',label:'공개 보인 정보',tone:'positive'});
 const table={...MARKET,carrierMultiplier:1};
 expect(salePriceTags(known,table).some(t=>t.id==='carrier')).toBe(false);
});
test('shared rename validation and real sale persist exactly once, retain genomes, pedigree and capacity',()=>{
 const game=referenceHomeGame(),g=Object.values(game.individuals)[0],quote=valueGecko(g),free=freeSlots(game);
 expect(validatedGeckoName('  새 이름  ')).toBe('새 이름');
 for(const invalid of ['', '   ','가'.repeat(25)])expect(()=>validatedGeckoName(invalid)).toThrow('1~24자');
 expect(validatedGeckoName('가'.repeat(24))).toHaveLength(24);
 const renamed=act(game,{type:'rename',id:g.id,name:' 새 이름 '},game.lastDate);
 expect(renamed.individuals[g.id]).toEqual({...g,name:'새 이름'});expect(valueGecko(renamed.individuals[g.id])).toEqual(quote);
 const sold=act(renamed,{type:'sell',id:g.id},renamed.lastDate);
 expect(sold.money).toBe(game.money+quote.sell);expect(sold.sales).toHaveLength(1);expect(freeSlots(sold)).toBe(free+1);
 expect(sold.individuals[g.id]).toEqual({...g,name:'새 이름',status:'sold'});
 expect(()=>act(sold,{type:'sell',id:g.id},sold.lastDate)).toThrow('보유');
 expect(parseBackup(exportBackup(sold),sold.lastDate)).toEqual(sold);
});
