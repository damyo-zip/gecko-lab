"use client";
import {useState} from 'react';
import {Dialog,won,type ViewProps} from './common';
import {expansionPrice} from '@/game/hardcore/economy';
import {freeSlots,owned,reserved} from '@/game/hardcore/survival';
/** Existing economy actions remain outside the gecko-only shop. */
export function ResourceManagement({game,busy,play,onClose}:ViewProps&{onClose:()=>void}){
 const [amount,setAmount]=useState(10);
 return <Dialog title="사료 및 사육장 관리" onClose={onClose}>
  <div className="hc-resource-box"><h2>먹이 재고 {game.food}개</h2><form onSubmit={e=>{e.preventDefault();void play({type:'buyFood',amount});}}><label>먹이 구매 수량<input type="number" min={1} max={1000} value={amount} onChange={e=>setAmount(Number(e.target.value))}/></label><button className="game-primary" disabled={busy||!Number.isInteger(amount)||amount<1||amount>1000||game.money<amount*game.rules.foodUnitPrice}>먹이 구입 · {won(amount*game.rules.foodUnitPrice)}</button></form></div>
  <div className="hc-resource-box"><h2>사육장 {owned(game).length}+예약 {reserved(game)} / {game.capacity}</h2><p>여유 공간 {freeSlots(game)}칸 · 예약 공간은 다른 개체 구매에 사용할 수 없습니다.</p><button className="game-secondary full-width" disabled={busy||game.money<expansionPrice(game)||game.capacity>=game.rules.maxCapacity} onClick={()=>play({type:'expand'})}>사육장 +{game.rules.expansionSlots}칸 · {won(expansionPrice(game))}</button></div>
  <p className="game-small-note">사료는 턴 종료 시 생존 보유 개체마다 1개씩 소비합니다. 상점에서는 게코 개체만 분양합니다.</p>
 </Dialog>;
}
