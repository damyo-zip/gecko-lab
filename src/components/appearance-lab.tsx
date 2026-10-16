'use client';
import {memo,useEffect,useMemo,useRef,useState} from 'react';
import type {SpriteResult} from '@/engine/model';
import {drawSprite} from '@/engine/canvas';
import {comparison,MORPHS,PROFILES,type ProfileId} from '@/prototype/appearance/fixtures';
import {APPEARANCE_EVIDENCE} from '@/prototype/appearance/evidence';
import {localContrast,structureContrast} from '@/prototype/appearance/quality';
import styles from './appearance-lab.module.css';

const Canvas=memo(function Canvas({sprite,label,testId,scale}:{sprite:SpriteResult;label:string;testId:string;scale:1|3|4}){
  const ref=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{if(ref.current)drawSprite(ref.current,sprite,scale);},[sprite,scale]);
  return <canvas ref={ref} width={96*scale} height={96*scale} style={{width:96*scale,height:96*scale}} role="img" aria-label={label} data-testid={testId} data-version={sprite.version}/>;
});
const percent=(n:number,d:number)=>Math.round(n/Math.max(1,d)*100)+'%';

export default function AppearanceLab(){
  const [profile,setProfile]=useState<ProfileId>('typical'),[seed,setSeed]=useState('regional-review-01'),[draft,setDraft]=useState(seed);
  const [fire,setFire]=useState<'up'|'down'>('up'),[combos,setCombos]=useState(false),[gallery,setGallery]=useState(false);
  const [scale,setScale]=useState<1|3|4>(1);
  const rows=useMemo(()=>MORPHS.slice(0,combos?MORPHS.length:6).map(m=>({...m,...comparison(profile,m.id,seed,fire)})),[profile,seed,fire,combos]);
  const levels=useMemo(()=>gallery?MORPHS.slice(1,6).map(m=>({...m,cases:(['low','typical','high'] as const).map(level=>({level,...comparison(level,m.id,seed,fire)}))})):[],[gallery,seed,fire]);
  return <main className={styles.lab}>
    <header><a href="/">← GECKO LAB</a><p className={styles.eyebrow}>개발용 · 정식 게임 미적용</p><h1>모프 외형 비교 연구실</h1>
      <p>정식 외형 → regional-prototype-1 → 명암 개선 v2를 비교합니다. 모든 열은 같은 60좌위 다유전자·외형 시드·파이어 상태를 사용하며 저장 데이터에 접근하지 않습니다.</p></header>
    <section className={styles.controls} aria-label="비교 조건">
      <label>공통 유전 배경<select value={profile} onChange={e=>setProfile(e.target.value as ProfileId)}>{PROFILES.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select></label>
      <form onSubmit={e=>{e.preventDefault();setSeed(draft.trim()||'regional-review-01');}}><label>공통 외형 시드<input value={draft} maxLength={80} onChange={e=>setDraft(e.target.value)}/></label><button type="submit">시드 적용</button></form>
      <button type="button" aria-pressed={fire==='down'} onClick={()=>setFire(fire==='up'?'down':'up')}>파이어 {fire==='up'?'업':'다운'}</button>
      <button type="button" aria-pressed={combos} onClick={()=>setCombos(!combos)}>복합 모프 {combos?'접기':'비교'}</button>
      <div className={styles.zoom} role="group" aria-label="픽셀 확대 배율">{([1,3,4] as const).map(n=><button key={n} type="button" aria-pressed={scale===n} onClick={()=>setScale(n)}>{n===1?'96px 원본':n+'배 확대'}</button>)}</div>
    </section>
    <p className={styles.note}>발현 배경은 합법적인 가상 유전체 예제이며 실제 등급을 뜻하지 않습니다. 명도 비교 두 배경은 명도 사본만 다릅니다. 96px는 CSS 축소 없는 원본 크기입니다. 확대 시 비교 상자 안에서 좌우로 밀어볼 수 있습니다.</p>
    <section className={styles.grid} aria-label="동일 조건 전후 비교">{rows.map(row=>{
      const m=row.relief.metrics,before=localContrast(row.improved.sprite,row.improved.materials),after=localContrast(row.relief.sprite,row.relief.materials);
      const probes=[row.old,row.improved.sprite,row.relief.sprite].map(structureContrast);
      return <article className={styles.card} key={row.id} data-testid={'appearance-pair-'+row.id}>
        <h2>{row.label}</h2><div className={styles.scroll}><div className={styles.pair}>
          <figure><Canvas scale={scale} sprite={row.old} label={row.label+' 정식 외형'} testId={'appearance-old-'+row.id}/><figcaption>정식</figcaption></figure>
          <figure><Canvas scale={scale} sprite={row.improved.sprite} label={row.label+' 기존 프로토타입 v1'} testId={'appearance-new-'+row.id}/><figcaption>기존 v1</figcaption></figure>
          <figure><Canvas scale={scale} sprite={row.relief.sprite} label={row.label+' 명암 개선 v2'} testId={'appearance-relief-'+row.id}/><figcaption>명암 개선 v2</figcaption></figure>
        </div></div><p className={styles.metrics}>백색 피부 {percent(m.whitePixels,m.skinPixels)} · 얼굴 {percent(m.headWhite,m.headSkin)} · 발현 마스크 v1과 동일</p>
        <details className={styles.measurements}><summary>구조·질감 측정</summary>
          <p>동일 재질 내 인접 명도차 {before.withinMaterial.toFixed(1)} → {after.withinMaterial.toFixed(1)} · 무늬 경계 명도차 {before.patternEdge.toFixed(1)} → {after.patternEdge.toFixed(1)}</p>
          <table><caption>고정 좌표의 밝은 쪽 − 접힘 쪽 명도차 (0–255)</caption><thead><tr><th>부위</th><th>원화</th><th>정식</th><th>v1</th><th>v2</th></tr></thead><tbody>{probes[0].map((p,i)=><tr key={p.id}><th>{p.label}</th><td>{p.source.toFixed(0)}</td>{probes.map((ps,j)=><td key={j}>{ps[i].contrast.toFixed(0)}</td>)}</tr>)}</tbody></table>
          <p>수치가 클수록 좋은 그림이라는 뜻은 아닙니다. 원화 색무늬와 구조의 분리는 자세별 근사이며, 원본 크기에서 형태와 무늬를 함께 확인하세요.</p>
        </details>
      </article>;
    })}</section>
    <section className={styles.extremes}>
      <button type="button" aria-expanded={gallery} onClick={()=>setGallery(!gallery)}>저발현 · 일반 · 극단 발현 한눈에 보기 {gallery?'−':'+'}</button>
      {gallery&&<div data-testid="expression-gallery">{levels.map(row=><article key={row.id}><h2>{row.label}</h2>{row.cases.map(c=><div key={c.level}><h3>{PROFILES.find(p=>p.id===c.level)!.label}</h3><div className={styles.scroll}><div className={styles.pair}>
        {[{sprite:c.old,key:'old',title:'정식'},{sprite:c.improved.sprite,key:'v1',title:'기존 v1'},{sprite:c.relief.sprite,key:'v2',title:'명암 개선 v2'}].map(v=><figure key={v.key}><Canvas scale={scale} sprite={v.sprite} label={row.label+' '+c.level+' '+v.title} testId={v.key==='v1'?'expression-'+row.id+'-'+c.level:'expression-'+v.key+'-'+row.id+'-'+c.level}/><figcaption>{v.title}</figcaption></figure>)}
      </div></div></div>)}</article>)}</div>}
    </section>
    <details className={styles.sources}><summary>관찰 근거와 프로토타입의 한계</summary>
      <p>96×96 원화·눈 구조를 재사용합니다. 새로운 원화나 실제 염색체 모델은 만들지 않았습니다. 수치·부위 투영·조합 효과는 검토용 게임 근사이며 두 복합 변이 사본의 외형은 미구현입니다.</p>
      <p>정식 명칭·가격·브리딩 도전은 기존 엔진을 계속 사용합니다. 이 페이지의 백색 면적은 구조를 제외한 피부 마스크 기준으로 기존 도전의 면적과 비교할 수 없습니다.</p>
      <p>v1의 합성과 출력은 보존했습니다. v2는 같은 8레이어·재질·무늬에 원화의 재질별 픽셀 질감, 자세에 주석을 붙인 접힘, 꼬리 단면의 조명을 적용합니다. 새로운 원화와 동등한 품질을 보장하지 않으며 정식 게임에는 적용하지 않습니다.</p>
      {APPEARANCE_EVIDENCE.map(e=><div key={e.morph}><h3><a href={e.url} target="_blank" rel="noreferrer">{e.morph} · {e.level}</a></h3><p>{e.observation}</p><p>{e.approximation}</p></div>)}
    </details>
  </main>;
}
