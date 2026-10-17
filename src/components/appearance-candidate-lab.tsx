'use client';
import {memo,useEffect,useMemo,useRef,useState,type CSSProperties} from 'react';
import {drawSprite} from '@/engine/canvas';
import {MORPHS,PROFILES,fixtureGenome,type ProfileId} from '@/engine/regional/fixtures';
import type {SpriteResult} from '@/engine/model';
import {renderComparison} from '@/lab/appearance/candidates';
import {CANDIDATES,COMPARISONS} from '@/lab/appearance/policies';
import styles from './appearance-candidate-lab.module.css';

const PixelView=memo(function PixelView({sprite,scale,testId}:{sprite:SpriteResult;scale:1|3;testId:string}){
 const ref=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{if(ref.current)drawSprite(ref.current,sprite,scale);},[sprite,scale]);
 return <canvas ref={ref} width={96*scale} height={96*scale} role="img" aria-label={testId} data-testid={testId}/>;
});
/** Isolated review tool: no live game state, persistence or renderer switch. */
export default function AppearanceCandidateLab(){
 const[profile,setProfile]=useState<ProfileId>('typical'),[seed,setSeed]=useState('regional-review-01'),[fire,setFire]=useState<'up'|'down'>('up'),[zoom,setZoom]=useState(true);
 const[backdrop,setBackdrop]=useState<'grid'|'terrarium'>('terrarium');
 const rows=useMemo(()=>MORPHS.slice(0,6).map(m=>{
  const input={genome:fixtureGenome(profile,m.id),seed,fire};
  return {...m,results:COMPARISONS.map(c=>({id:c.id,label:c.label,sprite:renderComparison(input,c.id)}))};
 }),[profile,seed,fire]);
 return <main className={styles.lab}>
  <a href="/lab/appearance">← 현재 v2 외형 연구실</a><h1>원화 보존 후보 비교</h1>
  <p>정식 게임은 현재 v2 그대로입니다. 이전 정식과 A/B/C는 이 화면에서만 비교하며, 저장·유전·가격·도전 판정을 바꾸지 않습니다.</p>
  <section className={styles.controls} aria-label="공통 비교 조건">
   <label>공통 유전 배경<select value={profile} onChange={e=>setProfile(e.target.value as ProfileId)}>{PROFILES.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select></label>
   <label>공통 외형 시드<input value={seed} maxLength={80} onChange={e=>setSeed(e.target.value)}/></label>
   <button onClick={()=>setFire(fire==='up'?'down':'up')}>파이어 {fire==='up'?'업':'다운'}</button>
   <button aria-pressed={zoom} onClick={()=>setZoom(!zoom)}>3배 확대 {zoom?'켜짐':'꺼짐'}</button>
   <button onClick={()=>setBackdrop(backdrop==='grid'?'terrarium':'grid')}>배경: {backdrop==='grid'?'격자':'테라리움'}</button>
  </section>
  <div className={styles.policies}>{CANDIDATES.map(c=><div key={c.id}><strong>{c.label}</strong><p>{c.description}</p></div>)}</div>
  <p className={styles.hint}>모든 열에 같은 유전체·시드·파이어를 적용합니다. 작은 그림은 96×96 원본, 큰 그림은 보간 없는 3배 확대입니다. 모바일에서는 표를 옆으로 밀어 비교하세요.</p>
  <section className={styles.viewport} tabIndex={0} aria-label="5개 렌더러 비교표" data-testid="candidate-viewport">
   <div className={styles.board} style={{'--cell-width':zoom?'310px':'144px'} as CSSProperties} data-backdrop={backdrop}>
    <div className={styles.header}>{COMPARISONS.map(c=><div key={c.id}><strong>{c.label}</strong><small>{c.version}</small></div>)}</div>
    {rows.map(row=><section className={styles.row} key={row.id} aria-label={row.label}>
     <h2><span className={styles.rowTitle}>{row.label} <small>{PROFILES.find(p=>p.id===profile)?.label} · 파이어 {fire==='up'?'업':'다운'}</small></span></h2>
     <div className={styles.cells}>{row.results.map(({id,label,sprite})=><article className={styles.cell} key={id} data-testid={'candidate-'+row.id+'-'+id}>
      <small>{label}</small>
      <div className={styles.native}><PixelView sprite={sprite} scale={1} testId={'native-'+row.id+'-'+id}/></div>
      {zoom&&<div className={styles.zoom}><PixelView sprite={sprite} scale={3} testId={'zoom-'+row.id+'-'+id}/></div>}
     </article>)}</div>
    </section>)}
   </div>
  </section>
  <p>이전 정식은 커밋 c934363의 원화 합성을 복원했습니다. 후보의 부위별 모프 표현은 비교용 게임 모델이며, 실제 유전 방식에 대한 새로운 주장이 아닙니다. 숨은 보인자만 있는 노멀의 모습도 바뀌지 않습니다.</p>
 </main>;
}
