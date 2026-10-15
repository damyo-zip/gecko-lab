"use client";
import {useMemo,useState} from "react";
import {owned,feedable,reserved} from "@/game/hardcore/survival";
import {morph,specimen,disclosedSex} from "@/game/hardcore/adapter";
import {STAGE_LABELS} from "@/game/model";
import type {Gecko,HardcoreGame} from "@/game/hardcore/model";
import {SpriteCanvas} from "../sprite-canvas";
import {Dialog,type ViewProps} from "./common";
import {HomeIcon} from "./home-icons";
import {isV12,lifeStage,foodDemand} from "@/game/hardcore/lifecycle";
import {PATTERN_FILTERS} from "@/phenotype/rules";
import {collectionEntries,collectionMorph,COLLECTION_MORPHS,COLLECTION_SORTS,type CollectionSort} from "./collection-query";
import {CollectionCatalog} from "./collection-catalog";
import {waitingClutches,waitingForCollection} from "@/game/hardcore/brood-care";
import {IncubatorEgg} from "./incubator-egg";
import {collectionStatus,type CollectionStatus} from "./collection-status";

function Sex({gecko:g}:{gecko:Gecko}) {
  const sex=g.stage==="adult"?g.sex:"unknown";
  return <span className={"home-sex "+sex} aria-label={disclosedSex(g)}>{sex==="unknown"?"?":<HomeIcon name={sex} size={19}/>}</span>;
}
function HomeHearts({gecko}:{gecko:Gecko}) {
  return <span className="home-heart-icons" aria-label={"하트 "+gecko.hearts+"/5"}>{[0,1,2,3,4].map(n=><i key={n} className={n<gecko.hearts?"filled":"empty"}><HomeIcon name="heart" size={15}/></i>)}</span>;
}
function Status({status,placeholder=false,testId}:{status:CollectionStatus;placeholder?:boolean;testId?:string}) {
  return <span className={"home-status "+(status.ready?"ready":"waiting")+(placeholder?" home-status-placeholder":"")} aria-hidden={placeholder||undefined} data-testid={testId}><HomeIcon name={status.ready?"heart":"clock"} size={14}/><span className="home-status-label">{status.label}</span></span>;
}

