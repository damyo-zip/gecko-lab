"use client";
import { useMemo, useState } from "react";
import type { AllelePair } from "@/genetics/mendel";
import { beliefLabel, carrierProbability, knowledgeLabel, SOURCE_LABELS } from "@/genetics/advanced/inference";
import { cross } from "@/genetics/advanced/inheritance";
import { LOCI, wildGenome } from "@/genetics/advanced/loci";
import { FEATURES, type Knowledge } from "@/genetics/advanced/model";
import { FEATURE_LABELS, polyScores } from "@/genetics/advanced/polygenic";
import { inheritedPossibleHet, publicForecast, publicKnowledge, traitForecast } from "@/game/hardcore/genetics";
import type { Gecko, HardcoreGame, Mating } from "@/game/hardcore/model";
import { morph } from "@/game/hardcore/adapter";

export function KnowledgePanel({knowledge,legacy=false}:{knowledge:Knowledge;legacy?:boolean}) {
  return <div className="genetic-panel" data-testid="public-genetics"><p>{knowledgeLabel(knowledge)}</p>
    {legacy&&<p className="game-small-note">이전 외형 모델 유지 · 과거 가상 대립유전자는 복원할 수 없어 미확인입니다.</p>}
    {LOCI.map(l=>{const b=knowledge.loci[l.id];return <details key={l.id}><summary>{l.name} · {beliefLabel(l.id,b)}</summary>
      <p>{SOURCE_LABELS[b.source]} · {b.note}</p>
      {b.probabilities&&<p>{Object.entries(b.probabilities).map(([k,p])=>k+" "+(p*100).toFixed(1)+"%").join(" · ")}</p>}
      <p className="game-small-note">{l.evidence.claim} {l.evidence.disagreements}</p><p className="game-small-note">{l.evidence.safety}</p>
      <p className="game-small-note">검토 {l.evidence.reviewed} · {l.evidence.level==="provisional"?"잠정 브리더 모델":"브리더 관찰 모델"}</p>
      {l.evidence.sources.map(url=><a href={url} key={url} target="_blank" rel="noreferrer">자료 {new URL(url).hostname}</a>)}
    </details>;})}
  </div>;
}
export function AdvancedTraits({gecko}:{gecko:Gecko}) {
  if(!gecko.genetics?.genome)return <p className="game-small-note">이전 개체는 기존 잠재 외형을 유지합니다. 평균·변이 모델을 가상 대립유전자 상속 결과로 주장하지 않습니다.</p>;
  const scores=polyScores(gecko.genetics.genome.polygenic);
  return <details className="hc-traits"><summary>외형 형질 10종 · 게임용 다유전자 모델</summary>
    {FEATURES.map(k=><div key={k}><span>{FEATURE_LABELS[k]}</span><progress max={1} value={scores[k]}/><b>{Math.round(scores[k]*100)}</b></div>)}
    <p className="game-small-note">부모에게서 가상 대립유전자를 상속합니다. 점수는 실제 DNA 검사나 멘델 확률이 아닙니다. 파이어업·성장 상태가 유전형을 바꾸지는 않습니다.</p>
  </details>;
}
export function GeneticForecast({father,mother}:{father:Gecko;mother:Gecko}) {
  const odds=publicForecast(publicKnowledge(father),publicKnowledge(mother));
  const traits=useMemo(()=>traitForecast(father,mother),[father,mother]);
  const possible=inheritedPossibleHet(publicKnowledge(father),publicKnowledge(mother));
  return <div className="genetics-forecast" data-testid="hardcore-forecast"><h2>공개 정보에 따른 자손 예상</h2>
    <p className="game-small-note">미확인 부모는 확률을 단정하지 않습니다. 아래 확률은 공개된 부모 정보에 조건부로 계산하며 수정·부화 성공률과 다릅니다.</p>
    {odds.map(({locus:l,outcomes})=><details key={l.id} open={l.id!=="cappuccino-complex"}><summary>{l.name}</summary>
      {outcomes?outcomes.map(o=><div className={"hc-probability "+(!o.safe?"danger":"")} key={o.key}><span><code>{o.key}</code> · {o.phenotype}</span><span>{l.nonViable.includes(o.key)?"비생존 · ":""}{Number((o.probability*100).toFixed(1))}%{!o.safe?" · 위험":""}</span></div>):<p>부모 정보 부족 · 확률 미확인</p>}
      {outcomes&&l.evidence.level!=="provisional"&&<p className="game-small-note">이 좌위의 비생존만 제외한 조건부 비율: {outcomes.filter(o=>o.viableProbability>0).map(o=>o.key+" "+(o.viableProbability*100).toFixed(1)+"%").join(" · ")}</p>}
      {l.evidence.level==="provisional"&&<p className="game-small-note">건강 위험은 보고·미검증 상태입니다. 이론적 대립유전자 비율이며, 치사 확률이나 실제 생존 자손 비율은 계산하지 않습니다.</p>}
    </details>)}
    {possible!==null&&<p data-testid="possible-het-forecast">Normal 외형 자손: {(possible*100).toFixed(1)}% possible het Ax</p>}
    {traits&&<details><summary>외형 예상 범위 · 게임 시뮬레이션</summary>{FEATURES.map(k=><div className="hc-probability" key={k}><span>{FEATURE_LABELS[k]}</span><span>{Math.round(traits.min[k]*100)}~{Math.round(traits.max[k]*100)}</span></div>)}<p className="game-small-note">128개 고정 표본의 범위이며 정확한 멘델 확률이나 모든 가능한 결과의 상·하한은 아닙니다.</p></details>}
  </div>;
}
export function BreedingRecord({mating:m,game}:{mating:Mating;game:HardcoreGame}) {
  const log=m.genetics;
  return <details className="genetic-panel"><summary>교배 당시 예측·자손·추론 기록</summary>
    {log?<><p>수컷 당시: {knowledgeLabel(log.father.knowledge)}</p><p>암컷 당시: {knowledgeLabel(log.mother.knowledge)}</p>
      {publicForecast(log.father.knowledge,log.mother.knowledge).map(({locus,outcomes})=><p key={locus.id}>{locus.name}: {outcomes?outcomes.map(o=>o.phenotype+" "+(o.probability*100).toFixed(1)+"%").join(" · "):"확률 미확인"}</p>)}
      {log.updates.map((u,i)=><p key={i} data-testid="inference-update">{game.individuals[u.id].name} · Ax 보인 가능성 {formatCarrier(u.before)} → {formatCarrier(u.after)}<br/>자손 검증 · {(carrierProbability(u.after)??0)>1-1e-9?"보인자 확인":"미발현만으로 비보인자 확정하지 않음"}</p>)}
    </>:<p>이전 버전 교배 · 당시 공개 정보 스냅샷 없음</p>}
    {Object.values(game.eggs).filter(e=>e.matingId===m.id).map(e=><p key={e.id}>{e.status==="hatched"?game.individuals[e.embryo.id].name+" · "+morph(game.individuals[e.embryo.id]):e.status==="failed"?"부화 실패 · 관찰 증거 제외":"부화 전 · 결과 미공개"}</p>)}
  </details>;
}
function formatCarrier(k:Knowledge){const p=carrierProbability(k);return p===null?"미확인":(p*100).toFixed(1)+"%";}
export function GeneticsGuide() {
  const entries=[["우성·열성","우성은 한 사본에서도 표현됩니다. 열성은 두 사본이 있어야 표현되며 한 사본 보인자는 외형상 Normal일 수 있습니다."],
    ["이형·동형접합","한 좌위의 두 대립유전자가 다르면 이형, 같으면 동형입니다."],["불완전 우성","한 사본과 두 사본의 표현형이 다릅니다. Lilly 두 사본은 비생존 위험으로 교배 전 경고하고 해당 배아는 부화하지 않습니다."],
    ["Possible het","알려진 부모·외형으로 계산한 보인 가능성입니다. Aa×Aa의 Normal 자손은 2/3, Aa×AA는 1/2입니다. 모든 노멀에 같은 확률을 적용하지 않습니다."],
    ["자손 검증","확인된 aa와 교배해 aa 자손이 나오면 열성 사본이 확인됩니다. Normal 자손 몇 마리만으로 비보인자로 단정할 수 없습니다."],
    ["다유전자·선택교배","외형 10종은 가상 유전자의 게임 모델입니다. 원하는 외형 개체를 선택하면 대립유전자 분포가 바뀌며 세대 자체는 점수를 올리지 않습니다."],
    ["안전과 근거","Cappuccino·Sable·Highway 같은 좌위는 잠정 브리더 모델입니다. 위험 조합을 계산기로 볼 수 있지만 게임 교배는 확인 후 허용합니다. 아잔틱은 한 호환 라인만 다룹니다."]];
  return <details className="genetic-panel"><summary>유전학 도감</summary>{entries.map(([title,body])=><details key={title}><summary>{title}</summary><p>{body}</p></details>)}<AlleleCalculator/></details>;
}
function AlleleCalculator() {
  const [father,setFather]=useState(wildGenome),[mother,setMother]=useState(wildGenome);
  const result=cross(father,mother);
  return <details><summary>독립 좌위 학습 계산기</summary><p className="game-small-note">선택한 확정 유전형의 이론 계산입니다. 게임 개체의 숨은 진실을 공개하거나 게임 개체를 변경하지 않습니다.</p>
    {LOCI.map(l=>{const options=Object.keys(l.phenotypes);return <div className="parent-picker-grid" key={l.id}>{[[father,setFather,"수컷"],[mother,setMother,"암컷"]].map(([g,set,label],i)=>{const genome=g as typeof father,setGenome=set as typeof setFather;
      const key=[...genome.loci[l.id]].sort((a,b)=>l.alleles.indexOf(a)-l.alleles.indexOf(b)).join("/");
      return <label key={i}>{l.name} · {label as string}<select aria-label={l.id+" "+label} value={key} onChange={e=>setGenome({...genome,loci:{...genome.loci,[l.id]:e.target.value.split("/") as unknown as AllelePair}})}>{options.map(k=><option key={k} value={k}>{k} · {l.phenotypes[k]}</option>)}</select></label>;
    })}</div>;})}
    {result.phenotypes.map(p=><div className="hc-probability" key={p.label}><span>{p.label}</span><span>{(p.probability*100).toFixed(1)}%</span></div>)}
    <p>수정 시점 비생존 {(result.nonViableProbability*100).toFixed(1)}% · 주의 조합 발생 {(result.blockedProbability*100).toFixed(1)}%</p>
    <p className="game-small-note">건강 위험의 정확한 사망 확률은 계산하지 않습니다. 연관 유전 없음 · 독립 좌위 가정.</p>
  </details>;
}
