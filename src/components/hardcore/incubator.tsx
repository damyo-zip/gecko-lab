"use client";
import {ObservationImage} from './convenience';
import {useState} from 'react';
import {BreedingRecord} from './genetics-panel';
import {Dialog,Sprite,type ViewProps} from './common';
import {HomeIcon} from './home-icons';
import {IncubatorEgg} from './incubator-egg';
import {IncubatorParents} from './incubator-parents';
import {incubatorState,eggProgress,eggNumber} from './incubator-state';
import {V12} from '@/game/hardcore/lifecycle';
import {awaitingPickup,awaitingRemoval} from '@/game/hardcore/brood-care';
import {bornIndividual} from '@/game/hardcore/egg-outcome';
const MATING_LABEL={pending:'수정 결과 대기',fertilized:'수정 성공',failed:'수정 실패',laid:'산란 완료',cancelled:'산란 전 취소'};

export function Incubator({game,busy,play,onDetail,onTab,onResources}:ViewProps&{onTab:(tab:string)=>void;onResources:()=>void}){
 const [page,setPage]=useState(0),[selectedId,setSelected]=useState(''),[help,setHelp]=useState(false),[limit,setLimit]=useState(12);
 const state=incubatorState(game),pages=Math.max(1,Math.ceil(state.slots.length/6)),current=Math.min(page,pages-1);
 const slots=state.slots.slice(current*6,current*6+6),selected=[...state.occupied,...state.waiting].find(e=>e.id===selectedId)??null;
 const matings=Object.values(game.matings).reverse();
 const changePage=(next:number)=>{setPage(next);setSelected('');};
 return <section className={'hc-incubator inc-reference'+(pages>1?' has-pages':'')} aria-label="인큐베이터 화면">
  <IncubatorParents game={game} egg={selected} onDetail={onDetail}/>
  <section className="inc-slots inc-metal" aria-label="실제 인큐베이터 슬롯">
   <div className="inc-slot-heading"><div><h2><HomeIcon name="egg"/>부화 중 <span data-testid="incubator-active">{state.active.length} / {state.total}</span></h2>
    <p>빈 슬롯 <b data-testid="incubator-free">{state.available}</b><span data-testid="incubator-remaining">{state.nextProgress?`${state.nextProgress.remainingDays}일 (${state.nextProgress.remainingTurns}턴)`:'대기 중'}</span></p>
   </div><button type="button" className="inc-toolbar-button" aria-label="교배 열기" disabled={busy} onClick={()=>onTab('breeding')}><HomeIcon name="heart"/></button><button type="button" className="inc-toolbar-button" aria-label="부화 확률과 슬롯 규칙" onClick={()=>setHelp(true)}>?</button></div>
   <div className="inc-slot-grid">{slots.map((slot,index)=>slot.kind==='egg'?(()=>{
    const egg=slot.egg,progress=eggProgress(game,egg),pickup=awaitingPickup(egg),removal=awaitingRemoval(egg);
    const failure=egg.lifecycle?.failure==='infertile'?'무정란':egg.lifecycle?.failure==='genetic'?'유전적 비생존':'부화 실패';
    const chosen=selected?.id===egg.id;
    return <article className={'inc-slot egg-card inc-metal '+egg.status+(chosen?' selected':'')} key={slot.id} data-testid={'hc-egg-'+egg.id}>
     <button type="button" className={'inc-egg-picture inc-select-egg'+(pickup?' inc-newborn':'')} aria-label={eggNumber(game,egg)+' 알 선택 · 부모 보기'} aria-pressed={chosen} data-testid={'select-egg-'+egg.id} onClick={()=>setSelected(egg.id)}>
      <span className="inc-egg-number">{eggNumber(game,egg)}</span><IncubatorEgg seed={egg.seed} variant={pickup?'broken':removal?'failed':'normal'}/>{pickup&&<ObservationImage gecko={bornIndividual(egg.embryo)} inline><Sprite gecko={bornIndividual(egg.embryo)}/></ObservationImage>}
     </button>
     {pickup||removal?<button type="button" className={'inc-settle '+(pickup?'pickup':'remove')} disabled={busy} aria-label={eggNumber(game,egg)+(pickup?' 새끼 수령':' '+failure+' 제거')} data-testid={(pickup?'receive-hatchling-':'remove-egg-')+egg.id} onClick={()=>void play({type:pickup?'receiveHatchling':'removeFailedEgg',eggId:egg.id})}><strong>{pickup?'새끼 수령':failure+' 제거'}</strong></button>:<>
      <div className="inc-progress" role="progressbar" aria-label={eggNumber(game,egg)+' 부화 진행'} aria-valuenow={progress.percent} aria-valuemin={0} aria-valuemax={100}><i style={{width:progress.percent+'%'}}/></div>
      <p className="inc-time"><b>{progress.remainingDays}일</b> · {progress.remainingTurns}턴 남음</p>
     </>}
    </article>;
   })():slot.kind==='reserved'?<article className="inc-slot inc-reserved inc-metal" key={slot.id} data-testid="incubator-reserved-slot">
    {slot.awaitingCollection?<><button type="button" className={'inc-reserved-select'+(selected?.id===slot.id?' selected':'')} aria-label={eggNumber(game,game.eggs[slot.id])+' 알 선택 · 부모 보기'} aria-pressed={selected?.id===slot.id} onClick={()=>setSelected(slot.id)}><HomeIcon name="clock"/><strong>알 수거 대기</strong><small>{game.individuals[slot.motherId]?.name??'어미 정보 없음'}</small></button><button className="inc-settle pickup" disabled={busy} onClick={()=>void play({type:'collectEggs',matingId:slot.matingId})}>알 2개 수거</button></>:<div className="inc-slot-outline"><HomeIcon name="clock"/><strong>교배 예약</strong><span>{Math.max(0,slot.layTurn-game.turn)}턴 후 산란</span><small title={game.individuals[slot.motherId]?.name}>{game.individuals[slot.motherId]?.name??'정보 없음'}</small></div>}
   </article>:<button className="inc-slot inc-empty inc-metal" key={slot.id} data-testid="incubator-empty-slot" aria-label={`빈 슬롯 ${current*6+index+1} · 부모 선택`} disabled={busy} onClick={()=>onTab('breeding')}><span className="inc-slot-outline"><span className="inc-plus"><HomeIcon name="plus"/></span><strong>빈 슬롯</strong><span>교배로 알 배치</span></span></button>)}</div>
   {!slots.length&&<button type="button" className="inc-no-space" disabled={busy} onClick={onResources}>사용 가능한 슬롯이 없습니다.<br/>보유 공간을 확보해주세요.</button>}
   {pages>1&&<nav className="inc-pagination" aria-label="인큐베이터 슬롯 페이지"><button disabled={busy||current===0} onClick={()=>changePage(current-1)}>이전 슬롯</button><span>{current+1} / {pages}</span><button disabled={busy||current===pages-1} onClick={()=>changePage(current+1)}>다음 슬롯</button></nav>}
   <p className="sr-only" data-testid="incubator-slots">빈 슬롯 {state.available}개 · 교배당 2개 예약 · 알 수거 시 2개 배치 · 교배 예약 {state.booked}개</p>
  </section>
  {help&&<Dialog title="부화 확률과 슬롯 규칙" onClose={()=>setHelp(false)}>
   <p>알이나 새끼 이미지를 누르면 부모를 확인합니다. 새끼 수령·실패 알 제거는 슬롯의 별도 버튼으로 처리합니다.</p>
   <p>1턴 {V12.daysPerTurn}일 · 수거 후 {V12.hatchAfter}턴 판정. 알마다 기본 무정란 {((1-game.rules.fertilizationChance)*100).toFixed(0)}%, 생존 가능한 수정란 부화 성공률 {(state.hatchChance*100).toFixed(1)}%, 전체 알 기준 {(game.rules.fertilizationChance*game.rules.hatchChance*100).toFixed(2)}%입니다. 유전적 비생존·가상 건강 영향은 별도로 적용되며 결과를 재추첨하지 않습니다.</p>
   <p>교배 시 2칸 예약 · 2턴 뒤 산란 · 알 수거 후 부화 시작. 새끼와 실패 알은 수령·제거 전까지 슬롯을 유지합니다. 현재 교배/수거 예약 {state.booked}개 · 실제 빈 슬롯 {state.available}개.</p>
   <button type="button" className="game-secondary full-width" onClick={()=>{setHelp(false);onTab('home');}}>오늘의 연구소</button>
   <section className="hc-mating-history"><h2>교배·산란 기록</h2>{matings.slice(0,limit).map(m=><div className="hc-event" key={m.id} data-testid={'mating-'+m.id}><strong>{game.individuals[m.parents.motherId]?.name??'정보 없음'} · {MATING_LABEL[m.status]}</strong><span>교배 {m.date}{m.lifecycle?m.status==='fertilized'?` · 산란 0/1 · 산란 예정 TURN ${m.lifecycle.nextLayTurn}`:` · 산란 일정 종료 · 보존된 알 ${Object.values(game.eggs).filter(e=>e.matingId===m.id).length}개`:''}</span><BreedingRecord mating={m} game={game}/></div>)}</section>
   {matings.length>limit&&<button className="game-secondary full-width" onClick={()=>setLimit(n=>n+12)}>이전 번식 기록 더 보기</button>}
  </Dialog>}
 </section>;
}
