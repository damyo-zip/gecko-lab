import {fixtureGenome} from '@/engine/regional/fixtures';
import {renderComparison} from '../candidates';
import type {VariantId} from './designs';
export type ReferenceId='authored'|'regional';
/** Historical/current game control. New art candidates have no Genome. */
export function referenceSprite(variant:VariantId,reference:ReferenceId){
 const profile=({normal:'typical',bright:'bright',dark:'dark',sparse:'low',rich:'high'} as const)[variant];
 return renderComparison({genome:fixtureGenome(profile,'normal'),seed:'base-study-01',fire:'up'},reference);
}
