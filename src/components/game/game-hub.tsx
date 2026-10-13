"use client";

import { useState } from "react";
import type { GameAction } from "@/game/model";
import { useGame } from "@/hooks/use-game";
import { Icon } from "../icons";
import { Collection } from "./collection";
import { Breeding } from "./breeding";
import { Incubator } from "./incubator";
import { Lineage } from "./lineage";
import { IndividualDetails } from "./details";
import { GameSettings } from "./settings";

type Tab = "collection" | "breeding" | "incubator" | "lineage";
const TABS: {id:Tab;label:string;icon:"grid"|"dna"|"egg"|"tree"}[] = [
  {id:"collection",label:"컬렉션",icon:"grid"},{id:"breeding",label:"교배",icon:"dna"},
  {id:"incubator",label:"인큐베이터",icon:"egg"},{id:"lineage",label:"혈통도",icon:"tree"},
];
export default function GameHub() {
  const { game, loading, busy, error, conflict, act, replace } = useGame();
  const [tab,setTab] = useState<Tab>("collection");
  const [detailId,setDetailId] = useState("");
  const [lineageId,setLineageId] = useState("");
  const [fatherId,setFatherId] = useState(""), [motherId,setMotherId] = useState("");
  const [settings,setSettings] = useState(false), [notice,setNotice] = useState("");
  const play = async (action: GameAction, message: string) => {
    const success = await act(action);
    if (success) setNotice(message);
    return success;
  };
  const individual = game?.individuals[detailId];
  return <main className="lab-shell game-shell">
    <header className="site-header game-header"><a href="/" className="wordmark" aria-label="GECKO LAB 홈">
      <span className="logo-tile"><Icon name="leaf" size={24} /></span><span>GECKO <em>LAB</em><small>크레스티드 게코 브리딩 연구소</small></span></a>
      <button type="button" className="settings-button" aria-label="저장 및 게임 설정" disabled={loading || busy} onClick={() => setSettings(true)}><Icon name="sliders" size={21} /></button></header>
    <div className="game-toolbar">
      <div className="turn-counter"><span>TURN</span><b data-testid="game-turn">{game?.turn ?? "—"}</b>
        <small>{busy ? "저장 중…" : conflict ? "상태 갱신 필요" : game ? "자동 저장 완료" : "로컬 저장"}</small></div>
      <div className="turn-actions"><button type="button" className="game-secondary" disabled={!game || busy || conflict} onClick={() => play({type:"advance",turns:1},"게임 시간을 1턴 진행했습니다.")}>1턴 진행</button>
        <button type="button" className="game-secondary" disabled={!game || busy || conflict} onClick={() => play({type:"advance",turns:5},"게임 시간을 5턴 진행했습니다.")}>+5턴</button></div>
    </div>
    {error && <div className="game-error-banner" role="alert">{error}{conflict && <button type="button" className="game-secondary" onClick={() => window.location.reload()}>저장 상태 새로고침</button>}</div>}
    <p className="game-live-notice" role="status">{notice || (game ? "작은 시작, 이어지는 혈통. 다음 세대를 만나 보세요." : "이 기기의 저장 데이터를 확인하고 있습니다.")}</p>
    {loading ? <section className="game-loading"><Icon name="leaf" size={32} /><h1>연구소를 여는 중</h1><p>저장된 유전형과 혈통을 확인합니다.</p></section> :
      game ? <div className="game-tab-content" aria-busy={busy}>
        {tab === "collection" && <Collection game={game} onDetail={setDetailId} />}
        {tab === "breeding" && <Breeding game={game} busy={busy || conflict} act={play} fatherId={fatherId} motherId={motherId} onFather={setFatherId} onMother={setMotherId} onLaid={() => setTab("incubator")} />}
        {tab === "incubator" && <Incubator game={game} onDetail={setDetailId} />}
        {tab === "lineage" && <Lineage game={game} selectedId={lineageId} onSelect={setLineageId} onDetail={setDetailId} />}
      </div> : <section className="game-loading"><h1>저장 데이터를 불러오지 못했습니다</h1><p>기존 저장을 자동으로 덮어쓰지 않았습니다. 백업을 복원하거나 새 게임으로 복구할 수 있습니다.</p>
        <button type="button" className="game-primary" onClick={() => setSettings(true)}>백업 복원 또는 새 게임</button></section>}
    <div className="game-footer-note"><a href="/lab">Phase 1 스프라이트 연구실 ↗</a><span>저장 v2 · 규칙 v1</span></div>
    <nav className="game-bottom-nav" aria-label="게임 탭">{TABS.map(value => <button type="button" key={value.id} aria-pressed={tab === value.id}
      disabled={!game || busy} onClick={() => setTab(value.id)}><Icon name={value.icon} size={23} /><span>{value.label}</span></button>)}</nav>
    {game && individual && <IndividualDetails key={individual.id} individual={individual} game={game} busy={busy || conflict} act={play}
      onClose={() => setDetailId("")} onDetail={setDetailId} onBreed={() => {
        if (individual.sex === "male") setFatherId(individual.id); else setMotherId(individual.id);
        setTab("breeding"); setDetailId("");
      }} onLineage={() => {setLineageId(individual.id);setTab("lineage");setDetailId("");}} />}
    {settings && <GameSettings game={game} busy={busy || conflict} error={error} replace={replace} onClose={() => setSettings(false)}
      onReplaced={() => {setSettings(false);setDetailId("");setFatherId("");setMotherId("");setLineageId("");setTab("collection");setNotice("저장 데이터를 교체했습니다.");}} />}
  </main>;
}
