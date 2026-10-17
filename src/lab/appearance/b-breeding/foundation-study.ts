import {fixtureGenome,type ProfileId} from '@/engine/regional/fixtures';
import {CORE_MORPHS} from './samples';
import {FOUNDATIONS,type FoundationId} from './foundation';
import {renderB,type BInput,type BResult} from './render';
export {FOUNDATIONS,CORE_MORPHS};
export const FOUNDATION_SEED='b-breeding-01';
export const renderBody=(foundation:FoundationId)=>renderB({genome:fixtureGenome('typical','normal'),seed:FOUNDATION_SEED},{foundation,baseOnly:true});
/** A controlled comparison: the same explicit Normal-pattern geometry and
 * morph coefficients are applied to all foundations. This is NOT a silent
 * change to the previous B experiment. Its original finals remain renderB(). */
export const renderFoundation=(input:BInput,foundation:FoundationId,normalPattern=true)=>renderB(input,{foundation,normalPattern,independentPattern:true});
export function foundationRows(profile:ProfileId,seed:string,normalPattern=true){
 return CORE_MORPHS.map(m=>({...m,input:{genome:fixtureGenome(profile,m.id),seed},examples:FOUNDATIONS.map(f=>({...f,result:renderFoundation({genome:fixtureGenome(profile,m.id),seed},f.id,normalPattern)}))}));
}
/** Pixel provenance, not an aesthetic score. Weak pixels retain their authored
 * shape at 26% pigment contrast; a count does not measure that contrast. */
export function foundationEvidence(r:BResult){
 const counts={authored:0,generated:0,morphPixels:0};
 for(const origin of r.origins){if(origin===1)counts.authored++;if(origin===2)counts.generated++;if(origin===3)counts.morphPixels++;}
 return {...counts,...r.metrics};
}
