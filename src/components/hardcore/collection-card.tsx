"use client";
import {memo,useMemo} from "react";
import type {Gecko,HardcoreGame} from "@/game/hardcore/model";
import {specimen,disclosedSex,morphDescription} from "@/game/hardcore/adapter";
import {waitingClutches,waitingForCollection} from "@/game/hardcore/brood-care";
import {SpriteCanvas} from "../sprite-canvas";
import {IncubatorEgg} from "./incubator-egg";
import {HomeIcon} from "./home-icons";
import {won,type Play} from "./common";
import {collectionMorph,collectionPrice} from "./collection-query";
import {collectionStatus,type CollectionStatus} from "./collection-status";

export function CollectionSex({gecko:g}:{gecko:Gecko}) {
 const sex=g.stage==="adult"?g.sex:"unknown";
 return <span className={"home-sex "+sex} aria-label={disclosedSex(g)}>{sex==="unknown"?"?":<HomeIcon name={sex} size={19}/>}</span>;
}
export function CollectionStatusLabel({status,placeholder=false,testId}:{status:CollectionStatus;placeholder?:boolean;testId?:string}) {
 return <span className={"home-status "+(status.ready?"ready":"waiting")+(placeholder?" home-status-placeholder":"")} aria-hidden={placeholder||undefined} data-testid={testId}><HomeIcon name={status.ready?"heart":"clock"} size={14}/><span className="home-status-label">{status.label}</span></span>;
}
export const CollectionEggs=memo(function CollectionEggs({game,gecko:g,busy,play,hero=false}:{game:HardcoreGame;gecko:Gecko;busy:boolean;play:Play;hero?:boolean}) {
 const clutch=useMemo(()=>{const id=waitingClutches(game,g.id)[0];return id?{id,eggs:Object.values(game.eggs).filter(e=>e.matingId===id&&waitingForCollection(e))}:null;},[game,g.id]);
 return clutch?<button type="button" className={"home-egg-pair"+(hero?" hero":"")} disabled={busy} aria-label={g.name+" 알 2개 수거"} data-testid={(hero?"hero-collect-eggs-":"collect-eggs-")+g.id} onClick={event=>{event.stopPropagation();void play({type:"collectEggs",matingId:clutch.id});}}>{clutch.eggs.map(egg=><IncubatorEgg key={egg.id} seed={egg.seed}/>)}<span>알 수거</span></button>:null;
});

/** One card for the six-card home and the windowed manager. Selection is UI only. */
export interface CardActionHandlers {onRename:(id:string)=>void;onSell:(id:string)=>void;onLineage:(id:string)=>void}
export const CollectionCard=memo(function CollectionCard({game,gecko:g,busy,play,selected,onSelect,onDetail,onResources,onBreed,onRename,onSell,onLineage,catalog=false}:{game:HardcoreGame;gecko:Gecko;busy:boolean;play:Play;selected:boolean;onSelect:(id:string)=>void;onDetail:(id:string)=>void;onResources:()=>void;onBreed:(id:string)=>void;catalog?:boolean}&CardActionHandlers) {
 const art=useMemo(()=>specimen(g),[g]),status=useMemo(()=>collectionStatus(game,g),[game,g]);
 return <article className={"home-card hc-card home-frame "+(selected?"selected ":"")+(catalog?"collection-list-row":"")} data-testid={(catalog?"collection-list-":"hc-card-")+g.id}>
  <button className="home-card-select" aria-label={g.name+" 선택"} aria-pressed={selected} onClick={()=>onSelect(g.id)}>
   <div className="home-card-art"><SpriteCanvas specimen={art} growthStage={g.stage} scale={3} testId={(catalog?"collection-list-sprite-":"hardcore-sprite-")+g.id}/></div>
   <CollectionSex gecko={g}/><strong className="home-card-name-placeholder" aria-hidden="true" title={g.name}>{g.name}</strong><span className="home-morph" title={morphDescription(g)}>{collectionMorph(g)}</span><CollectionStatusLabel status={status} placeholder={!!status.action} testId={status.action?undefined:"collection-status-"+g.id}/>
  </button>
  <button type="button" className="home-gen-badge" aria-label={g.name+" 가족 혈통도"} disabled={busy} onClick={event=>{event.stopPropagation();onLineage(g.id);}}>Gen {g.generation}</button>
  <button type="button" className="home-card-name" aria-label={g.name+" 이름 수정"} disabled={busy} onClick={event=>{event.stopPropagation();onRename(g.id);}}><span>{g.name}</span></button>
  <CollectionEggs game={game} gecko={g} busy={busy} play={play}/>
  {status.action&&<button type="button" className="home-card-status-action" disabled={busy} data-testid={"collection-status-"+g.id} aria-label={g.name+": "+status.label+(status.action==="breed"?" · 교배 열기":" · 사육장 관리 열기")} onClick={event=>{event.stopPropagation();if(status.action==="expand")onResources();else onBreed(g.id);}}><CollectionStatusLabel status={status}/></button>}
  <button className="home-card-more home-frame" aria-label={g.name+" 상세보기"} onClick={()=>{if(catalog)onSelect(g.id);onDetail(g.id);}}><span aria-hidden="true">···</span></button>
  {catalog&&<button type="button" className="collection-list-price" title={won(collectionPrice(g))} aria-label={g.name+" 분양 예상가 "+won(collectionPrice(g))} disabled={busy} onClick={event=>{event.stopPropagation();onSell(g.id);}}><span>{won(collectionPrice(g))}</span></button>}
 </article>;
});
