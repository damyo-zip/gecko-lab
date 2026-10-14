"use client";
import { useState } from "react";
import { Card, won, type ViewProps } from "./common";
import { knowledgeLabel } from "@/genetics/advanced/inference";
import { publicKnowledge } from "@/game/hardcore/genetics";
import { expansionPrice } from "@/game/hardcore/economy";
import { freeSlots, owned, reserved } from "@/game/hardcore/survival";
import { MARKET } from "@/game/hardcore/market";
export function Shop({game,busy,play}:ViewProps) {
  const [amount,setAmount] = useState(10), [inspect,setInspect] = useState("");
  return <section><h1>상점</h1><p className="game-section-copy">턴을 마치면 새 매물이 들어옵니다. 부모 기록이 없는 매물은 혈통 미확인으로 표시합니다. 숨은 보인자는 공개 혈통 정보에 따른 가능성으로 표시합니다.</p>
    <div className="hc-market-note"><strong>{MARKET.status === "provisional-game-prices" ? "임시 게임 가격 · 국내 시세 미검증" : "검토된 시장 추정가"}</strong><span>{MARKET.version} · 적용 {MARKET.effectiveDate}</span><p>{MARKET.note}</p></div>
    <div className="hc-resource-box"><h2>먹이 재고 {game.food}개</h2><form onSubmit={e=>{e.preventDefault();void play({type:"buyFood",amount});}}><label>먹이 구매 수량<input type="number" min={1} max={1000} value={amount} onChange={e=>setAmount(Number(e.target.value))}/></label><button className="game-primary" disabled={busy || !Number.isInteger(amount) || amount<1 || amount>1000 || game.money<amount*game.rules.foodUnitPrice}>먹이 구입 · {won(amount*game.rules.foodUnitPrice)}</button></form></div>
    <div className="hc-resource-box"><h2>사육장 {owned(game).length}+예약 {reserved(game)} / {game.capacity}</h2><p>여유 공간 {freeSlots(game)}칸 · 예약 공간은 다른 개체 구매에 사용할 수 없습니다.</p><button className="game-secondary full-width" disabled={busy || game.money<expansionPrice(game) || game.capacity>=game.rules.maxCapacity} onClick={()=>play({type:"expand"})}>사육장 +{game.rules.expansionSlots}칸 · {won(expansionPrice(game))}</button></div>
    <h2 className="lineage-subtitle">오늘의 매물</h2><div className="hc-grid">{Object.values(game.shop.offers).map(o=><Card key={o.id} gecko={o.individual} statusLabel="분양 매물" onDetail={id=>setInspect(inspect===id?"":id)}>
      {inspect===o.id && <p className="game-small-note">{knowledgeLabel(publicKnowledge(o.individual))}<br/>{o.individual.genetics?.knowledge.loci.axanthic.note}</p>}
      <span className="hc-price">기준가 {won(o.marketBase)}<br/><strong>상점가 {won(o.askPrice)}</strong></span>
      <button className="game-primary" aria-label={o.individual.name+" 구매"} disabled={busy || game.money<o.askPrice || freeSlots(game)<1} onClick={()=>play({type:"buyGecko",offerId:o.id})}>구매 {won(o.askPrice)}</button>
    </Card>)}</div><p className="game-small-note">상점 구매가와 즉시 분양가는 다릅니다. 유전자 가격은 단순 합산하지 않으며 복합 모프 평가는 현재 임시 추정입니다.</p>
  </section>;
}
