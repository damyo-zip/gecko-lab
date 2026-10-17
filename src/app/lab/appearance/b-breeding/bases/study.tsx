'use client';
import {useMemo,useState,type CSSProperties} from 'react';
import {StudyPixels as Pixels} from '@/lab/appearance/pixels';
import {FOUNDATIONS,CORE_MORPHS,FOUNDATION_SEED,renderBody,foundationRows} from '@/lab/appearance/b-breeding/foundation-study';
import type {FoundationId} from '@/lab/appearance/b-breeding/foundation';
import {PROFILES,type ProfileId,fixtureGenome} from '@/engine/regional/fixtures';
import {renderB,type BResult} from '@/lab/appearance/b-breeding/render';
import styles from '../study.module.css';
import local from './study.module.css';
import cardStyles from '../../bases/study.module.css';

function Portrait({sprite,id,label,zoom}:{sprite:BResult;id:string;label:string;zoom:boolean}){
 return <article className={styles.portrait}><strong>{label}</strong><div className={styles.native}><Pixels sprite={sprite} testId={'foundation-native-'+id}/></div>{zoom&&<div className={styles.art}><Pixels sprite={sprite} size={288} testId={'foundation-zoom-'+id}/></div>}</article>;
}

export default function FoundationStudy(){
 const [seed,setSeed]=useState(FOUNDATION_SEED),[profile,setProfile]=useState<ProfileId>('typical'),[normalPattern,setNormalPattern]=useState(true),[zoom,setZoom]=useState(true),[cardBase,setCardBase]=useState<FoundationId>('clean');
 const bodies=useMemo(()=>FOUNDATIONS.map(f=>({...f,sprite:renderBody(f.id)})),[]);
 const rows=useMemo(()=>foundationRows(profile,seed,normalPattern),[profile,seed,normalPattern]);
 return <main className={styles.page}>
  <a href="/lab/appearance/b-breeding">← B · 모프와 부모·자손 비교</a>
  <h1>B · 바디와 최종 표현형 분리</h1>
  <p>내부 바디의 무늬를 줄이면 모프가 더 잘 구분되는지 비교합니다. 얼굴·눈·크레스트·발·꼬리는 유지하고, 등·측면 색소를 분리했습니다. 정식 게임에는 적용하지 않습니다.</p>
  <div className={styles.controls}><label>공통 유전 배경<select aria-label="공통 유전 배경" value={profile} onChange={e=>setProfile(e.target.value as ProfileId)}>{PROFILES.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select></label><label>공통 무늬 시드<input value={seed} maxLength={80} onChange={e=>setSeed(e.target.value)}/></label><button aria-pressed={zoom} onClick={()=>setZoom(!zoom)}>3배 확대 {zoom?'켜짐':'꺼짐'}</button></div>
  <section><h2>1. 내부 렌더링 바디</h2><p>최종 노멀 개체가 아닙니다. 세 바디는 같은 일반 체색으로 고정하고, 추가 패턴과 모프를 모두 끈 상태입니다. 패턴리스도 구조 명암과 피부의 픽셀 질감을 남깁니다.</p><div className={local.pane} data-testid="foundation-body-table" tabIndex={0} aria-label="세 가지 내부 바디 비교"><div className={styles.three} style={{'--column':zoom?'310px':'170px'} as CSSProperties}>{bodies.map(b=><div key={b.id}><Portrait sprite={b.sprite} id={'body-'+b.id} label={b.label} zoom={zoom}/><p className={local.caption}>{b.description}</p></div>)}</div></div></section>
  <section><h2>2. 바디 위에 같은 표현형 적용</h2><p>비교 조건을 맞추기 위해 세 열 모두 같은 노멀용 패턴 레이어와 모프 계수를 적용합니다. 기존 바디에 남은 무늬와 새로 생성한 무늬는 별개입니다. 최종 노멀은 아래 첫 행이며, 내부 패턴리스 바디와 다릅니다.</p>
   <div className={styles.controls}><button aria-pressed={normalPattern} onClick={()=>setNormalPattern(!normalPattern)}>노멀용 패턴 {normalPattern?'켜짐':'꺼짐'}</button><span className={local.controlNote}>{normalPattern?'유전 배경·시드로 생성한 공통 패턴 + 각 모프':'추가 일반 패턴 없이 각 모프만 적용 · 원화 바탕 무늬는 그대로 남음'}</span></div>
   <p className={local.caption}>모바일에서는 표 안을 좌우로 밀어 비교하세요. 각 그림의 작은 원본은 항상 96×96입니다.</p>
   <div className={styles.scroll} data-testid="foundation-morph-table" tabIndex={0} aria-label="세 베이스의 최종 모프 비교"><div className={styles.table} style={{'--column':zoom?'310px':'170px'} as CSSProperties}><div className={styles.three}>{FOUNDATIONS.map(f=><strong className={styles.level} key={f.id}>{f.label}</strong>)}</div>
    {rows.map(r=><section key={r.id}><h3 className={styles.rowTitle}><span>{r.label}</span></h3><div className={styles.three}>{r.examples.map(e=><Portrait key={e.id} sprite={e.result} id={r.id+'-'+e.id} label={e.label} zoom={zoom}/>)}</div></section>)}
   </div></div>
  </section>
  <section><h2>3. 컬렉션 크기에서 보기</h2><div className={styles.controls}>{FOUNDATIONS.map(f=><button key={f.id} aria-pressed={cardBase===f.id} onClick={()=>setCardBase(f.id)}>{f.label}</button>)}</div><div className={cardStyles.phone} data-testid="foundation-card-preview"><header><img src="/ui/home-wordmark.svg" alt="GECKO LAB"/><span>{FOUNDATIONS.find(f=>f.id===cardBase)!.label}</span></header><h3>동일한 바디 · 여섯 모프</h3><div className={cardStyles.collection}>{rows.map(r=><article key={r.id}><div className={local.card}><div><Pixels sprite={r.examples.find(e=>e.id===cardBase)!.result} testId={'foundation-card-'+r.id}/></div><strong>{r.label.split(' · ')[0]}</strong><small>외형 비교 표본</small></div></article>)}</div></div></section>
  <details className={styles.section}><summary>직전 B 실험의 정확한 결과 확인</summary><p>위 통제 비교는 일반 패턴 레이어를 분리했으므로 직전 실험의 최종 출력과 완전히 같지는 않습니다. 아래는 바꾸지 않은 이전 경로의 결과입니다. 공통 유전 배경과 시드는 위와 같습니다.</p><div className={styles.cards}>{CORE_MORPHS.map(m=><Portrait key={m.id} sprite={renderB({genome:fixtureGenome(profile,m.id),seed})} id={'previous-'+m.id} label={m.label} zoom={zoom}/>)}</div></details>
  <p className={styles.note}>원화에는 색소와 조명이 합쳐져 있습니다. 분리한 바디 명암은 B 몸통의 형태와 같은 색소 안의 미세 밝기 차이로 재구성한 실험 모델입니다. 얼굴·팔다리·꼬리의 기존 장식은 제거 대상이 아니며, 이 비교는 유전·저장·가격·성공 판정을 변경하지 않습니다.</p>
 </main>;
}
