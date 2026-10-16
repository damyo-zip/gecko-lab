import { appearanceProfile } from './appearance';
import { axanthicState } from '@/genetics/hardcore';
import { phenotype } from '@/genetics/advanced/phenotype';
import { buildPatternPlan } from '@/engine/pattern-plan';
import { createBaseSprite,PART } from '@/engine/art';
import { CHALLENGE_THRESHOLDS as T,type ChallengeId } from './challenge-rules';
import type { Gecko } from './model';

/** Replace this adapter when genetics changes. No genotype mutation, name parsing,
 * extra random draws, or guessed phantom allele. Older art has no measured mask:
 * return false rather than pretending it expresses an unobservable quality.
 * Thresholds measure the existing side-view plan (not literal whole-body coverage).
 * Dark/orange are visual proxies; spots use actual separated marks in three regions. */
export function evaluateBreedingChallenge(g:Gecko,id:ChallengeId):boolean {
 const p=appearanceProfile(g),genome=g.genetics?.genome;
 if(!p||!genome)return false;
 const {traits:t,observation:o}=p,s=phenotype(genome).scores;
 const lilly=g.genotype.loci['lilly-white'].includes('Lw'),ax=axanthicState(g.genotype)==='visual';
 const white=lilly&&t.cream>=T.whiteExpression&&o.creamArea>=T.whiteArea;
 switch(id){
  case 'midnight':return t.color==='다크'&&!lilly&&!ax&&t.palette.base.reduce((n,c,i)=>n+c*[.2126,.7152,.0722][i],0)<=T.darkLuminance&&o.baseArea>=T.darkBaseArea;
  case 'sun':return t.color==='오렌지'&&!lilly&&!ax&&s.orange>=T.orangeStrength&&o.baseArea>=T.orangeBaseArea&&o.spots<=T.solidMaxSpots;
  case 'stars':{
   if(o.spots<T.superSpots)return false;
   const parts=createBaseSprite().parts,counts=new Map<number,number>();
   for(const c of buildPatternPlan(t,g.visualSeed).spotCenters){const part=parts[c.y*96+c.x];counts.set(part,(counts.get(part)??0)+1);}
   return [PART.head,PART.body,PART.tail].every(part=>(counts.get(part)??0)>=T.regionSpots);
  }
  case 'white':return white;
  case 'monochrome':return white&&ax;
 }
}
