import { seededRandom } from '@/genetics/random';
import { healthEffects } from '@/genetics/health';
import type { Embryo, Gecko, Mating, TimedEgg } from './model';

export function fertileChance(m:Mating):number {
  return m.fertilizationChance*(m.riskModel ?
    healthEffects(m.riskModel.father).fertilityFactor*healthEffects(m.riskModel.mother).fertilityFactor : 1);
}
/** Disjoint causes, ordered once: infertility → genetic nonviability → baseline hatch → fictional vigor.
 * A lethal embryo is never subjected to/rewarded for an ordinary hatch roll. */
export function eggFailure(egg:TimedEgg):NonNullable<TimedEgg['lifecycle']>['failure'] {
  if(!egg.lifecycle?.fertilized)return 'infertile';
  if(egg.embryo.development?.viable===false)return 'genetic';
  if(seededRandom(egg.seed,'hatch')()>=egg.hatchChance)return 'hatch';
  if(egg.embryo.development && egg.embryo.healthGenome &&
    seededRandom(egg.seed,'health-hatch')()>=healthEffects(egg.embryo.healthGenome).hatchFactor)return 'health';
  return null;
}
export function bornIndividual(embryo:Embryo):Gecko {
  if(embryo.development?.viable===false)throw new Error('비생존 배아는 생존 개체로 등록할 수 없습니다.');
  const child=structuredClone(embryo);delete child.development;return child;
}
