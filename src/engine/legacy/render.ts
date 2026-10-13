import { createBaseSprite, PART } from "./base";
import {
  LAYER_ORDER, PIXEL_COUNT, validateSpecimen,
  type BodyColor, type GeckoSpecimen, type LayerName, type SpriteLayer, type SpriteResult,
} from "../model";
import { randomFor } from "../random";
import { ellipse, mix, paint, type RGB } from "../raster";

const BASE = createBaseSprite();
const COLORS: Record<BodyColor, RGB> = {
  orange: [196, 111, 51], brown: [103, 62, 41], cream: [190, 153, 114], slate: [94, 95, 115],
};

function palette(specimen: GeckoSpecimen) {
  const { bodyColor, patternStyle } = specimen.appearance;
  const gray = bodyColor === "slate";
  const adjust = (color: RGB): RGB => {
    if (specimen.state.fire === "up") return color;
    const luminance = Math.round(color[0] * .3 + color[1] * .59 + color[2] * .11);
    return mix(mix(color, [luminance, luminance, luminance], .22), [223, 209, 185], .25);
  };
  return {
    body: adjust(COLORS[bodyColor]),
    ink: adjust(gray ? [34, 31, 43] : [61, 32, 26]),
    shadow: adjust(gray ? [38, 37, 50] : [79, 40, 30]),
    highlight: adjust(gray ? [163, 162, 177] : [255, 211, 146]),
    pattern: adjust(gray ? [157, 156, 175] : patternStyle === "lilly" ? [255, 240, 205] : [247, 199, 122]),
    secondary: adjust(gray ? [70, 69, 87] : [113, 56, 33]),
    spots: adjust(gray ? [25, 25, 35] : [53, 37, 29]),
    cream: adjust(gray ? [183, 180, 193] : [255, 226, 177]),
  };
}

function newLayer(name: LayerName, mask = new Uint8Array(PIXEL_COUNT)): SpriteLayer {
  return { name, mask, pixels: new Uint8ClampedArray(PIXEL_COUNT * 4) };
}

function solidLayer(name: LayerName, mask: Uint8Array, color: RGB): SpriteLayer {
  const layer = newLayer(name, mask.slice());
  for (let i = 0; i < PIXEL_COUNT; i++) if (mask[i]) paint(layer.pixels, i, color);
  return layer;
}

/** Straight-alpha source-over, with an independent 8-bit alpha mask. */
export function compositeLayers(layers: readonly SpriteLayer[], enabled: readonly LayerName[] = LAYER_ORDER): Uint8ClampedArray {
  const result = new Uint8ClampedArray(PIXEL_COUNT * 4);
  for (const layer of layers) {
    if (!enabled.includes(layer.name)) continue;
    if (layer.pixels.length !== PIXEL_COUNT * 4 || layer.mask.length !== PIXEL_COUNT)
      throw new Error("레이어는 96×96 크기여야 합니다.");
    for (let i = 0; i < PIXEL_COUNT; i++) {
      const offset = i * 4;
      const alpha = (layer.pixels[offset+3] * layer.mask[i]) / (255 * 255);
      if (!alpha) continue;
      const oldAlpha = result[offset+3] / 255;
      const combined = alpha + oldAlpha * (1-alpha);
      for (let c = 0; c < 3; c++) {
        result[offset+c] = Math.round((layer.pixels[offset+c] * alpha +
          result[offset+c] * oldAlpha * (1-alpha)) / combined);
      }
      result[offset+3] = Math.round(combined * 255);
    }
  }
  return result;
}

