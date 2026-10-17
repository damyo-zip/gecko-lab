/** Public, DOM-free transplant surface. Build with npm run build:engine. */
export { createFounder, createOffspring, validateGenome, viability } from './individual';
export { calculatePhenotype, describeAppearance } from './appearance';
export { renderAppearance, renderIndividual, baselineRenderer } from './renderer';
export { editFeature } from './editing';
export { exportWorkspace, importWorkspace, emptyWorkspace } from './workspace';
export { LOCI, POLY_IDS, polyScores, cross, risks, wildGenome } from './genetics';
export type { Genome, MendelianGenome } from './genetics';
export type { ForgeGecko, RenderInput, AppearanceRenderer, Workspace } from './model';
