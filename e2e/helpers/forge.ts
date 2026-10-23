import {specimen,visualName,morphDescription} from '../../src/game/hardcore/adapter';
import {appearanceProfile} from '../../src/game/hardcore/appearance';
import {forgeSurface} from '../../src/forge/surface';
import type {Gecko} from '../../src/game/hardcore/model';

/** Expected presentation after importing a historical fixture. No allele inference. */
export function productionGecko(g:Gecko):Gecko {
 if(g.genetics?.forge)return g;
 if(!g.genetics)throw Error('Fixture must pass through the historical save reader first');
 return {...g,genetics:{...g.genetics,forge:{version:1}}};
}
export const productionSprite=(g:Gecko)=>forgeSurface(specimen(productionGecko(g)))!;
export const productionName=(g:Gecko)=>visualName(productionGecko(g));
export const productionDescription=(g:Gecko)=>morphDescription(productionGecko(g));
export const productionAppearance=(g:Gecko)=>appearanceProfile(productionGecko(g));
