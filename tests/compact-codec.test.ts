import {describe,it,expect} from 'vitest';
import {newCurrentGame} from '../src/game/hardcore/play';
import {compactDocument,readCompactDocument} from '../src/game/hardcore/compact-codec';
import {makeSave,readMonthlySave,parseBackupBundle,exportBackup,checksum} from '../src/game/hardcore/save';
import {SHOP_CATALOG_IDS,catalogProfile} from '../src/game/hardcore/shop-catalog';
import {familyOffer} from '../src/game/hardcore/shop-family';
import {validateGame} from '../src/game/hardcore/validation';
import {valueGecko} from '../src/game/hardcore/market';

describe('deduplicated v11 backup',()=>{
 it('roundtrips the exact active game and history; normal IDB snapshots retain the original readable game shape',()=>{
  const game=newCurrentGame('codec-current','2026-10-24'),document=compactDocument(game);
  expect(document.version).toBe(11);expect(document.blobs.length).toBeGreaterThan(0);
  expect(readCompactDocument(JSON.parse(JSON.stringify(document))).game).toEqual(game);
  expect(parseBackupBundle(exportBackup(game),game.lastDate).game).toEqual(game);
  expect(readMonthlySave(makeSave(game),game.lastDate)).toEqual(game);
 });
 it.each(['checksum','bad-ref','unused-blob','genome','unknown'] as const)('rejects %s corruption, including a freshly recomputed document checksum',kind=>{
  const d=JSON.parse(JSON.stringify(compactDocument(newCurrentGame('codec-invalid','2026-10-24'))));
  if(kind==='checksum')d.checksum='wrong';
  if(kind==='bad-ref')d.game.forge={$dna:999999};
  if(kind==='unused-blob')d.blobs.push({version:1});
  if(kind==='genome'){const genome=d.blobs.find((v:any)=>v?.polygenic);genome.polygenic.loci['red-1']=[99,99];}
  if(kind==='unknown')d.game.compact.unexpected=true;
  if(kind!=='checksum')d.checksum=checksum({game:d.game,blobs:d.blobs,history:d.history});
  expect(()=>readCompactDocument(d)).toThrow();
 });
});
describe('complete shop founder pool',()=>{
 it('cycles every profile and preserves safe, affordable unrelated starting adults',()=>{
  const game=newCurrentGame('catalog-bag','2026-10-24'),offers=Object.values(game.shop.offers);
  expect(offers).toHaveLength(4);expect(offers.slice(0,2).map(o=>o.individual.sex)).toEqual(['male','female']);
  expect(offers.slice(0,2).every(o=>o.individual.stage==='adult'&&o.askPrice<=game.money)).toBe(true);
  const selected=new Set<number>();for(let b=1;b<=SHOP_CATALOG_IDS.length;b++)for(let i=0;i<4;i++)selected.add(catalogProfile(game.seed,b,i,'male'));
  expect(selected.size).toBe(SHOP_CATALOG_IDS.length);
 });
 it.each(SHOP_CATALOG_IDS)('%s is a real, viable inherited listing priced by the unchanged market',profile=>{
  const game=newCurrentGame('catalog-proof','2026-10-24'),n=SHOP_CATALOG_IDS.indexOf(profile);
  let batch=2,index=0,found=false;
  for(let b=2;b<=SHOP_CATALOG_IDS.length+1&&!found;b++)for(let i=0;i<4;i++)if(catalogProfile(game.seed,b,i,'male')===n){batch=b;index=i;found=true;break;}
  expect(found).toBe(true);const offer=familyOffer(game,batch,index);game.shop.offers[Object.keys(game.shop.offers)[index]]=offer;
  // Preserve the actual identity key required by the catalog contract.
  game.shop.offers=Object.fromEntries(Object.values(game.shop.offers).map(o=>[o.id,o]));
  expect(offer.family!.version).toBe(3);expect(offer.individual.genotype.loci['lilly-white'].every(a=>a==='Lw')).toBe(false);
  expect(offer.askPrice).toBe(valueGecko(offer.individual).ask);validateGame(game);
 });
});
