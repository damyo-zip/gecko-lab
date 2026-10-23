import type {MorphExtensions} from '@/forge';

/** Versioned replacement engine data. Missing extension copies remain unknown. */
export interface ForgeGenetics {version:1;extensions?:MorphExtensions}
export interface ForgeSystem {version:1}
