"use client";
import {useEffect,useLayoutEffect,useMemo,useRef,useState} from "react";
import {owned,feedable} from "@/game/hardcore/survival";
import {disclosedSex} from "@/game/hardcore/adapter";
import {ageTurns,foodDemand,isV12} from "@/game/hardcore/lifecycle";
import {STAGE_LABELS} from "@/game/model";
import {PATTERN_FILTERS} from "@/phenotype/rules";
import {Dialog,Hearts,type ViewProps} from "./common";
import {HomeIcon} from "./home-icons";
import {CollectionCard,CollectionStatusLabel} from "./collection-card";
import {collectionStatus} from "./collection-status";
import {EndTurnButton} from "./end-turn";
import {collectionEntries,collectionMorph,COLLECTION_MORPHS,COLLECTION_SORTS,type CollectionQuery,type CollectionSort} from "./collection-query";

export function CollectionCatalog({game,busy,play,initial,selectedId,onSelect,onQuery,onClose,onDetail,onResources,onBreed}:ViewProps&{initial:CollectionQuery;selectedId:string;onSelect:(id:string)=>void;onQuery:(query:CollectionQuery)=>void;onClose:()=>void;onResources:()=>void;onBreed:(id:string)=>void}) {
 const [query,setQuery]=useState<CollectionQuery>({...initial,sex:"all",search:""});
 const [viewport,setViewport]=useState({top:0,height:360,pitch:182});
 const scroll=useRef<HTMLDivElement>(null),grid=useRef<HTMLDivElement>(null),frame=useRef(0);
 const animals=useMemo(()=>owned(game),[game.individuals]);
 const entries=useMemo(()=>collectionEntries(animals,query),[animals,query]);
 const selected=game.individuals[selectedId]?.status==="owned"?game.individuals[selectedId]:entries[0];
 const status=selected?collectionStatus(game,selected):null,demand=foodDemand(game);
 const change=(patch:Partial<CollectionQuery>)=>{const next={...query,...patch};scroll.current?.scrollTo({top:0});setViewport(w=>({...w,top:0}));setQuery(next);onQuery(next);};
 // Three columns, a fixed responsive row height and two overscan rows: neither
 // sprite painting nor the DOM grows with the total number of owned records.
 useLayoutEffect(()=>{
  const root=scroll.current,list=grid.current;if(!root||!list)return;
  const measure=()=>{const style=getComputedStyle(list);setViewport(w=>{const next={top:root.scrollTop,height:root.clientHeight,pitch:parseFloat(style.gridAutoRows)+parseFloat(style.rowGap)};return w.top===next.top&&w.height===next.height&&w.pitch===next.pitch?w:next;});};
  const queue=()=>{if(!frame.current)frame.current=requestAnimationFrame(()=>{frame.current=0;measure();});};
  measure();const observer=new ResizeObserver(queue);observer.observe(root);root.addEventListener("scroll",queue,{passive:true});
  return()=>{observer.disconnect();root.removeEventListener("scroll",queue);cancelAnimationFrame(frame.current);frame.current=0;};
 },[]);
 useEffect(()=>{const root=scroll.current;if(root)setViewport(w=>w.top===root.scrollTop?w:{...w,top:root.scrollTop});},[entries.length]);
 const rows=Math.ceil(entries.length/3),start=Math.max(0,Math.min(rows-1,Math.floor(viewport.top/viewport.pitch)-2)),end=Math.min(rows,Math.ceil((viewport.top+viewport.height)/viewport.pitch)+2);
 return <Dialog title="전체 개체" className="collection-catalog" onClose={onClose}>
  <div className="collection-list-controls">
   <label className="collection-list-search"><HomeIcon name="search" size={18}/><input type="search" aria-label="이름·ID 검색" placeholder="이름·ID 검색" value={query.search} onChange={e=>change({search:e.target.value})}/></label>
   <div className="collection-list-primary-filters"><label>모프<select aria-label="목록 모프 필터" value={query.morph} onChange={e=>change({morph:e.target.value})}><option value="all">모프 전체</option>{Object.entries(COLLECTION_MORPHS).map(([id,label])=><option key={id} value={id}>{label}</option>)}{PATTERN_FILTERS.map(label=><option key={label} value={"pattern:"+label}>{label}</option>)}</select></label>
    <label>정렬<select aria-label="목록 정렬" value={query.sort} onChange={e=>change({sort:e.target.value as CollectionSort})}>{Object.entries(COLLECTION_SORTS).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label></div>
   <details className="collection-list-extra"><summary>성장·성별 조건</summary><div><label>성장<select aria-label="목록 성장 단계" value={query.stage} onChange={e=>change({stage:e.target.value})}><option value="all">성장 전체</option>{Object.entries(STAGE_LABELS).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
    <label>성별<select aria-label="목록 성별" value={query.sex} onChange={e=>change({sex:e.target.value})}><option value="all">성별 전체</option><option value="male">수컷</option><option value="female">암컷</option><option value="unknown">미구분</option></select></label></div></details>
   <p><span role="status">{entries.length} / {animals.length}마리</span><button onClick={()=>change({morph:"all",sort:"default",stage:"all",sex:"all",search:""})}>필터 초기화</button></p>
  </div>
  <section className="collection-manager-selected" aria-label="선택 개체 관리" data-selected-id={selected?.id??""}>
   {selected&&status?<><div><strong>{selected.name}</strong><span>{collectionMorph(selected)} · Gen {selected.generation}</span><small>{disclosedSex(selected)} · {STAGE_LABELS[selected.stage]} · {ageTurns(game,selected)}턴</small><CollectionStatusLabel status={status}/></div><Hearts gecko={selected}/><div className="collection-manager-actions"><button className="game-secondary" disabled={busy} onClick={()=>onDetail(selected.id)}>상세·분양</button><button className="game-secondary" disabled={busy||!status.action} onClick={()=>status.action==="expand"?onResources():onBreed(selected.id)}>{status.action==="expand"?"사육장 관리":"교배 열기"}</button></div></>:<p>보유한 개체를 선택해 관리할 수 있습니다.</p>}
  </section>
  <div className="collection-list-scroll" ref={scroll} tabIndex={0} role="region" aria-label="개체·분양가격 목록">
   <div className="collection-list-window" style={{height:rows?rows*viewport.pitch-6:0}}>
    <div ref={grid} className="collection-list-grid" style={{top:start*viewport.pitch}}>{entries.slice(start*3,end*3).map(g=><CollectionCard key={g.id} game={game} gecko={g} busy={busy} play={play} selected={g.id===selected?.id} onSelect={onSelect} onDetail={onDetail} onResources={onResources} onBreed={onBreed} catalog/>)}</div>
   </div>
   {!entries.length&&<p className="collection-list-empty">{animals.length?"조건에 맞는 개체가 없습니다.":"보유 개체가 없습니다."}</p>}
  </div>
  <div className="collection-manager-footer"><p>{isV12(game)?`턴 종료 시 ${demand.animals}마리 자동 급여 · 면제 ${demand.exempt}마리 · 필요 ${demand.needed}개 · 재고 ${game.food}개${demand.missing?` · ${demand.missing}개 부족`:""}`:`사료 ${game.food}개 · 수동 급여`}<span>TURN {game.turn} · 분양 예상가는 현재 게임 기준</span></p><div><button className="game-secondary" disabled={busy} onClick={onResources}>사료·사육장</button>{!isV12(game)&&selected?<button className="game-primary" disabled={busy||!game.food||!feedable(game,selected)} onClick={()=>void play({type:"feed",id:selected.id})}>먹이 1개 급여</button>:<EndTurnButton game={game} busy={busy} play={play} onShop={onResources} className="game-primary">턴 넘기기</EndTurnButton>}</div></div>
 </Dialog>;
}
