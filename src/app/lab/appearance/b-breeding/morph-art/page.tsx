import {MORPH_ART} from '@/lab/appearance/morph-art/assets';
import styles from './study.module.css';

export const metadata={title:'GECKO LAB — B 모프별 독립 아트 6종',robots:{index:false,follow:false}};

function Gallery({kind}:{kind:'native'|'zoom'|'collection'|'shop'}){
 return <div className={`${styles.gallery} ${styles[kind]}`} data-testid={'morph-art-'+kind}>
  {MORPH_ART.map(art=><figure key={art.id}>
   <a href={'/lab/b-morph-art/'+art.id+'.png'} target="_blank" rel="noreferrer" aria-label={art.name+' PNG 열기'}>
    <img src={'/lab/b-morph-art/'+art.id+'.png'} alt={art.name} width={96} height={96} draggable={false}/>
   </a>
   <figcaption>{art.name}</figcaption>
  </figure>)}
 </div>;
}

export default function Page(){
 return <main className={styles.page}>
  <header className={styles.header}>
   <a href="/lab/appearance/b-breeding">← B 외형 실험</a>
   <h1>B · 모프별 독립 아트</h1>
   <p>모프별로 따로 제작한 고정 PNG 6종입니다. 이미지 생성 도구로 제작한 시안을 96×96·제한 팔레트로 정리했습니다. 정식 게임과 유전·가격·저장에는 연결하지 않습니다.</p>
   <nav aria-label="비교 크기"><a href="#native">96×96</a><a href="#zoom">3배 확대</a><a href="#cards">카드 크기</a><a href="#png">PNG</a></nav>
  </header>
  <section id="native"><h2>96×96</h2><Gallery kind="native"/></section>
  <section id="zoom"><h2>3배 확대</h2><Gallery kind="zoom"/></section>
  <section id="cards"><h2>컬렉션 카드 크기</h2><Gallery kind="collection"/>
   <h2>상점 카드 크기</h2><Gallery kind="shop"/></section>
  <section id="png"><h2>개별 PNG</h2><div className={styles.downloads}>{MORPH_ART.map(art=><a key={art.id} href={'/lab/b-morph-art/'+art.id+'.png'} download={art.id+'-96.png'}>{art.name}</a>)}</div></section>
 </main>;
}
