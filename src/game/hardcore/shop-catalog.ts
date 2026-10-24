import type {Gecko} from './model';
import {seededRandom} from '@/genetics/random';
import {createCompanionPatternsFounder,COMPANION_PATTERNS_PRESETS} from '@/forge/engine/companion-patterns-breeding';
import {createCompanionLineageFounder,LINEAGE_PRESETS} from '@/forge/engine/companion-lineage-breeding';
import {createCompanionLateralFounder,LATERAL_PRESETS} from '@/forge/engine/companion-lateral-breeding';
import {createCompanionWhitewallFounder} from '@/forge/engine/companion-whitewall-breeding';
import {createCompanionEmptyBackFounder} from '@/forge/engine/companion-emptyback-breeding';
import {createVeilTraits,createLateralTraits} from '@/forge';
import {cachedGenotype} from './genetics';
import {polyScores} from '@/genetics/advanced/polygenic';
import {legacyTraits,observedLoci} from '@/genetics/advanced/phenotype';
import {childKnowledge,unknownKnowledge,belief} from '@/genetics/advanced/inference';
import {LOCI,pairKey} from '@/genetics/advanced/loci';
import {founderPatternColour} from './colour-genetics';
import {editFeature} from '@/forge';
import {editPatternGeneGroup} from '@/forge/engine/companion-patterns-breeding';
import type {Feature} from '@/genetics/advanced/model';

const patterns=COMPANION_PATTERNS_PRESETS.map(r=>({id:'pattern:'+r.id,create:(input:Parameters<typeof createCompanionPatternsFounder>[0])=>createCompanionPatternsFounder({...input,morph:r.id})}));
const lineages=LINEAGE_PRESETS.map(r=>({id:'lineage:'+r.id,create:(input:Parameters<typeof createCompanionPatternsFounder>[0])=>createCompanionLineageFounder({...input,morph:r.id})}));
const laterals=LATERAL_PRESETS.map(r=>({id:'lateral:'+r.id,create:(input:Parameters<typeof createCompanionPatternsFounder>[0])=>createCompanionLateralFounder({...input,morph:r.id})}));
const special=[
 {id:'whitewall',create:(i:Parameters<typeof createCompanionPatternsFounder>[0])=>createCompanionWhitewallFounder({...i,morph:'classic',whiteout:['Wo','Wo'],wallFoundation:'high'})},
 {id:'whiteout',create:(i:Parameters<typeof createCompanionPatternsFounder>[0])=>createCompanionWhitewallFounder({...i,morph:'classic',whiteout:['Wo','Wo'],wallFoundation:'low'})},
 {id:'superstripe',create:(i:Parameters<typeof createCompanionPatternsFounder>[0])=>createCompanionEmptyBackFounder({...i,morph:'tricolor',emptyBack:['Eb','Eb']})},
 {id:'reverse-pinstripe',create:(i:Parameters<typeof createCompanionPatternsFounder>[0])=>createCompanionEmptyBackFounder({...i,morph:'partial-pin',emptyBack:['Eb','Eb']})},
 {id:'patternless-selected',create:(i:Parameters<typeof createCompanionPatternsFounder>[0])=>createCompanionPatternsFounder({...i,morph:'base'})},
 {id:'brindle-selected',create:(i:Parameters<typeof createCompanionPatternsFounder>[0])=>createCompanionPatternsFounder({...i,morph:'brindle'})},
 {id:'tiger-selected',create:(i:Parameters<typeof createCompanionPatternsFounder>[0])=>createCompanionPatternsFounder({...i,morph:'tiger'})},
 {id:'tricolor-selected',create:(i:Parameters<typeof createCompanionPatternsFounder>[0])=>createCompanionPatternsFounder({...i,morph:'tricolor-harlequin'})},
 {id:'tricolor-extreme-selected',create:(i:Parameters<typeof createCompanionPatternsFounder>[0])=>createCompanionPatternsFounder({...i,morph:'tricolor-extreme'})},
];
const complexPairs=[['C','C'],['C','S'],['C','H'],['S','S'],['S','H'],['H','H']] as const;
const complex=complexPairs.flatMap(pair=>[false,true].map(lilly=>({id:'complex:'+pair.join('/')+(lilly?':lilly':''),pair,lilly})));
export const SHOP_CATALOG_IDS=[...patterns,...lineages,...laterals,...special,...complex].map(r=>r.id);
/** A shuffled cyclic bag gives every recipe an opportunity. Cross-recipe parents
 * also allow combinations; this does not force an offspring's label or pixels. */
export function catalogProfile(seed:string,batch:number,index:number,sex:'male'|'female'):number {
 const rng=seededRandom(seed,'complete-catalog-order:1'),order=SHOP_CATALOG_IDS.map((_,n)=>n);
 for(let n=order.length-1;n>0;n--){const j=Math.floor(rng()*(n+1));[order[n],order[j]]=[order[j],order[n]];}
 const position=((batch-1)*4+index)%order.length;
 const mixed=seededRandom(seed,'catalog-mix:'+batch+':'+index)();
 return sex==='female'&&mixed<.2?Math.floor(seededRandom(seed,'catalog-mother:'+batch+':'+index)()*order.length):order[position];
}
/** Only founder alleles are configured. The existing embryo factory performs
 * every actual transmission, sex/viability roll and visual-seed assignment. */
