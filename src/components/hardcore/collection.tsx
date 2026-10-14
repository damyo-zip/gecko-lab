"use client";
import {useMemo,useState} from "react";
import {owned,feedable,freeSlots,reserved} from "@/game/hardcore/survival";
import {ovulating} from "@/game/hardcore/breeding";
import {morph,specimen,disclosedSex} from "@/game/hardcore/adapter";
import {STAGE_LABELS} from "@/game/model";
import type {Gecko,HardcoreGame} from "@/game/hardcore/model";
import {SpriteCanvas} from "../sprite-canvas";
import {Dialog,type ViewProps} from "./common";
import {HomeIcon} from "./home-icons";
import {isV12,ageTurns,lifeStage,foodDemand} from "@/game/hardcore/lifecycle";
import {appearanceProfile} from "@/game/hardcore/appearance";
import {PATTERN_FILTERS} from "@/phenotype/rules";
import {collectionEntries,collectionMorph,COLLECTION_MORPHS,COLLECTION_SORTS,type CollectionSort} from "./collection-query";
import {CollectionPages} from "./collection-pages";
import {CollectionCatalog} from "./collection-catalog";

function breedingStatus(game:HardcoreGame,g:Gecko) {
  if(isV12(game)&&ageTurns(game,g)>=60)return {ready:false,label:"번식 은퇴"};
  if(g.stage!=="adult")return {ready:false,label:"성장 중"};
  if(g.hearts<=2)return {ready:false,label:"급여 필요"};
  if(g.nextBreedTurn>game.turn||game.lastDate<g.recoverUntil)return {ready:false,label:"대기 중"};
  if(g.sex==="female"&&Object.values(game.matings).some(m=>m.parents.motherId===g.id&&["pending","fertilized"].includes(m.status)))return {ready:false,label:"번식 진행 중"};
  if(g.sex==="female"&&!ovulating(g,game))return {ready:false,label:"배란 대기"};
  if(freeSlots(game)<2)return {ready:false,label:"공간 확보 필요"};
  return {ready:true,label:"브리딩 가능"};
}
function Sex({gecko:g}:{gecko:Gecko}) {
  const sex=g.stage==="adult"?g.sex:"unknown";
  return <span className={"home-sex "+sex} aria-label={disclosedSex(g)}>{sex==="unknown"?"?":<HomeIcon name={sex} size={19}/>}</span>;
}
function HomeHearts({gecko}:{gecko:Gecko}) {
  return <span className="home-heart-icons" aria-label={"하트 "+gecko.hearts+"/5"}>{[0,1,2,3,4].map(n=><i key={n} className={n<gecko.hearts?"filled":"empty"}><HomeIcon name="heart" size={15}/></i>)}</span>;
}
function Status({game,gecko}:{game:HardcoreGame;gecko:Gecko}) {
  const status=breedingStatus(game,gecko);
  return <span className={"home-status "+(status.ready?"ready":"waiting")}><HomeIcon name={status.ready?"heart":"clock"} size={14}/>{status.label}</span>;
}

