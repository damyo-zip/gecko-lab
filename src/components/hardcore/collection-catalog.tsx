"use client";
import {memo,useEffect,useMemo,useRef,useState} from "react";
import type {Gecko,HardcoreGame} from "@/game/hardcore/model";
import {owned} from "@/game/hardcore/survival";
import {specimen,disclosedSex} from "@/game/hardcore/adapter";
import {STAGE_LABELS} from "@/game/model";
import {PATTERN_FILTERS} from "@/phenotype/rules";
import {SpriteCanvas} from "../sprite-canvas";
import {Dialog,won} from "./common";
import {HomeIcon} from "./home-icons";
import {collectionEntries,collectionMorph,collectionPrice,COLLECTION_MORPHS,COLLECTION_SORTS,type CollectionQuery,type CollectionSort} from "./collection-query";

const CatalogRow=memo(function CatalogRow({gecko:g,busy,onDetail}:{gecko:Gecko;busy:boolean;onDetail:(id:string)=>void}) {
  const art=useMemo(()=>specimen(g),[g]);
  return <button className="collection-list-row" disabled={busy} onClick={()=>onDetail(g.id)} aria-label={g.name+" 상세보기"} data-testid={"collection-list-"+g.id}>
    <span className="collection-list-art"><SpriteCanvas specimen={art} scale={3} testId={"collection-list-sprite-"+g.id}/></span>
    <span className="collection-list-info"><strong>{g.name}</strong><span>{collectionMorph(g)}</span><small>Gen {g.generation} · {STAGE_LABELS[g.stage]} · {disclosedSex(g)}</small><span className="collection-list-price"><small>분양 예상가</small><b>{won(collectionPrice(g))}</b></span></span>
    <HomeIcon name="chevron" size={18}/>
  </button>;
});

export function CollectionCatalog({game,busy,initial,onClose,onDetail}:{game:HardcoreGame;busy:boolean;initial:CollectionQuery;onClose:()=>void;onDetail:(id:string)=>void}) {
  const [query,setQuery]=useState<CollectionQuery>({...initial,sex:"all",search:""}),[limit,setLimit]=useState(24);
  const scroll=useRef<HTMLDivElement>(null),sentinel=useRef<HTMLDivElement>(null);
  const animals=useMemo(()=>owned(game),[game.individuals]);
  const entries=useMemo(()=>collectionEntries(animals,query),[animals,query]);
  const change=(patch:Partial<CollectionQuery>)=>{scroll.current?.scrollTo({top:0});setLimit(24);setQuery(q=>({...q,...patch}));};
  useEffect(()=>{
    const root=scroll.current,target=sentinel.current;if(!root||!target||limit>=entries.length)return;
    const observer=new IntersectionObserver(items=>{if(items.some(i=>i.isIntersecting))setLimit(n=>Math.min(n+24,entries.length));},{root,rootMargin:"160px"});
    observer.observe(target);return()=>observer.disconnect();
  },[limit,entries]);
  return <Dialog title="전체 개체 목록" className="collection-catalog" onClose={onClose}>
    <div className="collection-list-controls">
      <label className="collection-list-search"><HomeIcon name="search" size={18}/><input type="search" aria-label="이름·ID 검색" placeholder="이름·ID 검색" value={query.search} onChange={e=>change({search:e.target.value})}/></label>
      <div><label>모프<select aria-label="목록 모프 필터" value={query.morph} onChange={e=>change({morph:e.target.value})}><option value="all">모프 전체</option>{Object.entries(COLLECTION_MORPHS).map(([id,label])=><option key={id} value={id}>{label}</option>)}{PATTERN_FILTERS.map(label=><option key={label} value={"pattern:"+label}>{label}</option>)}</select></label>
        <label>정렬<select aria-label="목록 정렬" value={query.sort} onChange={e=>change({sort:e.target.value as CollectionSort})}>{Object.entries(COLLECTION_SORTS).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
        <label>성장<select aria-label="목록 성장 단계" value={query.stage} onChange={e=>change({stage:e.target.value})}><option value="all">성장 전체</option>{Object.entries(STAGE_LABELS).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
        <label>성별<select aria-label="목록 성별" value={query.sex} onChange={e=>change({sex:e.target.value})}><option value="all">성별 전체</option><option value="male">수컷</option><option value="female">암컷</option><option value="unknown">미구분</option></select></label></div>
      <p><span role="status">{entries.length} / {animals.length}마리</span><button onClick={()=>change({morph:"all",sort:"default",stage:"all",sex:"all",search:""})}>필터 초기화</button></p>
    </div>
    <div className="collection-list-scroll" ref={scroll} tabIndex={0} role="region" aria-label="개체·분양가격 목록">
      {entries.slice(0,limit).map(g=><CatalogRow key={g.id} gecko={g} busy={busy} onDetail={onDetail}/>)}
      {!entries.length&&<p className="collection-list-empty">{animals.length?"조건에 맞는 개체가 없습니다.":"보유 개체가 없습니다."}</p>}
      {limit<entries.length&&<div ref={sentinel} className="collection-list-more"><button className="game-secondary" onClick={()=>setLimit(n=>Math.min(n+24,entries.length))}>개체 목록 더 보기</button></div>}
    </div>
    <p className="collection-list-note">현재 게임 기준의 분양 예상가입니다. 개체를 누르면 상세 정보와 분양 절차를 확인할 수 있습니다.</p>
  </Dialog>;
}
