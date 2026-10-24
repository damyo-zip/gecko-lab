import {createCompanionPatternsFounder} from '@/forge/engine/companion-patterns-breeding';
import {createCompanionLineageFounder} from '@/forge/engine/companion-lineage-breeding';
import {withVeilTraits,createVeilTraits,withEmptyBackPair} from '@/forge';
import type {CurrentChallengeId} from './challenge-rules';
import type {Feature} from '@/genetics/advanced/model';

/** Explicit legal founder recipes for display/tests only. Never inserted into a game. */
export const TARGET_RECIPES={
 'lilly-dalmatian':{morph:'dalmatian',features:{red:1,orange:1.6,brightness:2.7,cream:4,dorsal:3,flank:3,harlequin:3,spots:4,pinstripe:0},warmth:0,lilly:true,veil:1},
 halloween:{morph:'extreme-harlequin',features:{red:.3,orange:3.6,brightness:1.3,cream:2.6,dorsal:2.7,flank:3.6,harlequin:3.6,spots:0,pinstripe:0},warmth:4},
 'red-tricolor':{morph:'tricolor-harlequin',features:{red:4,orange:2.9,brightness:2,cream:3.2,flank:3.7,harlequin:3.4,spots:0,pinstripe:0},warmth:.3},
 'sable-lilly':{morph:'sable-lilly',lineage:true,veil:.12,features:{red:0,orange:0,brightness:1,cream:3.8,dorsal:3.5,flank:3.6,harlequin:3.6,spots:0,pinstripe:0},warmth:0},
 'gold-tiger':{morph:'tiger',features:{red:1,orange:3.1,brightness:2.1,cream:0,dorsal:4,flank:.5,harlequin:.5,spots:0,pinstripe:0},warmth:3},
 'red-superdalmatian':{morph:'dalmatian',features:{red:4,orange:2.7,brightness:2,cream:0,dorsal:0,flank:0,harlequin:0,spots:4,pinstripe:0},warmth:0},
 frappuccino:{morph:'frappuccino',lineage:true,veil:.3,features:{red:1.6,orange:2.4,brightness:1.8,cream:3.5,dorsal:3.5,flank:3.3,harlequin:3.3,spots:0,pinstripe:0},warmth:1},
 'tricolor-superstripe':{morph:'tricolor-full-pin',emptyback:true,features:{red:1.5,orange:3.6,brightness:1.3,cream:4,dorsal:3.5,flank:3.6,harlequin:3.6,spots:0,pinstripe:4},warmth:0},
} as const;
export function targetFounder(id:CurrentChallengeId){
 const r=TARGET_RECIPES[id],seed='challenge-discussion:'+id+':1',input={id:'challenge-preview:'+id,name:id,seed,sex:'female' as const};
 const f='lineage' in r?createCompanionLineageFounder({...input,morph:r.morph}):createCompanionPatternsFounder({...input,morph:r.morph});
 for(const [feature,mean]of Object.entries(r.features)){
  const total=Math.round(mean*12),low=Math.floor(total/12),extra=total%12;
  for(let n=0;n<6;n++)f.genome.polygenic.loci[(feature as Feature)+'-'+n]=[low+(n<extra-6?1:0),low+(n<extra?1:0)];
 }
 if('lilly' in r)f.genome.mendelian.loci['lilly-white']=['n','Lw'];
 if('emptyback' in r)f.extensions=withEmptyBackPair(f.extensions,['Eb','Eb']);
 f.extensions=withVeilTraits(f.extensions,createVeilTraits(seed,'veil' in r?r.veil:.5));
 return {genome:f.genome,visualSeed:f.visualSeed,forge:{version:1 as const,paletteVersion:2 as const,extensions:f.extensions,
  patternColour:{version:1 as const,warmth:Array.from({length:6},()=>[Math.floor(r.warmth),Math.ceil(r.warmth)] as const)}}};
}
