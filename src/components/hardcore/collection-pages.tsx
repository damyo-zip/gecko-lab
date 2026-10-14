"use client";
import {memo,useEffect,useMemo,useRef,useState} from "react";
import type {Gecko,HardcoreGame} from "@/game/hardcore/model";
import {specimen,disclosedSex} from "@/game/hardcore/adapter";
import {HomeIcon} from "./home-icons";
import {SpriteCanvas} from "../sprite-canvas";
import {collectionMorph} from "./collection-query";

export const COLLECTION_PAGE_SIZE=6;
export const CollectionCard=memo(function CollectionCard({gecko:g,selected,onSelect,onDetail,status}:{gecko:Gecko;selected:boolean;onSelect:(id:string)=>void;onDetail:(id:string)=>void;status:{ready:boolean;label:string}}) {
  const art=useMemo(()=>specimen(g),[g]),sex=g.stage==="adult"?g.sex:"unknown";
  return <article className={"home-card hc-card home-frame "+(selected?"selected":"")} data-testid={"hc-card-"+g.id}>
    <button className="home-card-select" aria-label={g.name+" 선택"} aria-pressed={selected} onClick={()=>onSelect(g.id)}>
      <span className="home-gen-badge">Gen {g.generation}</span><div className="home-card-art"><SpriteCanvas specimen={art} scale={3} testId={"hardcore-sprite-"+g.id}/></div>
      <span className={"home-sex "+sex} aria-label={disclosedSex(g)}>{sex==="unknown"?"?":<HomeIcon name={sex} size={19}/>}</span>
      <strong title={g.name}>{g.name}</strong><span className="home-morph" title={collectionMorph(g)}>{collectionMorph(g)}</span>
      <span className={"home-status "+(status.ready?"ready":"waiting")}><HomeIcon name={status.ready?"heart":"clock"} size={14}/>{status.label}</span>
    </button><button className="home-card-more home-frame" aria-label={g.name+" 상세보기"} onClick={()=>onDetail(g.id)}><span aria-hidden="true">···</span></button>
  </article>;
});

export function CollectionPages({game,entries,selectedId,onSelect,onDetail,statusFor,queryKey}:{game:HardcoreGame;entries:readonly Gecko[];selectedId:string;onSelect:(id:string)=>void;onDetail:(id:string)=>void;statusFor:(game:HardcoreGame,g:Gecko)=>{ready:boolean;label:string};queryKey:string}) {
  const rail=useRef<HTMLDivElement>(null),index=useRef(0);
  const [page,setPage]=useState(0),pages=Math.max(1,Math.ceil(entries.length/COLLECTION_PAGE_SIZE)),active=Math.min(page,pages-1);
  useEffect(()=>{index.current=0;setPage(0);rail.current?.scrollTo({left:0,behavior:"instant"});},[queryKey]);
  useEffect(()=>{
    const node=rail.current;if(!node)return;
    const observer=new ResizeObserver(()=>{node.scrollTo({left:Math.min(index.current,pages-1)*node.clientWidth,behavior:"instant"});});
    observer.observe(node);return()=>observer.disconnect();
  },[pages]);
  const go=(next:number)=>rail.current?.scrollTo({left:next*rail.current.clientWidth,behavior:"smooth"});
  return <>
    <div className="home-card-carousel" ref={rail} role="region" aria-label="보유 개체 슬라이드" onScroll={e=>{const n=Math.max(0,Math.min(pages-1,Math.round(e.currentTarget.scrollLeft/e.currentTarget.clientWidth)));index.current=n;setPage(n);}}>
      {Array.from({length:pages},(_,p)=><div key={p} className="home-card-page home-card-grid hc-grid" aria-label={`보유 개체 ${p+1}페이지`} aria-hidden={p!==active} inert={p!==active}>
        {/* Keep only the current and neighboring pages' canvases mounted. */}
        {Math.abs(p-active)<=1&&entries.slice(p*COLLECTION_PAGE_SIZE,(p+1)*COLLECTION_PAGE_SIZE).map(g=><CollectionCard key={g.id} gecko={g} selected={g.id===selectedId} onSelect={onSelect} onDetail={onDetail} status={statusFor(game,g)}/>)}
      </div>)}
    </div>
    <div className="home-page-controls"><button aria-label="이전 6마리" disabled={active===0} onClick={()=>go(active-1)}><HomeIcon name="chevron" size={15}/></button><span role="status" aria-live="polite">{active+1} / {pages}<small>좌우로 밀어 보기</small></span><button aria-label="다음 6마리" disabled={active===pages-1} onClick={()=>go(active+1)}><HomeIcon name="chevron" size={15}/></button></div>
  </>;
}
