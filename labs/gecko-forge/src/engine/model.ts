import type { Genome } from './genetics';
import type { SpriteResult } from '@/engine/model';
import type { calculatePhenotype } from './appearance';

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
}

/** The renderer knows neither game individuals nor a save/state container. */
export interface RenderInput {
  phenotype: ReturnType<typeof calculatePhenotype>;
  seed: string;
  fire: 'up' | 'down';
}
export interface AppearanceRenderer {
  id: string;
  render(input: RenderInput): SpriteResult;
}

/** Experimental, non-inherited UI settings. Never put these in Genome. */
export interface ExperimentSettings { zoom: 2 | 3 | 4; showB: boolean }
export interface Workspace {
  format: 'gecko-forge';
  version: 1;
  geneticsVersion: 'advanced-1';
  rendererVersion: 'patterns-1';
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
