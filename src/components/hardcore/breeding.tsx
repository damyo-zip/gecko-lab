"use client";
import { breedingCheck, ovulating, nextOvulation } from "@/game/hardcore/breeding";
import { owned } from "@/game/hardcore/survival";
import { Sprite, Hearts, type ViewProps } from "./common";
import { morph } from "@/game/hardcore/adapter";
import { knowledgeLabel } from "@/genetics/advanced/inference";
import { publicKnowledge } from "@/game/hardcore/genetics";
import { GeneticForecast, GeneticsGuide } from "./genetics-panel";
import { addDays } from "@/game/hardcore/time";
export function Breeding({game,busy,play,onDetail,fatherId,motherId,onFather,onMother,onStarted}:ViewProps & {
  fatherId:string;motherId:string;onFather:(id:string)=>void;onMother:(id:string)=>void;onStarted:()=>void;
}) {
  const males = owned(game).filter(g=>g.sex === "male" && g.stage === "adult"), females = owned(game).filter(g=>g.sex === "female" && g.stage === "adult");
  const father = game.individuals[fatherId], mother = game.individuals[motherId], check = breedingCheck(game,fatherId,motherId);
  return <section><h1>브리딩</h1><p className="game-section-copy">성체 암컷의 배란기에 교배합니다. 지금 새끼 2마리 공간을 예약하고, 다음 게임 날부터 결과를 확인합니다.</p>
    <div className="parent-picker-grid"><label>수컷 부모<select aria-label="수컷 부모" value={fatherId} onChange={e=>onFather(e.target.value)}><option value="">수컷 선택</option>{males.map(g=><option key={g.id} value={g.id}>{g.name} · Gen {g.generation}</option>)}</select></label>
      <label>암컷 부모<select aria-label="암컷 부모" value={motherId} onChange={e=>onMother(e.target.value)}><option value="">암컷 선택</option>{females.map(g=><option key={g.id} value={g.id}>{g.name} · {ovulating(g,game) ? "배란기" : "대기"}</option>)}</select></label></div>
    <div className="hc-grid">{[father,mother].map((g,index)=><div className="parent-summary" key={index}>{g ? <><div className="parent-art"><Sprite gecko={g}/></div><strong>{g.name}</strong><span>{morph(g)}</span><span>Gen {g.generation}</span><Hearts gecko={g}/><span>{knowledgeLabel(publicKnowledge(g))}</span>{g.sex === "female" && <span>{ovulating(g,game) ? "배란 중" : "다음 배란 " + nextOvulation(g,game)}</span>}<button className="game-secondary full-width" onClick={()=>onDetail(g.id)}>상세 정보</button></> : <p>부모를 선택하세요</p>}</div>)}</div>
    <div className="hc-event"><strong>게임용 성공 확률</strong><span>수정 {Math.round(game.rules.fertilizationChance*100)}% · 알별 부화 {Math.round(game.rules.hatchChance*100)}%</span></div>
    {father&&mother&&<GeneticForecast father={father} mother={mother}/>}
    {check.reasons.length>0 && <div className="game-warning">{check.reasons.map(r=><p key={r}>{r}</p>)}</div>}
    <button className="game-primary full-width breed-button" disabled={busy || !!check.reasons.length} onClick={async()=>{if(await play({type:"breed",fatherId,motherId})) onStarted();}}>교배 일정 시작 · 공간 2칸 예약</button>
    <ol className="hc-timeline"><li>수정 확인 {addDays(game.lastDate,1)}</li><li>산란 예정 {addDays(game.lastDate,2)}</li><li>부화 예정 {addDays(game.lastDate,3)}</li><li>성체 예정 {addDays(game.lastDate,3+game.rules.adultAfter)}</li></ol>
    <div className="game-model-note">Lilly White와 동일 계통 Axanthic은 브리더 관찰 기반 작업 모델입니다. 복합 계통은 미검증입니다. 60개 가상 좌위의 외형 상속, 성별 50:50, 일정은 게임용 모델입니다.</div>
    <GeneticsGuide/>
  </section>;
}
