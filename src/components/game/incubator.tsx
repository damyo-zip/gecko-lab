"use client";

import { useState } from "react";
import { phenotypeOf } from "@/game/adapter";
import { genotypeLabel } from "@/genetics/mendel";
import { SEX_LABELS, type GameState } from "@/game/model";
import { GameSprite } from "./common";

export function Incubator({ game, onDetail }: { game: GameState; onDetail: (id: string) => void }) {
  const [limit,setLimit] = useState(6);
  const eggs = Object.values(game.eggs).sort((a,b) => b.clutch-a.clutch || a.id.localeCompare(b.id));
  const clutches = [...new Set(eggs.map(v => v.clutch))];
  const waiting = eggs.filter(v => v.status === "incubating").length;
  return <section className="game-section" aria-labelledby="incubator-title">
    <div className="game-section-heading"><div><p className="eyebrow">A LITTLE LIFE, IN TIME</p><h1 id="incubator-title">인큐베이터</h1></div><span className="game-count-chip">대기 {waiting}개</span></div>
    <p className="game-section-copy">게임 시간을 진행하면 부화합니다. 부화한 자손은 컬렉션에 자동 등록됩니다.</p>
    {!eggs.length && <div className="game-empty egg-empty"><span aria-hidden="true">◒</span><h2>아직 알이 없습니다</h2><p>교배 화면에서 부모를 선택해 첫 클러치를 만들어 보세요.</p></div>}
    {clutches.slice(0,limit).map(clutch => {
      const pair = eggs.filter(v => v.clutch === clutch), parents = pair[0].parents;
      return <div className="clutch-panel" key={clutch}>
        <div className="clutch-heading"><strong>클러치 #{clutch}</strong><span>Gen {pair[0].embryo.generation} · TURN {pair[0].laidTurn} 산란</span></div>
        <p className="clutch-parents">{game.individuals[parents.fatherId].name} × {game.individuals[parents.motherId].name}</p>
        <div className="egg-grid">{pair.map(egg => {
          const child = game.individuals[egg.embryo.id];
          return <article className={"egg-card " + egg.status} key={egg.id} data-testid={"egg-" + egg.id}>
            {egg.status === "incubating" ? <>
              <div className="pixel-egg" aria-hidden="true"><i /><i /><i /><i /></div>
              <h3>부화까지 {egg.dueTurn-game.turn}턴</h3><span>TURN {egg.dueTurn} 공개</span>
              <progress max={game.rules.incubationTurns} value={game.turn-egg.laidTurn} aria-label="알 부화 진행" />
              <p>유전 결과 확정 · 저장 완료</p>
            </> : <>
              <span className="egg-hatched-badge">부화 완료</span><GameSprite individual={child} />
              <h3>{child.name}</h3><span>{SEX_LABELS[child.sex]} · {phenotypeOf(child).geneticMorph}</span>
              <code>{genotypeLabel(child.genotype)}</code>
              <button type="button" className="game-secondary" onClick={() => onDetail(child.id)} aria-label={child.name+" 이름과 상세 정보"}>이름과 상세 정보</button>
            </>}
          </article>;
        })}</div>
      </div>;
    })}
    {clutches.length > limit && <button type="button" className="game-secondary full-width" onClick={() => setLimit(limit+6)}>이전 클러치 더 보기</button>}
  </section>;
}
