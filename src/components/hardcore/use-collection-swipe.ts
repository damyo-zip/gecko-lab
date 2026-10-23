"use client";
import {useRef,type PointerEvent} from 'react';

/** Direction locks early; native pan-y retains scrolling and cancels the drag. */
export function useCollectionSwipe(move:(direction:number)=>void){
 const gesture=useRef<{id:number;x:number;y:number;axis:''|'x'|'y'}|null>(null),suppress=useRef(0);
 const clear=()=>{gesture.current=null;};
 return {
  onPointerDownCapture:(e:PointerEvent<HTMLDivElement>)=>{
   if(!e.isPrimary||e.button!==0){clear();return;}
   const button=(e.target as Element).closest('button');
   if(button&&!button.classList.contains('home-card-select'))return;
   gesture.current={id:e.pointerId,x:e.clientX,y:e.clientY,axis:''};
  },
  onPointerMoveCapture:(e:PointerEvent<HTMLDivElement>)=>{
   const g=gesture.current;if(!g||g.id!==e.pointerId)return;
   const dx=Math.abs(e.clientX-g.x),dy=Math.abs(e.clientY-g.y);
   if(!g.axis&&Math.max(dx,dy)>12)g.axis=dx>dy*1.4?'x':'y';
   if(g.axis==='x'){e.preventDefault();if(!e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.setPointerCapture(e.pointerId);}
  },
  onPointerUpCapture:(e:PointerEvent<HTMLDivElement>)=>{
   const g=gesture.current;clear();if(!g||g.id!==e.pointerId)return;
   const dx=e.clientX-g.x,dy=e.clientY-g.y;
   if(g.axis==='x'){
    suppress.current=performance.now()+400;
    if(Math.abs(dx)>=48&&Math.abs(dx)>Math.abs(dy)*1.4)move(dx<0?1:-1);
   }
  },
  onPointerCancelCapture:clear,
  onClickCapture:(e:React.MouseEvent<HTMLDivElement>)=>{if(performance.now()<suppress.current){e.preventDefault();e.stopPropagation();}},
 };
}
