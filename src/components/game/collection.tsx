"use client";

import { useState } from "react";
import { STAGE_LABELS, type GameState, type GrowthStage } from "@/game/model";
import { IndividualCard } from "./common";

export function Collection({ game, onDetail }: { game: GameState; onDetail: (id: string) => void }) {
  const [filter, setFilter] = useState<"all" | GrowthStage>("all");
  const [limit, setLimit] = useState(12);
  const population = Object.values(game.individuals);
  const filtered = population.filter(v => filter === "all" || v.stage === filter)
    .sort((a,b) => b.birthTurn-a.birthTurn || a.id.localeCompare(b.id));
  return <section className="game-section" aria-labelledby="collection-title">
    <div className="game-section-heading"><div><p className="eyebrow">MY GECKOS</p><h1 id="collection-title">컬렉션 <span>{population.length}</span></h1></div>
      <label className="compact-select"><span className="sr-only">성장 단계 필터</span><select value={filter} onChange={(e) => { setFilter(e.target.value as typeof filter); setLimit(12); }}>
        <option value="all">모든 성장 단계</option>{Object.entries(STAGE_LABELS).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
    <p className="game-section-copy">카드를 눌러 유전형과 혈통을 확인하세요. 새끼도 자동으로 등록됩니다.</p>
    <div className="game-collection-grid">{filtered.slice(0,limit).map(individual =>
      <IndividualCard key={individual.id} individual={individual} turn={game.turn} onOpen={() => onDetail(individual.id)} />)}</div>
    {!filtered.length && <p className="game-empty">아직 이 성장 단계의 개체가 없습니다.</p>}
    {filtered.length > limit && <button type="button" className="game-secondary full-width" onClick={() => setLimit(limit+12)}>개체 더 보기 ({filtered.length-limit}마리)</button>}
  </section>;
}
