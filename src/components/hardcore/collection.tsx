"use client";
import { useState } from "react";
import { owned, feedable } from "@/game/hardcore/survival";
import { valueGecko } from "@/game/hardcore/market";
import { Card, won, SectionHeading, type ViewProps } from "./common";

export function Collection({game,busy,play,onDetail}:ViewProps) {
  const [limit,setLimit] = useState(12), [stage,setStage] = useState("all");
  const animals = owned(game), visible = animals.filter(g=>stage === "all" || g.stage === stage);
  return <section className="hc-collection"><SectionHeading title="컬렉션" eyebrow="나의 테라리움" icon="grid" count={animals.length}>
    <select className="compact-select" aria-label="성장 단계 필터" value={stage} onChange={e=>{setStage(e.target.value);setLimit(12);}}><option value="all">전체 성장 단계</option><option value="hatchling">해칭</option><option value="juvenile">아성체</option><option value="adult">성체</option></select></SectionHeading>
    <p className="game-section-copy">오늘 급여한 개체는 다시 먹일 수 없습니다. 재고가 부족한 전체 급여는 하트가 적은 개체부터 진행합니다.</p>
    <button className="game-primary full-width" disabled={busy || !game.food || !animals.some(g=>feedable(game,g))} onClick={()=>play({type:"feedAll"})}>수동 전체 급여 · 먹이 {game.food}개</button>
    {!visible.length && <p className="game-empty">보유 개체가 없습니다. 상점에서 새 개체를 선택하세요. 판매·폐사 기록은 혈통도에 남습니다.</p>}
    <div className="hc-grid">{visible.slice(0,limit).map(g=><Card key={g.id} gecko={g} onDetail={onDetail}>
      <span className="hc-price">분양 예상 {won(valueGecko(g).sell)}</span>
      <button className="game-secondary" aria-label={g.name + " 먹이 급여"} disabled={busy || !game.food || !feedable(game,g)} onClick={()=>play({type:"feed",id:g.id})}>{g.lastFedDate === game.lastDate ? "오늘 급여 완료" : g.hearts === 5 ? "컨디션 가득" : "먹이 1개 급여"}</button>
    </Card>)}</div>
    {visible.length>limit && <button className="game-secondary full-width" onClick={()=>setLimit(n=>n+12)}>개체 더 보기</button>}
  </section>;
}
