"use client";

import { useState } from "react";
import { genotypeLabel } from "@/genetics/mendel";
import { TRAIT_KEYS, TRAIT_LABELS } from "@/genetics/traits";
import { phenotypeOf } from "@/game/adapter";
import { SEX_LABELS, STAGE_LABELS, type GameState, type Individual } from "@/game/model";
import { Dialog, GameSprite } from "./common";
import type { PlayAction } from "./breeding";

export function IndividualDetails({ individual, game, busy, act, onClose, onDetail, onBreed, onLineage }: {
  individual: Individual; game: GameState; busy: boolean; act: PlayAction; onClose: () => void; onDetail: (id: string) => void;
  onBreed: () => void; onLineage: () => void;
}) {
  const [name,setName] = useState(individual.name), phenotype = phenotypeOf(individual);
  const age = game.turn-individual.birthTurn;
  return <Dialog title={individual.name+" 상세"} onClose={onClose}>
    <div className="detail-art"><GameSprite individual={individual} scale={3} /></div>
    <form className="name-form" onSubmit={async event => { event.preventDefault(); await act({type:"rename",id:individual.id,name},"이름을 저장했습니다."); }}>
      <label htmlFor="offspring-name">개체 이름</label><div><input id="offspring-name" value={name} maxLength={24} disabled={busy} onChange={e => setName(e.target.value)} />
        <button type="submit" className="game-primary" disabled={busy || !name.trim()}>이름 저장</button></div>
    </form>
    <dl className="detail-facts">
      <div><dt>고유 ID</dt><dd className="id-text">{individual.id}</dd></div>
      <div><dt>성별 · 세대</dt><dd>{SEX_LABELS[individual.sex]} · Gen {individual.generation}</dd></div>
      <div><dt>성장 단계</dt><dd>{STAGE_LABELS[individual.stage]}{individual.stage !== "adult" && " · 성체까지 "+Math.max(0,game.rules.adultAfter-age)+"턴"}</dd></div>
      <div><dt>출생 턴</dt><dd>{individual.parents ? "TURN "+individual.birthTurn : "시작 성체 (게임 시작 이전)"}</dd></div>
      <div><dt>유전형</dt><dd><code>{genotypeLabel(individual.genotype)}</code> · Lilly White 좌</dd></div>
      <div><dt>유전 모프</dt><dd>{phenotype.geneticMorph}</dd></div>
      <div><dt>외형 분류</dt><dd>{phenotype.description}</dd></div>
      <div><dt>교배 상태</dt><dd>{individual.stage !== "adult" ? "성체가 되어야 교배 가능" : individual.nextBreedTurn > game.turn ? "TURN "+individual.nextBreedTurn+"부터 가능" : "가능 · 조합별 위험 검사 필요"}</dd></div>
      <div><dt>외형 시드</dt><dd className="id-text">{individual.visualSeed}</dd></div>
    </dl>
    <div className="detail-parentage"><h3>부모</h3>{individual.parents ? <div>{[individual.parents.fatherId,individual.parents.motherId].map((id,i) =>
      <button key={id} type="button" className="game-secondary" onClick={() => onDetail(id)}>{i === 0 ? "아버지" : "어머니"} · {game.individuals[id].name}</button>)}</div> :
      <p>시작 개체입니다. 게임에서는 시작 개체 간 혈연이 없는 것으로 가정합니다.</p>}</div>
    <div className="potential-traits"><h3>잠재 외형 형질 <span>게임용 근사 수치</span></h3>
      {TRAIT_KEYS.map(key => <div key={key}><span>{TRAIT_LABELS[key]}</span><progress max="1" value={individual.potential[key]} aria-label={TRAIT_LABELS[key]} /><b>{Math.round(individual.potential[key]*100)}</b></div>)}</div>
    <p className="game-small-note">현재 모든 성장 단계는 Phase 1의 성체 스프라이트를 임시 사용합니다.</p>
    <div className="detail-actions"><button type="button" className="game-secondary" onClick={onLineage}>혈통 보기</button>
      <button type="button" className="game-primary" disabled={busy || individual.stage !== "adult"} onClick={onBreed}>부모로 선택</button></div>
  </Dialog>;
}