export function configureCatalogParent(g:Gecko,profile:number,seed:string,sex:'male'|'female'):Gecko {
 const recipes=[...patterns,...lineages,...laterals,...special],recipe=recipes[profile];
 const input={id:g.id,name:g.name,seed,sex,morph:'base' as const};
 const template=recipe?recipe.create(input):createCompanionPatternsFounder({...input,morph:'extreme-harlequin'});
 const random=seededRandom(seed,'catalog-modifiers:1'),base=g.genetics!.forge!.extensions!;
 const drawn=g.genetics!.genome!;
 const e=template.extensions;
 g.genetics!.genome=template.genome;
 const selected:Record<string,Partial<Record<Feature,number>>>={
  whitewall:{flank:4,harlequin:4,brightness:1.2,pinstripe:0,spots:0,cream:2},
  whiteout:{flank:1.5,harlequin:1.5,brightness:1.2,pinstripe:3,spots:0},
  superstripe:{red:1.5,orange:3.6,brightness:1.3,cream:4,dorsal:3.5,flank:3.6,harlequin:3.6,spots:0,pinstripe:4},
  'reverse-pinstripe':{brightness:1.5,cream:0,dorsal:4,flank:.5,harlequin:.5,spots:0,pinstripe:4,contrast:4},
  'patternless-selected':{cream:0,dorsal:0,flank:0,harlequin:0,spots:0,pinstripe:0},
  'brindle-selected':{brightness:2,cream:0,dorsal:4,flank:.5,harlequin:.5,spots:0,pinstripe:0},
  'tiger-selected':{red:1,orange:3,brightness:2.5,cream:0,dorsal:4,flank:.5,harlequin:.5,spots:0,pinstripe:0},
  'tricolor-selected':{red:1.5,orange:3.6,brightness:1.3,cream:3.4,dorsal:2.6,flank:3.3,harlequin:2.9,spots:0,pinstripe:0},
  'tricolor-extreme-selected':{red:1.5,orange:3.6,brightness:1.2,cream:3.4,dorsal:2.6,flank:4,harlequin:4,spots:0,pinstripe:0},
 };
 for(const [feature,mean] of Object.entries(recipe?selected[recipe.id]??{}:{}))g.genetics!.genome=editFeature(g.genetics!.genome,feature as Feature,mean!);
 if(recipe?.id==='brindle-selected')g.genetics!.genome=editPatternGeneGroup(editPatternGeneGroup(g.genetics!.genome,'width',4),'brindle',4);
 if(recipe?.id==='tiger-selected')g.genetics!.genome=editPatternGeneGroup(editPatternGeneGroup(g.genetics!.genome,'width',4),'brindle',0);
 const modifier=complex[profile-recipes.length];
 if(modifier){g.genetics!.genome.mendelian.loci['cappuccino-complex']=[modifier.pair[sex==='male'?0:1],modifier.pair[sex==='male'?0:1]];g.genetics!.genome.mendelian.loci['lilly-white']=modifier.lilly&&sex==='female'?['n','Lw']:['n','n'];}
 g.genetics!.forge={version:1,paletteVersion:2,patternColour:founderPatternColour(seed),extensions:{...base,...e,version:5,
  phantom:(e?.phantom??base.phantom).map(a=>a??'N') as ['N'|'ph','N'|'ph'],emptyBack:(e?.emptyBack??base.emptyBack)!.map(a=>a??'N') as ['N'|'Eb','N'|'Eb'],whiteout:(e?.whiteout??base.whiteout)!.map(a=>a??'N') as ['N'|'Wo','N'|'Wo'],
  lateral:recipe?.id==='whitewall'||recipe?.id==='superstripe'?createLateralTraits(seed,0,1):recipe?.id==='whiteout'?createLateralTraits(seed,0,.15):e?.lateral??createLateralTraits(seed,.5,.15),veil:createVeilTraits(seed,random())}};
 if(recipe&&recipe.id in selected)g.genetics!.forge.patternColour={version:1,warmth:Array.from({length:6},()=>[0,0] as const)};
 if(recipe?.id==='whitewall')g.genetics!.forge.patternColour={version:1,warmth:Array.from({length:6},()=>[4,4] as const)};
 // Independent founder draws leave every supported combination reachable, not
 // only named presets or neighbors in a fixed bag. Never edit a born listing.
 const variation=seededRandom(seed,'catalog-independent-alleles:1');
 if(variation()<.12)g.genetics!.genome.polygenic=drawn.polygenic;
 if(variation()<.12){
  g.genetics!.genome.mendelian.loci['lilly-white']=variation()<.5?['n','n']:['n','Lw'];
  g.genetics!.genome.mendelian.loci.axanthic=([['A','A'],['A','ax'],['ax','ax']] as const)[Math.floor(variation()*3)];
  const alleles=['n','C','S','H'];g.genetics!.genome.mendelian.loci['cappuccino-complex']=[alleles[Math.floor(variation()*4)],alleles[Math.floor(variation()*4)]];
 }
 if(variation()<.12){
  const e=g.genetics!.forge.extensions!;
  e.phantom=([['N','N'],['N','ph'],['ph','ph']] as const)[Math.floor(variation()*3)];
  e.emptyBack=([['N','N'],['N','Eb'],['Eb','Eb']] as const)[Math.floor(variation()*3)];
  e.whiteout=([['N','N'],['N','Wo'],['Wo','Wo']] as const)[Math.floor(variation()*3)];
  e.lateral=createLateralTraits(seed+'|mixed',variation(),variation());
 }
 g.genotype=cachedGenotype(g.genetics!,g.genotype);g.potential=legacyTraits(polyScores(g.genetics!.genome.polygenic));
 g.genetics!.knowledge=childKnowledge(unknownKnowledge(),unknownKnowledge(),observedLoci(g.genetics!.genome),g.id);
 const locus=LOCI.find(l=>l.id==='cappuccino-complex')!,pair=g.genetics!.genome.mendelian.loci[locus.id];
 g.genetics!.knowledge.loci[locus.id]=belief({[pairKey(pair,locus)]:1},'appearance','관찰 가능한 복합 계통 · 잠정 모델',[g.id]);
 return g;
}
