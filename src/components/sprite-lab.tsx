"use client";

import { useId, useState } from "react";
import { drawSprite } from "@/engine/canvas";
import { ENGINE_VERSION, LAYER_LABELS, LAYER_ORDER, type BodyColor, type LayerName } from "@/engine/model";
import { MORPH_PRESETS, specimenFromPreset } from "@/engine/presets";
import { renderSprite, renderLegacySprite } from "@/engine/render";
import { deriveSeed } from "@/engine/random";
import { Icon } from "./icons";
import { SpriteCanvas } from "./sprite-canvas";

const BODY_OPTIONS: { id: BodyColor; name: string; color: string }[] = [
  { id: "orange", name: "오렌지", color: "#d68b46" },
  { id: "brown", name: "브라운", color: "#86573e" },
  { id: "cream", name: "크림", color: "#ebd1a6" },
  { id: "slate", name: "슬레이트", color: "#9292ad" },
];

function RangeControl({ label, value, max = 100, onChange, suffix = "%" }: {
  label: string; value: number; max?: number; onChange: (value: number) => void; suffix?: string;
}) {
  const id = useId();
  return <label className="range-control" htmlFor={id}>
    <span>{label}<output htmlFor={id}>{value}{suffix}</output></span>
    <input id={id} type="range" min="0" max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} />
  </label>;
}

