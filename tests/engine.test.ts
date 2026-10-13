import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createBaseSprite, PART } from "../src/engine/base";
import { LAYER_ORDER, PIXEL_COUNT, type GeckoSpecimen, type SpriteLayer } from "../src/engine/model";
import { MORPH_PRESETS, specimenFromPreset } from "../src/engine/presets";
import { compositeLayers, renderSprite } from "../src/engine/render";
import { deriveSeed } from "../src/engine/random";

const specimen = () => specimenFromPreset(MORPH_PRESETS[0], "reproducible-individual");
const hash = (pixels: Uint8ClampedArray) => createHash("sha256").update(pixels).digest("hex");
function count(mask: Uint8Array) { return mask.filter(Boolean).length; }
function layer(result: ReturnType<typeof renderSprite>, name: string) {
  return result.layers.find((value) => value.name === name)!;
}

describe("96×96 sprite engine", () => {
  it("renders the authored anatomy with eight independently masked layers", () => {
    const result = renderSprite(specimen());
    expect([result.width, result.height, result.pixels.length]).toEqual([96, 96, 96 * 96 * 4]);
    expect(result.layers.map((value) => value.name)).toEqual(LAYER_ORDER);
    const base = createBaseSprite();
    expect(count(base.silhouette)).toBeGreaterThan(1600);
    for (const part of Object.values(PART)) expect(count(Uint8Array.from(base.parts, (v) => v === part ? 255 : 0))).toBeGreaterThan(10);
    for (let i = 0; i < PIXEL_COUNT; i++) {
      expect(result.pixels[i*4+3]).toBe(base.silhouette[i]);
      for (const value of result.layers) if (!base.silhouette[i]) expect(value.mask[i]).toBe(0);
    }
  });

  it("is byte-identical across repeated calls and serialized parameters", () => {
    const input = specimen();
    const result = renderSprite(input);
    expect(hash(renderSprite(input).pixels)).toBe(hash(result.pixels));
    expect(hash(renderSprite(JSON.parse(JSON.stringify(input))).pixels)).toBe(hash(result.pixels));
  });

  it("changes anatomical patterns with the seed while preserving silhouette and lighting", () => {
    const input = specimen();
    input.appearance.spotCount = 35;
    const a = renderSprite(input);
    const b = renderSprite({ ...input, seed: "different-individual" });
    expect(hash(a.pixels)).not.toBe(hash(b.pixels));
    for (const name of ["silhouette", "body", "shadow", "highlight", "details"])
      expect(layer(a, name)).toEqual(layer(b, name));
    for (const name of ["dorsal", "flank", "spots"])
      expect(layer(a, name).mask).not.toEqual(layer(b, name).mask);
  });

  it("produces six distinct visual presets under the same seed", () => {
    const outputs = MORPH_PRESETS.map((preset) => hash(renderSprite(specimenFromPreset(preset, "same-seed")).pixels));
    expect(new Set(outputs).size).toBe(6);
    const dalmatian = renderSprite(specimenFromPreset(MORPH_PRESETS[3]));
    expect(count(layer(dalmatian, "spots").mask)).toBeGreaterThan(100);
  });

  it("recolors Orange/Brown/Cream without moving any mask", () => {
    const input = specimen();
    const outputs = (["orange", "brown", "cream"] as const).map((bodyColor) =>
      renderSprite({ ...input, appearance: { ...input.appearance, bodyColor } }));
    expect(new Set(outputs.map((result) => hash(result.pixels))).size).toBe(3);
    for (const result of outputs.slice(1)) for (let i = 0; i < 8; i++)
      expect(result.layers[i].mask).toEqual(outputs[0].layers[i].mask);
  });

  it("changes fire-state colors while keeping all patterns fixed", () => {
    const input = specimen();
    input.appearance.spotCount = 60;
    const up = renderSprite(input);
    const down = renderSprite({ ...input, state: { fire: "down" } });
    expect(hash(up.pixels)).not.toBe(hash(down.pixels));
    for (let i = 0; i < 8; i++) expect(up.layers[i].mask).toEqual(down.layers[i].mask);
  });

  it.each(["dorsal", "flank"] as const)("%s coverage is zero at 0 and grows monotonically", (name) => {
    const key = name === "dorsal" ? "dorsalCoverage" : "flankCoverage";
    const input = specimen();
    const outputs = [0, .5, 1].map((coverage) =>
      layer(renderSprite({ ...input, appearance: { ...input.appearance, [key]: coverage } }), name).mask);
    expect(count(outputs[0])).toBe(0);
    expect(count(outputs[1])).toBeGreaterThan(0);
    expect(count(outputs[2])).toBeGreaterThan(count(outputs[1]));
    for (let i = 0; i < PIXEL_COUNT; i++) if (outputs[1][i]) expect(outputs[2][i]).toBe(255);
  });

  it("adds spots without relocating earlier spots or changing other patterns", () => {
    const input = specimen();
    const outputs = [0, 20, 70].map((spotCount) =>
      renderSprite({ ...input, appearance: { ...input.appearance, spotCount } }));
    expect(count(layer(outputs[0], "spots").mask)).toBe(0);
    expect(count(layer(outputs[2], "spots").mask)).toBeGreaterThan(count(layer(outputs[1], "spots").mask));
    const small = layer(outputs[1], "spots").mask, large = layer(outputs[2], "spots").mask;
    for (let i = 0; i < PIXEL_COUNT; i++) if (small[i]) expect(large[i]).toBe(255);
    for (const name of ["dorsal", "flank"]) expect(layer(outputs[1], name)).toEqual(layer(outputs[2], name));
    for (let y = 22; y < 35; y++) for (let x = 20; x < 31; x++) expect(large[y*96+x]).toBe(0);
  });

  it("can isolate layers or produce a completely transparent output", () => {
    const input = specimen();
    expect(renderSprite(input, []).pixels.every((value) => value === 0)).toBe(true);
    const only = renderSprite(input, ["silhouette"]);
    expect(hash(only.pixels)).not.toBe(hash(renderSprite(input).pixels));
    expect(only.pixels.some((value) => value > 0)).toBe(true);
  });

  it("does not mutate input or leak shared buffers between results", () => {
    const input = specimen(), serialized = JSON.stringify(input);
    const original = renderSprite(input);
    const expected = hash(original.pixels);
    original.pixels.fill(0);
    for (const value of original.layers) { value.mask.fill(0); value.pixels.fill(0); }
    expect(hash(renderSprite(input).pixels)).toBe(expected);
    expect(JSON.stringify(input)).toBe(serialized);
  });

  it("derives reproducible bounded individual seeds from a maximum-length seed", () => {
    const seed = "게".repeat(128);
    const seeds = ["A", "B", "C"].map((domain) => deriveSeed(seed, domain));
    expect(new Set(seeds).size).toBe(3);
    for (const value of seeds) expect(() => renderSprite({ ...specimen(), seed: value })).not.toThrow();
    expect(deriveSeed(seed, "A")).toBe(seeds[0]);
  });

  it.each([
    ["empty seed", (v: GeckoSpecimen) => { v.seed = ""; }],
    ["long seed", (v: GeckoSpecimen) => { v.seed = "x".repeat(129); }],
    ["NaN coverage", (v: GeckoSpecimen) => { v.appearance.dorsalCoverage = NaN; }],
    ["negative coverage", (v: GeckoSpecimen) => { v.appearance.flankCoverage = -.1; }],
    ["oversized coverage", (v: GeckoSpecimen) => { v.appearance.dorsalCoverage = 1.1; }],
    ["fractional spots", (v: GeckoSpecimen) => { v.appearance.spotCount = 1.5; }],
    ["too many spots", (v: GeckoSpecimen) => { v.appearance.spotCount = 71; }],
    ["unknown palette", (v: GeckoSpecimen) => { v.appearance.bodyColor = "invalid" as never; }],
    ["schema version", (v: GeckoSpecimen) => { v.schemaVersion = 2 as never; }],
  ])("rejects invalid parameters: %s", (_, mutate) => {
    const input = specimen(); mutate(input);
    expect(() => renderSprite(input)).toThrow();
  });
});

describe("masked alpha compositing", () => {
  it("multiplies layer opacity and mask alpha and composites source-over", () => {
    const background: SpriteLayer = { name: "body", mask: new Uint8Array(PIXEL_COUNT), pixels: new Uint8ClampedArray(PIXEL_COUNT*4) };
    const foreground: SpriteLayer = { name: "dorsal", mask: new Uint8Array(PIXEL_COUNT), pixels: new Uint8ClampedArray(PIXEL_COUNT*4) };
    background.mask[0] = 255; background.pixels.set([0, 0, 255, 255]);
    foreground.mask[0] = 128; foreground.pixels.set([255, 0, 0, 128]);
    expect(Array.from(compositeLayers([background, foreground]).slice(0,4))).toEqual([64,0,191,255]);
    expect(Array.from(compositeLayers([foreground]).slice(0,4))).toEqual([255,0,0,64]);
    expect(Array.from(compositeLayers([background, foreground]).slice(4,8))).toEqual([0,0,0,0]);
  });

  it("rejects malformed layer dimensions", () => {
    expect(() => compositeLayers([{ name: "body", mask: new Uint8Array(1), pixels: new Uint8ClampedArray(4) }])).toThrow();
  });
});
