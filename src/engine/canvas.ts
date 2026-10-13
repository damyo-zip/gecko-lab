import type { SpriteResult } from "./model";

/** Browser-only adapter. The engine itself has no React, Canvas or DOM dependency. */
export function drawSprite(canvas: HTMLCanvasElement, sprite: SpriteResult, scale: 1 | 3 | 4): void {
  const logical = document.createElement("canvas");
  logical.width = sprite.width;
  logical.height = sprite.height;
  const source = logical.getContext("2d");
  const context = canvas.getContext("2d");
  if (!source || !context) throw new Error("이 브라우저에서는 Canvas 2D를 사용할 수 없습니다.");
  const data = source.createImageData(sprite.width, sprite.height);
  data.data.set(sprite.pixels);
  source.putImageData(data, 0, 0);
  canvas.width = sprite.width * scale;
  canvas.height = sprite.height * scale;
  context.imageSmoothingEnabled = false;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(logical, 0, 0, canvas.width, canvas.height);
}
