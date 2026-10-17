export function encodePNG(width: number, height: number, rgba: Uint8ClampedArray): Buffer;
export function decodePNG(input: Buffer | Uint8Array): { width: number; height: number; pixels: Uint8ClampedArray };
