"use client";

import { useState } from "react";
import { phenotypeOf } from "@/game/adapter";
import { SEX_LABELS, type GameState } from "@/game/model";
import { GameSprite, IndividualCard } from "./common";

export function Lineage({ game, selectedId, onSelect, onDetail }: { game: GameState; selectedId: string; onSelect: (id: string) => void; onDetail: (id: string) => void }) {
  const [limit,setLimit] = useState(12);
  const population = Object.values(game.individuals);
  const selected = game.individuals[selectedId] ?? population[0];
  const children = population.filter(v => v.parents?.fatherId === selected.id || v.parents?.motherId === selected.id);
  const rows: { id: string; depth: number; path: string; label: string }[] = [];
  const visit = (id: string, depth: number, path: string, label: string) => {
    const value = game.individuals[id]; if (!value || depth > 3) return;
    rows.push({id,depth,path,label});
    if (value.parents) {
      visit(value.parents.fatherId,depth+1,path+"-f","아버지");
      visit(value.parents.motherId,depth+1,path+"-m","어머니");
    }
  };
  if (selected.parents) { visit(selected.parents.fatherId,0,"f","아버지"); visit(selected.parents.motherId,0,"m","어머니"); }
  return <section className="game-section" aria-labelledby="lineage-title">
    <div className="game-section-heading"><div><p className="eyebrow">ROOTS AND BRANCHES</p><h1 id="lineage-title">혈통도</h1></div>
      <span className="game-count-chip">최고 Gen {Math.max(...population.map(v => v.generation))}</span></div>
    <label className="lineage-select">혈통을 볼 개체<select value={selected.id} onChange={e => {onSelect(e.target.value);setLimit(12);}}>
      {population.map(v => <option key={v.id} value={v.id}>{v.name} · Gen {v.generation}</option>)}</select></label>
    <div className="lineage-root"><GameSprite individual={selected} /><div><h2>{selected.name}</h2><p>{SEX_LABELS[selected.sex]} · Gen {selected.generation}</p>
      <p>{phenotypeOf(selected).description}</p><code className="id-text">{selected.id}</code>
      <button type="button" className="game-secondary" onClick={() => onDetail(selected.id)}>상세 정보</button></div></div>
    <h2 className="lineage-subtitle">조상</h2>
    {!rows.length && <p className="game-empty">시작 개체입니다. 등록된 부모가 없습니다.</p>}
    <div className="ancestor-list">{rows.map(row => {
      const individual = game.individuals[row.id];
      return <div key={row.path} className="ancestor-row" style={{marginLeft:row.depth*12}}>
        <span className="ancestor-branch" aria-hidden="true">└</span><button type="button" onClick={() => onSelect(individual.id)}>
          <span>{row.label} · <strong>{individual.name}</strong></span><small>Gen {individual.generation} · {individual.id}</small></button>
      </div>;
    })}</div>
    <p className="game-small-note">화면에는 조상 4단계까지 표시합니다. 이름을 눌러 더 이전 혈통으로 이동할 수 있습니다. 전체 관계는 저장에 유지됩니다.</p>
    <h2 className="lineage-subtitle">직접 자손 <span>{children.length}</span></h2>
    <div className="game-collection-grid">{children.slice(0,limit).map(child => <IndividualCard key={child.id} individual={child} turn={game.turn} onOpen={() => onDetail(child.id)} />)}</div>
    {!children.length && <p className="game-empty">아직 등록된 자손이 없습니다.</p>}
    {children.length > limit && <button type="button" className="game-secondary full-width" onClick={() => setLimit(limit+12)}>자손 더 보기</button>}
    <div className="game-model-note"><strong>현재 근친 차단 정책</strong><p>직계 혈통 전체와 두 부모의 최근 2세대 공통 조상 관계를 차단합니다.
      정밀한 근친계수나 먼 친척의 건강 위험을 계산한 결과는 아닙니다.</p></div>
  </section>;
}
