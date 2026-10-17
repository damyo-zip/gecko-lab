import {patternTraits} from '@/genetics/advanced/pattern-traits';
import {phenotype} from '@/genetics/advanced/phenotype';
import {classifyPattern} from '@/phenotype/names';
import {buildPatternPlan} from '@/engine/pattern-plan';
import type {GeckoSpecimen,PatternStyle} from '@/engine/model';
import type {RegionalInput} from '@/engine/regional';

/** Reproduce the pre-regional patterns-1 adapter for a fully recorded adult.
 * No fabricated game record, legacy save import or gene modification. */
export function authoredSubject(input:RegionalInput):GeckoSpecimen {
 const {genome,seed}=input,t=patternTraits(genome),s=phenotype(genome).scores;
 const lilly=genome.mendelian.loci['lilly-white'].includes('Lw'),ax=genome.mendelian.loci.axanthic.every(a=>a==='ax');
 const n=classifyPattern(t,buildPatternPlan(t,seed).observation);
 const style:PatternStyle=lilly?'lilly':ax?'axanthic':n.base.includes('트라이컬러')?'tricolor':n.base.includes('할리퀸')?'harlequin':n.base.includes('달마시안')?'dalmatian':'normal';
 return {schemaVersion:1,id:'lab-art-subject',name:'비교 개체',seed,genome,state:{fire:input.fire??'up'},appearance:{
  bodyColor:ax?'slate':lilly?'cream':s.red>.55||s.orange>.58?'orange':s.brightness<.42?'brown':s.cream>.7?'cream':'orange',
  patternStyle:style,patterns:t,dorsalCoverage:t.dorsal,flankCoverage:t.flank,spotCount:Math.min(70,t.spots.count),
  expression:{red:s.red,orange:s.orange,brightness:s.brightness,cream:s.cream,harlequin:s.harlequin,pinstripe:s.pinstripe,contrast:s.contrast},
 }};
}
