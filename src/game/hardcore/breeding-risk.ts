import { canonicalJSON } from '@/game/save';
import { pedigreeCoefficient, pedigreeRelationship } from '@/game/pedigree-risk';
import { publicForecast, publicKnowledge } from './genetics';
import type { Gecko, HardcoreGame } from './model';

export interface BreedingWarning { code:'kinship'|'lilly'|'complex'; title:string; message:string }
/** Public knowledge/pedigree only. Secret genomes (including health loci) NEVER enter this API. */
export function breedingRisk(game:HardcoreGame, father:Gecko, mother:Gecko) {
  const pedigree = pedigreeCoefficient(father.id,mother.id,game.individuals);
  const relationship = pedigreeRelationship(father,mother,game.individuals);
  const warnings:BreedingWarning[] = [];
  if (pedigree.coefficient > 0) warnings.push({code:'kinship',title:'근친교배 주의',message:
    `${relationship}입니다. 특정 형질을 고정할 수 있지만 숨은 해로운 열성 변이가 발현될 가능성도 높아질 수 있습니다. 예상 자손 근교계수 F ${(pedigree.coefficient*100).toFixed(2)}%. F는 질병 확률이 아닙니다.`});
  const odds = publicForecast(publicKnowledge(father),publicKnowledge(mother));
  const lw = odds.find(x=>x.locus.id==='lilly-white');
  const lethal = lw?.outcomes?.filter(o=>lw.locus.nonViable.includes(o.key)).reduce((s,o)=>s+o.probability,0) ?? 0;
  if (lethal > 0) warnings.push({code:'lilly',title:'위험 유전자 조합',message:
    `공개된 부모 정보에 따르면 수정 시점 Lilly 동형접합 비생존 확률은 ${(lethal*100).toFixed(1)}%입니다. 해당 유전형의 알은 정상적으로 부화하지 않습니다. 각 알은 독립적으로 상속됩니다.`});
  const complex = odds.find(x=>x.locus.id==='cappuccino-complex');
  const beliefs = [publicKnowledge(father),publicKnowledge(mother)].map(k=>k.loci['cappuccino-complex'].probabilities);
  const knownVariant = beliefs.some(p=>p && Object.entries(p).some(([k,v])=>v>0 && k!=='n/n'));
  if (complex?.outcomes?.some(o=>!o.safe&&o.probability>0) || !complex?.outcomes && knownVariant)
    warnings.push({code:'complex',title:'복합 유전자 조합',message:'공개된 계통 정보상 건강 위험이 보고되었거나 결과가 미검증인 조합입니다. 같은 좌위 모델은 잠정적이며, 근거가 부족한 치사 확률은 부여하지 않습니다.'});
  const signature = canonicalJSON({game:game.gameId,revision:game.revision,father:father.id,mother:mother.id,warnings});
  const acknowledgement = signature;
  return {pedigree,relationship,warnings,acknowledgement};
}
