/** Approved portable Forge API. Uses the matching, preserved core genetics. */
export {createOffspring,validateGenome,viability} from './engine/individual';
export {inherit,inheritPoly,founderPoly} from './engine/genetics';
export {editFeature} from './engine/editing';
export {calculatePhenotype} from './engine/appearance';
export {companionLineageParameters,renderCompanionLineage,describeCompanionLineage,companionLineageRenderer,COMPANION_LINEAGE_RENDERER_ID} from './engine/companion-lineage';
export {inheritMorphExtensions,validateMorphExtensions,withVeilTraits,withLateralTraits,withPhantomPair,withEmptyBackPair,withWhiteoutPair,veilTraits,phantomCopies,emptyBackCopies,whiteoutCopies} from './engine/morph-extensions';
export {createVeilTraits,veilDensity,forecastVeilDensity} from './engine/veil-genetics';
export {createLateralTraits,lateralTraitScores} from './engine/lateral-genetics';
export {renderIndividual} from './engine/renderer';
export type {MorphExtensions} from './engine/morph-extensions';
export type {ForgeGecko,RenderInput} from './engine/model';
export type {CompanionLineageResult} from './engine/companion-lineage';
