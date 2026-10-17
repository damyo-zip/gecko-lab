import styles from './study.module.css';

export const metadata={title:'GECKO LAB — 최초 B · 노멀 픽셀아트 3종',robots:{index:false,follow:false}};
const arts=[
 {id:'original',name:'원본 B'},
 {id:'ribbon',name:'연결형'},
 {id:'islands',name:'섬무늬형'},
] as const;

function Gallery({kind}:{kind:'collection'|'shop'|'native'|'zoom'}){
 return <div className={`${styles.gallery} ${styles[kind]}`} data-testid={'trio-'+kind}>
  {arts.map(art=><figure key={art.id}>
   <a href={'/lab/b-native-trio/'+art.id+'.png'} target="_blank" rel="noreferrer" aria-label={art.name+' PNG 열기'}>
    <img src={'/lab/b-native-trio/'+art.id+'.png'} width={96} height={96} alt={art.name} draggable={false}/>
   </a>
   <figcaption>{art.name}</figcaption>
  </figure>)}
 </div>;
}

export default function Page(){
 return <main className={styles.page}>
  <header className={styles.header}>
   <img src="/ui/home-wordmark.svg" width={240} height={49} alt="GECKO LAB"/>
   <h1>최초 B · 노멀 3종</h1>
   <p>같은 얼굴·자세·체색을 유지하고, 몸통과 꼬리의 무늬를 96×96 픽셀 좌표로 직접 편집했습니다.</p>
   <nav aria-label="비교 크기"><a href="#cards">카드 크기</a><a href="#native">96×96</a><a href="#zoom">3배 확대</a><a href="#png">PNG</a></nav>
  </header>
  <div id="cards" className={styles.cardPreviews}>
   <section><h2>컬렉션 카드</h2><Gallery kind="collection"/></section>
   <section><h2>상점 카드</h2><Gallery kind="shop"/></section>
  </div>
  <section id="native"><h2>96×96 원본 크기</h2><Gallery kind="native"/></section>
  <section id="zoom"><h2>3배 확대</h2><Gallery kind="zoom"/></section>
  <section id="png"><h2>개별 PNG</h2><div className={styles.downloads}>{arts.map(art=><a key={art.id} href={'/lab/b-native-trio/'+art.id+'.png'} download={'B-'+art.id+'-96.png'}>{art.name}</a>)}</div></section>
  <footer className={styles.footer}>외형 검토용 아트입니다. 정식 게임·유전·모프 분류·가격·저장에는 연결하지 않습니다.</footer>
 </main>;
}
