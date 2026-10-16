'use client';
import {useMemo,useState} from 'react';
import {SpriteCanvas} from './sprite-canvas';
import {MORPHS,PROFILES,fixtureGenome,type ProfileId} from '@/engine/regional/fixtures';
import {regionalObservation,APPEARANCE_VERSION} from '@/engine/regional';
import {classifyPattern} from '@/phenotype/names';
import {phenotype} from '@/genetics/advanced/phenotype';
import type {GeckoSpecimen} from '@/engine/model';
import styles from './appearance-lab.module.css';
/** A specimen gallery of the one production engine, with no renderer switching. */
export default function AppearanceLab(){
 const[profile,setProfile]=useState<ProfileId>('typical'),[seed,setSeed]=useState('regional-review-01'),[fire,setFire]=useState<'up'|'down'>('up'),[scale,setScale]=useState<1|3|4>(3);
 const rows=useMemo(()=>MORPHS.map(m=>{
  const genome=fixtureGenome(profile,m.id),p=regionalObservation({genome,seed,fire});
  const names=classifyPattern(p.traits,p.observation,phenotype(genome).geneticMorphs);
  const specimen:GeckoSpecimen={schemaVersion:1,id:m.id,name:m.label,genome,seed,state:{fire},appearance:{bodyColor:'orange',patternStyle:'normal',dorsalCoverage:0,flankCoverage:0,spotCount:0}};
  return {...m,specimen,names,observation:p.observation};
 }),[profile,seed,fire]);
 return <main className={styles.lab}><a href="/">← GECKO LAB</a><h1>정식 외형 연구실</h1><p>정식 렌더러 {APPEARANCE_VERSION} · 명암 개선 v2 · 96×96 · 같은 유전체와 시드의 결정적 출력</p>
 <section className={styles.controls} aria-label="외형 조건"><label>공통 유전 배경<select value={profile} onChange={e=>setProfile(e.target.value as ProfileId)}>{PROFILES.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select></label><label>공통 외형 시드<input value={seed} maxLength={80} onChange={e=>setSeed(e.target.value||'regional-review-01')}/></label><button onClick={()=>setFire(fire==='up'?'down':'up')}>파이어 {fire==='up'?'업':'다운'}</button>{([1,3,4] as const).map(s=><button key={s} aria-pressed={scale===s} onClick={()=>setScale(s)}>{s===1?'96px 원본':s+'배 확대'}</button>)}</section>
 <section className={styles.grid}>{rows.map(r=><article className={styles.card} key={r.id} data-testid={'regional-'+r.id}><h2>{r.label}</h2><div className={styles.scroll}><SpriteCanvas specimen={r.specimen} scale={scale} testId={'regional-sprite-'+r.id}/></div><strong>{r.names.primary}</strong><p>{r.names.features.join(' · ')||'추가 특징 없음'}</p><p>백색 {Math.round(r.observation.whiteArea*100)}% · 얼굴 {Math.round(r.observation.headWhite*100)}% · 실제 반점 {r.observation.spots}개</p></article>)}</section><p>C/S/H 복합·동형접합 외형은 잠정 게임 모델입니다. 상속·건강 확률은 이 화면에서 변경하지 않습니다.</p></main>;
}
