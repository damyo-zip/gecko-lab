"use client";
import { BreedingRecord } from "./genetics-panel";
import { useState } from "react";
import { Sprite, type ViewProps } from "./common";
import { addDays } from "@/game/hardcore/time";
const MATING_LABEL = {pending:"수정 결과 대기",fertilized:"수정 성공",failed:"수정 실패",laid:"산란 완료",cancelled:"산란 전 취소"};
export function Incubator({game,onDetail}:ViewProps) {
  const [limit,setLimit] = useState(12);
  const eggs = Object.values(game.eggs).reverse(), matings = Object.values(game.matings).reverse();
  return <section><h1>인큐베이터</h1><p className="game-section-copy">게임에서 하루가 지날 때 수정·산란·부화가 차례로 진행됩니다. 알의 유전형은 산란 때 확정되며 부화할 때 다시 추첨하지 않습니다.</p>
    {matings.slice(0,limit).map(m=><div className="hc-event" key={m.id} data-testid={"mating-"+m.id}><strong>{game.individuals[m.parents.motherId].name} · {MATING_LABEL[m.status]}</strong><span>교배 {m.date}{m.status === "pending" ? " · 수정 확인 " + addDays(m.date,1) : m.status === "fertilized" ? " · 산란 " + addDays(m.date,2) : ""}</span><BreedingRecord mating={m} game={game}/></div>)}
    {!eggs.length && <p className="game-empty">아직 산란한 알이 없습니다.</p>}
    <div className="hc-grid">{eggs.slice(0,limit).map(e=><article className="egg-card" key={e.id} data-testid={"hc-egg-"+e.id}>
      {e.status === "hatched" ? <><Sprite gecko={game.individuals[e.embryo.id]}/><h3>{game.individuals[e.embryo.id].name}</h3><span>부화 성공 · {e.resolvedDate}</span><button className="game-secondary" onClick={()=>onDetail(e.embryo.id)}>자손 이름과 상세 정보</button></> : <><div className="pixel-egg"><i/><i/><i/><i/></div><h3>{e.status === "failed" ? "부화 실패" : "부화 대기"}</h3><span>{e.status === "failed" ? "결과 확정 · 공간 해제" : "예정 " + e.dueDate}</span></>}
      <p>부모: {game.individuals[e.embryo.parents!.fatherId].name} × {game.individuals[e.embryo.parents!.motherId].name}</p><span>Gen {e.embryo.generation}</span>
    </article>)}</div>
    {(eggs.length>limit || matings.length>limit) && <button className="game-secondary full-width" onClick={()=>setLimit(n=>n+12)}>이전 번식 기록 더 보기</button>}
  </section>;
}
