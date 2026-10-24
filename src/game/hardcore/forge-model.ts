import type {MorphExtensions} from '@/forge';
import type {PatternColourTraits} from './colour-genetics';

/** Versioned replacement engine data. Missing extension copies remain unknown. */
export interface ForgeGenetics {version:1;extensions?:MorphExtensions;paletteVersion?:2;patternColour?:PatternColourTraits}
export interface ForgeSystem {version:1}
