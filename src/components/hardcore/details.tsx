"use client";
import {displayAge} from '@/game/hardcore/family-album';
import { KnowledgePanel, AdvancedTraits } from "./genetics-panel";
import { useState } from "react";
import { Dialog, Sprite, Hearts, STATUS, won, type ViewProps } from "./common";
import type { Gecko } from "@/game/hardcore/model";
import { disclosedSex, visualName, morphDescription } from "@/game/hardcore/adapter";
import {koreanMorphText} from "@/phenotype/display-name";
import { knowledgeLabel } from "@/genetics/advanced/inference";
import { publicKnowledge } from "@/game/hardcore/genetics";
import {saleRestriction} from "@/game/hardcore/economy";
import { valueGecko } from "@/game/hardcore/market";
import { feedable } from "@/game/hardcore/survival";
import { STAGE_LABELS } from "@/game/model";
import { isV12,ageTurns,lifeStage,lifecycleRules,isMonthly } from "@/game/hardcore/lifecycle";
import { TRAIT_KEYS, TRAIT_LABELS } from "@/genetics/traits";
import { PatternInfo } from "./pattern-info";
export function Details({gecko:g,game,busy,play,onDetail,onClose,onBreed,onLineage}:ViewProps & {
  gecko:Gecko;onClose:()=>void;onBreed:()=>void;onLineage:()=>void;
}) {
  const [name,setName] = useState(g.name), [confirm,setConfirm] = useState(false);
  const [fire,setFire]=useState<"up"|"down">("up");
  const quote = valueGecko(g), sale = game.sales.find(s=>s.individualId===g.id);
  const pending = !!saleRestriction(game,g);
  return <Dialog title={g.name + " 상세"} onClose={onClose}>
    <div className="hc-detail-meta"><span>Gen {g.generation}</span><span>{STATUS[g.status]}</span><span>{disclosedSex(g)} · {STAGE_LABELS[g.stage]}</span></div>
    <div className="detail-art"><Sprite gecko={g} large fire={fire}/></div><div className="hc-condition-row"><span>컨디션</span><Hearts gecko={g}/></div>
    <button className="game-secondary full-width" onClick={()=>setFire(fire==="up"?"down":"up")}>파이어 {fire==="up"?"다운":"업"} 미리 보기</button>
    <form className="name-form" onSubmit={async e=>{e.preventDefault();await play({type:"rename",id:g.id,name});}}><label htmlFor="hc-name">개체 이름</label><div><input id="hc-name" maxLength={24} value={name} onChange={e=>setName(e.target.value)} required/><button className="game-secondary" disabled={busy}>이름 저장</button></div></form>
    <dl className="detail-facts">{isV12(game)&&<><div><dt>나이 · 수명</dt><dd>{displayAge(game,g)} · {lifeStage(game,g)} · {isMonthly(game)?"12세 노령 / 15세 은퇴 / 18세 자연사":"50턴 노령 / 60턴 은퇴"}</dd></div><div><dt>사료</dt><dd>{g.status==="pedigree"?"외부 부모 기록 · 급여 대상 아님":g.status==="owned"?"자동 급여 · 도전 2개마다 사료 1마리분 면제":"현재 급여 대상 아님"}</dd></div>{g.status==="dead"&&<div><dt>사망 원인</dt><dd>{g.deathCause==="natural"?"노령 자연사":"사료 부족·컨디션 소진"}</dd></div>}</>}<div><dt>상태</dt><dd>{STATUS[g.status]}{g.diedDate ? " · " + g.diedDate : ""}</dd></div><div><dt>성별 · 성장</dt><dd>{disclosedSex(g)} · {STAGE_LABELS[g.stage]}</dd></div><div><dt>모프</dt><dd data-testid="detail-morph">{visualName(g)}</dd></div><div><dt>전체 외형 분류</dt><dd data-testid="detail-morph-description">{morphDescription(g)}</dd></div><div><dt>공개 유전 정보</dt><dd>{koreanMorphText(knowledgeLabel(publicKnowledge(g)))}</dd></div><div><dt>세대 · 출생</dt><dd>Gen {g.generation} · {g.birthDate}</dd></div><div><dt>고유 ID</dt><dd className="id-text">{g.id}</dd></div><div><dt>혈통명</dt><dd>{g.lineageIds.map(id=>game.lineages[id].name).join(" / ") || "미지정"}</dd></div><div><dt>혈통 자료</dt><dd>{g.provenance === "known" ? "게임 내 부모·유전 기록" : "부모 혈통 미확인"}</dd></div><div><dt>시장 기준가</dt><dd>{won(quote.marketBase)} · 임시 추정</dd></div><div><dt>게임 평가액</dt><dd>{won(quote.valuation)}</dd></div><div><dt>분양 예상가</dt><dd>{won(quote.sell)}</dd></div>{sale && <div><dt>분양 이력</dt><dd>{sale.date} · {won(sale.price)}<br/>{sale.marketVersion}</dd></div>}</dl>
    <PatternInfo gecko={g}/><KnowledgePanel knowledge={publicKnowledge(g)} legacy={!g.genetics?.genome}/><AdvancedTraits gecko={g}/>
    {g.parents && <div className="detail-parentage"><h3>부모</h3><div>{[g.parents.fatherId,g.parents.motherId].map(id=><button className="game-secondary" key={id} onClick={()=>onDetail(id)}>{game.individuals[id].name} · {STATUS[game.individuals[id].status]}</button>)}</div></div>}
    <details className="hc-traits"><summary>게임용 잠재 외형</summary>{TRAIT_KEYS.map(k=><div key={k}><span>{TRAIT_LABELS[k]}</span><progress value={g.potential[k]} max={1}/><b>{Math.round(g.potential[k]*100)}</b></div>)}<p className="game-small-note">렌더러 입력으로 변환한 외형 점수입니다. 이전 개체는 평균·변이 모델, 신규 개체는 가상 대립유전자 모델을 사용합니다.</p></details>
    {g.status === "owned" && <>{!isV12(game)&&<button className="game-primary full-width" disabled={busy || !game.food || !feedable(game,g)} onClick={()=>play({type:"feed",id:g.id})}>먹이 1개 급여</button>}<button className="game-secondary full-width" disabled={busy || g.stage !== "adult" || (isV12(game)&&ageTurns(game,g)>=lifecycleRules(game).retireAfter)} onClick={onBreed}>부모로 선택</button>
      {confirm ? <div className="game-warning"><p>즉시 분양하면 보유 사육장에서 나갑니다. {game.compact?"분양 요약 기록이 남습니다.":"혈통 기록과 당시 가격은 남습니다."} 분양가 {won(quote.sell)}</p><div className="confirm-actions"><button className="game-secondary" onClick={()=>setConfirm(false)}>취소</button><button className="game-primary" disabled={busy || pending} onClick={async()=>{if(await play({type:"sell",id:g.id})) setConfirm(false);}}>분양 확정</button></div></div> : <button className="game-secondary full-width" disabled={busy || pending} onClick={()=>setConfirm(true)}>분양 준비 · {won(quote.sell)}</button>}
      {pending && <p className="game-small-note">산란 전 일정이 있는 암컷은 분양할 수 없습니다.</p>}</>}
    <button className="game-secondary full-width" onClick={onLineage}>{game.compact?"남아 있는 가족 정보 보기":"영구 혈통 기록 보기"}</button>
  </Dialog>;
}
