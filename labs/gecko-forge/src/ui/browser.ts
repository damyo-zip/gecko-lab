import type { ForgeGecko, Workspace } from '../engine/model';
import { emptyWorkspace, exportWorkspace, importWorkspace } from '../engine/workspace';
import { renderIndividual } from '../engine/renderer';

export const STORAGE_KEY = 'gecko-forge:workspace:1';
export const BACKUP_KEY = 'gecko-forge:before-import:1';
export function loadWorkspace(): Workspace {
  const json = localStorage.getItem(STORAGE_KEY);
  return json ? importWorkspace(json) : emptyWorkspace();
}
export function saveWorkspace(workspace: Workspace): void { localStorage.setItem(STORAGE_KEY, exportWorkspace(workspace, false)); }
export function drawIndividual(canvas: HTMLCanvasElement, g: ForgeGecko): void {
  const sprite = renderIndividual(g), ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D를 사용할 수 없습니다.');
  canvas.width = 96; canvas.height = 96; ctx.imageSmoothingEnabled = false;
  if (!sprite) return;
  const data = ctx.createImageData(96, 96); data.data.set(sprite.pixels); ctx.putImageData(data, 0, 0);
}
export function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function downloadPng(g: ForgeGecko): void {
  const canvas = document.createElement('canvas'); drawIndividual(canvas, g);
  canvas.toBlob(blob => { if (blob) download(blob, `${g.id}-96.png`); }, 'image/png');
}
