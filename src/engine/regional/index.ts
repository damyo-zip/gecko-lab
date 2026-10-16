import type {RegionalInput,RegionalResult} from './model';
import {renderRegional} from './render';
import {observeRegional} from './observe';
export {APPEARANCE_VERSION} from './model';
export {regionalPhenotype} from './phenotype';
export type {RegionalInput,RegionalResult} from './model';

const pixels=new Map<string,RegionalResult>();
const observations=new Map<string,ReturnType<typeof observeRegional>>();
const key=(input:RegionalInput)=>JSON.stringify([input.genome,input.seed,input.fire??'up']);
function keep<T>(cache:Map<string,T>,id:string,value:T,max:number){cache.delete(id);cache.set(id,value);if(cache.size>max)cache.delete(cache.keys().next().value!);return value;}
/** Bounded caches: 32 pixel/layer bundles, 4096 small measurement records. Neither
 * name nor age/turn/sex changes a render. Fixed genome+seed+fire is the identity. */
export function regionalAppearance(input:RegionalInput):RegionalResult {
  const id=key(input),prior=pixels.get(id);
  return prior?keep(pixels,id,prior,32):keep(pixels,id,renderRegional(input),32);
}
export function regionalObservation(input:RegionalInput){
  const id=key(input),prior=observations.get(id);
  return prior?keep(observations,id,prior,4096):keep(observations,id,observeRegional(input,regionalAppearance(input)),4096);
}
export const regionalCacheSize=()=>({pixels:pixels.size,observations:observations.size});
