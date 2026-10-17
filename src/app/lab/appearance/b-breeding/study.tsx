'use client';
import {useMemo,useState,type CSSProperties} from 'react';
import {StudyPixels as Pixels} from '@/lab/appearance/pixels';
import {renderBase} from '@/lab/appearance/base-study/render';
import {renderB,type BInput} from '@/lab/appearance/b-breeding/render';
import {bPhenotype} from '@/lab/appearance/b-breeding/phenotype';
import {CORE_MORPHS,LEVELS,CONDITIONS,CROSSINGS,conditionExamples,family,selectionStudy,type ConditionId,type CrossingId} from '@/lab/appearance/b-breeding/samples';
import {fixtureGenome,type MorphId} from '@/engine/regional/fixtures';
import baseStyles from '../bases/study.module.css';
import styles from './study.module.css';
const COMPOUNDS=[{id:'lilly-axanthic',label:'릴리 아잔틱'},{id:'frappuccino',label:'프라푸치노'},{id:'lilly-sable',label:'릴리 + 세이블'},{id:'cappuccino-highway',label:'카푸치노 + 하이웨이'}] as const;

function Portrait({input,id,label,zoom,detail}:{input:BInput;id:string;label:string;zoom:boolean;detail?:string}){
 const sprite=useMemo(()=>renderB(input),[input]);
 return <article className={styles.portrait}><strong>{label}</strong><div className={styles.native}><Pixels sprite={sprite} testId={'b-native-'+id}/></div>{zoom&&<div className={styles.art}><Pixels sprite={sprite} size={288} testId={'b-zoom-'+id}/></div>}{detail&&<small>{detail}</small>}</article>;
}
export default function BBreedingStudy(){
 const[seed,setSeed]=useState('b-breeding-01'),[zoom,setZoom]=useState(true),[morph,setMorph]=useState<MorphId>('lilly'),[condition,setCondition]=useState<ConditionId>('diverse'),[cross,setCross]=useState<CrossingId>('lilly'),[draw,setDraw]=useState(0);
 const rows=useMemo(()=>CORE_MORPHS.map(m=>({...m,examples:LEVELS.map(l=>({...l,input:{genome:fixtureGenome(l.id,m.id),seed}}))})),[seed]);
 const variety=useMemo(()=>conditionExamples(morph,condition,seed),[morph,condition,seed]);
 const related=useMemo(()=>family(cross,draw?seed+':draw-'+draw:seed),[cross,seed,draw]);
 const generations=useMemo(()=>selectionStudy(),[]);
 return <main className={styles.page}>
  <a href="/lab/appearance/bases">← 새 베이스 A/B/C</a><header className={styles.intro}><div><span>B / BREEDING EXPRESSION STUDY 01</span><h1>B · 브리딩 감상형 발현 실험</h1><p>선택한 B의 얼굴과 자세를 유지하고, 같은 유전 형질이 등·측면·화이트·꼬리에서 어떻게 보이는지 비교합니다. 정식 게임·저장·경제에는 연결하지 않습니다.</p></div><figure><Pixels sprite={renderBase('B')} size={192} testId="b-original"/><figcaption>선택한 B 원형</figcaption></figure></header>
  <p><a href="/lab/appearance/b-breeding/bases">현재·약한 패턴·패턴리스 바디 비교 →</a></p>
  <p><a href="/lab/appearance/b-breeding/families">모프별 전체 패턴군 비교 →</a></p>
  <div className={styles.controls}><label>무늬·자손 시드<input value={seed} maxLength={80} onChange={e=>setSeed(e.target.value)}/></label><button aria-pressed={zoom} onClick={()=>setZoom(!zoom)}>3배 확대 {zoom?'켜짐':'꺼짐'}</button></div>
  <h2>모프별 발현 비교</h2><p>각 단계의 같은 유전 배경을 여섯 모프에 공통 적용합니다. 원본은 96px, 큰 그림은 보간 없는 3배입니다. 모바일에서는 표를 옆으로 밀어 비교하세요.</p>
  <div className={styles.scroll} tabIndex={0} aria-label="B 모프별 세 단계 비교" data-testid="b-morph-table"><div className={styles.table} style={{'--column':zoom?'310px':'150px'} as CSSProperties}>
   <div className={styles.three}>{LEVELS.map(l=><strong className={styles.level} key={l.id}>{l.label}</strong>)}</div>
   {rows.map(m=><section key={m.id}><h3 className={styles.rowTitle}><span>{m.label} <small>{bPhenotype(m.examples[1].input.genome).features.join(' · ')||'유전된 체색 · 등 · 측면 무늬'}</small></span></h3><div className={styles.three}>{m.examples.map(e=><Portrait key={e.id} input={e.input} id={m.id+'-'+e.id} label={e.label} zoom={zoom}/>)}</div></section>)}
  </div></div>
  <section className={styles.section}><h2>같은 모프 안에서도 다른 개체</h2><p>{condition==='diverse'?'서로 다른 가상 유전 배경을 가진 네 표본입니다. 부모·자손 관계를 가정하지 않습니다.':condition==='seed'?'유전체는 같고 배치 시드만 다릅니다. 발현 강도는 그대로이며 무늬 위치만 달라집니다.':condition==='brightness'?'명도 관련 6좌위만 바꾸고 나머지 유전체와 시드는 고정했습니다.':'크림·등·측면 관련 좌위만 바꾸고 발색·명도·시드는 고정했습니다.'}</p><div className={styles.controls}><label>비교 모프<select value={morph} onChange={e=>setMorph(e.target.value as MorphId)}>{CORE_MORPHS.map(m=><option value={m.id} key={m.id}>{m.label}</option>)}</select></label><label>비교 조건<select value={condition} onChange={e=>setCondition(e.target.value as ConditionId)}>{CONDITIONS.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></label></div>
   <div className={styles.cards}>{variety.map((v,n)=><Portrait key={n} input={v} id={'variety-'+n} label={v.label} zoom={zoom}/>)}</div>
  </section>
  <section className={styles.section}><h2>부모를 보고 자손을 기대하기</h2><p>기존 멘델·60좌위 상속 함수로 만든 첫 네 자손입니다. 결과를 골라내지 않았으며, 네 마리가 교배 확률의 분포를 뜻하지는 않습니다. 외형 비교를 위해 자손도 성체와 같은 표시 크기를 사용합니다.</p><div className={styles.controls}><label>부모 조합<select value={cross} onChange={e=>{setCross(e.target.value as CrossingId);setDraw(0);}}>{CROSSINGS.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></label><button onClick={()=>setDraw(draw+1)}>다른 자손 조합 보기</button></div><p>{CROSSINGS.find(c=>c.id===cross)!.description} 부모는 고정하고 자손의 추첨만 바꿉니다.</p>
   <div className={styles.family} data-testid="b-family"><div className={styles.parents}><Portrait input={related.father} id="father" label={'아비 · '+related.father.name} zoom={zoom}/><Portrait input={related.mother} id="mother" label={'어미 · '+related.mother.name} zoom={zoom}/></div><div className={styles.familyArrow} aria-hidden="true">↓</div><div className={styles.cards}>{related.children.map((c,n)=><Portrait key={c.id} input={c} id={'child-'+n} label={'자손 '+(n+1)+' · '+c.name} zoom={zoom}/>)}</div></div>
  </section>
  <section className={styles.section}><h2>선택교배로 달라지는 등과 화이트</h2><p>하이웨이 발현 상태를 유지하며, 매 세대 48마리 중 등·크림 관련 형질이 높은 두 마리를 다음 부모로 골랐습니다. 대립유전자를 강화하거나 외형을 덮어쓰지 않았습니다.</p><div className={styles.cards}>{generations.filter(g=>[0,1,3,5].includes(g.generation)).map(g=><Portrait key={g.generation} input={g.selected[0]} id={'generation-'+g.generation} label={g.generation===0?'시작 부모':g.generation+'세대 선별 개체'} zoom={zoom}/>)}</div><small>상단 시드와 별개인 고정 시드로 선별한 대표 개체입니다. 모든 자손의 개선이나 실제 자연계의 수치 유전 법칙을 보장하지 않습니다.</small></section>
  <section className={styles.section}><h2>컬렉션 카드 크기로 감상</h2><div className={baseStyles.phone} data-testid="b-collection-preview"><header><img src="/ui/home-wordmark.svg" alt="GECKO LAB"/><span>B 외형 검토</span></header><h3>같은 B · 여섯 모프</h3><div className={baseStyles.collection}>{rows.map(m=><article key={m.id} className={morph===m.id?baseStyles.selected:''}><button onClick={()=>setMorph(m.id)} aria-label={m.label+' 다양성 보기'}><span>Gen 1</span><div><Pixels sprite={renderB(m.examples[1].input)} testId={'b-card-'+m.id}/></div><strong>{m.label.split(' · ')[0]}</strong><small>일반 발현</small><em>외형 비교 샘플</em></button></article>)}</div></div></section>
  <details className={styles.section}><summary>복합 모프 확장 점검</summary><p>서로 다른 부위의 특징을 합성하는 잠정 외형입니다. 별도의 생존 확률이나 새 유전 규칙을 추가하지 않았습니다.</p><div className={styles.cards}>{COMPOUNDS.map(m=><Portrait key={m.id} input={{genome:fixtureGenome('typical',m.id),seed}} id={'compound-'+m.id} label={m.label} zoom={zoom}/>)}</div></details>
  <p className={styles.note}>브리딩 감상용 실험입니다. 실제 보유 개체를 조회하거나 새 개체를 저장하지 않습니다. 부위별 발현 계수는 잠정 게임 표현이며 가격·도전 판정에 사용하지 않습니다.</p>
 </main>;
}
