"use client";
import {useState} from 'react';
import {searchIndividuals} from '@/game/hardcore/family-album';
import {visualName,disclosedSex} from '@/game/hardcore/adapter';
import {Dialog,Sprite,STATUS} from './common';
import type {HardcoreGame} from '@/game/hardcore/model';

/** At most 24 canvases/options at a time, regardless of archive size. */
export function AlbumPicker({game,title,onClose,onChoose,ids}:{game:HardcoreGame;title:string;onClose:()=>void;onChoose:(id:string)=>void;ids?:readonly string[]}){
 const [query,setQuery]=useState(''),[offset,setOffset]=useState(0),result=searchIndividuals(game,query,offset,24,ids);
 return <Dialog title={title} onClose={onClose}>
  <label className="album-search">이름 또는 고유 ID<input type="search" value={query} onChange={e=>{setQuery(e.target.value);setOffset(0);}} placeholder="판매·폐사·외부 부모 기록도 검색"/></label>
  <p className="game-small-note">실제 개체 기록 {result.total}마리 · 숨은 유전형은 표시하지 않습니다.</p>
  <div className="album-picker-list">{result.items.map(g=><button key={g.id} className="album-picker-item" onClick={()=>onChoose(g.id)} aria-label={g.name+' 혈통 선택'}>
   <div className="album-art"><Sprite gecko={g}/></div><span><strong>{g.name}</strong><small>{g.generation}세대 · {disclosedSex(g)} · {STATUS[g.status]}</small><small>{visualName(g)}</small><code>{g.id}</code></span>
  </button>)}</div>
  {!result.total&&<p className="game-empty">일치하는 개체 기록이 없습니다.</p>}
  {result.total>24&&<div className="album-pagination"><button className="game-secondary" disabled={!offset} onClick={()=>setOffset(n=>Math.max(0,n-24))}>이전 개체</button><span>{Math.floor(offset/24)+1} / {Math.ceil(result.total/24)}</span><button className="game-secondary" disabled={offset+24>=result.total} onClick={()=>setOffset(n=>n+24)}>다음 개체</button></div>}
 </Dialog>;
}
