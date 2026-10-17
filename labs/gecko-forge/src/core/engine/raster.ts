import { PIXEL_COUNT, SPRITE_SIZE } from "./model";

export type Point = readonly [number, number];
export type RGB = readonly [number, number, number];

export function insidePolygon(x: number, y: number, points: readonly Point[]): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i], [xj, yj] = points[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function polygon(mask: Uint8Array, points: readonly Point[], value = 255): void {
  for (let y = 0; y < SPRITE_SIZE; y++) {
    for (let x = 0; x < SPRITE_SIZE; x++) {
      if (insidePolygon(x + 0.5, y + 0.5, points)) mask[y * SPRITE_SIZE + x] = value;
    }
  }
}

export function ellipse(mask: Uint8Array, cx: number, cy: number, rx: number, ry: number, value = 255): void {
  for (let y = Math.max(0, Math.floor(cy - ry)); y <= Math.min(95, Math.ceil(cy + ry)); y++) {
    for (let x = Math.max(0, Math.floor(cx - rx)); x <= Math.min(95, Math.ceil(cx + rx)); x++) {
      if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) mask[y * SPRITE_SIZE + x] = value;
    }
  }
}

export function line(mask: Uint8Array, from: Point, to: Point, value = 255): void {
  let [x, y] = from;
  const [tx, ty] = to;
  const dx = Math.abs(tx - x), dy = -Math.abs(ty - y);
  const sx = x < tx ? 1 : -1, sy = y < ty ? 1 : -1;
  let error = dx + dy;
  for (;;) {
    if (x >= 0 && x < 96 && y >= 0 && y < 96) mask[y * 96 + x] = value;
    if (x === tx && y === ty) break;
    const twice = 2 * error;
    if (twice >= dy) { error += dy; x += sx; }
    if (twice <= dx) { error += dx; y += sy; }
  }
}

export function paint(pixels: Uint8ClampedArray, index: number, color: RGB, alpha = 255): void {
  pixels.set([color[0], color[1], color[2], alpha], index * 4);
}

export function intersect(a: Uint8Array, b: Uint8Array): Uint8Array {
  const result = new Uint8Array(PIXEL_COUNT);
  for (let i = 0; i < PIXEL_COUNT; i++) result[i] = Math.round((a[i] * b[i]) / 255);
  return result;
}

export function mix(a: RGB, b: RGB, amount: number): RGB {
  return a.map((value, i) => Math.round(value * (1 - amount) + b[i] * amount)) as unknown as RGB;
}
