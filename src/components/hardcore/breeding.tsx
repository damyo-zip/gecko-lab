"use client";
import { breedingCheck, ovulating, nextOvulation } from "@/game/hardcore/breeding";
import { owned } from "@/game/hardcore/survival";
import { Sprite, Hearts, type ViewProps } from "./common";
import { morph } from "@/game/hardcore/adapter";
import { geneticLabel } from "@/genetics/hardcore";
import { addDays } from "@/game/hardcore/time";
export function Breeding({game,busy,play,onDetail,fatherId,motherId,onFather,onMother,onStarted}:ViewProps & {
  fatherId:string;motherId:string;onFather:(id:string)=>void;onMother:(id:string)=>void;onStarted:()=>void;
}) {
  const males = owned(game).filter(g=>g.sex === "male" && g.stage === "adult"), females = owned(game).filter(g=>g.sex === "female" && g.stage === "adult");
  const father = game.individuals[fatherId], mother = game.individuals[motherId], check = breedingCheck(game,fatherId,motherId);
  return <section><h1>브리딩</h1><p className="game-section-copy">성체 암컷의 배란기에 교배합니다. 지금 새끼 2마리 공간을 예약하고, 내일부터 결과를 확인합니다.</p>
    <div className="parent-picker-grid"><label>수컷 부모<select aria-label="수컷 부모" value={fatherId} onChange={e=>onFather(e.target.value)}><option value="">수컷 선택</option>{males.map(g=><option key={g.id} value={g.id}>{g.name} · Gen {g.generation}</option>)}</select></label>
      <label>암컷 부모<select aria-label="암컷 부모" value={motherId} onChange={e=>onMother(e.target.value)}><option value="">암컷 선택</option>{females.map(g=><option key={g.id} value={g.id}>{g.name} · {ovulating(g,game) ? "배란기" : "대기"}</option>)}</select></label></div>
    <div className="hc-grid">{[father,mother].map((g,index)=><div className="parent-summary" key={index}>{g ? <><div className="parent-art"><Sprite gecko={g}/></div><strong>{g.name}</strong><span>{morph(g)}</span><span>Gen {g.generation}</span><Hearts gecko={g}/><span>{geneticLabel(g.genotype)}</span>{g.sex === "female" && <span>{ovulating(g,game) ? "배란 중" : "다음 배란 " + nextOvulation(g,game)}</span>}<button className="game-secondary full-width" onClick={()=>onDetail(g.id)}>상세 정보</button></> : <p>부모를 선택하세요</p>}</div>)}</div>
    <div className="hc-event"><strong>게임용 성공 확률</strong><span>수정 {Math.round(game.rules.fertilizationChance*100)}% · 알별 부화 {Math.round(game.rules.hatchChance*100)}%</span></div>
    {check.forecast && <div className="genetics-forecast" data-testid="hardcore-forecast"><h2>수정 시점의 유전형 확률</h2>
      {check.forecast.loci.map(l=><div key={l.definition.id}><h3>{l.definition.name}</h3>{l.outcomes.map(o=><div className={"hc-probability " + (!o.viable ? "danger" : "")} key={o.alleles.join()}><code>{o.alleles.join("/")}</code><span>{o.viable ? "" : "비생존 · "}{o.probability*100}%</span></div>)}
        <p className="game-small-note">생존 개체 중 조건부 비율: {l.outcomes.filter(o=>o.viable).map(o=>o.alleles.join("/")+" "+(o.viableProbability*100).toFixed(1)+"%").join(" · ")}</p></div>)}
      <p className="game-small-note">생존 조건부 비율과 수정 시점의 비율을 구분합니다. 수정/부화 성공률은 생물학 통계가 아닌 게임 설정입니다.</p></div>}
    {check.reasons.length>0 && <div className="game-warning">{check.reasons.map(r=><p key={r}>{r}</p>)}</div>}
    <button className="game-primary full-width breed-button" disabled={busy || !!check.reasons.length} onClick={async()=>{if(await play({type:"breed",fatherId,motherId})) onStarted();}}>교배 일정 시작 · 공간 2칸 예약</button>
    <ol className="hc-timeline"><li>수정 확인 {addDays(game.lastDate,1)}</li><li>산란 예정 {addDays(game.lastDate,2)}</li><li>부화 예정 {addDays(game.lastDate,3)}</li><li>성체 예정 {addDays(game.lastDate,3+game.rules.adultAfter)}</li></ol>
    <div className="game-model-note">Lilly White와 동일 계통 Axanthic은 브리더 관찰 기반 작업 모델입니다. 복합 계통은 미검증입니다. 연속 외형 형질과 성별 50:50, 일정은 게임용 근사입니다.</div>
  </section>;
}
