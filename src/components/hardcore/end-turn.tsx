"use client";
import {useState,useId,type ReactNode} from "react";
import type {HardcoreGame} from "@/game/hardcore/model";
import {foodDemand,isV12} from "@/game/hardcore/lifecycle";
import {Dialog,type Play} from "./common";
export function EndTurnButton({game,busy,play,onShop,className,children}:{game:HardcoreGame;busy:boolean;play:Play;onShop:()=>void;className:string;children:ReactNode}){
 const [confirm,setConfirm]=useState(false),note=useId(),demand=foodDemand(game);
 const next=async()=>{if(await play({type:"endTurn"}))setConfirm(false);};
 return <><button className={className} disabled={busy||game.time.mode!=="turn"} aria-describedby={note} onClick={()=>{if(isV12(game)&&demand.missing)setConfirm(true);else void next();}}>{children}</button>
  <p id={note} className="sr-only">{isV12(game)?`1턴 7일 · 생존 개체 ${demand.animals}마리 자동 급여 · 먹이 면제 ${demand.exempt}마리 · 필요 사료 ${demand.needed}개 · 사료 재고 ${game.food}개${demand.missing?` · ${demand.missing}개 부족`:""}`:game.time.mode==="turn"?"하루 진행 · 하트 −1 · 번식·성장·상점 갱신":"한국 자정 모드입니다. 설정에서 턴 방식으로 변경하세요."}</p>
  {confirm&&<Dialog title="턴 종료 전 사료 부족" onClose={()=>setConfirm(false)}><p className="game-warning" role="alert">생존 개체 {demand.animals}마리 · 먹이 면제 {demand.exempt}마리 · 필요 사료 {demand.needed}개 · 재고 {game.food}개 · 부족 {demand.missing}개</p><p className="game-section-copy">미급여 개체는 하트가 1 감소하고, 0이 되면 영구 폐사합니다. 먹이 면제와 재고 사료 모두 하트가 적은 개체부터 적용합니다. 알은 사료를 소비하지 않습니다.</p><button className="game-primary full-width" disabled={busy} onClick={()=>{setConfirm(false);onShop();}}>사료 구입하러 가기</button><button className="game-secondary full-width" disabled={busy} onClick={()=>void next()}>사료 부족 상태로 턴 마치기</button></Dialog>}
 </>;
}
