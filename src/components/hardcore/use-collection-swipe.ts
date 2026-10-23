"use client";
import {useLayoutEffect,useRef,type PointerEvent,type TouchEvent} from 'react';

/** Direction locks early; native pan-y retains scrolling and cancels the drag. */
export function useCollectionSwipe(move:(direction:number)=>void,queryKey:string){
 const gesture=useRef<{id:number;x:number;y:number;axis:''|'x'|'y'}|null>(null),suppress=useRef(0);
 const frame=useRef<number|null>(null);
 const pendingTouch=useRef<number|null>(null);
 const clear=()=>{gesture.current=null;pendingTouch.current=null;};
 const schedule=(direction:number)=>{
  if(frame.current!==null)cancelAnimationFrame(frame.current);
  frame.current=requestAnimationFrame(()=>{frame.current=null;move(direction);});
 };
 useLayoutEffect(()=>{
  gesture.current=null;pendingTouch.current=null;
  // A filter/sort change owns the new first page. An old gesture must not
  // overwrite that reset when its deferred native-touch frame finally runs.
  return()=>{if(frame.current!==null)cancelAnimationFrame(frame.current);frame.current=null;};
 },[queryKey]);
 return {
  onPointerDownCapture:(e:PointerEvent<HTMLDivElement>)=>{
   if(!e.isPrimary||e.button!==0){clear();return;}
   // Native touch adjustment may target the name/status button even when a
   // drag starts in the art. Only a horizontal drag suppresses these clicks.
   suppress.current=0;
   gesture.current={id:e.pointerId,x:e.clientX,y:e.clientY,axis:''};
  },
  onPointerMoveCapture:(e:PointerEvent<HTMLDivElement>)=>{
   const g=gesture.current;if(!g||g.id!==e.pointerId)return;
   const dx=Math.abs(e.clientX-g.x),dy=Math.abs(e.clientY-g.y);
   if(!g.axis&&Math.max(dx,dy)>12)g.axis=dx>dy*1.4?'x':'y';
   if(g.axis==='x'){
    e.preventDefault();
    // Touch already keeps the initial control captured until the finger lifts.
    if(e.pointerType!=='touch'&&!e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.setPointerCapture(e.pointerId);
   }
  },
  onPointerUpCapture:(e:PointerEvent<HTMLDivElement>)=>{
   const g=gesture.current;clear();if(!g||g.id!==e.pointerId)return;
   if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
   const dx=e.clientX-g.x,dy=e.clientY-g.y;
   if(g.axis==='x'){
    e.preventDefault();
    suppress.current=performance.now()+400;
    // pointerup precedes touchend. Keep its target mounted through both native
    // events so replacing the page cannot swallow the next control's click.
    if(Math.abs(dx)>=48&&Math.abs(dx)>Math.abs(dy)*1.4){
     if(e.pointerType==='touch')pendingTouch.current=dx<0?1:-1;
     else schedule(dx<0?1:-1);
    }
   }
  },
  onTouchEndCapture:(e:TouchEvent<HTMLDivElement>)=>{
   const direction=pendingTouch.current;pendingTouch.current=null;
   if(direction!==null){e.preventDefault();schedule(direction);}
  },
  onPointerCancelCapture:clear,
  onClickCapture:(e:React.MouseEvent<HTMLDivElement>)=>{if(performance.now()<suppress.current){e.preventDefault();e.stopPropagation();}},
 };
}
