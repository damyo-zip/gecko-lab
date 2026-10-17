'use client';
import {memo,useEffect,useMemo,useRef,useState,type CSSProperties} from 'react';
import {DESIGNS,VARIANTS,type BaseId,type VariantId} from '@/lab/appearance/base-study/designs';
import {renderBase,type StudySprite} from '@/lab/appearance/base-study/render';
import {referenceSprite,type ReferenceId} from '@/lab/appearance/base-study/reference';
import {HomeIcon} from '@/components/hardcore/home-icons';
import styles from './study.module.css';

const Pixels=memo(function Pixels({sprite,size=96,testId}:{sprite:StudySprite;size?:number;testId:string}){
 const ref=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{
  if(!ref.current)return;const source=document.createElement('canvas');source.width=source.height=96;
  const c=source.getContext('2d')!,image=c.createImageData(96,96);image.data.set(sprite.pixels);c.putImageData(image,0,0);
  const ctx=ref.current.getContext('2d')!;ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,size,size);ctx.drawImage(source,0,0,size,size);
 },[sprite,size]);
 return <canvas ref={ref} width={size} height={size} role="img" aria-label={testId} data-testid={testId}/>;
});
const CONTEXTS=[{id:'collection',label:'컬렉션 · 3열'},{id:'shop',label:'상점 · 2열'},{id:'breeding',label:'교배 · 양쪽'},{id:'incubator',label:'인큐베이터 · 해칭'},{id:'lineage',label:'혈통도 · 가족'}] as const;
type ContextId=typeof CONTEXTS[number]['id'];
const GROWTH=[{size:48,label:'해칭 50%'},{size:72,label:'아성체 75%'},{size:96,label:'성체 100%'}] as const;

