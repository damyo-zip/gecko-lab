"use client";
import {memo,useEffect,useRef} from 'react';

let art:Promise<ImageData[]>|undefined;
/** Dedicated frontal art, sampled onto a 96px canvas; no changes to collection art/genetics. */
export function prepareRushArt(){
  if(!art)art=(async()=>{
    const source=new Image();source.src='/art/cre-rush/front-source.png';await source.decode();
    const c=document.createElement('canvas');c.width=c.height=96;const ctx=c.getContext('2d')!;ctx.imageSmoothingEnabled=false;ctx.drawImage(source,0,0,96,96);
    const original=ctx.getImageData(0,0,96,96);
    return Array.from({length:4},(_,variant)=>{
      const result=new ImageData(new Uint8ClampedArray(original.data),96,96),d=result.data;
      for(let i=0;i<d.length;i+=4){
        d[i+3]=d[i+3]<128?0:255;if(!variant||!d[i+3])continue;
        const x=(i/4)%96/96,y=Math.floor(i/4/96)/96;
        // Keep the amber iris, slit and highlights; grade the skin's original shading.
        const eyes=((x-.35)/.075)**2+((y-.465)/.10)**2<1||((x-.68)/.075)**2+((y-.49)/.10)**2<1;
        if(eyes||Math.max(d[i],d[i+1],d[i+2])<42)continue;
        if(variant===1){d[i]=Math.min(255,d[i]*.68+77);d[i+1]=Math.min(255,d[i+1]*.68+67);d[i+2]=Math.min(255,d[i+2]*.68+51);}
        if(variant===2){d[i]*=.76;d[i+1]*=.72;d[i+2]*=.76;}
        if(variant===3){d[i]=Math.min(255,d[i]*1.07);d[i+1]*=.81;d[i+2]*=.83;}
      }return result;
    });
  })().catch(error=>{art=undefined;throw error;});return art;
}
export const RushSprite=memo(function RushSprite({variant=0,onReady,onError}:{variant?:number;onReady?:()=>void;onError?:()=>void}){
  const ref=useRef<HTMLCanvasElement>(null),callbacks=useRef({onReady,onError});callbacks.current={onReady,onError};
  useEffect(()=>{let mounted=true;prepareRushArt().then(images=>{if(!mounted||!ref.current)return;const ctx=ref.current.getContext('2d')!;ctx.imageSmoothingEnabled=false;ctx.putImageData(images[variant],0,0);callbacks.current.onReady?.();}).catch(()=>{if(mounted)callbacks.current.onError?.();});return()=>{mounted=false;};},[variant]);
  return <canvas ref={ref} width={96} height={96} role="img" aria-label="정면으로 뛰어드는 크레스티드 게코" className="rush-sprite"/>;
});
