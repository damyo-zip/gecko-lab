import {LAYER_ORDER,PIXEL_COUNT,type SpriteLayer,type LayerName} from "./model";
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