export function Collection({game,busy,play,onDetail,onShop,onRush,onResources,onBreed}:ViewProps&{onShop:()=>void;onRush:()=>void;onResources:()=>void;onBreed:(id:string)=>void}) {
  const [selectedId,setSelected]=useState(""),[limit,setLimit]=useState(12),[stage,setStage]=useState("all");
  const [filter,setFilter]=useState("all"),[sort,setSort]=useState<CollectionSort>("default"),[columns,setColumns]=useState<2|3>(3),[care,setCare]=useState(false),[catalog,setCatalog]=useState(false);
  const animals=useMemo(()=>owned(game),[game.individuals]),selected=animals.find(g=>g.id===selectedId)??animals[0];
  const art=useMemo(()=>selected?specimen(selected):null,[selected]);
  const visible=useMemo(()=>collectionEntries(animals,{morph:filter,sort,stage}),[animals,filter,sort,stage]);
  const eggPair=(g:Gecko,hero=false)=>{const matingId=waitingClutches(game,g.id)[0],eggs=Object.values(game.eggs).filter(e=>e.matingId===matingId&&waitingForCollection(e));return matingId?<button type="button" className={"home-egg-pair"+(hero?" hero":"")} disabled={busy} aria-label={g.name+" 알 2개 수거"} data-testid={(hero?"hero-collect-eggs-":"collect-eggs-")+g.id} onClick={event=>{event.stopPropagation();void play({type:"collectEggs",matingId});}}><>{eggs.map(egg=><IncubatorEgg key={egg.id} seed={egg.seed}/>)}</><span>알 수거</span></button>:null;};
  const move=(direction:number)=>{const index=animals.findIndex(g=>g.id===selected?.id);setSelected(animals[(index+direction+animals.length)%animals.length].id);};
  return <section className="home-collection" aria-label="홈 컬렉션">
    <div className="home-hero home-frame" data-testid="home-hero">
      <div className="home-generation home-frame"><b>Gen {selected?.generation??"—"}</b><span>{selected?selected.generation+"세대":"컬렉션"}</span><button aria-label="선택 개체 이름 수정" disabled={!selected||busy} onClick={()=>onDetail(selected.id)}><HomeIcon name="pen" size={17}/></button></div>
      {selected&&<><span className="home-id" title={selected.id}>#{String(Object.keys(game.individuals).indexOf(selected.id)+1).padStart(4,"0")}</span>
        <div className="home-hero-art"><SpriteCanvas specimen={art!} growthStage={selected.stage} scale={3} testId="home-hero-sprite"/></div>{eggPair(selected,true)}</>}
      {!selected&&<div className="home-hero-empty"><HomeIcon name="collection" size={48}/><p>첫 게코를 기다리는 테라리움</p><button className="game-secondary" onClick={onShop}>상점에서 시작하기</button></div>}
      <button className="home-arrow previous home-frame" aria-label="이전 개체" disabled={animals.length<2||busy} onClick={()=>move(-1)}><HomeIcon name="chevron"/></button>
      <button className="home-arrow next home-frame" aria-label="다음 개체" disabled={animals.length<2||busy} onClick={()=>move(1)}><HomeIcon name="chevron"/></button>
      <div className="home-info home-frame">
        {selected?<><div className="home-name"><button aria-label="선택 개체 상세 정보" onClick={()=>onDetail(selected.id)}><strong title={selected.name}>{selected.name}</strong><HomeIcon name="pen" size={14}/></button><Sex gecko={selected}/></div>
          <dl className="home-facts"><div><dt>모프</dt><dd title={morph(selected)}>{collectionMorph(selected)}</dd></div><div><dt>세대</dt><dd>{selected.generation}세대 (Gen {selected.generation})</dd></div><div><dt>크기</dt><dd>96×96 ({STAGE_LABELS[selected.stage]})</dd></div><div><dt>성장</dt><dd>{isV12(game)?lifeStage(game,selected):STAGE_LABELS[selected.stage]}</dd></div><div><dt>상태</dt><dd><Status status={collectionStatus(game,selected)}/></dd></div></dl></>:<div className="home-info-empty"><strong>나의 컬렉션</strong><p>개체를 선택하면<br/>브리딩 정보를 볼 수 있어요.</p></div>}
        <div className="home-heart-row">{selected?<HomeHearts gecko={selected}/>:<span>컨디션 관리</span>}<button className="home-frame" aria-label="컨디션 관리" onClick={()=>setCare(true)}>?</button></div>
      </div>
    </div>
    <div className="home-inventory home-frame">
      <div className="home-inventory-heading"><h1><HomeIcon name="leaf" size={21}/>보유 개체 <small>{animals.length} / {game.capacity}</small></h1>
        <div className="home-filters"><select aria-label="모프 필터" value={filter} onChange={e=>{setFilter(e.target.value);setLimit(12);}}><option value="all">모프 전체</option>{Object.entries(COLLECTION_MORPHS).map(([id,label])=><option key={id} value={id}>{label}</option>)}{PATTERN_FILTERS.map(label=><option key={label} value={"pattern:"+label}>{label}</option>)}</select>
          <select aria-label="개체 정렬" value={sort} onChange={e=>setSort(e.target.value as CollectionSort)}>{Object.entries(COLLECTION_SORTS).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select>
          <button className="home-frame" aria-label={columns===3?"2열로 보기":"3열로 보기"} onClick={()=>setColumns(columns===3?2:3)}><HomeIcon name="grid" size={18}/></button></div>
      </div>
      <div className={"home-card-grid hc-grid columns-"+columns}>{visible.slice(0,limit).map(g=>{const status=collectionStatus(game,g);return <article className={"home-card hc-card home-frame "+(g.id===selected?.id?"selected":"")} key={g.id} data-testid={"hc-card-"+g.id}>
        <button className="home-card-select" aria-label={g.name+" 선택"} aria-pressed={g.id===selected?.id} onClick={()=>setSelected(g.id)}>
          <span className="home-gen-badge">Gen {g.generation}</span><div className="home-card-art"><SpriteCanvas specimen={specimen(g)} growthStage={g.stage} scale={3} testId={"hardcore-sprite-"+g.id}/></div>
          <Sex gecko={g}/><strong title={g.name}>{g.name}</strong><span className="home-morph" title={morph(g)}>{collectionMorph(g)}</span><Status status={status} placeholder={!!status.action} testId={status.action?undefined:"collection-status-"+g.id}/>
        </button>
        {eggPair(g)}
        {status.action&&<button type="button" className="home-card-status-action" disabled={busy} data-testid={"collection-status-"+g.id} aria-label={g.name+": "+status.label+(status.action==="breed"?" · 교배 열기":" · 사육장 관리 열기")} onClick={event=>{event.stopPropagation();if(status.action==="expand")onResources();else onBreed(g.id);}}><Status status={status}/></button>}
        <button className="home-card-more home-frame" aria-label={g.name+" 상세보기"} onClick={()=>onDetail(g.id)}><span aria-hidden="true">···</span></button>
      </article>;})}</div>
      {!animals.length?<section className="home-breeder-guide home-frame" aria-labelledby="home-breeder-title">
        <h2 id="home-breeder-title"><HomeIcon name="leaf" size={20}/>첫 게코를 기다리는 시간</h2>
        <p>아직 게코가 없어도 괜찮아요. 파충류 카페에서 아르바이트하며 자금을 모으고, 상점에서 마음에 드는 게코를 찾아보세요.</p>
        <div className="home-breeder-actions">
          <button type="button" className="game-secondary" aria-label="카페 알바하기" disabled={busy} onClick={onRush}><HomeIcon name="coin" size={20}/><span><strong>카페 알바하기</strong><small>돈 모으기</small></span></button>
          <button type="button" className="game-secondary" aria-label="상점 구경하기" disabled={busy} onClick={onShop}><HomeIcon name="shop" size={20}/><span><strong>상점 구경하기</strong><small>매물 둘러보기</small></span></button>
        </div>
        <p className="home-breeder-hint"><HomeIcon name="clock" size={12}/>턴을 넘기며 새로운 게코를 만나보세요.</p>
      </section>:!visible.length&&<div className="home-empty">필터에 맞는 개체가 없습니다.</div>}
      {visible.length>limit&&<button className="game-secondary full-width" onClick={()=>setLimit(n=>n+12)}>개체 더 보기</button>}
    </div>
    {catalog&&<CollectionCatalog game={game} busy={busy} initial={{morph:filter,sort,stage}} onClose={()=>setCatalog(false)} onDetail={id=>{setCatalog(false);setSelected(id);onDetail(id);}}/>}
    {care&&<Dialog title="컨디션 관리" onClose={()=>setCare(false)}><p className="game-section-copy">{game.lastDate} · TURN {game.turn} · {game.time.mode==="turn"?"턴 방식":"한국 자정"}<br/>사육장 {animals.length}+예약 {reserved(game)} / {game.capacity}</p><p className="game-section-copy">하트는 게임용 컨디션입니다. 1턴은 7일이며 생존 개체당 사료 1개를 자동 급여합니다. 미급여 시 하트가 1 감소하고, 0이면 영구 폐사합니다. 상단 먹이 + 버튼에서 사료를 확보하세요. 교배 실행 시 부모 조합의 유전 위험과 근친 여부를 추가로 검사합니다.</p>
      {isV12(game)?<p className="game-section-copy">다음 턴 필요 사료 {foodDemand(game).needed}개 · 재고 {game.food}개 · 부족 {foodDemand(game).missing}개</p>:<button className="game-primary full-width" disabled={busy||!game.food||!animals.some(g=>feedable(game,g))} onClick={()=>play({type:"feedAll"})}>수동 전체 급여 · 먹이 {game.food}개</button>}
      <label className="home-stage-filter">성장 단계 필터<select aria-label="성장 단계 필터" value={stage} onChange={e=>{setStage(e.target.value);setLimit(12);}}><option value="all">전체 성장 단계</option><option value="hatchling">해칭</option><option value="juvenile">아성체</option><option value="adult">성체</option></select></label>
      <button className="game-secondary full-width" aria-label="전체 개체 목록 열기" aria-haspopup="dialog" onClick={()=>{setCare(false);setCatalog(true);}}>전체 개체 목록 · 검색 / 분양가</button>
      <p className="game-small-note">급여는 턴 종료 시 자동 처리합니다. 사료가 부족하면 하트가 적은 개체부터 급여합니다. 카드 더보기에서 이름 수정·분양·유전 정보를 이용할 수 있습니다.</p></Dialog>}
  </section>;
}
