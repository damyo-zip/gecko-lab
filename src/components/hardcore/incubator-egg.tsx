"use client";
import {useEffect,useRef} from 'react';

/** A hand-shaped 48×56 shell with layered shading. Seed changes shell markings only. */
export function paintIncubatorEgg(ctx:CanvasRenderingContext2D,seed:string,variant:'normal'|'broken'|'failed'='normal'){
 let hash=2166136261;for(const c of seed)hash=Math.imul(hash^c.charCodeAt(0),16777619);hash>>>=0;
 const palettes=[['#fff1c9','#efca91','#cd9b62','#83562f','#de8446','#ab5328'],['#fff0ca','#dfc398','#b39166','#705239','#84593c','#563b2e'],['#ffe8c1','#e4b79a','#bb8470','#785143','#b16a58','#813d37']];
 // Separate palette selection from the lower hash bits used for individual markings.
 const p=variant==='failed'?['#c6c39a','#97977a','#696b57','#393f37','#68714a','#434e37']:palettes[(hash>>>16)%palettes.length],w=48,h=56,mask=new Uint8Array(w*h);
 // Deliberate stepped silhouette: rounded pointed top and broad heavy bottom, leaning right.
 const rows=[[23,29],[20,33],[18,36],[16,38],[14,39],[13,40],[12,41],[11,41],[10,41],[9,41],[8,40],[7,40],[7,39],[6,39],[6,38],[6,37],[6,36],[7,35],[8,33],[10,31],[13,28]];
 for(let y=0;y<rows.length*2;y++){const [left,right]=rows[Math.floor(y/2)];for(let x=left;x<=right;x++)mask[(y+7)*w+x]=1;}
 const inside=(x:number,y:number)=>x>=0&&x<w&&y>=0&&y<h&&mask[y*w+x]===1;
 ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,w,h);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  if(!inside(x,y))continue;
  if(variant==='broken'&&y<29+((Math.floor(x/4)%2)*5))continue;
  if(variant==='failed'&&(y<15||x<12+(y%5===0?2:0)))continue;
  const edge=!inside(x-1,y)||!inside(x+1,y)||!inside(x,y-1)||!inside(x,y+1);
  const shade=x/48+(y/56)*.45;
  ctx.fillStyle=edge?p[3]:shade>1.03?p[2]:shade>.65?p[1]:p[0];ctx.fillRect(x,y,1,1);
 }
 const spots=[[29,14,3],[20,20,3],[35,24,2],[15,31,3],[26,31,4],[33,38,3],[12,41,2],[23,43,3],[30,46,2],[25,10,2],[17,26,2],[36,18,2]];
 for(let i=0;i<spots.length;i++){
  const [sx,sy,r]=spots[i],dx=((hash>>>(i%8*3))&3)-1,dy=((hash>>>(i%7*4))&3)-1;
  for(let y=sy-r+dy;y<=sy+r+dy;y++)for(let x=sx-r+dx;x<=sx+r+dx;x++){
   const distance=(x-sx-dx)**2*.8+(y-sy-dy)**2;
   if(variant==='broken'&&y<29+((Math.floor(x/4)%2)*5)||variant==='failed'&&(y<15||x<14))continue;
   if(distance>r*r||!inside(x-2,y)||!inside(x+2,y)||!inside(x,y-2)||!inside(x,y+2))continue;
   ctx.fillStyle=y>sy+dy?p[5]:p[4];ctx.fillRect(x,y,1,1);
  }
 }
 ctx.fillStyle=p[0];for(const [x,y] of [[22,11],[21,12],[20,13],[17,18],[16,19],[13,25]])if(variant==='normal'&&inside(x,y))ctx.fillRect(x,y,2,1);
}
export function IncubatorEgg({seed,large=false,variant='normal'}:{seed:string;large?:boolean;variant?:'normal'|'broken'|'failed'}){
 const ref=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{const ctx=ref.current?.getContext('2d');if(ctx)paintIncubatorEgg(ctx,seed,variant);},[seed,variant]);
 return <canvas ref={ref} width={48} height={56} className={'inc-shell-egg'+(large?' large':'')} role="img" aria-label={variant==='broken'?'깨진 알껍데기':variant==='failed'?'변색된 실패 알':'고정 시드 픽셀 알'} data-seed={seed}/>;
}
