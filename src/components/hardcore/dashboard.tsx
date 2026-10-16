import { owned, reserved } from "@/game/hardcore/survival";
import {foodDemand} from "@/game/hardcore/lifecycle";
import { addDays } from "@/game/hardcore/time";
import type { ViewProps } from "./common";
import { Hearts } from "./common";

export function Dashboard({game,onDetail,onTab}: ViewProps & {onTab:(tab:string)=>void}) {
  const demand=foodDemand(game),animals = owned(game), danger = animals.filter(g=>g.hearts<=2);
  const matings = Object.values(game.matings).filter(m=>m.status === "pending" || m.status === "fertilized");
  const eggs = Object.values(game.eggs).filter(e=>e.status === "incubating");
  return <section><div className="game-section-heading"><div><span className="eyebrow">DAILY BREEDER</span><h1>오늘의 연구소</h1></div><span className="game-count-chip">{game.time.mode === "turn" ? "턴 방식" : "한국 시간"}</span></div>
    <div className="hc-daily-note"><strong>1턴 7일 · 먹이 면제 {demand.exempt}마리 · 필요 사료 {demand.needed}개</strong><p>사료가 부족하면 미급여 개체의 하트가 1 감소합니다. 하트 0이면 영구 폐사하며 혈통은 보존됩니다. 50턴부터 노령, 60턴부터 은퇴, 65턴부터 자연사 확률을 적용합니다.</p></div>
    {!animals.length && <div className="game-empty"><h2>작은 혈통의 시작</h2><p>상점에서 노멀 한 쌍을, 상단 먹이 +에서 사료를 준비하세요. 인큐베이터 슬롯 2개를 남겨 두면 첫 교배가 가능합니다.</p><button className="game-primary full-width" onClick={()=>onTab("shop")}>상점에서 시작하기</button></div>}
    <h2 className="lineage-subtitle">주의가 필요한 개체 <span>{danger.length}</span></h2>
    {danger.length ? danger.slice(0,12).map(g=><button className="hc-list-row" key={g.id} onClick={()=>onDetail(g.id)}><strong>{g.name}</strong><Hearts gecko={g}/><span>급여 필요</span></button>) : <p className="game-small-note">현재 하트 2 이하의 보유 개체가 없습니다.</p>}
    <h2 className="lineage-subtitle">다가오는 일정</h2>
    {matings.map(m=><div className="hc-event" key={m.id}><strong>{game.individuals[m.parents.motherId].name}</strong><span>{m.lifecycle?"다음 산란 TURN "+m.lifecycle.nextLayTurn:m.status === "pending" ? "수정 결과 " + addDays(m.date,1) : "산란 예정 " + addDays(m.date,2)}</span></div>)}
    {eggs.map(e=><div className="hc-event" key={e.id}><strong>알 · {e.id.split("-").slice(-3,-1).join("-")}</strong><span>부화 예정 {e.dueDate}</span></div>)}
    {!matings.length && !eggs.length && <p className="game-small-note">아직 진행 중인 번식 일정이 없습니다.</p>}
    <p className="game-small-note">생존 {animals.length}마리 · 새끼 공간 {reserved(game)}칸 예약 · {game.time.mode === "turn" ? "미접속 중에는 하루가 진행되지 않습니다." : "미접속 날짜도 순서대로 처리합니다."}</p>
  </section>;
}
