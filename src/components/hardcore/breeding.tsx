"use client";
import { breedingCheck, ovulating, nextOvulation } from "@/game/hardcore/breeding";
import { owned } from "@/game/hardcore/survival";
import { Sprite, Hearts, SectionHeading, type ViewProps } from "./common";
import { morph } from "@/game/hardcore/adapter";
import { knowledgeLabel } from "@/genetics/advanced/inference";
import { publicKnowledge } from "@/game/hardcore/genetics";
import { GeneticForecast, GeneticsGuide } from "./genetics-panel";
import { addDays } from "@/game/hardcore/time";
import { ageTurns,lifeStage } from "@/game/hardcore/lifecycle";
export function Breeding({game,busy,play,onDetail,fatherId,motherId,onFather,onMother,onStarted}:ViewProps & {
  fatherId:string;motherId:string;onFather:(id:string)=>void;onMother:(id:string)=>void;onStarted:()=>void;
}) {
  const males = owned(game).filter(g=>g.sex === "male" && g.stage === "adult"), females = owned(game).filter(g=>g.sex === "female" && g.stage === "adult");
  const father = game.individuals[fatherId], mother = game.individuals[motherId], check = breedingCheck(game,fatherId,motherId);
  return <section className="hc-breeding"><SectionHeading title="브리딩" eyebrow="다음 세대의 시작" icon="dna"/><p className="game-section-copy">12~59턴 성체가 교배할 수 있습니다. 시즌 최대 3회 산란을 위해 자손 6칸을 예약합니다. 유전 결과는 교배 성공 시 확정하고, 첫 산란은 2턴 후입니다.</p>
    <div className="parent-picker-grid"><label>수컷 부모<select aria-label="수컷 부모" value={fatherId} onChange={e=>onFather(e.target.value)}><option value="">수컷 선택</option>{males.map(g=><option key={g.id} value={g.id}>{g.name} · Gen {g.generation}</option>)}</select></label>
      <label>암컷 부모<select aria-label="암컷 부모" value={motherId} onChange={e=>onMother(e.target.value)}><option value="">암컷 선택</option>{females.map(g=><option key={g.id} value={g.id}>{g.name} · {ovulating(g,game) ? "교배 가능" : "휴식·은퇴"}</option>)}</select></label></div>
    <div className="hc-grid">{[father,mother].map((g,index)=><div className="parent-summary" key={index}><span className="eyebrow">{index===0?"수컷 부모":"암컷 부모"}</span>{g ? <><div className="parent-art"><Sprite gecko={g}/></div><strong>{g.name}</strong><span>{morph(g)}</span><span>Gen {g.generation} · {ageTurns(game,g)}턴 · {lifeStage(game,g)}</span><Hearts gecko={g}/><span>{knowledgeLabel(publicKnowledge(g))}</span>{g.sex === "female" && <span>{ovulating(g,game) ? "교배 가능" : "다음 교배 가능 " + nextOvulation(g,game)}</span>}<button className="game-secondary full-width" onClick={()=>onDetail(g.id)}>상세 정보</button></> : <p>부모를 선택하세요</p>}</div>)}</div>
    <div className="hc-event"><strong>게임용 성공 확률</strong><span>알별 무정란 5% · 수정란 부화 성공 95% · 전체 알 기준 부화 90.25%</span></div>
    {father&&mother&&<GeneticForecast father={father} mother={mother}/>}
    {check.reasons.length>0 && <div className="game-warning">{check.reasons.map(r=><p key={r}>{r}</p>)}</div>}
    <button className="game-primary full-width breed-button" disabled={busy || !!check.reasons.length} onClick={async()=>{if(await play({type:"breed",fatherId,motherId})) onStarted();}}>교배 일정 시작 · 공간 6칸 예약</button>
    <ol className="hc-timeline"><li>첫 산란 +2턴 · {addDays(game.lastDate,14)}</li><li>추가 산란 +6 / +10턴 · 한 번에 2알</li><li>알별 부화 판정 산란 +4턴 · 첫 부화 {addDays(game.lastDate,42)}</li><li>성체 부화 +12턴 · 첫 성체 {addDays(game.lastDate,126)}</li><li>마지막 산란 +4턴까지 휴식 · 신규 교배 60턴 은퇴</li></ol>
    <div className="game-model-note">Lilly White와 동일 계통 Axanthic은 브리더 관찰 기반 작업 모델입니다. 복합 계통은 미검증입니다. 60개 가상 좌위의 외형 상속, 성별 50:50, 일정은 게임용 모델입니다.</div>
    <GeneticsGuide/>
  </section>;
}
