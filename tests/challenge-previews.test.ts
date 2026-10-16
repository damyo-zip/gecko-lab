import {createHash} from 'node:crypto';
import {test,expect} from 'vitest';
import {CHALLENGE_PREVIEW_RECIPES,challengePreview} from '@/game/hardcore/challenge-previews';
import {BREEDING_CHALLENGES,type ChallengeId} from '@/game/hardcore/challenge-rules';
import {evaluateBreedingChallenge} from '@/game/hardcore/challenge-evaluator';
import {cachedGenotype,offspringRecord} from '@/game/hardcore/genetics';
import {specimen} from '@/game/hardcore/adapter';
import {FEATURES,type Feature} from '@/genetics/advanced/model';
import {validatePoly,polyScores} from '@/genetics/advanced/polygenic';
import {validateMendelian} from '@/genetics/advanced/loci';
import {legacyTraits} from '@/genetics/advanced/phenotype';
import {renderSprite} from '@/engine/render';
import {challengeParents} from './helpers/challenge-game';

const hash=(pixels:Uint8ClampedArray)=>createHash('sha256').update(pixels).digest('hex');
/** Independent game founder records verify that preview recipes really use the
 * same genotype → phenotype → renderer path as collection/shop/hatch geckos. */
function parents(id:ChallengeId){
 const game=challengeParents(id),recipe=CHALLENGE_PREVIEW_RECIPES[id];
 for(const g of Object.values(game.individuals)){
  const genome=g.genetics!.genome!,values:Partial<Record<Feature,number>>=recipe.alleles;
  for(const f of FEATURES)for(let n=0;n<6;n++)genome.polygenic.loci[f+'-'+n]=[values[f]??2,values[f]??2];
  validatePoly(genome.polygenic);validateMendelian(genome.mendelian);
  g.potential=legacyTraits(polyScores(genome.polygenic));
 }
 return game;
}

test.each(BREEDING_CHALLENGES)('$name preview is a legal, attainable current-engine appearance matching its target',c=>{
 const game=parents(c.id),mother=game.individuals['challenge-female'],father=game.individuals['challenge-male'];
 const preview=challengePreview(c.id);
 mother.id=preview.id;mother.name=preview.name;mother.visualSeed=preview.seed;
 expect(specimen(mother)).toEqual(preview);
 expect(evaluateBreedingChallenge(mother,c.id)).toBe(true);
 // Actual inheritance can transmit this appearance; display recipes don't add
 // synthetic traits or overwrite a player's hatch to produce the reference.
 let matched=false;
 for(let n=0;n<24&&!matched;n++){
  const record=offspringRecord(father.genetics!,mother.genetics!,null,'preview-offspring:'+n,'child',true);
  const child={...mother,genetics:record,genotype:cachedGenotype(record,mother.genotype),potential:legacyTraits(polyScores(record.genome!.polygenic))};
  matched=JSON.stringify(specimen(child).appearance)===JSON.stringify(preview.appearance);
 }
 expect(matched).toBe(true);
});

test('five distinct pixel outputs are deterministic after serialization and reuse stable inputs',()=>{
 const hashes=new Set<string>();
 for(const c of BREEDING_CHALLENGES){
  const preview=challengePreview(c.id),pixels=renderSprite(preview).pixels;
  expect(challengePreview(c.id)).toBe(preview);
  expect(hash(renderSprite(structuredClone(preview)).pixels)).toBe(hash(pixels));
  expect(pixels.filter((_,i)=>i%4===3&&pixels[i]>0).length).toBeGreaterThan(1500);
  hashes.add(hash(pixels));
 }
 expect(hashes.size).toBe(5);
});