export function renderSprite(specimen: GeckoSpecimen, enabled: readonly LayerName[] = LAYER_ORDER): SpriteResult {
  validateSpecimen(specimen);
  const colors = palette(specimen);
  const layers: SpriteLayer[] = [];
  layers.push(solidLayer("silhouette", BASE.silhouette, colors.ink));
  const bodyMask = BASE.silhouette.slice();
  for (let i = 0; i < PIXEL_COUNT; i++) if (BASE.outline[i]) bodyMask[i] = 0;
  layers.push(solidLayer("body", bodyMask, colors.body));
  layers.push(solidLayer("shadow", BASE.shadows, colors.shadow));
  layers.push(solidLayer("highlight", BASE.highlights, colors.highlight));

  const dorsal = newLayer("dorsal");
  const flank = newLayer("flank");
  const dorsalRandom = randomFor(specimen.seed, "dorsal");
  const phase = dorsalRandom() * Math.PI * 2;
  const flankRandom = randomFor(specimen.seed, "flank");
  // Branches grow from the belly towards the spine. Anchors vary by seed, not by coverage/color.
  const branches = Array.from({ length: 7 }, (_, j) => ({
    x: 39 + j * 6 + flankRandom() * 2,
    y: 50 + flankRandom() * 6,
    width: 1.6 + flankRandom() * 1.1,
    height: 3.5 + flankRandom() * 4,
    slope: .25 + flankRandom() * .45,
  }));
  for (let y = 0; y < 96; y++) {
    for (let x = 0; x < 96; x++) {
      const i = y * 96 + x, part = BASE.parts[i];
      if (!part || BASE.outline[i] || BASE.crest[i] || part === PART.farLeg) continue;
      const wave = Math.sin(x * .31 + phase) * 1.4 + Math.sin(x * .61 + phase) * .65;
      let dorsalScore = Infinity;
      if (part === PART.head && x > 15) dorsalScore = (y - (20 + (x-26) ** 2 / 52) - wave) / 8;
      if (part === PART.body && x > 36) dorsalScore = (y - (37 + ((x-53)/25) ** 2 * 4) - wave) / 11;
      if (part === PART.tail) dorsalScore = .48 + Math.sin((x+y) * .33 + phase) * .22;
      const coverage = specimen.appearance.dorsalCoverage;
      if (coverage > 0 && dorsalScore >= -.3 && dorsalScore <= coverage) {
        dorsal.mask[i] = 255;
        const form = BASE.shadows[i] / 255;
        paint(dorsal.pixels, i, mix(colors.pattern, colors.shadow, form * .4));
      }
      let flankScore = Infinity;
      if (part === PART.body && x > 35 && y > 42) {
        for (const branch of branches) {
          const dx = (x - branch.x - (y - branch.y) * branch.slope) / branch.width;
          const dy = (y - branch.y) / branch.height;
          flankScore = Math.min(flankScore, Math.sqrt(dx*dx + dy*dy) / 1.8);
        }
      }
      if (part === PART.frontLeg || part === PART.hindLeg) {
        // Limb blotches follow the limb length rather than scattering over the whole image.
        flankScore = .22 + Math.abs(Math.sin(y * .4 + phase)) * .65;
      }
      if (part === PART.head && y > 33 && x > 26) flankScore = .45 + (y-33) * .045;
      if (specimen.appearance.flankCoverage > 0 && flankScore < specimen.appearance.flankCoverage) {
        flank.mask[i] = 255;
        const tricolor = specimen.appearance.patternStyle === "tricolor";
        const color = specimen.appearance.patternStyle === "normal" ||
          (tricolor && Math.sin(x * .4 + y * .23 + phase) > .25) ? colors.secondary : colors.pattern;
        paint(flank.pixels, i, mix(color, colors.shadow, BASE.shadows[i] / 255 * .42));
      }
    }
  }
  layers.push(dorsal, flank);

  const spots = newLayer("spots");
  const spotRandom = randomFor(specimen.seed, "spots");
  const centers: { x: number; y: number; radius: number }[] = [];
  // Blue-noise-style rejection sampling confined to anatomical masks; no per-pixel random noise.
  // Generate only the requested prefix; increasing spotCount retains earlier spots.
  for (let tries = 0; tries < 12_000 && centers.length < specimen.appearance.spotCount; tries++) {
    const x = 8 + Math.floor(spotRandom() * 81);
    const y = 19 + Math.floor(spotRandom() * 68);
    const radius = spotRandom() < .75 ? 1 : 1.5;
    const i = y * 96 + x;
    if (!bodyMask[i] || BASE.crest[i] || BASE.parts[i] === PART.farLeg ||
      ((x-25)/8) ** 2 + ((y-28)/9) ** 2 < 1 || y <= 21) continue;
    if ([i-1,i+1,i-96,i+96].some((index) => !bodyMask[index])) continue;
    if (centers.some((spot) => (spot.x-x) ** 2 + (spot.y-y) ** 2 < (spot.radius+radius+1.2) ** 2)) continue;
    centers.push({ x, y, radius });
  }
  for (const spot of centers.slice(0, specimen.appearance.spotCount))
    ellipse(spots.mask, spot.x, spot.y, spot.radius, spot.radius);
  for (let i = 0; i < PIXEL_COUNT; i++) {
    if (!bodyMask[i] || BASE.crest[i]) spots.mask[i] = 0;
    if (spots.mask[i]) paint(spots.pixels, i, colors.spots);
  }
  layers.push(spots);

  const details = newLayer("details");
  const detailPalette: RGB[] = [colors.ink, [29, 20, 20], colors.shadow,
    [163, 83, 37], [223, 155, 66], [255, 247, 220], colors.cream];
  for (let i = 0; i < PIXEL_COUNT; i++) {
    if (BASE.crest[i] || BASE.details[i]) {
      details.mask[i] = 255;
      paint(details.pixels, i, BASE.crest[i] ? colors.cream : detailPalette[BASE.details[i]]);
    }
  }
  layers.push(details);
  return { width: 96, height: 96, pixels: compositeLayers(layers, enabled), layers, version: "1.0.0" };
}
