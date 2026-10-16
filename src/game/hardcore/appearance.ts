import {regionalObservation} from '@/engine/regional';
import {phenotype} from '@/genetics/advanced/phenotype';
import {classifyPattern} from '@/phenotype/names';
import type {Gecko} from './model';
export function appearanceProfile(g:Gecko){
  const genome=g.genetics?.genome;if(!genome||g.genetics?.appearanceVersion!=="regional-2")return null;
  const {traits,observation}=regionalObservation({genome,seed:g.visualSeed,fire:'up'});
  const names=classifyPattern(traits,observation,phenotype(genome).geneticMorphs);
  return {traits,observation,names};
}