export default function SpriteLab() {
  const [selected, setSelected] = useState(MORPH_PRESETS[0]);
  const [specimen, setSpecimen] = useState(() => specimenFromPreset(MORPH_PRESETS[0]));
  const [seedInput, setSeedInput] = useState(specimen.seed);
  const [seedError, setSeedError] = useState("");
  const [scale, setScale] = useState<1 | 3 | 4>(3);
  const [enabled, setEnabled] = useState<readonly LayerName[]>(LAYER_ORDER);
  const [grid, setGrid] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState("");
  const [renderer,setRenderer]=useState<"current"|"legacy">("current");

  const updateTrait = (key: "dorsalCoverage" | "flankCoverage" | "spotCount", value: number) => {
    setSpecimen((current) => ({ ...current, appearance: { ...current.appearance, [key]: value } }));
  };
  const applySeed = (event: React.FormEvent) => {
    event.preventDefault();
    const seed = seedInput.trim();
    if (!seed) { setSeedError("시드를 한 글자 이상 입력해 주세요."); return; }
    setSpecimen((current) => ({ ...current, id: selected.id + ":" + seed, seed }));
    setSeedError("");
  };
  const download = () => {
    const canvas = document.createElement("canvas");
    drawSprite(canvas, (renderer==="legacy"?renderLegacySprite:renderSprite)(specimen, enabled), 1);
    canvas.toBlob((blob) => {
      if (!blob) { setDownloadStatus("PNG를 생성할 수 없습니다."); return; }
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "gecko-" + selected.id + "-96x96.png";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setDownloadStatus("96×96 투명 PNG를 저장했습니다.");
    }, "image/png");
  };

  return <main className="lab-shell">
    <header className="site-header">
      <a href="/" className="wordmark" aria-label="GECKO LAB 홈">
        <span className="logo-tile"><Icon name="leaf" size={24} /></span>
        <span>GECKO <em>LAB</em><small>나만의 크레스티드 게코 연구소</small></span>
      </a>
      <span className="phase-badge"><i />PHASE 06</span>
    </header>

    <section className="intro" aria-labelledby="page-title">
      <div><p className="eyebrow">THE SPRITE LAB / 스프라이트 연구실</p>
        <h1 id="page-title">작은 픽셀, <span>다른 개성.</span></h1>
        <p className="intro-copy">체색과 무늬를 조합하고, 나만의 게코를 관찰해 보세요.</p>
      </div>
      <div className="engine-tag"><span className="status-dot" />로컬 렌더링 <b>96 × 96</b></div>
    </section>

    <section className="workspace" aria-label="개체 관찰과 외형 설정">
      <div className="specimen-panel">
        <div className="panel-topline"><span><Icon name="leaf" /> 개체 관찰</span><span className="mono">BASE 01</span></div>
        <div className={"habitat" + (grid ? " show-grid" : "")}>
          <div className="habitat-label"><span className="tiny-dot" /> CRESTED GECKO <span>성체 · 옆모습</span></div>
          <div className="fern fern-left" aria-hidden="true"><i /><i /><i /><i /></div>
          <div className="fern fern-right" aria-hidden="true"><i /><i /><i /><i /></div>
          <div className="pixel-scroll" data-testid="pixel-scroll">
            <div className="sprite-board" style={{ minWidth: 96 * scale }}>
              <SpriteCanvas specimen={specimen} scale={scale} enabled={enabled} testId="hero-sprite" renderer={renderer}/>
            </div>
          </div>
          <div className="habitat-bottom"><span className={"fire-indicator " + specimen.state.fire}>
            <Icon name={specimen.state.fire === "up" ? "sun" : "moon"} size={14} />
            {specimen.state.fire === "up" ? "파이어업" : "파이어다운"}</span>
            <span>{renderer==="current"?"PNG 아트 베이스 v2":"이전 좌표 베이스 v1"}</span></div>
        </div>
        <div className="specimen-summary">
          <div><p className="eyebrow">SELECTED SPECIMEN</p><h2>{selected.nickname} <span>{selected.english}</span></h2>
            <p>{selected.description}</p></div>
          <span className="specimen-mark" style={{ color: selected.accent }}><Icon name="spark" size={28} /></span>
        </div>
        <div className="preview-tools">
          <div className="segmented scale-controls" aria-label="스프라이트 확대 배율">
            {([1, 3, 4] as const).map((value) => <button type="button" key={value} aria-pressed={scale === value}
              onClick={() => setScale(value)}>{value}×</button>)}
          </div>
          <button type="button" className={"quiet-button" + (grid ? " active" : "")} aria-pressed={grid}
            onClick={() => setGrid(!grid)}><Icon name="grid" size={16} />격자</button>
          <button type="button" className="quiet-button export-button" onClick={download}><Icon name="download" size={16} />PNG 저장</button>
        </div>
        <div className="segmented art-version-controls" aria-label="아트 버전 비교"><button aria-pressed={renderer==="current"} onClick={()=>setRenderer("current")}>새 아트 v2</button><button aria-pressed={renderer==="legacy"} onClick={()=>setRenderer("legacy")}>이전 아트 v1</button></div>
        <p className="pixel-hint">{scale === 4 ? "4배 확대 · 좁은 화면에서는 스프라이트를 좌우로 스크롤하세요." : "정수 배율 확대 · 픽셀 스무딩 OFF · 투명 배경 출력"}</p>
        <p className="sr-only" role="status">{downloadStatus}</p>
      </div>

      <div className="controls-panel">
        <div className="panel-topline"><span><Icon name="sliders" /> 외형 조합</span><span className="subtle-tag">LIVE</span></div>
        <div className="control-content">
          <div className="control-block"><p className="control-label">기본 체색 <span>BODY COLOR</span></p>
            <div className="swatch-group">{BODY_OPTIONS.map((color) => <button type="button" key={color.id}
              aria-pressed={specimen.appearance.bodyColor === color.id} onClick={() => setSpecimen((current) => ({
                ...current, appearance: { ...current.appearance, bodyColor: color.id },
              }))}><i style={{ background: color.color }} /><span>{color.name}</span></button>)}</div>
          </div>
          <div className="control-block range-group">
            <p className="control-label">무늬와 반점 <span>PATTERN</span></p>
            <RangeControl label="등 패턴 면적" value={Math.round(specimen.appearance.dorsalCoverage * 100)}
              onChange={(value) => updateTrait("dorsalCoverage", value / 100)} />
            <RangeControl label="옆구리 패턴 면적" value={Math.round(specimen.appearance.flankCoverage * 100)}
              onChange={(value) => updateTrait("flankCoverage", value / 100)} />
            <RangeControl label="달마시안 반점" value={specimen.appearance.spotCount} max={70}
              suffix="개" onChange={(value) => updateTrait("spotCount", value)} />
          </div>
          <div className="control-block"><p className="control-label">발색 상태 <span>FIRE STATE</span></p>
            <div className="segmented fire-controls">{(["up", "down"] as const).map((fire) => <button type="button"
              key={fire} aria-pressed={specimen.state.fire === fire} onClick={() => setSpecimen((current) => ({ ...current, state: { fire } }))}>
              <Icon name={fire === "up" ? "sun" : "moon"} size={16} />{fire === "up" ? "파이어업" : "파이어다운"}</button>)}</div>
          </div>
          <form className="seed-form" onSubmit={applySeed}>
            <label htmlFor="individual-seed" className="control-label">개체 시드 <span>FIXED SEED</span></label>
            <div><input id="individual-seed" value={seedInput} maxLength={128} spellCheck={false}
              aria-invalid={!!seedError} aria-describedby={seedError ? "seed-error" : "seed-note"}
              onChange={(event) => setSeedInput(event.target.value)} />
              <button type="submit" aria-label="시드 적용"><Icon name="arrow" /></button></div>
            {seedError ? <p id="seed-error" role="alert">{seedError}</p> : <p id="seed-note">같은 시드와 설정은 항상 같은 외형을 만듭니다.</p>}
          </form>
        </div>
      </div>
    </section>

    <section className="gallery-section" aria-labelledby="gallery-title">
      <div className="section-heading"><div><p className="eyebrow">MORPH COLLECTION</p><h2 id="gallery-title">여섯 가지 외형</h2></div>
        <span className="section-meta">06 <span>/ 시각 프리셋</span></span></div>
      <p className="section-description">같은 시드로 비교하는 모프 프리셋입니다. 카드를 눌러 외형을 불러오세요.</p>
      <div className="morph-grid">{MORPH_PRESETS.map((preset, i) => {
        const preview = specimenFromPreset(preset, specimen.seed);
        preview.state.fire = specimen.state.fire;
        return <button type="button" className={"morph-card" + (selected.id === preset.id ? " selected" : "")}
          key={preset.id} style={{ "--morph-accent": preset.accent } as React.CSSProperties} data-testid={"preset-" + preset.id}
          aria-pressed={selected.id === preset.id} onClick={() => {
            setSelected(preset);
            const next = specimenFromPreset(preset, specimen.seed);
            next.state.fire = specimen.state.fire;
            setSpecimen(next);
            setEnabled(LAYER_ORDER);
          }}>
          <div className="card-number"><span>0{i+1}</span><span>{selected.id === preset.id ? "선택됨" : "96 × 96"}</span></div>
          <div className="card-sprite"><SpriteCanvas specimen={preview} testId={"gallery-" + preset.id} renderer={renderer}/></div>
          <span className="morph-name">{preset.name}</span><span className="morph-english">{preset.english}</span>
          <div className="card-footer"><span className="tiny-dot" />{preset.appearance.spotCount ? "반점 패턴" : "부위별 패턴"}<Icon name="arrow" size={14} /></div>
        </button>;
      })}</div>
    </section>

    <section className="lower-workspace">
      <div className="individual-panel">
        <div className="section-heading"><div><p className="eyebrow">SAME TRAITS, DIFFERENT SEEDS</p><h2>개체 비교</h2></div><Icon name="spark" /></div>
        <p className="section-description">설정은 같아도 무늬의 모양과 위치는 다릅니다.</p>
        <div className="individual-grid">{["A", "B", "C","D","E","F","G","H","I","J","K","L"].map((suffix) => {
          const individual = { ...specimen, seed: deriveSeed(specimen.seed, suffix), name: "개체 " + suffix };
          return <div key={suffix} className="individual-card"><SpriteCanvas specimen={individual} testId={"individual-" + suffix} renderer={renderer}/>
            <span>개체 {suffix}</span><small title={individual.seed}>{individual.seed}</small></div>;
        })}</div>
      </div>
      <div className="layers-panel">
        <div className="section-heading"><div><p className="eyebrow">PIXEL COMPOSITING</p><h2>레이어 살펴보기</h2></div><span className="section-meta">08</span></div>
        <p className="section-description">레이어를 켜고 끄며 알파 마스크 조합을 확인하세요.</p>
        <div className="layer-grid">{LAYER_ORDER.map((layer, i) => <label key={layer}>
          <input type="checkbox" checked={enabled.includes(layer)} onChange={() => setEnabled((current) =>
            current.includes(layer) ? current.filter((value) => value !== layer) : LAYER_ORDER.filter((value) => value === layer || current.includes(value)))} />
          <span className="layer-index">0{i+1}</span><span>{LAYER_LABELS[layer]}</span>
        </label>)}</div>
      </div>
    </section>

    <aside className="prototype-note"><Icon name="leaf" /><div><strong>새 Normal 베이스와 가변 패턴</strong>
      <p>별도로 생성한 원화를 96픽셀 팔레트 자산과 부위별 PNG 마스크로 정리했습니다. 원본 레퍼런스를 잘라 넣지 않았으며 얼굴·몸체·꼬리는 실제 아트에서 가져옵니다.
        콘셉트의 세밀한 질감과 전문 수작업 픽셀 아트에는 아직 차이가 있습니다. 구버전 비교와 같은 표현형의 12개 시드를 확인할 수 있습니다.</p></div></aside>
    <footer className="site-footer"><span>GECKO LAB <span> / SPRITE ENGINE v{ENGINE_VERSION}</span></span>
      <span>기존 유전학 · 브리딩 · 저장 호환</span></footer>
  </main>;
}
