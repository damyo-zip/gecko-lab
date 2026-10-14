"use client";
import { useState } from "react";
import { ancestors, descendants } from "@/game/hardcore/lineage";
import { knowledgeLabel } from "@/genetics/advanced/inference";
import { publicKnowledge } from "@/game/hardcore/genetics";
import { morph } from "@/game/hardcore/adapter";
import { Sprite, STATUS, won, type ViewProps } from "./common";
export function Lineage({game,busy,play,onDetail,selectedId,onSelect}:ViewProps & {selectedId:string;onSelect:(id:string)=>void}) {
  const [name,setName] = useState(""), [limit,setLimit] = useState(24);
  const individuals = Object.values(game.individuals).filter(g=>g.status!=="pedigree"||g.id===selectedId), root = game.individuals[selectedId] ?? individuals[0];
  const prior = root ? [...ancestors(game,root.id)].sort((a,b)=>a[1]-b[1]) : [], future = root ? [...descendants(game,root.id)] : [];
  const related=root?[root,...future.map(id=>game.individuals[id])]:[];
  const generations=[...new Set(related.map(g=>g.generation))].sort((a,b)=>a-b);
  return <section><h1>혈통도</h1><p className="game-section-copy">보유·판매·폐사 개체를 모두 보존합니다. 모든 세대의 조상을 탐색할 수 있고, 혈통 이름은 유전자나 평가 점수를 바꾸지 않습니다.</p>
    <label className="lineage-select">혈통을 볼 개체<select aria-label="혈통을 볼 개체" value={root?.id ?? ""} onChange={e=>{onSelect(e.target.value);setLimit(24);}}>{individuals.map(g=><option key={g.id} value={g.id}>{g.name} · Gen {g.generation} · {STATUS[g.status]}</option>)}</select></label>
    {root ? <><div className="lineage-root"><Sprite gecko={root}/><div><h2>{root.name}</h2><p>Gen {root.generation} · 출생 {root.birthDate} · {STATUS[root.status]}</p><p>{morph(root)}</p><p>{knowledgeLabel(publicKnowledge(root))}</p><p>{root.lineageIds.map(id=>game.lineages[id].name).join(" / ") || "혈통명 미지정"}</p><button className="game-secondary" onClick={()=>onDetail(root.id)}>상세 정보</button></div></div>
      <form className="hc-line-name" onSubmit={async e=>{e.preventDefault();if(await play({type:"lineage",id:root.id,name})) setName("");}}><label>혈통 이름<input value={name} maxLength={40} required onChange={e=>setName(e.target.value)}/></label><button className="game-primary" disabled={busy}>혈통 이름 등록</button><p className="game-small-note">이 개체·기존 후손·진행 중인 알·향후 자손에 이름을 연결합니다. 여러 혈통 이름을 함께 보존합니다.</p></form>
      <details className="genetic-panel"><summary>세대별 외형 변화 · 이 개체와 후손</summary><p className="game-small-note">관찰된 집단 평균이며 세대 보너스나 실제 유전 예측이 아닙니다. 판매·폐사 개체도 포함합니다.</p><div className="lineage-trends">{generations.slice(0,limit).map(gen=>{const group=related.filter(g=>g.generation===gen),average=(key:"redIntensity"|"creamCoverage")=>Math.round(100*group.reduce((s,g)=>s+g.potential[key],0)/group.length);return <div key={gen}>Gen {gen} · {group.length}마리<br/>붉은 발색 {average("redIntensity")} · 크림 {average("creamCoverage")}</div>;})}</div></details>
      <h2 className="lineage-subtitle">조상 · 전체 {prior.length}마리</h2><div className="ancestor-list">{prior.slice(0,limit).map(([id,depth])=>{const g=game.individuals[id],sale=game.sales.find(s=>s.individualId===id);return <button className="hc-list-row" key={id} onClick={()=>{onSelect(id);setLimit(24);}}><strong>{g.name} · Gen {g.generation}</strong><span>{depth}대 위 · {STATUS[g.status]} · 출생 {g.birthDate}</span><span>{morph(g)} · {knowledgeLabel(publicKnowledge(g))}</span>{sale && <span>분양 {sale.date} · {won(sale.price)}</span>}{g.diedDate && <span>폐사 {g.diedDate}</span>}</button>;})}</div>
      <h2 className="lineage-subtitle">전체 후손 {future.length}마리</h2>{future.slice(0,limit).map(id=><button className="hc-list-row" key={id} onClick={()=>{onSelect(id);setLimit(24);}}><strong>{game.individuals[id].name} · Gen {game.individuals[id].generation}</strong><span>{STATUS[game.individuals[id].status]} · {morph(game.individuals[id])}</span></button>)}
      {(prior.length>limit || future.length>limit) && <button className="game-secondary full-width" onClick={()=>setLimit(n=>n+24)}>혈통 기록 더 보기</button>}
    </> : <p className="game-empty">상점에서 첫 개체를 구입하면 혈통 기록이 시작됩니다.</p>}
  </section>;
}
