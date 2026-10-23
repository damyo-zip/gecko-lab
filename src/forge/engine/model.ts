import type { Genome } from './genetics';
import type { SpriteResult } from '@/engine/model';
import type { calculatePhenotype } from './appearance';
import type { MorphExtensions } from './morph-extensions';

export type Sex = 'male' | 'female';
export interface ForgeGecko {
  version: 1;
  id: string;
  name: string;
  sex: Sex;
  genome: Genome;
  creationSeed: string;
  visualSeed: string;
  fire: 'up' | 'down';
  generation: number;
  parents: { fatherId: string; motherId: string } | null;
  origin: 'founder' | 'offspring' | 'edited' | 'copy';
  derivedFrom: string | null;
  extensions?: MorphExtensions;
}

/** The renderer knows neither game individuals nor a save/state container. */
export interface RenderInput {
  phenotype: ReturnType<typeof calculatePhenotype>;
  seed: string;
  fire: 'up' | 'down';
  extensions?: MorphExtensions;
}
export interface AppearanceRenderer {
  id: string;
  render(input: RenderInput): SpriteResult;
}

/** Experimental, non-inherited UI settings. Never put these in Genome. */
export interface ExperimentSettings { zoom: 2 | 3 | 4; showB: boolean; lillyVeilOverrides?: Record<string, number> }
export type RendererVersion = 'patterns-1' | 'b-origin-01-patternless-1' | 'b-origin-01-morphs-1' | 'b-origin-01-companion-flame-1' | 'b-origin-01-companion-lilly-1' | 'b-origin-01-companion-lilly-2' | 'b-origin-01-companion-pigment-1' | 'b-origin-01-companion-dalmatian-1' | 'b-origin-01-companion-dalmatian-2' | 'b-origin-01-companion-dalmatian-3' | 'b-origin-01-companion-pinstripe-1' | 'b-origin-01-companion-cappuccino-1' | 'b-origin-01-companion-tricolor-1' | 'b-origin-01-companion-patterns-1' | 'b-origin-01-companion-patterns-2' | 'b-origin-01-companion-patterns-3' | 'b-origin-01-companion-patterns-4' | 'b-origin-01-companion-patterns-5' | 'b-origin-01-companion-phantom-1' | 'b-origin-01-companion-emptyback-1' | 'b-origin-01-companion-whitewall-1' | 'b-origin-01-companion-whitewall-2' | 'b-origin-01-companion-laterals-1' | 'b-origin-01-companion-dorsal-1' | 'b-origin-01-companion-lineage-1';
export interface Workspace {
  format: 'gecko-forge';
  version: 1;
  geneticsVersion: 'advanced-1';
  rendererVersion: RendererVersion;
  nextId: number;
  individuals: ForgeGecko[];
  favorites: string[];
  selectedId: string | null;
  fatherId: string | null;
  motherId: string | null;
  breedingSeed: string;
  offspringCount: number;
  settings: ExperimentSettings;
}