export function Collection({game,busy,play,onDetail,onShop}:ViewProps&{onShop:()=>void}) {
  const [selectedId,setSelected]=useState(""),[stage,setStage]=useState("all");
  const [filter,setFilter]=useState("all"),[sort,setSort]=useState<CollectionSort>("default"),[care,setCare]=useState(false),[catalog,setCatalog]=useState(false);
  const animals=useMemo(()=>owned(game),[game.individuals]),selected=animals.find(g=>g.id===selectedId)??animals[0];
  const art=useMemo(()=>selected?specimen(selected):null,[selected]);
  const visible=useMemo(()=>collectionEntries(animals,{morph:filter,sort,stage}),[animals,filter,sort,stage]);
  const move=(direction:number)=>{const index=animals.findIndex(g=>g.id===selected?.id);setSelected(animals[(index+direction+animals.length)%animals.length].id);};
  return <section className="home-collection" aria-label="홈 컬렉션">
    <div className="home-hero home-frame" data-testid="home-hero">
      <div className="home-generation home-frame"><b>Gen {selected?.generation??"—"}</b><span>{selected?selected.generation+"세대":"컬렉션"}</span><button aria-label="선택 개체 이름 수정" disabled={!selected||busy} onClick={()=>onDetail(selected.id)}><HomeIcon name="pen" size={17}/></button></div>
      {selected&&<><span className="home-id" title={selected.id}>#{String(Object.keys(game.individuals).indexOf(selected.id)+1).padStart(4,"0")}</span>
        <div className="home-hero-art"><SpriteCanvas specimen={art!} scale={3} testId="home-hero-sprite"/></div></>}
      {!selected&&<div className="home-hero-empty"><HomeIcon name="collection" size={48}/><p>첫 게코를 기다리는 테라리움</p><button className="game-secondary" onClick={onShop}>상점에서 시작하기</button></div>}
      <button className="home-arrow previous home-frame" aria-label="이전 개체" disabled={animals.length<2||busy} onClick={()=>move(-1)}><HomeIcon name="chevron"/></button>
      <button className="home-arrow next home-frame" aria-label="다음 개체" disabled={animals.length<2||busy} onClick={()=>move(1)}><HomeIcon name="chevron"/></button>
      <div className="home-info home-frame">
        {selected?<><div className="home-name"><button aria-label="선택 개체 상세 정보" onClick={()=>onDetail(selected.id)}><strong title={selected.name}>{selected.name}</strong><HomeIcon name="pen" size={14}/></button><Sex gecko={selected}/></div>
          <dl className="home-facts"><div><dt>모프</dt><dd title={morph(selected)}>{collectionMorph(selected)}</dd></div><div><dt>세대</dt><dd>{selected.generation}세대 (Gen {selected.generation})</dd></div><div><dt>크기</dt><dd>96×96 ({STAGE_LABELS[selected.stage]})</dd></div><div><dt>성장</dt><dd>{isV12(game)?lifeStage(game,selected):STAGE_LABELS[selected.stage]}</dd></div><div><dt>상태</dt><dd><Status game={game} gecko={selected}/></dd></div></dl></>:<div className="home-info-empty"><strong>나의 컬렉션</strong><p>개체를 선택하면<br/>브리딩 정보를 볼 수 있어요.</p></div>}
        <div className="home-heart-row">{selected?<HomeHearts gecko={selected}/>:<span>컨디션 관리</span>}<button className="home-frame" aria-label="컨디션 관리" onClick={()=>setCare(true)}>?</button></div>
      </div>
    </div>
    <div className="home-inventory home-frame">
      <div className="home-inventory-heading"><h1><HomeIcon name="leaf" size={21}/>보유 개체 <small>{animals.length} / {game.capacity}</small></h1>
        <div className="home-filters"><select aria-label="모프 필터" value={filter} onChange={e=>{setFilter(e.target.value);}}><option value="all">모프 전체</option>{Object.entries(COLLECTION_MORPHS).map(([id,label])=><option key={id} value={id}>{label}</option>)}{PATTERN_FILTERS.map(label=><option key={label} value={"pattern:"+label}>{label}</option>)}</select>
          <select aria-label="개체 정렬" value={sort} onChange={e=>setSort(e.target.value as CollectionSort)}>{Object.entries(COLLECTION_SORTS).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select>
          <button className="home-frame" aria-label="전체 개체 목록 열기" aria-haspopup="dialog" onClick={()=>setCatalog(true)}><HomeIcon name="grid" size={18}/></button></div>
      </div>
      {visible.length?<CollectionPages game={game} entries={visible} selectedId={selected?.id??""} onSelect={setSelected} onDetail={onDetail} statusFor={breedingStatus} queryKey={filter+":"+sort+":"+stage}/>:<div className="home-empty">{animals.length?"필터에 맞는 개체가 없습니다.":"보유 개체가 없습니다. 상점에서 첫 게코를 데려오세요."}{!animals.length&&<button className="game-secondary" onClick={onShop}>상점 보기</button>}</div>}

    </div>
    {catalog&&<CollectionCatalog game={game} busy={busy} initial={{morph:filter,sort,stage}} onClose={()=>setCatalog(false)} onDetail={id=>{setCatalog(false);setSelected(id);onDetail(id);}}/>}
    {care&&<Dialog title="컨디션 관리" onClose={()=>setCare(false)}><p className="game-section-copy">{game.lastDate} · TURN {game.turn} · {game.time.mode==="turn"?"턴 방식":"한국 자정"}<br/>사육장 {animals.length}+예약 {reserved(game)} / {game.capacity}</p><p className="game-section-copy">하트는 게임용 컨디션입니다. 1턴은 7일이며 생존 개체당 사료 1개를 자동 급여합니다. 미급여 시 하트가 1 감소하고, 0이면 영구 폐사합니다. 상단 먹이 + 버튼에서 사료를 확보하세요. 교배 실행 시 부모 조합의 유전 위험과 근친 여부를 추가로 검사합니다.</p>
      {isV12(game)?<p className="game-section-copy">다음 턴 필요 사료 {foodDemand(game).needed}개 · 재고 {game.food}개 · 부족 {foodDemand(game).missing}개</p>:<button className="game-primary full-width" disabled={busy||!game.food||!animals.some(g=>feedable(game,g))} onClick={()=>play({type:"feedAll"})}>수동 전체 급여 · 먹이 {game.food}개</button>}
      <label className="home-stage-filter">성장 단계 필터<select aria-label="성장 단계 필터" value={stage} onChange={e=>{setStage(e.target.value);}}><option value="all">전체 성장 단계</option><option value="hatchling">해칭</option><option value="juvenile">아성체</option><option value="adult">성체</option></select></label>
      <p className="game-small-note">급여는 턴 종료 시 자동 처리합니다. 사료가 부족하면 하트가 적은 개체부터 급여합니다. 카드 더보기에서 이름 수정·분양·유전 정보를 이용할 수 있습니다.</p></Dialog>}
  </section>;
}
