"use client";
import {useState} from 'react';
import {Dialog,won,type ViewProps} from './common';
import {expansionPrice} from '@/game/hardcore/economy';
import {freeSlots,owned,reserved} from '@/game/hardcore/survival';
import {useConvenience} from './convenience';
import {foodDemand} from '@/game/hardcore/lifecycle';
/** Existing economy actions remain outside the gecko-only shop. */
export function FoodPurchase({game,busy,play,onClose,onHousing}:ViewProps&{onClose:()=>void;onHousing:()=>void}){
 const [amount,setAmount]=useState(10),demand=foodDemand(game);
 const {autoBuyFood,setAutoBuyFood}=useConvenience();
 return <Dialog title="사료 구매" onClose={onClose}>
  <p className="game-section-copy" data-testid="resource-balance">보유 금액 {won(game.money)}</p>
  <div className="hc-resource-box"><h2>먹이 재고 {game.food}개</h2><form onSubmit={e=>{e.preventDefault();void play({type:'buyFood',amount});}}><label>먹이 구매 수량<input type="number" min={1} max={1000} value={amount} onChange={e=>setAmount(Number(e.target.value))}/></label><button className="game-primary" disabled={busy||!Number.isInteger(amount)||amount<1||amount>1000||game.money<amount*game.rules.foodUnitPrice}>먹이 구입 · {won(amount*game.rules.foodUnitPrice)}</button></form></div>
  <label className="food-auto-purchase"><input type="checkbox" checked={autoBuyFood} onChange={e=>setAutoBuyFood(e.target.checked)}/>먹이 자동 구매</label>
  <p className="game-small-note">기본 사료는 생존 보유 개체당 턴마다 1개입니다. 도전 2개 완료마다 1마리분씩, 최대 4마리분이 자동 면제됩니다. 다음 턴: 보유 {demand.animals}마리 · 면제 {demand.exempt}마리 · 필요 사료 {demand.needed}개. 상점에서는 게코 개체만 분양합니다.</p>
  <button type="button" className="game-secondary full-width" disabled={busy} onClick={onHousing}>사육장 구매</button>
 </Dialog>;
}

export function HousingPurchase({game,busy,play,onClose}:ViewProps&{onClose:()=>void}){
 return <Dialog title="사육장 구매" onClose={onClose}>
  <p className="game-section-copy" data-testid="resource-balance">보유 금액 {won(game.money)}</p>
  <div className="hc-resource-box"><h2>사육장 · 보유 개체 {owned(game).length}마리 · 예약 공간 {reserved(game)}칸 / 전체 용량 {game.capacity}칸</h2><p>여유 공간 {freeSlots(game)}칸 · 예약 공간은 다른 개체 구매에 사용할 수 없습니다.</p><button className="game-secondary full-width" disabled={busy||game.money<expansionPrice(game)||game.capacity>=game.rules.maxCapacity} onClick={()=>play({type:'expand'})}>사육장 +{game.rules.expansionSlots}칸 · {won(expansionPrice(game))}</button></div>
 </Dialog>;
}
