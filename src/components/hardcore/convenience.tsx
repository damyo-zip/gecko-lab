"use client";
import {createContext,useCallback,useContext,useEffect,useMemo,useRef,useState,type ReactNode,type RefObject} from 'react';
import type {Gecko} from '@/game/hardcore/model';
import {specimen,visualName} from '@/game/hardcore/adapter';
import {SpriteCanvas} from '../sprite-canvas';
import {Dialog} from './common';

type ImageTap={time:number;x:number;y:number;id:string;target:EventTarget|null};
const Convenience=createContext<{autoBuyFood:boolean;setAutoBuyFood:(value:boolean)=>void;observe:(gecko:Gecko)=>void;lastTap:RefObject<ImageTap>}>({
 autoBuyFood:false,setAutoBuyFood:()=>{},observe:()=>{},lastTap:{current:{time:-Infinity,x:0,y:0,id:'',target:null}},
});
export const useConvenience=()=>useContext(Convenience);
const preferenceKey=(gameId:string)=>'gecko-lab:ui:'+gameId;
/** A fresh run can reuse its seed/game ID; it must still start with defaults. */
export function resetConveniencePreferences(gameId:string){
 try{localStorage.removeItem(preferenceKey(gameId));}catch{/* Optional device storage. */}
 window.dispatchEvent(new Event('gecko-lab-ui-reset'));
}
/** Device UI preferences stay out of game saves, migrations and backup checksums. */
export function ConvenienceProvider({gameId,children}:{gameId:string;children:ReactNode}){
 const key=preferenceKey(gameId);
 const read=()=>{try{return localStorage.getItem(key)==='auto-food:on';}catch{return false;}};
 const [autoBuyFood,setAuto]=useState(read),[observed,observe]=useState<Gecko|null>(null);
 const lastTap=useRef<ImageTap>({time:-Infinity,x:0,y:0,id:'',target:null});
 useEffect(()=>{
  const reset=(e:globalThis.PointerEvent)=>{if((e.target as Element).closest('.observation-target')!==lastTap.current.target)lastTap.current.time=-Infinity;};
  document.addEventListener('pointerdown',reset,true);return()=>document.removeEventListener('pointerdown',reset,true);
 },[]);
 useEffect(()=>{
  const sync=(e:StorageEvent)=>{if(e.key===key||e.key===null)setAuto(read());},reset=()=>setAuto(read());
  window.addEventListener('storage',sync);window.addEventListener('gecko-lab-ui-reset',reset);
  return()=>{window.removeEventListener('storage',sync);window.removeEventListener('gecko-lab-ui-reset',reset);};
 },[key]);
 const setAutoBuyFood=useCallback((value:boolean)=>{setAuto(value);try{localStorage.setItem(key,value?'auto-food:on':'auto-food:off');}catch{/* The current session can still use the preference. */}},[key]);
 const value=useMemo(()=>({autoBuyFood,setAutoBuyFood,observe,lastTap}),[autoBuyFood,setAutoBuyFood]);
 return <Convenience.Provider value={value}>{children}{observed&&<ObservationDialog gecko={observed} onClose={()=>observe(null)}/>}</Convenience.Provider>;
}
export function ObservationDialog({gecko,onClose}:{gecko:Gecko;onClose:()=>void}){
 const art=useMemo(()=>specimen(gecko),[gecko]);
 return <Dialog title={gecko.name} className="observation-dialog" onClose={onClose}>
  <div className="observation-art"><SpriteCanvas specimen={art} scale={1} testId="observation-sprite"/></div>
  <p className="observation-morph">{visualName(gecko)}</p>
 </Dialog>;
}
/** Per-image tap history: other animals, controls and drags cannot form a double tap. */
export function ObservationImage({gecko,children,className,single=false,inline=false}:{gecko:Gecko;children:ReactNode;className?:string;single?:boolean;inline?:boolean}){
 const {observe,lastTap:last}=useConvenience(),start=useRef({x:0,y:0,moved:false});
 const Tag=inline?'span':'div';
 return <Tag className={(className??'')+' observation-target'+(inline?' observation-inline':'')} onPointerDown={e=>{
  if(!e.isPrimary||e.button!==0){last.current.time=-Infinity;start.current.moved=true;return;}
  start.current={x:e.clientX,y:e.clientY,moved:false};
 }} onPointerMove={e=>{if(Math.hypot(e.clientX-start.current.x,e.clientY-start.current.y)>10){start.current.moved=true;last.current.time=-Infinity;}}} onPointerCancel={()=>{start.current.moved=true;last.current.time=-Infinity;}} onClick={e=>{
  if(start.current.moved)return;
  const now=performance.now(),previous=last.current;
  if(single||(previous.id===gecko.id&&now-previous.time<350&&Math.hypot(e.clientX-previous.x,e.clientY-previous.y)<24)){
   last.current.time=-Infinity;e.preventDefault();observe(gecko);
  }else last.current={time:now,x:e.clientX,y:e.clientY,id:gecko.id,target:e.currentTarget};
 }} onDoubleClick={e=>{e.preventDefault();if(!start.current.moved)observe(gecko);}}>{children}</Tag>;
}
