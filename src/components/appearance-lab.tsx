'use client';
import {memo,useEffect,useMemo,useRef,useState} from 'react';
import type {SpriteResult} from '@/engine/model';
import {drawSprite} from '@/engine/canvas';
import {comparison,MORPHS,PROFILES,type ProfileId} from '@/prototype/appearance/fixtures';
import {APPEARANCE_EVIDENCE} from '@/prototype/appearance/evidence';
import styles from './appearance-lab.module.css';

const Canvas=memo(function Canvas({sprite,label,testId}:{sprite:SpriteResult;label:string;testId:string}){
  const ref=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{if(ref.current)drawSprite(ref.current,sprite,3);},[sprite]);
  return <canvas ref={ref} width={288} height={288} role="img" aria-label={label} data-testid={testId} data-version={sprite.version}/>;
});
const percent=(n:number,d:number)=>Math.round(n/Math.max(1,d)*100)+'%';

export default function AppearanceLab(){
  const [profile,setProfile]=useState<ProfileId>('typical'),[seed,setSeed]=useState('regional-review-01'),[draft,setDraft]=useState(seed);
  const [fire,setFire]=useState<'up'|'down'>('up'),[combos,setCombos]=useState(false),[gallery,setGallery]=useState(false);
  const rows=useMemo(()=>MORPHS.slice(0,combos?MORPHS.length:6).map(m=>({...m,...comparison(profile,m.id,seed,fire)})),[profile,seed,fire,combos]);
  const levels=useMemo(()=>gallery?MORPHS.slice(1,6).map(m=>({...m,cases:(['low','typical','high'] as const).map(level=>({level,...comparison(level,m.id,seed,fire)}))})):[],[gallery,seed,fire]);
  return <main className={styles.lab}>
    <header><a href="/">← GECKO LAB</a><p className={styles.eyebrow}>개발용 · 정식 게임 미적용</p><h1>모프 외형 비교 연구실</h1>
      <p>모든 모프에 같은 60좌위 다유전자 배경과 외형 시드를 사용합니다. 유전 모프만 변경한 전후 비교이며 저장 데이터에 접근하지 않습니다.</p></header>
    <section className={styles.controls} aria-label="비교 조건">
      <label>공통 유전 배경<select value={profile} onChange={e=>setProfile(e.target.value as ProfileId)}>{PROFILES.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select></label>
      <form onSubmit={e=>{e.preventDefault();setSeed(draft.trim()||'regional-review-01');}}><label>공통 외형 시드<input value={draft} maxLength={80} onChange={e=>setDraft(e.target.value)}/></label><button type="submit">시드 적용</button></form>
      <button type="button" aria-pressed={fire==='down'} onClick={()=>setFire(fire==='up'?'down':'up')}>파이어 {fire==='up'?'업':'다운'}</button>
      <button type="button" aria-pressed={combos} onClick={()=>setCombos(!combos)}>복합 모프 {combos?'접기':'비교'}</button>
    </section>
    <p className={styles.note}>발현 배경은 서로 다른 합법적인 가상 유전체입니다. 발현 확률이나 실제 등급 기준을 뜻하지 않습니다. 명도 비교 두 배경은 명도 사본만 다릅니다.</p>
    <section className={styles.grid} aria-label="동일 조건 전후 비교">{rows.map(row=>{
      const m=row.improved.metrics;
      return <article className={styles.card} key={row.id} data-testid={'appearance-pair-'+row.id}>
        <h2>{row.label}</h2><div className={styles.pair}>
          <figure><Canvas sprite={row.old} label={row.label+' 기존 외형'} testId={'appearance-old-'+row.id}/><figcaption>기존 · {row.old.version}</figcaption></figure>
          <figure><Canvas sprite={row.improved.sprite} label={row.label+' 개선 외형'} testId={'appearance-new-'+row.id}/><figcaption>프로토타입</figcaption></figure>
        </div><p className={styles.metrics}>백색 피부 {percent(m.whitePixels,m.skinPixels)} · 얼굴 {percent(m.headWhite,m.headSkin)} · 평균 밝기 {m.meanSkinLuminance.toFixed(0)}</p>
      </article>;
    })}</section>
    <section className={styles.extremes}>
      <button type="button" aria-expanded={gallery} onClick={()=>setGallery(!gallery)}>저발현 · 일반 · 극단 발현 한눈에 보기 {gallery?'−':'+'}</button>
      {gallery&&<div data-testid="expression-gallery">{levels.map(row=><article key={row.id}><h2>{row.label}</h2><div className={styles.levels}>{row.cases.map(c=><figure key={c.level}>
        <Canvas sprite={c.improved.sprite} label={row.label+' '+c.level} testId={'expression-'+row.id+'-'+c.level}/><figcaption>{PROFILES.find(p=>p.id===c.level)!.label}</figcaption>
      </figure>)}</div></article>)}</div>}
    </section>
    <details className={styles.sources}><summary>관찰 근거와 프로토타입의 한계</summary>
      <p>96×96 원화·눈 구조를 재사용합니다. 새로운 원화나 실제 염색체 모델은 만들지 않았습니다. 수치·부위 투영·조합 효과는 검토용 게임 근사이며 두 복합 변이 사본의 외형은 미구현입니다.</p>
      <p>정식 명칭·가격·브리딩 도전은 기존 엔진을 계속 사용합니다. 이 페이지의 백색 면적은 구조를 제외한 피부 마스크 기준으로 기존 도전의 면적과 비교할 수 없습니다.</p>
      {APPEARANCE_EVIDENCE.map(e=><div key={e.morph}><h3><a href={e.url} target="_blank" rel="noreferrer">{e.morph} · {e.level}</a></h3><p>{e.observation}</p><p>{e.approximation}</p></div>)}
    </details>
  </main>;
}
