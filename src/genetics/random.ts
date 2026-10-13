export const GENETICS_MODEL_VERSION = 1 as const;

/** Versioned FNV-1a/Mulberry32 stream. Independent of the graphics engine's PRNG. */
export function seededRandom(seed: string, domain: string): () => number {
  let hash = 2166136261;
  const input = "genetics-v1:" + seed + ":" + domain;
  for (let i = 0; i < input.length; i++) hash = Math.imul(hash ^ input.charCodeAt(i), 16777619);
  let state = hash >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), state | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function seedId(seed: string, domain: string): string {
  return Math.floor(seededRandom(seed, domain)() * 4294967296).toString(16).padStart(8, "0");
}
