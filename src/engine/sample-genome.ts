import {wildGenome} from '@/genetics/advanced/loci';
import {FEATURES,type Genome} from '@/genetics/advanced/model';
import type {AppearanceTraits} from './model';
/** Explicit legal virtual-allele samples for the old standalone labs/presets.
 * Production specimens ALWAYS use their recorded inherited genome. */
export function sampleGenome(a:AppearanceTraits):Genome {
 const score={red:a.patternStyle==='tricolor'?3:1,orange:a.bodyColor==='orange'?3:1,brightness:a.bodyColor==='brown'?1:3,cream:Math.round(a.dorsalCoverage*4),dorsal:Math.round(a.dorsalCoverage*4),flank:Math.round(a.flankCoverage*4),harlequin:Math.round(a.flankCoverage*4),contrast:3,pinstripe:1,spots:Math.round(Math.min(1,a.spotCount/100)*4)};
 const mendelian=wildGenome();if(a.patternStyle==='lilly')mendelian.loci['lilly-white']=['n','Lw'];if(a.patternStyle==='axanthic'||a.bodyColor==='slate')mendelian.loci.axanthic=['ax','ax'];
 return {version:1,mendelian,polygenic:{version:1,loci:Object.fromEntries(FEATURES.flatMap(f=>Array.from({length:6},(_,i)=>[f+'-'+i,[score[f],score[f]]])))}};
}
