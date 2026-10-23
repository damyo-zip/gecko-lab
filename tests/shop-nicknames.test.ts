import {test,expect} from 'vitest';
import {newForgeGame,act} from '@/game/hardcore/play';
import {SHOP_NICKNAMES,shopNickname} from '@/game/hardcore/shop-nicknames';
import {familyOffer} from '@/game/hardcore/shop-family';
import {exportBackup,parseForgeBackup} from '@/game/hardcore/save';

const date='2026-10-23';
test('four shop nicknames are deterministic, distinct and unrelated to morph or gender labels',()=>{
 const a=newForgeGame('nicknames',date),b=newForgeGame('nicknames',date),names=Object.values(a.shop.offers).map(o=>o.individual.name);
 expect(new Set(SHOP_NICKNAMES).size).toBe(SHOP_NICKNAMES.length);expect(new Set(names).size).toBe(4);
 for(const n of names)expect(SHOP_NICKNAMES).toContain(n);
 expect(b).toEqual(a);
 const same=structuredClone(a);same.individuals={};const offer=familyOffer(same,8,0),other=familyOffer(same,8,0);
 expect(offer).toEqual(other);expect(offer.individual.name).not.toMatch(/수컷|암컷|해칭|아성체/);
 const collision=familyOffer(same,8,0,undefined,new Set([offer.individual.name]));
 expect(collision.individual.name).not.toBe(offer.individual.name);
 expect({...collision,individual:{...collision.individual,name:''}}).toEqual({...offer,individual:{...offer.individual,name:''}});
});
test('occupied names are skipped and a full nickname pool has a stable fallback',()=>{
 const seed='collision',first=shopNickname(seed,new Set()),second=shopNickname(seed,new Set([first]));
 expect(second).not.toBe(first);const all=new Set<string>(SHOP_NICKNAMES);
 const numbered=shopNickname(seed,all);expect(numbered).toBe(first+'2');all.add(numbered);expect(shopNickname(seed,all)).toBe(first+'3');
});
test('purchase, rename, refresh and backup preserve the individual nickname',()=>{
 let game=newForgeGame('nickname-lifecycle',date,{initialMoney:10_000_000,initialCapacity:20});
 const offer=Object.values(game.shop.offers)[0],original=structuredClone(offer.individual);
 game=act(game,{type:'buyGecko',offerId:offer.id},date);expect(game.individuals[offer.id]).toEqual(original);
 game=act(game,{type:'rename',id:offer.id,name:'내 작은 모찌'},date);
 game=act(game,{type:'refreshShop'},date);expect(game.individuals[offer.id].name).toBe('내 작은 모찌');
 const names=Object.values(game.shop.offers).map(o=>o.individual.name);expect(new Set(names).size).toBe(4);expect(names).not.toContain('내 작은 모찌');
 expect(parseForgeBackup(exportBackup(game),date)).toEqual(game);
});
