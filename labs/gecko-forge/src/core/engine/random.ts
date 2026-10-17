/** FNV-1a + Mulberry32. Domain-separated streams keep unrelated traits stable. */
export function randomFor(seed: string, domain: string): () => number {
  let hash = 2166136261;
  const input = seed + ":" + domain;
  for (let i = 0; i < input.length; i++) hash = Math.imul(hash ^ input.charCodeAt(i), 16777619);
  let state = hash >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), state | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** Bounded derived seeds, even when the original seed is already 128 characters. */
export function deriveSeed(seed: string, domain: string): string {
  const random = randomFor(seed, "derived:" + domain);
  return "GL-" + Math.floor(random() * 4294967296).toString(16).padStart(8, "0");
}