export default function BaseStudy(){
 const[reference,setReference]=useState<ReferenceId>('authored'),[zoom,setZoom]=useState(true),[variant,setVariant]=useState<VariantId>('normal'),[context,setContext]=useState<ContextId>('collection'),[focus,setFocus]=useState<BaseId>('A'),[seed,setSeed]=useState('base-study-01');
 const rows=useMemo(()=>VARIANTS.map(v=>({...v,sprites:[{id:'reference',name:reference==='authored'?'기존 원화 정식':'현재 v2',sprite:referenceSprite(v.id,reference)},...DESIGNS.map(d=>({id:d.id,name:d.name,sprite:renderBase(d.id,v.id,seed)}))]})),[reference,seed]);
 const base=(id:BaseId,v:VariantId=variant)=>renderBase(id,v,seed);
 const current=rows.find(r=>r.id===variant)!;
 return <main className={styles.page}>
  <a href="/lab/appearance">← 외형 연구실</a><p className={styles.eyebrow}>GECKO LAB / BASE DESIGN STUDY 01</p><h1>새 96px 베이스 탐색</h1>
  <p>얼굴·비율·자세부터 새로 만든 세 후보입니다. 각 후보의 동일한 베이스에 밝기·무늬만 달리해 확장 여지를 비교합니다. 정식 게임과 연결하지 않습니다.</p>
  <div className={styles.designs}>{DESIGNS.map(d=><article key={d.id}><h2>{d.name}</h2><Pixels sprite={base(d.id,'normal')} size={192} testId={'intro-'+d.id}/><p>{d.description}</p><small>{d.tradeoff}</small></article>)}</div>
  <section className={styles.controls} aria-label="베이스 비교 설정">
   <label>기존 참고 외형<select value={reference} onChange={e=>setReference(e.target.value as ReferenceId)}><option value="authored">기존 원화 정식 · c934363</option><option value="regional">현재 적용 v2 · regional-2</option></select></label>
   <button aria-pressed={zoom} onClick={()=>setZoom(!zoom)}>3배 확대 {zoom?'켜짐':'꺼짐'}</button>
   <label>패턴 배치 시드<input value={seed} maxLength={80} onChange={e=>setSeed(e.target.value)}/></label>
  </section>
  <p className={styles.note}>96×96 원본은 항상 표시합니다. 확대는 최근접 3배입니다. 표를 옆으로 밀어 비교할 수 있습니다. 기존 참고 열은 기존 유전체 배경, 새 후보는 아트 재질·피복 변형입니다.</p>
  <div className={styles.scroll} tabIndex={0} aria-label="기존과 새 베이스 비교" data-testid="base-comparison">
   <div className={styles.table} style={{'--column':zoom?'310px':'148px'} as CSSProperties}>
    <div className={styles.columns}>{current.sprites.map(c=><strong key={c.id}>{c.name}</strong>)}</div>
    {rows.map(r=><section className={styles.variant} key={r.id}><h2><span>{r.label}</span></h2><div className={styles.columns}>{r.sprites.map(c=><article key={c.id}>
     <small>{c.name}</small><div className={styles.native}><Pixels sprite={c.sprite} testId={'base-native-'+r.id+'-'+c.id}/></div>
     {zoom&&<div className={styles.large}><Pixels sprite={c.sprite} size={288} testId={'base-zoom-'+r.id+'-'+c.id}/></div>}
    </article>)}</div></section>)}
   </div>
  </div>
  <section className={styles.sizes}><h2>작아져도 읽히는가</h2><p>같은 노멀 픽셀을 48·72·96px로 표시합니다. 성장 기능을 새로 적용하는 것이 아닙니다.</p>
   <div className={styles.sizeGrid}>{DESIGNS.map(d=><article key={d.id}><strong>{d.name}</strong><div>{GROWTH.map(g=><figure key={g.size}><div><Pixels sprite={base(d.id,'normal')} size={g.size} testId={'growth-'+d.id+'-'+g.size}/></div><figcaption>{g.label}</figcaption></figure>)}</div></article>)}</div>
  </section>
  <section className={styles.contexts}><h2>게임 배치에서 비교</h2><p>기존 테라리움 배경·네이비 패널·녹색 강조를 사용한 그림 배치 모형입니다. 구매·교배·턴 진행을 실행하지 않습니다.</p>
   <div className={styles.controls}><label>화면 구성<select value={context} onChange={e=>setContext(e.target.value as ContextId)}>{CONTEXTS.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></label><label>표현 변형<select value={variant} onChange={e=>setVariant(e.target.value as VariantId)}>{VARIANTS.map(v=><option key={v.id} value={v.id}>{v.label}</option>)}</select></label><label>선택 후보<select value={focus} onChange={e=>setFocus(e.target.value as BaseId)}>{DESIGNS.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label></div>
   <div className={styles.phone} data-context={context} data-testid="base-game-preview">
    <header><img src="/ui/home-wordmark.svg" alt="GECKO LAB"/><span>아트 배치 검토</span></header>
    {context==='collection'&&<><div className={styles.hero}><Pixels sprite={base(focus)} size={192} testId="preview-hero"/><aside><strong>{DESIGNS.find(d=>d.id===focus)!.short}</strong><span>노멀 베이스</span><span>{VARIANTS.find(v=>v.id===variant)!.label}</span><span>성체 · 100%</span></aside></div><h3>보유 개체 <small>6마리 배치 예시</small></h3><div className={styles.collection}>{[...DESIGNS,...DESIGNS].map((d,n)=><article key={n} className={focus===d.id?styles.selected:''}><button onClick={()=>setFocus(d.id)} aria-label={d.name+' 배치 선택'}><span>Gen {n<3?1:2}</span><div><Pixels sprite={base(d.id,n<3?variant:n===3?'dark':n===4?'bright':'rich')} testId={'preview-card-'+n}/></div><strong>{d.short}</strong><small>{n<3?d.id+' · 노멀':n===3?'어두운 개체':n===4?'밝은 개체':'패턴 많음'}</small><em>브리딩 가능</em></button></article>)}</div></>}
    {context==='shop'&&<><h3>오늘의 매물 <small>외형 배치 예시</small></h3><div className={styles.shop}>{current.sprites.map(c=><article key={c.id}><div className={styles.terrarium}><Pixels sprite={c.sprite} size={144} testId={'preview-shop-'+c.id}/></div><strong>{c.name}</strong><small>노멀 · 성체</small><span className={styles.fakeButton}>구매 영역</span></article>)}</div></>}
    {context==='breeding'&&<><h3>교배 부모 배치</h3><div className={styles.parents}>{[{id:'reference',name:current.sprites[0].name,sprite:current.sprites[0].sprite},{id:focus,name:DESIGNS.find(d=>d.id===focus)!.name,sprite:base(focus)}].map(c=><article key={c.id}><div className={styles.terrarium}><Pixels sprite={c.sprite} size={144} testId={'preview-parent-'+c.id}/></div><strong>{c.name}</strong><small>성체 · 노멀</small></article>)}</div><div className={styles.fakeButton}>교배 버튼 배치</div></>}
    {context==='incubator'&&<><h3>부화한 새끼 배치</h3><div className={styles.slots}>{[...DESIGNS,...DESIGNS].map((d,n)=><article key={n}><span>#{n+1}</span><div className={styles.hatchling}><span className={styles.shell}/><Pixels sprite={base(d.id)} size={48} testId={'preview-baby-'+n}/></div><strong>{d.short}</strong><small>50% 표시</small></article>)}</div></>}
    {context==='lineage'&&<><h3>가족 혈통도</h3><div className={styles.family}>{DESIGNS.map(d=><article key={d.id}><small>{d.id==='B'?'선택 개체':d.id==='A'?'아버지 배치':'어머니 배치'}</small><Pixels sprite={base(d.id)} testId={'preview-family-'+d.id}/><strong>{d.short}</strong><span>노멀 베이스</span></article>)}</div><div className={styles.parents}>{['normal','rich'].map(v=><article key={v}><Pixels sprite={base(focus,v as VariantId)} size={144} testId={'preview-compare-'+v}/><small>{v==='normal'?'기본 베이스':'패턴 변형'}</small></article>)}</div></>}
    <div className={styles.fakeButton}>턴 넘기기 · 배치 검토</div><nav>{(['collection','incubator','lineage','shop'] as const).map(id=><button key={id} aria-pressed={context===id} onClick={()=>setContext(id)}><HomeIcon name={{collection:'collection',incubator:'egg',lineage:'tree',shop:'shop'}[id] as 'collection'|'egg'|'tree'|'shop'} size={24}/>{CONTEXTS.find(c=>c.id===id)!.label.split(' · ')[0]}</button>)}</nav>
   </div>
  </section>
  <p className={styles.note}>새 아트 초안을 96px로 샘플링한 뒤 제한 팔레트·이진 알파·픽셀 윤곽·눈을 정리한 후보입니다. 이번에는 완성된 모프나 유전 모델을 만들지 않습니다. 후보를 채택하더라도 부위 마스크와 모프별 검토는 별도로 필요합니다.</p>
 </main>;
}
