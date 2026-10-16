"use client";
import {useState} from "react";
import {PATTERN_EXAMPLES,exampleGenome} from "@/genetics/advanced/pattern-examples";
import {patternTraits} from "@/genetics/advanced/pattern-traits";
import {regionalObservation} from "@/engine/regional";
import {classifyPattern} from "@/phenotype/names";
import {SpriteCanvas} from "./sprite-canvas";
import type {GeckoSpecimen} from "@/engine/model";

export default function PatternLab(){
  const [seed,setSeed]=useState("patterns-v1"),[fire,setFire]=useState<"up"|"down">("up");
  return <main className="lab-shell pattern-lab"><a href="/">← 게임으로</a><h1>실제 무늬 비교 연구실</h1>
    <p>같은 60개 가상 좌위의 명시적 예제입니다. 명칭은 실제 생성된 무늬를 자동 판정합니다. 상점 매물이나 자손 유전형을 이 예제로 바꾸지 않습니다.</p>
    <label>외형 시드 <input value={seed} maxLength={90} onChange={e=>setSeed(e.target.value||"patterns-v1")}/></label>
    <button className="game-secondary" onClick={()=>setFire(fire==="up"?"down":"up")}>파이어 {fire==="up"?"다운":"업"}</button>
    <div className="pattern-lab-grid">{PATTERN_EXAMPLES.map(e=>{
      const genome=exampleGenome(e.id),s=seed+"|"+e.id,{traits,observation:o}=regionalObservation({genome,seed:s,fire}),n=classifyPattern(traits,o);
      const specimen:GeckoSpecimen={genome,schemaVersion:1,id:e.id,name:n.primary,seed:s,state:{fire},appearance:{bodyColor:"orange",patternStyle:"harlequin",dorsalCoverage:traits.dorsal,flankCoverage:traits.flank,spotCount:Math.min(70,traits.spots.count),patterns:traits}};
      return <article className="genetic-panel" key={e.id} data-testid={"pattern-example-"+e.id}><h2>{e.title} 형질 예제</h2><div className="pattern-lab-art"><SpriteCanvas specimen={specimen} scale={3} testId={"pattern-sprite-"+e.id}/></div>
        <strong data-testid="pattern-name">{n.primary}</strong><p>{n.features.join(" · ")||"추가 특징 없음"}</p><p>실제 반점 {o.spots}개 · 등 {Math.round(o.dorsal*100)}% · 측면 {Math.round(o.flank*100)}%</p>
      </article>;
    })}</div>
    <p>96×96 원화와 8개 레이어 유지. 양쪽 핀은 옆모습에 투영하며, 새로운 입체 자세나 고품질 원화를 제작한 것은 아닙니다.</p>
  </main>;
}
