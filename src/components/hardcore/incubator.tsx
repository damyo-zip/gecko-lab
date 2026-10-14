"use client";
import { BreedingRecord } from "./genetics-panel";
import { useState } from "react";
import { Sprite, SectionHeading, type ViewProps } from "./common";
import { addDays } from "@/game/hardcore/time";
const MATING_LABEL = {pending:"수정 결과 대기",fertilized:"수정 성공",failed:"수정 실패",laid:"산란 완료",cancelled:"산란 전 취소"};
export function Incubator({game,onDetail}:ViewProps) {
  const [limit,setLimit] = useState(12);
  const eggs = Object.values(game.eggs).reverse(), matings = Object.values(game.matings).reverse();
  const records=matings.slice(0,limit).map(m=><div className="hc-event" key={m.id} data-testid={"mating-"+m.id}><strong>{game.individuals[m.parents.motherId].name} · {MATING_LABEL[m.status]}</strong><span>교배 {m.date}{m.lifecycle?` · 산란 ${m.lifecycle.clutchesLaid}/${m.lifecycle.maxClutches}${m.status==='fertilized'?' · 다음 산란 TURN '+m.lifecycle.nextLayTurn:''}`:m.status === "pending" ? " · 수정 확인 " + addDays(m.date,1) : m.status === "fertilized" ? " · 산란 " + addDays(m.date,2) : ""}</span><BreedingRecord mating={m} game={game}/></div>);
  return <section className="hc-incubator"><SectionHeading title="인큐베이터" eyebrow="새 생명을 기다리는 시간" icon="egg" count={eggs.length}/><p className="game-section-copy">1턴은 7일입니다. 알은 산란 후 정확히 4턴에 무정란/부화 결과를 판정하며 사료를 소비하지 않습니다. 유전형은 수정 시 확정하고 부화한 개체에 그대로 상속합니다.</p>
    <div className="hc-incubator-metrics"><div><span>부화 대기</span><strong>{eggs.filter(e=>e.status==="incubating").length}</strong></div><div><span>부화한 자손</span><strong>{eggs.filter(e=>e.status==="hatched").length}</strong></div></div>
    {!eggs.length && records}
    {!eggs.length && <p className="game-empty">아직 산란한 알이 없습니다.</p>}
    <div className="hc-grid">{eggs.slice(0,limit).map(e=><article className={"egg-card "+e.status} key={e.id} data-testid={"hc-egg-"+e.id}>
      <span className="hc-egg-status">{e.status==="hatched"?"부화 완료":e.status==="incubating"?"관찰 중":"결과 확정"}</span>
      {e.status === "hatched" ? <><div className="hc-hatch-art"><Sprite gecko={game.individuals[e.embryo.id]}/></div><h3>{game.individuals[e.embryo.id].name}</h3><span>부화 성공 · {e.resolvedDate}</span><button className="game-secondary" onClick={()=>onDetail(e.embryo.id)}>자손 이름과 상세 정보</button></> : <><div className="hc-egg-stage"><div className="pixel-egg"><i/><i/><i/><i/></div></div><h3>{e.status === "failed" ? e.lifecycle?.failure==='infertile'?"무정란":"부화 실패" : "부화 대기"}</h3><span>{e.status === "failed" ? "결과 확정 · 공간 해제" : "예정 " + e.dueDate}</span></>}
      <p>부모: {game.individuals[e.embryo.parents!.fatherId].name} × {game.individuals[e.embryo.parents!.motherId].name}</p><span>Gen {e.embryo.generation}</span>
    </article>)}</div>
    {eggs.length>0&&matings.length>0&&<section className="hc-mating-history"><h2>교배·산란 기록</h2>{records}</section>}
    {(eggs.length>limit || matings.length>limit) && <button className="game-secondary full-width" onClick={()=>setLimit(n=>n+12)}>이전 번식 기록 더 보기</button>}
  </section>;
}
