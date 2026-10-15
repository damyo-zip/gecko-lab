"use client";
import {memo,useEffect,useRef} from 'react';

let art:Promise<ImageData[][]>|undefined;
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
      }// Three small pixel poses, cached once. The central face, eyes and crests never warp.
      // Only the outer toe pads / upper tail move 1–2 logical pixels between flight phases.
      return [0,1,2].map(pose=>{
        if(pose===1)return result;
        const frame=new ImageData(96,96),amount=pose===0?-1:1;
        for(let y=0;y<96;y++)for(let x=0;x<96;x++){
          const toes=Math.max(0,Math.min(1,(y-70)/14)),tail=Math.max(0,1-y/24);
          const dx=Math.round((x<48?-1:1)*toes*amount+tail*amount),dy=Math.round(toes*amount);
          const sx=x-dx,sy=y-dy;if(sx<0||sx>=96||sy<0||sy>=96)continue;
          const from=(sy*96+sx)*4,to=(y*96+x)*4;frame.data.set(d.subarray(from,from+4),to);
        }return frame;
      });
    });
  })().catch(error=>{art=undefined;throw error;});return art;
}
export const RushSprite=memo(function RushSprite({variant=0,pose=1,onReady,onError}:{variant?:number;pose?:0|1|2;onReady?:()=>void;onError?:()=>void}){
  const ref=useRef<HTMLCanvasElement>(null),callbacks=useRef({onReady,onError});callbacks.current={onReady,onError};
  useEffect(()=>{let mounted=true;prepareRushArt().then(images=>{if(!mounted||!ref.current)return;const ctx=ref.current.getContext('2d')!;ctx.imageSmoothingEnabled=false;ctx.putImageData(images[variant][pose],0,0);callbacks.current.onReady?.();}).catch(()=>{if(mounted)callbacks.current.onError?.();});return()=>{mounted=false;};},[variant,pose]);
  return <canvas ref={ref} width={96} height={96} role="img" aria-label="정면으로 뛰어드는 크레스티드 게코" className="rush-sprite"/>;
});
