import {visualName} from "@/game/hardcore/adapter";
import {koreanMorphText} from "@/phenotype/display-name";
import { appearanceProfile } from "@/game/hardcore/appearance";
import type { Gecko } from "@/game/hardcore/model";
export function PatternInfo({gecko}:{gecko:Gecko}) {
  const p=appearanceProfile(gecko);if(!p)return null;
  const o=p.observation,percent=(v:number)=>Math.round(v*100)+"%";
  return <details className="genetic-panel" data-testid="pattern-info"><summary>실제 무늬 · {visualName(gecko)}</summary>
    <p data-testid="pattern-primary">{visualName(gecko)}</p><p data-testid="pattern-description">전체 외형 분류: {koreanMorphText(p.names.primary)}</p><p data-testid="pattern-features">추가 특징: {p.names.features.join(" · ")||"없음"}</p>
    <div className="hc-probability"><span>등 / 측면 / 사지 면적</span><span>{[o.dorsal,o.flank,o.limbs].map(percent).join(" / ")}</span></div>
    <div className="hc-probability"><span>등 핀 좌 / 우 연결</span><span>{o.pin.map(l=>percent(l.coverage)+" · 끊김 "+l.gapCount).join(" / ")}</span></div>
    <div className="hc-probability"><span>측면 좌 / 우 연결</span><span>{o.side.map(l=>percent(l.coverage)).join(" / ")}</span></div>
    <div className="hc-probability"><span>실제 반점 / 드리피</span><span>{o.spots}개 / {o.drips}갈래</span></div>
    <p className="game-small-note">화면에 생성된 픽셀 무늬를 판정합니다. 양쪽 선은 현재 옆모습에 투영한 표현입니다. 수치 기준과 60개 가상 좌위의 부위별 효과는 게임용 근사 모델이며 DNA 검사·확정 유전 확률이 아닙니다.</p>
    <a href="/lab/patterns">무늬 비교 연구실</a>
  </details>;
}
