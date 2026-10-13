"use client";
import { useState } from "react";
import { useHardcore } from "@/hooks/use-hardcore";
import { owned, reserved } from "@/game/hardcore/survival";
import { Icon } from "../icons";
import { Dashboard } from "./dashboard";
import { Collection } from "./collection";
import { Breeding } from "./breeding";
import { Incubator } from "./incubator";
import { Shop } from "./shop";
import { Lineage } from "./lineage";
import { Details } from "./details";
import { Settings } from "./settings";
import { won } from "./common";
import { OfflineShell } from "./offline";
const TABS = [{id:"home",label:"오늘",icon:"leaf"},{id:"collection",label:"컬렉션",icon:"grid"},{id:"breeding",label:"교배",icon:"dna"},{id:"incubator",label:"부화",icon:"egg"},{id:"shop",label:"상점",icon:"sliders"},{id:"lineage",label:"혈통",icon:"tree"}] as const;
export default function HardcoreHub() {
  const {game,loading,busy,error,conflict,act,replace}=useHardcore();
  const [tab,setTab]=useState("home"),[detail,setDetail]=useState(""),[settings,setSettings]=useState(false);
  const [father,setFather]=useState(""),[mother,setMother]=useState(""),[lineage,setLineage]=useState("");
  const g=game?.individuals[detail],disabled=busy||conflict;
  const props=game ? {game,busy:disabled,play:act,onDetail:setDetail} : null;
  return <main className="lab-shell game-shell hc-shell"><OfflineShell/><header className="site-header game-header"><a href="/" className="wordmark" aria-label="GECKO LAB 홈"><span className="logo-tile"><Icon name="leaf" size={24}/></span><span>GECKO <em>LAB</em><small>매일 돌보고, 세대를 이어가는 브리더</small></span></a><button className="settings-button" aria-label="저장 및 게임 설정" disabled={loading||busy} onClick={()=>setSettings(true)}><Icon name="sliders" size={21}/></button></header>
    <div className="hc-clock"><strong data-testid="game-date">{game?.lastDate ?? "—"}</strong><span>Asia/Seoul · 매일 00:00</span><small>{busy ? "저장 중…" : conflict ? "다른 창의 변경 확인 필요" : game ? "자동 저장 완료" : "로컬 저장 확인"}</small></div>
    {game && <div className="hc-stats"><div><span>게임 자금</span><b data-testid="game-money">{won(game.money)}</b></div><div><span>먹이</span><b data-testid="game-food">{game.food}개</b></div><div><span>사육장 / 예약</span><b>{owned(game).length}+{reserved(game)} / {game.capacity}</b></div></div>}
    {error && <div className="game-error-banner" role="alert">{error}{conflict && <button className="game-secondary full-width" onClick={()=>location.reload()}>저장 상태 새로고침</button>}</div>}
    {game && game.notices.length>0 && <div className="hc-notices" role="status">{game.notices.slice(-5).map((n,i)=><p key={i}>{n}</p>)}</div>}
    {loading ? <section className="game-loading"><h1>연구소를 여는 중</h1><p>날짜와 저장된 혈통을 확인합니다.</p></section> : props ? <div className="game-tab-content" aria-busy={busy}>
      {tab==="home" && <Dashboard {...props} onTab={setTab}/>}{tab==="collection" && <Collection {...props}/>}
      {tab==="breeding" && <Breeding {...props} fatherId={father} motherId={mother} onFather={setFather} onMother={setMother} onStarted={()=>setTab("incubator")}/>}
      {tab==="incubator" && <Incubator {...props}/>}{tab==="shop" && <Shop {...props}/>}
      {tab==="lineage" && <Lineage {...props} selectedId={lineage} onSelect={setLineage}/>}
    </div> : <section className="game-loading"><h1>저장 데이터를 불러오지 못했습니다</h1><p>기존 저장을 덮어쓰지 않았습니다. 복구 전 원본을 아카이브에 남깁니다.</p><button className="game-primary" onClick={()=>setSettings(true)}>백업 복원 또는 새 게임</button></section>}
    <footer className="game-footer-note"><a href="/lab">스프라이트 연구실 ↗</a><span>저장 v3 · 가격표는 현재 임시 추정</span></footer>
    <nav className="game-bottom-nav hc-nav" aria-label="게임 탭">{TABS.map(t=><button key={t.id} aria-pressed={tab===t.id} disabled={!game||disabled} onClick={()=>setTab(t.id)}><Icon name={t.icon} size={21}/><span>{t.label}</span></button>)}</nav>
    {props && g && <Details key={g.id} {...props} gecko={g} onClose={()=>setDetail("")} onBreed={()=>{if(g.sex==="male")setFather(g.id);else setMother(g.id);setDetail("");setTab("breeding");}} onLineage={()=>{setLineage(g.id);setDetail("");setTab("lineage");}}/>}
    {settings && <Settings game={game} busy={disabled} error={error} replace={replace} onClose={()=>setSettings(false)} onReplaced={()=>{setSettings(false);setDetail("");setFather("");setMother("");setLineage("");setTab("home");}}/>}
  </main>;
}
