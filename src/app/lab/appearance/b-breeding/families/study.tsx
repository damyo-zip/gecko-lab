'use client';
import {useMemo,useState,type CSSProperties} from 'react';
import {StudyPixels as Pixels} from '@/lab/appearance/pixels';
import type {StudySprite} from '@/lab/appearance/base-study/render';
import {renderBase} from '@/lab/appearance/base-study/render';
import {fixtureGenome,PROFILES,type ProfileId} from '@/engine/regional/fixtures';
import {FAMILIES,MORPH_FAMILIES,type ArtMorph,type FamilyId} from '@/lab/appearance/b-breeding/families/art-source';
import {renderFamily} from '@/lab/appearance/b-breeding/families/render';
import {family,conditionExamples,selectionStudy,type CrossingId} from '@/lab/appearance/b-breeding/samples';
import {morphLabel} from '@/lab/appearance/b-breeding/phenotype';
import styles from '../study.module.css';
import local from './study.module.css';
import cards from '../../bases/study.module.css';
const SEED='b-families-01';
const descriptions:Record<ArtMorph,string>={normal:'최초 B의 크림 띠·측면 창문·꼬리 흐름을 기준으로 범위와 연결을 바꿉니다.',lilly:'원본 크림 경계를 화이트로 이어갑니다. 넓은형은 피복을, 연결형은 얼굴·코 확장까지 보여줍니다.',axanthic:'원본의 밝고 어두운 픽셀과 무늬 대비를 유지하며 무채색 재질과 유전 명도를 적용합니다.',cappuccino:'원본 피부를 갈색 계열로 보존하면서 밝은 꼬리 기부와 어두운 끝을 함께 설계합니다.',highway:'측면 피복을 줄이고 원본 등 띠의 안쪽 가장자리를 분리·물결·중앙 연결 형태로 설계합니다.',sable:'원본의 어두운 바탕과 밝은 크라운·등 군집을 강조하고 큰 측면 창문을 유지합니다.'};
function Portrait({sprite,id,label,zoom}:{sprite:StudySprite;id:string;label:string;zoom:boolean}){
 return <article className={styles.portrait}><strong>{label}</strong><div className={styles.native}><Pixels sprite={sprite} testId={'family-native-'+id}/></div>{zoom&&<div className={styles.art}><Pixels sprite={sprite} size={288} testId={'family-zoom-'+id}/></div>}</article>;
}
export default function FamilyStudy(){
 const [seed,setSeed]=useState(SEED),[morph,setMorph]=useState<ArtMorph>('normal'),[profile,setProfile]=useState<ProfileId>('typical'),[forced,setForced]=useState<FamilyId|'auto'>('auto'),[zoom,setZoom]=useState(true),[cross,setCross]=useState<CrossingId>('lilly'),[comparison,setComparison]=useState<'diversity'|'siblings'|'selection'>('siblings');
 const options=useMemo(()=>forced==='auto'?{}:{family:forced,cadence:'a' as const},[forced]);
 const selected=useMemo(()=>renderFamily({genome:fixtureGenome(profile,morph),seed},options),[morph,profile,seed,options]);
 const rows=useMemo(()=>MORPH_FAMILIES.map(m=>({...m,examples:FAMILIES.map(f=>({id:f.id,label:f.label,sprite:renderFamily({genome:fixtureGenome(profile,m.id),seed},{family:f.id,cadence:'a'})}))})),[profile,seed]);
 const automatic=useMemo(()=>MORPH_FAMILIES.map(m=>({...m,examples:(['low','typical','high'] as const).map(p=>({id:p,sprite:renderFamily({genome:fixtureGenome(p,m.id),seed})}))})),[seed]);
 const examples=useMemo(()=>{
  if(comparison==='diversity')return conditionExamples(morph,'diverse',seed).map((e,n)=>({...e,label:'개체 '+(n+1)+' · '+morphLabel(e.genome),sprite:renderFamily(e)}));
  if(comparison==='selection')return selectionStudy().filter(g=>[0,1,3,5].includes(g.generation)).map(g=>({...g.selected[0],label:'G'+g.generation+' · 실제 선별 개체',sprite:renderFamily(g.selected[0])}));
  const f=family(cross,seed);return [f.father,f.mother,...f.children].map((e,n)=>({...e,label:(n===0?'아비':n===1?'어미':'자손 '+(n-1))+' · '+morphLabel(e.genome),sprite:renderFamily(e)}));
 },[comparison,morph,seed,cross]);
 const previews=useMemo(()=>MORPH_FAMILIES.map(m=>({...m,sprite:renderFamily({genome:fixtureGenome(profile,m.id),seed},options)})),[profile,seed,options]);
 return <main className={styles.page}>
  <a href="/lab/appearance/bases">← 최초 B · 아트 배치 검토</a><h1>B · 모프별 전체 패턴군</h1>
  <p>최초 B의 원본 픽셀을 바탕으로 등·측면·꼬리의 큰 흐름을 함께 설계했습니다. 모프당 4계열 × 두 전신 배치 초안입니다. 정식 게임에는 적용하지 않습니다.</p>
  <div className={styles.controls}>
   <label>모프<select aria-label="모프" value={morph} onChange={e=>setMorph(e.target.value as ArtMorph)}>{MORPH_FAMILIES.map(m=><option key={m.id} value={m.id}>{m.label}</option>)}</select></label>
   <label>유전 배경<select aria-label="유전 배경" value={profile} onChange={e=>setProfile(e.target.value as ProfileId)}>{PROFILES.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select></label>
   <label>패턴군<select aria-label="패턴군" value={forced} onChange={e=>setForced(e.target.value as FamilyId|'auto')}><option value="auto">유전 점수로 자동 선택</option>{FAMILIES.map(f=><option key={f.id} value={f.id}>{f.label} · 아트 비교용</option>)}</select></label>
   <label>배치 시드<input value={seed} maxLength={80} onChange={e=>setSeed(e.target.value)}/></label><button aria-pressed={zoom} onClick={()=>setZoom(!zoom)}>3배 확대 {zoom?'켜짐':'꺼짐'}</button>
  </div>
  <div className={styles.parents}><Portrait id="original" label="최초 B 원본 · 변경 없음" sprite={renderBase('B')} zoom={zoom}/><Portrait id="selected" label={MORPH_FAMILIES.find(m=>m.id===morph)!.label+' · '+FAMILIES.find(f=>f.id===selected.family)!.label} sprite={selected} zoom={zoom}/></div>
  <p className={local.selection} data-testid="family-selection">{forced==='auto'?'자동 선택':'아트 비교용 고정 선택'} · {selected.artId} · 유전 피복 성향 {selected.selection.coverage.toFixed(2)} · 연결 성향 {selected.selection.connection.toFixed(2)}</p>
  <p>{descriptions[morph]}</p>
  <section><h2>1. 모프별 네 가지 패턴군 초안</h2><p>열마다 전체 무늬를 따로 설계한 아트 비교입니다. 같은 유전 배경에서 패턴군만 고정해 보여주므로 실제 자손 추첨 결과는 아닙니다. 모바일에서는 표 안을 좌우로 밀어 비교하세요.</p>
   <div className={styles.scroll} tabIndex={0} data-testid="family-art-table" aria-label="모프별 네 가지 패턴군"><div className={styles.table} style={{'--column':zoom?'310px':'170px'} as CSSProperties}><div className={local.four}>{FAMILIES.map(f=><strong key={f.id} className={styles.level}>{f.label}</strong>)}</div>{rows.map(r=><section key={r.id}><h3 className={styles.rowTitle}><span>{r.label}<small>{descriptions[r.id]}</small></span></h3><div className={local.four}>{r.examples.map(e=><Portrait key={e.id} id={r.id+'-'+e.id} label={e.label} sprite={e.sprite} zoom={zoom}/>)}</div></section>)}</div></div>
  </section>
  <details className={styles.section}><summary>2. 저·일반·고발현 유전 배경으로 자동 선택</summary><p>별도 수동 선택 없이 기존 60좌위 점수로 패턴군을 고릅니다. 높은 피복과 높은 연결은 서로 다른 축이므로 고발현이 한 가지 그림을 뜻하지 않습니다.</p><div className={styles.scroll} tabIndex={0} aria-label="유전 배경별 자동 패턴군"><div className={styles.table} style={{'--column':zoom?'310px':'170px'} as CSSProperties}>{automatic.map(r=><section key={r.id}><h3 className={styles.rowTitle}><span>{r.label}</span></h3><div className={styles.three}>{r.examples.map(e=><Portrait key={e.id} id={'auto-'+r.id+'-'+e.id} label={{low:'저발현',typical:'일반',high:'고발현'}[e.id]+' · '+FAMILIES.find(f=>f.id===e.sprite.family)!.label} sprite={e.sprite} zoom={zoom}/>)}</div></section>)}</div></div></details>
  <section><h2>3. 가족과 개체별 경향</h2><div className={styles.controls}><label>비교 방식<select aria-label="비교 방식" value={comparison} onChange={e=>setComparison(e.target.value as typeof comparison)}><option value="siblings">부모와 첫 네 자손</option><option value="diversity">같은 모프 · 네 유전 배경</option><option value="selection">여러 세대 선택교배</option></select></label>{comparison==='siblings'&&<label>부모 조합<select aria-label="부모 조합" value={cross} onChange={e=>setCross(e.target.value as CrossingId)}><option value="lilly">릴리 × 노멀</option><option value="axanthic">어두운 아잔틱 × 밝은 아잔틱</option><option value="complex">카푸치노 × 하이웨이 · 복합은 미술 검토 필요</option></select></label>}</div>
   <p>{comparison==='siblings'?'기존 멘델·다유전자 상속 함수로 만든 첫 네 자손을 그대로 보여줍니다. 그림이나 패턴군 이름을 상속하지 않으며, 위 수동 패턴군 선택도 가족에게 적용하지 않습니다. 부모는 고정하고 시드는 자손 추첨에만 적용합니다.':comparison==='selection'?'기존 5세대 선택교배 표본의 실제 선별 개체입니다. 유전자는 직접 강화하지 않았습니다. 그림 계열이 바뀌는 경계가 있어 외형 변화가 단계적으로 보일 수 있습니다.':'같은 모프에서 기존 유전체의 발색·명도·피복·연결 점수가 다른 네 개체입니다. 완전히 같은 유전체는 유사한 패턴 계열을 유지합니다.'}</p>
   <div className={styles.cards} data-testid="family-examples">{examples.map((e,n)=><Portrait key={n} id={'example-'+n} label={e.label+' · '+FAMILIES.find(f=>f.id===e.sprite.family)!.label} sprite={e.sprite} zoom={zoom}/>)}</div>
  </section>
  <section><h2>4. 컬렉션 카드 크기</h2><div className={cards.phone} data-testid="family-card-preview"><header><img src="/ui/home-wordmark.svg" alt="GECKO LAB"/><span>전신 패턴군 비교</span></header><div className={cards.collection}>{previews.map(m=><article key={m.id}><div className={local.card}><div><Pixels sprite={m.sprite} testId={'family-card-'+m.id}/></div><strong>{m.label}</strong><small>{FAMILIES.find(f=>f.id===m.sprite.family)!.label}</small></div></article>)}</div></div></section>
  <p className={styles.note}>‘정석’은 검토할 아트 계열을 뜻하며 업계의 절대 판정 기준은 아닙니다. 하이웨이·세이블과 복합 모프는 브리더 검토가 필요합니다. 이번 초안은 6모프의 기본 계열을 검토하며 복합 모프 전용 아트·정식 이름·가격·도전 판정은 연결하지 않습니다.</p>
 </main>;
}
