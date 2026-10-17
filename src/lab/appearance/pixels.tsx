'use client';
import {memo,useEffect,useRef} from 'react';
import type {StudySprite} from './base-study/render';
/** Shared lab-only adapter. Bitmap and touch/UI state are never game records. */
export const StudyPixels=memo(function StudyPixels({sprite,size=96,testId}:{sprite:StudySprite;size?:number;testId:string}){
 const ref=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{
  if(!ref.current)return;const source=document.createElement('canvas');source.width=source.height=96;
  const c=source.getContext('2d')!,image=c.createImageData(96,96);image.data.set(sprite.pixels);c.putImageData(image,0,0);
  const ctx=ref.current.getContext('2d')!;ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,size,size);ctx.drawImage(source,0,0,size,size);
 },[sprite,size]);
 return <canvas ref={ref} width={size} height={size} role="img" aria-label={testId} data-testid={testId}/>;
});
