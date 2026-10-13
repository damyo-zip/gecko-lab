"use client";

import { checkBreeding } from "@/game/play";
import { genotypeLabel } from "@/genetics/mendel";
import { STAGE_LABELS, type GameAction, type GameState } from "@/game/model";
import { ParentSummary } from "./common";

export type PlayAction = (action: GameAction, message: string) => Promise<boolean>;
export function Breeding({ game, busy, act, fatherId, motherId, onFather, onMother, onLaid }: {
  game: GameState; busy: boolean; act: PlayAction; fatherId: string; motherId: string;
  onFather: (id: string) => void; onMother: (id: string) => void; onLaid: () => void;
}) {
  const population = Object.values(game.individuals);
  const males = population.filter(v => v.sex === "male"), females = population.filter(v => v.sex === "female");
  const father = game.individuals[fatherId] ?? males[0], mother = game.individuals[motherId] ?? females[0];
  const check = checkBreeding(game,father?.id ?? "",mother?.id ?? "");
  const outcomes = check.forecast?.loci[0].outcomes ?? [];
  const percentage = (value: number) => Number((value*100).toFixed(1)) + "%";
  const label = (alleles: readonly [string,string]) => alleles[0] === "Lw" && alleles[1] === "Lw" ? "동형접합 비생존" : alleles.includes("Lw") ? "릴리화이트" : "일반형";
  return <section className="game-section" aria-labelledby="breeding-title">
    <div className="game-section-heading"><div><p className="eyebrow">PLAN THE NEXT GENERATION</p><h1 id="breeding-title">교배 연구실</h1></div><span className="game-count-chip">알 2개 / 교배</span></div>
    <p className="game-section-copy">성체 부모를 선택하고, 유전 확률과 혈연 관계를 먼저 확인하세요.</p>
    <div className="parent-picker-grid">
      <label htmlFor="father-select">수컷 부모<select id="father-select" value={father?.id ?? ""} disabled={busy} onChange={e => onFather(e.target.value)}>
        {males.map(v => <option key={v.id} value={v.id}>{v.name} · Gen {v.generation} · {STAGE_LABELS[v.stage]}</option>)}</select></label>
      <label htmlFor="mother-select">암컷 부모<select id="mother-select" value={mother?.id ?? ""} disabled={busy} onChange={e => onMother(e.target.value)}>
        {females.map(v => <option key={v.id} value={v.id}>{v.name} · Gen {v.generation} · {STAGE_LABELS[v.stage]}</option>)}</select></label>
    </div>
    <div className="selected-parents"><ParentSummary individual={father} title="FATHER" /><span className="cross-symbol" aria-hidden="true">×</span><ParentSummary individual={mother} title="MOTHER" /></div>
    <div className="genetics-forecast" data-testid="genetics-forecast">
      <h2>수정 시점의 이론적 유전형 확률</h2>
      <p className="forecast-subtitle">Lilly White · 단일 유전자좌 멘델 모델</p>
      {outcomes.map(outcome => <div key={outcome.alleles.join("/")} className={"probability-row" + (!outcome.viable ? " nonviable" : "")}>
        <div><code>{genotypeLabel({modelVersion:1,loci:{"lilly-white":outcome.alleles}})}</code><span>{label(outcome.alleles)}</span><strong>{percentage(outcome.probability)}</strong></div>
        <div className="probability-track"><i style={{width: percentage(outcome.probability)}} /></div>
      </div>)}
      <div className="conditional-probability"><h3>생존 개체 중의 조건부 확률</h3>
        {outcomes.filter(v => v.viable).map(v => <span key={v.alleles.join("/")}>{label(v.alleles)} <b>{percentage(v.viableProbability)}</b></span>)}
        <p>이론적 비율이며 알 2개에서 같은 비율을 보장하지 않습니다.</p></div>
    </div>
    {check.reasons.length ? <div className="game-warning" role="status"><strong>이 조합은 교배할 수 없습니다</strong>
      <ul>{check.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul></div> :
      <p className="game-safe">✓ 현재 모델의 위험 조합과 가까운 근친 관계 검사를 통과했습니다.</p>}
    <button type="button" className="game-primary full-width breed-button" disabled={busy || !check.allowed}
      onClick={async () => {
        if (father && mother && await act({type:"breed",fatherId:father.id,motherId:mother.id},"알 2개를 만들었습니다. 각 알의 유전 결과는 이미 저장되었습니다.")) onLaid();
      }}>교배하고 알 2개 생성</button>
    <div className="game-model-note"><strong>확률 모델과 게임 가정</strong><p>유전형 계산은 릴리화이트에만 적용합니다.
      체색·크림·패턴·반점과 성별·성장 기간은 게임용 근사 규칙입니다. 아잔틱과 카푸치노는 계산하지 않습니다.</p></div>
  </section>;
}
