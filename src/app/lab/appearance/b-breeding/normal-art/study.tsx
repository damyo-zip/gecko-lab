'use client';
import {useState} from 'react';
import {NORMAL_ART} from '@/lab/appearance/b-breeding/normal-art/art';
import {renderNormalArt,normalPatternMask,NORMAL_ART_VERSION} from '@/lab/appearance/b-breeding/normal-art/render';
import {measureNormalArt} from '@/lab/appearance/b-breeding/normal-art/measure';
import {StudyPixels as Pixels} from '@/lab/appearance/pixels';
import styles from './study.module.css';

const samples=NORMAL_ART.map(d=>({...d,sprite:renderNormalArt(d.id),mask:normalPatternMask(d.id),metrics:measureNormalArt(d.id)}));
const shortName=(s:string)=>s.split(' · ')[1];
export default function NormalArtStudy(){
 const[view,setView]=useState<'collection'|'shop'>('collection'),[stage,setStage]=useState<'adult'|'juvenile'|'hatchling'>('adult');
 const scale={adult:1,juvenile:.75,hatchling:.5}[stage];
 return <main className={styles.page}>
  <nav><a href="/lab/appearance/bases">최초 B 원본</a><a href="/lab/appearance/b-breeding/families">기존 B-pattern-family-1</a></nav>
  <header><small>{NORMAL_ART_VERSION} / NORMAL ONLY</small><h1>B · 노멀 패턴 아트 8종</h1><p>같은 바디·체색 위에 등, 옆구리, 꼬리의 완성형 무늬를 각각 그린 비교입니다. 첫 번째는 최초 B 원본 그대로입니다. 정식 게임과 유전·저장 데이터에는 연결하지 않습니다.</p></header>
  <section><h2>96×96 원본 크기</h2><p>얼굴과 실루엣은 동일합니다. 무늬의 큰 배치와 갈색 여백을 비교하세요. 좁은 화면에서는 이 영역을 좌우로 밀 수 있습니다.</p>
   <div className={styles.scroll} tabIndex={0} aria-label="노멀 8종 원본 크기 비교" data-testid="normal-native-pane"><div className={styles.nativeRow}>{samples.map(d=><figure key={d.id}><figcaption>{d.name}</figcaption><div className={styles.native}><Pixels sprite={d.sprite} testId={'normal-native-'+d.id}/></div></figure>)}</div></div>
  </section>
  <section><h2>3배 확대 · 같은 배경</h2><div className={styles.gallery}>{samples.map(d=><article key={d.id} data-testid={'normal-design-'+d.id}><h3>{d.name}</h3><div className={styles.art}><Pixels sprite={d.sprite} size={288} testId={'normal-zoom-'+d.id}/></div><p>{d.concept}</p><small>{d.reference}</small></article>)}</div></section>
  <section><h2>게임 카드 크기에서 비교</h2><p>컬렉션 3열과 상점 2열의 아트 배치·배경을 재현한 미리보기입니다. 모두 비교용 그림이며 보유 개체나 판매 매물이 아닙니다. 축소는 이 영역에만 한 번 적용합니다.</p>
   <div className={styles.controls}><div role="group" aria-label="카드 배치"><button aria-pressed={view==='collection'} onClick={()=>setView('collection')}>컬렉션 3열</button><button aria-pressed={view==='shop'} onClick={()=>setView('shop')}>상점 2열</button></div><label>성장 표시<select aria-label="성장 표시" value={stage} onChange={e=>setStage(e.target.value as typeof stage)}><option value="adult">성체 · 100%</option><option value="juvenile">아성체 · 75%</option><option value="hatchling">해칭 · 50%</option></select></label></div>
   <div className={styles.phone} data-testid="normal-cards"><img className={styles.logo} src="/ui/home-wordmark.svg" alt="GECKO LAB"/><div className={view==='collection'?styles.collection:styles.shop} data-testid={'normal-'+view+'-grid'}>{samples.map(d=><article key={d.id}><div className={styles.cardArt}><div style={{transform:`scale(${scale})`}} data-testid={'normal-growth-'+d.id}><Pixels sprite={d.sprite} size={288} testId={'normal-card-'+d.id}/></div></div><strong>{shortName(d.name)}</strong><small>노멀 · 아트 {d.name.slice(0,2)}</small><span className={styles.cardState}>{stage==='adult'?'성체':stage==='juvenile'?'아성체':'해칭'} · 비교용</span>{view==='shop'&&<span className={styles.buy}>외형 비교 샘플</span>}</article>)}</div></div>
  </section>
  <details><summary>주요 패턴 마스크 보기</summary><p>크림색은 새로 그린 주요 무늬, 회청색은 변경 가능한 피부입니다. 어두운 얼굴·눈·잉크·실루엣은 고정 영역입니다. 고정된 얼굴과 크레스트의 크림은 아래 면적에 포함하지 않습니다.</p><div className={styles.maskGrid}>{samples.map(d=><figure key={d.id}><figcaption>{d.name}</figcaption><Pixels sprite={d.mask} size={192} testId={'normal-mask-'+d.id}/><small>크림 {d.metrics.area}px · 덩어리 {d.metrics.components}개</small></figure>)}</div></details>
  <section><h2>유전 점수와 연결한다면</h2><p>8종을 피복·연결의 두 점수에 순서대로 배정하지 않습니다. 먼저 아래 특징으로 후보를 좁히고, 필요한 경우 기존 하위 좌위의 파생값과 아트 배치를 활용하는 방향을 제안합니다. 이번 화면은 자동 선택이나 실제 교배를 실행하지 않습니다.</p>
   <div className={styles.scroll} tabIndex={0} aria-label="패턴 구조 관찰값"><table><caption>실제 96px 마스크의 관찰값 · 유전 점수나 품질 점수가 아닙니다</caption><thead><tr><th>아트</th><th>면적</th><th>등 / 측면 / 꼬리 / 사지 (px)</th><th>덩어리 수</th><th>최대 덩어리 비율</th><th>경계 복잡도</th></tr></thead><tbody>{samples.map(d=><tr key={d.id}><th>{shortName(d.name)}</th><td>{Math.round(d.metrics.coverage*100)}%</td><td>{d.metrics.back} / {d.metrics.flank} / {d.metrics.tail} / {d.metrics.limbs}</td><td>{d.metrics.components}</td><td>{Math.round(d.metrics.largestFraction*100)}%</td><td>{d.metrics.boundary.toFixed(1)}</td></tr>)}</tbody></table></div><p className={styles.note}>덩어리는 4방향으로 연결된 3px 이상 크림 조각, 최대 비율은 전체 크림 중 가장 큰 덩어리입니다. 경계 복잡도는 외곽 변의 수 ÷ √면적입니다. 얼굴 보호선·가려진 부위가 덩어리를 나눌 수 있으며 실제 게코의 해부학적 측정값은 아닙니다.</p>
   <div className={styles.mapping}>{samples.map(d=><article key={d.id}><h3>{d.name}</h3><p>{d.genes}</p><small>{d.gap}</small></article>)}</div>
  </section>
  <section className={styles.note}><h2>이번 초안에서 더 확인할 점</h2><p>넓은 등무늬형·측면 대형 패턴형·연결형은 큰 무늬 배치의 차이를 보기 좋습니다. 세밀한 분리형은 작은 카드에서 조각이 합쳐 보일 수 있고, 빗살 창작형은 더 자연스러운 경계 다듬기가 필요합니다. 저패턴형은 원화의 색 무늬를 새 피부색으로 대체한 부분의 질감이 원본과 완전히 같지 않습니다.</p><p>플레임·할리퀸·패턴리스·타이거/브린들은 기존 브리더 용어를 참고한 방향입니다. ‘세 섬’·‘연결형’·‘빗살’은 아트 설명이며 새로운 모프명이 아닙니다. 원화·기존 패턴군을 보존했고, 유전 좌위·명칭·가격·도전 판정은 바꾸지 않았습니다.</p></section>
 </main>;
}
