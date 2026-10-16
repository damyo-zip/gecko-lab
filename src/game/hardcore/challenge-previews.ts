import type {GeckoSpecimen} from '@/engine/model';
import {wildGenome} from '@/genetics/advanced/loci';
import {FEATURES,type Feature,type Genome} from '@/genetics/advanced/model';
import {POLY_CONFIG,polyScores} from '@/genetics/advanced/polygenic';
import {legacyTraits} from '@/genetics/advanced/phenotype';
import {unknownKnowledge} from '@/genetics/advanced/inference';
import {specimen} from './adapter';
import {challengeById,type ChallengeId} from './challenge-rules';
import type {Gecko} from './model';

/** Display recipes, independent of hatch evaluation/thresholds. These are legal
 * virtual alleles in the current engine, not new genes or collectible geckos.
 * Change these recipes when the appearance model changes; never rewrite a save.
 * Unspecified features use the neutral allele (2). No player/game RNG is used. */
export const CHALLENGE_PREVIEW_RECIPES = {
 midnight:{seed:'challenge-preview:midnight:1',alleles:{brightness:0,red:0,orange:0,dorsal:0,flank:0,harlequin:0,cream:0,pinstripe:0,spots:0},lilly:false,axanthic:false},
 sun:{seed:'challenge-preview:sun:1',alleles:{brightness:2,red:0,orange:4,dorsal:0,flank:0,harlequin:0,cream:0,pinstripe:0,spots:0},lilly:false,axanthic:false},
 stars:{seed:'challenge-preview:stars:1',alleles:{brightness:3,red:0,orange:2,dorsal:0,flank:0,harlequin:0,cream:0,pinstripe:0,spots:4},lilly:false,axanthic:false},
 white:{seed:'challenge-preview:white:1',alleles:{brightness:2,red:0,orange:2,dorsal:4,flank:4,harlequin:4,cream:4,pinstripe:0,spots:0,contrast:0},lilly:true,axanthic:false},
 monochrome:{seed:'challenge-preview:monochrome:1',alleles:{brightness:2,red:0,orange:2,dorsal:4,flank:4,harlequin:4,cream:4,pinstripe:0,spots:0,contrast:0},lilly:true,axanthic:true},
} as const satisfies Record<ChallengeId,{seed:string;alleles:Partial<Record<Feature,number>>;lilly:boolean;axanthic:boolean}>;

/** A transient renderer input, never inserted into individuals, eggs or rewards.
 * Adult is only the reference pose; no game clock, growth or breeding rule runs. */
function referenceGecko(id:ChallengeId):Gecko {
 const recipe=CHALLENGE_PREVIEW_RECIPES[id],alleles:Partial<Record<Feature,number>>=recipe.alleles;
 const genome:Genome={version:1,mendelian:wildGenome(),polygenic:{version:1,loci:Object.fromEntries(FEATURES.flatMap(f=>
  Array.from({length:POLY_CONFIG.lociPerFeature},(_,n)=>[f+'-'+n,[alleles[f]??2,alleles[f]??2]])))}};
 if(recipe.lilly)genome.mendelian.loci['lilly-white']=['n','Lw'];
 if(recipe.axanthic)genome.mendelian.loci.axanthic=['ax','ax'];
 return {
  id:'challenge-preview:'+id,name:challengeById(id).name,sex:'female',birthTurn:-12,stage:'adult',parents:null,generation:1,
  genotype:{modelVersion:1,loci:{'lilly-white':genome.mendelian.loci['lilly-white'],axanthic:genome.mendelian.loci.axanthic}},
  potential:legacyTraits(polyScores(genome.polygenic)),visualSeed:recipe.seed,nextBreedTurn:0,
  genetics:{version:1,genome,appearanceVersion:'patterns-1',knowledge:unknownKnowledge()},
  birthDate:'2000-01-01',status:'pedigree',hearts:5,lastFedDate:null,diedDate:null,
  cycleAnchor:'2000-01-01',recoverUntil:'2000-01-01',lineageIds:[],provenance:'known',
 };
}

const previews=new Map<ChallengeId,GeckoSpecimen>();
/** At most five stable specimens. SpriteCanvas memoizes pixels for the same
 * object, so lock countdowns and opening the goal dialog do not repaint it. */
export function challengePreview(id:ChallengeId):GeckoSpecimen {
 let preview=previews.get(id);
 if(!preview){preview=specimen(referenceGecko(id));previews.set(id,preview);}
 return preview;
}
