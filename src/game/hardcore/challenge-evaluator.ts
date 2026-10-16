import { appearanceProfile } from './appearance';
import { axanthicState } from '@/genetics/hardcore';
import { phenotype } from '@/genetics/advanced/phenotype';
import { PART } from '@/engine/art';
import { CHALLENGE_THRESHOLDS as T,type ChallengeId } from './challenge-rules';
import type { Gecko } from './model';

/** Replace this adapter when genetics changes. No genotype mutation, name parsing,
 * extra random draws, or guessed phantom allele. Older art has no measured mask:
 * return false rather than pretending it expresses an unobservable quality.
 * Thresholds measure final v2 skin materials (not literal whole-animal coverage).
 * Dark/orange are visual proxies; spots use actual separated marks in three regions. */
export function evaluateBreedingChallenge(g:Gecko,id:ChallengeId):boolean {
 const p=appearanceProfile(g),genome=g.genetics?.genome;
 if(!p||!genome)return false;
 const {traits:t,observation:o}=p,s=phenotype(genome).scores;
 const lilly=g.genotype.loci['lilly-white'].includes('Lw'),ax=axanthicState(g.genotype)==='visual';
 // Regional whiteArea is white pigment / all skin, not the old cream plan area.
 const white=lilly&&o.expression.lilly>=T.whiteExpression&&o.whiteArea>=T.whiteArea;
 switch(id){
  case 'midnight':return t.color==='다크'&&!lilly&&!ax&&o.baseLuminance<=T.darkLuminance&&o.baseArea>=T.darkBaseArea;
  case 'sun':return t.color==='오렌지'&&!lilly&&!ax&&s.orange>=T.orangeStrength&&o.baseArea>=T.orangeBaseArea&&o.spots<=T.solidMaxSpots;
  case 'stars':{
   if(o.spots<T.superSpots)return false;
   return [PART.head,PART.body,PART.tail].every(part=>(o.spotRegions[part]??0)>=T.regionSpots);
  }
  case 'white':return white;
  case 'monochrome':return white&&ax;
 }
}
