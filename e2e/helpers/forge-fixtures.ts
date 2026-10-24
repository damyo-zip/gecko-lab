/** Browser scenarios use current presentation after the same production migration.
 * Original fixture factories remain untouched for historical unit/archive tests. */
import {migrateMonthly} from '../../src/game/hardcore/migrate-monthly';
import {migrateForge} from '../../src/game/hardcore/migrate-forge';
import {referenceHomeGame as home} from '../fixtures/reference-home';
import {collectionStatusGame as status} from '../fixtures/collection-status';
import {lineageFixture as lineage} from '../fixtures/lineage-reference';
import {growthScaleGame as growth} from '../fixtures/growth-scale';
import {incubatorFixture as incubator} from '../fixtures/incubator-reference';
import {breedingRiskFixture as risk} from '../fixtures/breeding-risk';
import {rushPerformanceGame as rush} from '../fixtures/rush-performance';
import {rushShiftGame as shift} from '../fixtures/rush-shifts';
import {newGame as catalog,axCatalog as ax} from '../fixtures/legacy-catalog';
import {successfulPair as pair} from '../fixtures/lifecycle';
import {currentBreederRankGames as ranks} from '../../tests/helpers/current-challenge-game';
import type {HardcoreGame} from '../../src/game/hardcore/model';
export {REFERENCE_DATE} from '../fixtures/reference-home';
export {turns} from '../fixtures/lifecycle';
export {act,synchronize} from '../../src/game/hardcore/play';

/** Review fixtures explicitly request adult cards; give those founders the
 * new minimum age before migration. This is fixture setup, never save migration. */
const current=(g:HardcoreGame)=>migrateMonthly(migrateForge(g));
function adultReview(g:HardcoreGame){
 for(const x of Object.values(g.individuals))if(x.status==='owned'&&x.stage==='adult'&&g.turn-x.birthTurn<18)x.birthTurn=g.turn-18;
 return current(g);
}
function adultShopReview(g:HardcoreGame){
 for(const o of Object.values(g.shop.offers))if(o.individual.stage==='adult'&&!o.family){o.individual.birthTurn=g.turn-18;}
 return current(g);
}
export const referenceHomeGame=()=>adultReview(home());
export const collectionStatusGame=()=>{const f=status();return {...f,game:adultReview(f.game)};};
export const lineageFixture=()=>{const f=lineage();return {...f,game:current(f.game)};};
export const growthScaleGame=()=>{const f=growth();return {...f,game:current(f.game)};};
export const incubatorFixture=()=>current(incubator());
export const breedingRiskFixture=()=>{const f=risk();return {...f,game:current(f.game)};};
export const rushPerformanceGame=(...a:Parameters<typeof rush>)=>current(rush(...a));
export const rushShiftGame=(...a:Parameters<typeof shift>)=>current(shift(...a));
export const legacyCatalogGame=(...a:Parameters<typeof catalog>)=>adultShopReview(catalog(...a));
export const axCatalog=(...a:Parameters<typeof ax>)=>adultShopReview(ax(...a));
export const successfulPair=(...a:Parameters<typeof pair>)=>{const f=pair(...a);return {...f,original:adultShopReview(f.original)};};
export const breederRankGames=()=>ranks().map(current);

/** For migration comparisons against original DNA, before the new engine marker.
 * The production archive tests still compare the complete untouched raw record. */
export function withoutForge<T>(value:T):T {
 if(Array.isArray(value))return value.map(withoutForge) as T;
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([k])=>k!=='forge').map(([k,v])=>[k,withoutForge(v)])) as T;
 return value;
}
export const currentExpected=(g:HardcoreGame)=>current(g);
