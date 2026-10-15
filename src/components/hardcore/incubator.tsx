"use client";
import {useState} from 'react';
import {BreedingRecord} from './genetics-panel';
import {Dialog,Sprite,type ViewProps} from './common';
import {HomeIcon} from './home-icons';
import {IncubatorEgg} from './incubator-egg';
import {incubatorState,eggProgress,eggNumber} from './incubator-state';
import {V12} from '@/game/hardcore/lifecycle';
import {awaitingPickup,awaitingRemoval} from '@/game/hardcore/brood-care';
import {bornIndividual} from '@/game/hardcore/egg-outcome';
import {morph} from '@/game/hardcore/adapter';
const MATING_LABEL={pending:'수정 결과 대기',fertilized:'수정 성공',failed:'수정 실패',laid:'산란 완료',cancelled:'산란 전 취소'};

export function Incubator({game,busy,play,onDetail,onTab}:ViewProps&{onTab:(tab:string)=>void}){
 const [page,setPage]=useState(0),[limit,setLimit]=useState(12),[help,setHelp]=useState(false),[inspect,setInspect]=useState('');
 const state=incubatorState(game),pages=Math.max(1,Math.ceil(state.slots.length/6)),current=Math.min(page,pages-1);
 const slots=state.slots.slice(current*6,current*6+6),completed=Object.values(game.eggs).filter(e=>e.status!=='incubating'&&(!e.care||e.care.settledTurn!==null)).reverse();
 const matings=Object.values(game.matings).reverse();
 const parents=(fatherId:string,motherId:string)=>`${game.individuals[fatherId].name} × ${game.individuals[motherId].name}`;
 const nextDays=state.nextProgress?.remainingDays;
 return <section className="hc-incubator inc-reference" aria-label="인큐베이터 화면">
  <div className="inc-title"><button className="inc-metal inc-back" aria-label="컬렉션으로 돌아가기" disabled={busy} onClick={()=>onTab('collection')}><HomeIcon name="chevron"/></button><HomeIcon name="egg"/><h1>인큐베이터</h1></div>
  <div className="inc-hero inc-metal" data-testid="incubator-hero">
   <div className="inc-hero-art" aria-hidden="true"/>
   {state.next&&<div className="inc-hero-egg"><IncubatorEgg seed={state.next.seed} large/></div>}
   <div className="inc-digital" aria-label={nextDays===undefined?'부화 대기 알 없음':`다음 부화까지 ${nextDays}일`}>{nextDays===undefined?'대기':nextDays+'일'}</div>
   <div className="inc-info inc-metal"><h2>인큐베이터 정보</h2><dl>
    <div><dt>현재 부화 중</dt><dd data-testid="incubator-active">{state.active.length} / {state.total}</dd></div>
    <div><dt>빈 슬롯</dt><dd data-testid="incubator-free">{state.available}</dd></div>
    <div><dt>부화까지</dt><dd data-testid="incubator-remaining">{state.nextProgress?`${state.nextProgress.remainingDays}일 (${state.nextProgress.remainingTurns}턴)`:'대기 중'}</dd></div>
    <div><dt>부화 성공률</dt><dd>{(state.hatchChance*100).toFixed(1)}% <button className="inc-help" aria-label="부화 확률과 슬롯 규칙" onClick={()=>setHelp(true)}>?</button></dd></div>
   </dl></div>
  </div>
  <section className="inc-slots inc-metal" aria-label="실제 인큐베이터 슬롯"><div className="inc-slot-heading"><HomeIcon name="egg"/><h2>부화 중 <span>{state.active.length} / {state.total}</span></h2></div>
   <div className="inc-slot-grid">{slots.map((slot,index)=>slot.kind==='egg'?(()=>{
    const egg=slot.egg,progress=eggProgress(game,egg),p=egg.embryo.parents!;
    const pickup=awaitingPickup(egg),removal=awaitingRemoval(egg),failure=egg.lifecycle?.failure==='infertile'?'무정란':egg.lifecycle?.failure==='genetic'?'유전적 비생존':'부화 실패';
    return <article className={"inc-slot egg-card inc-metal "+egg.status} key={slot.id} data-testid={'hc-egg-'+egg.id}>
     <div className="inc-egg-picture"><span className="inc-egg-number" title={egg.id}>{eggNumber(game,egg)}</span>
      {pickup?<button type="button" className="inc-care-target inc-newborn" disabled={busy} aria-label={eggNumber(game,egg)+' 새끼 수령'} data-testid={'receive-hatchling-'+egg.id} onClick={()=>void play({type:'receiveHatchling',eggId:egg.id})}><IncubatorEgg seed={egg.seed} variant="broken"/><Sprite gecko={bornIndividual(egg.embryo)}/></button>:
       removal?<button type="button" className="inc-care-target" disabled={busy} aria-label={eggNumber(game,egg)+' '+failure+' 제거'} data-testid={'remove-egg-'+egg.id} onClick={()=>void play({type:'removeFailedEgg',eggId:egg.id})}><IncubatorEgg seed={egg.seed} variant="failed"/></button>:<IncubatorEgg seed={egg.seed}/>}</div>
     {pickup||removal?<p className="inc-time inc-care-label">{pickup?'부화 완료':failure}<span>{pickup?'새끼를 눌러 수령':'알을 눌러 제거'}</span></p>:<><div className="inc-progress" role="progressbar" aria-label={eggNumber(game,egg)+' 부화 진행'} aria-valuenow={progress.percent} aria-valuemin={0} aria-valuemax={100}><i style={{width:progress.percent+'%'}}/></div>
     <p className="inc-time">부화까지 <b>{progress.remainingDays}일</b><span>({progress.remainingTurns}턴)</span></p></>}
     <button className="inc-parents" aria-label={eggNumber(game,egg)+' 부모 정보'} title={parents(p.fatherId,p.motherId)} onClick={()=>setInspect(egg.id)}>{parents(p.fatherId,p.motherId)}</button>
    </article>;
   })():slot.kind==='reserved'?<article className="inc-slot inc-reserved inc-metal" key={slot.id} data-testid="incubator-reserved-slot"><div className="inc-slot-outline"><HomeIcon name="clock"/><strong>{slot.awaitingCollection?"알 수거 대기":"교배 예약"}</strong>{slot.awaitingCollection?<button className="game-secondary" disabled={busy} onClick={()=>void play({type:"collectEggs",matingId:slot.matingId})}>알 2개 수거</button>:<span>{Math.max(0,slot.layTurn-game.turn)}턴 후 산란</span>}<small title={game.individuals[slot.motherId].name}>{game.individuals[slot.motherId].name}</small></div></article>:
    <button className="inc-slot inc-empty inc-metal" key={slot.id} data-testid="incubator-empty-slot" aria-label={`빈 슬롯 ${current*6+index+1} · 부모 선택`} disabled={busy} onClick={()=>onTab('breeding')}><span className="inc-slot-outline"><span className="inc-plus inc-metal"><HomeIcon name="plus"/></span><strong>빈 슬롯</strong><span>교배로 알 배치</span></span></button>)}</div>
   {!slots.length&&<p className="inc-no-space">사용 가능한 슬롯이 없습니다. 보유 공간을 확보하면 알을 배치할 수 있습니다.</p>}
   {pages>1&&<div className="inc-pagination"><button disabled={busy||current===0} onClick={()=>setPage(current-1)}>이전 슬롯</button><span>{current+1} / {pages}</span><button disabled={busy||current===pages-1} onClick={()=>setPage(current+1)}>다음 슬롯</button></div>}
   <p className="sr-only" data-testid="incubator-slots">빈 슬롯 {state.available}개 · 교배당 2개 예약 · 알 수거 시 2개 배치 · 교배 예약 {state.booked}개</p>
  </section>
  <div className="inc-extra"><nav className="inc-tools" aria-label="연구소 도구"><button className="game-secondary" disabled={busy} onClick={()=>onTab('breeding')}>교배</button><button className="game-secondary" disabled={busy} onClick={()=>onTab('home')}>오늘</button></nav>
   <p className="inc-rule-note">1턴 {V12.daysPerTurn}일 · TURN {game.turn} · 교배당 2알 · 수거 후 {V12.hatchAfter}턴 부화</p>
   {game.notices.length>0&&<div className="hc-notices" role="status">{game.notices.slice(-5).map((n,i)=><p key={i}>{n}</p>)}</div>}
   {completed.length>0&&<section className="inc-results"><h2>부화 결과 · {completed.length}</h2><div className="hc-grid">{completed.slice(0,limit).map(e=><article className={'egg-card '+e.status} key={e.id} data-testid={'hc-egg-'+e.id}>
    <span>{eggNumber(game,e)} · {e.status==='hatched'?'부화 완료':e.lifecycle?.failure==='genetic'?'유전적 비생존':e.lifecycle?.failure==='infertile'?'무정란':'부화 실패'}</span>
    {e.status==='hatched'?<><div className="hc-hatch-art"><Sprite gecko={game.individuals[e.embryo.id]}/></div><h3>{game.individuals[e.embryo.id].name}</h3><span className="game-morph">{morph(game.individuals[e.embryo.id])}</span><span>부화 성공 · {e.resolvedDate}</span><button className="game-secondary" onClick={()=>onDetail(e.embryo.id)}>자손 이름과 상세 정보</button></>:<><IncubatorEgg seed={e.seed}/><h3>{e.lifecycle?.failure==='genetic'?'유전적 비생존':e.lifecycle?.failure==='infertile'?'무정란':'부화 실패'}</h3><span>결과 확정 · 공간 해제</span></>}
    <p>부모: {parents(e.embryo.parents!.fatherId,e.embryo.parents!.motherId)}</p><span>Gen {e.embryo.generation}</span>
   </article>)}</div></section>}
   {matings.length>0&&<section className="hc-mating-history"><h2>교배·산란 기록</h2>{matings.slice(0,limit).map(m=><div className="hc-event" key={m.id} data-testid={'mating-'+m.id}><strong>{game.individuals[m.parents.motherId].name} · {MATING_LABEL[m.status]}</strong><span>교배 {m.date}{m.lifecycle?m.status==='fertilized'?` · 산란 0/1 · 산란 예정 TURN ${m.lifecycle.nextLayTurn}`:` · 산란 일정 종료 · 보존된 알 ${Object.values(game.eggs).filter(e=>e.matingId===m.id).length}개`:''}</span><BreedingRecord mating={m} game={game}/></div>)}</section>}
   {(completed.length>limit||matings.length>limit)&&<button className="game-secondary full-width" onClick={()=>setLimit(n=>n+12)}>이전 번식 기록 더 보기</button>}
  </div>
  {inspect&&game.eggs[inspect]&&<Dialog title={eggNumber(game,game.eggs[inspect])+' 알 정보'} onClose={()=>setInspect('')}><p>수컷: {game.individuals[game.eggs[inspect].embryo.parents!.fatherId].name}</p><p>암컷: {game.individuals[game.eggs[inspect].embryo.parents!.motherId].name}</p><p>Gen {game.eggs[inspect].embryo.generation} · 부화 예정 {game.eggs[inspect].dueDate}</p><p>알 ID: {inspect}</p><p>결과는 수거 후 {V12.hatchAfter}턴에 공개됩니다.</p></Dialog>}
  {help&&<Dialog title="부화 확률과 슬롯 규칙" onClose={()=>setHelp(false)}><p>생존 가능한 수정란의 기본 부화 성공률은 {(state.hatchChance*100).toFixed(1)}%입니다. 신규 교배 알마다 무정란 {((1-game.rules.fertilizationChance)*100).toFixed(0)}%, 전체 알 기준 부화 {(game.rules.fertilizationChance*game.rules.hatchChance*100).toFixed(2)}%가 기본 모델입니다. 유전적 비생존은 별도로 부화에 실패하며, 가상 열성 변이의 배아 발달·번식 영향이 추가될 수 있습니다. 수정 여부는 판정 전 공개하지 않습니다.</p><p>1턴 {V12.daysPerTurn}일 · 수거 후 {V12.hatchAfter}턴 판정. 교배 한 번은 슬롯 2개를 예약하고, 2턴 뒤 산란합니다. 컬렉션에서 알 2개를 수거하면 부화가 시작됩니다. 부화한 새끼와 실패 알은 직접 눌러 슬롯에서 수령·제거하세요.</p><p>현재 부화 중 {state.active.length}개 · 교배 예약 {state.booked}개 · 실제 빈 슬롯 {state.available}개. 슬롯은 보유 개체와 공용 공간을 사용합니다. 빈 슬롯의 +는 부모 선택이며 인큐베이터 구매가 아닙니다.</p><p>알 색과 무늬는 고유 시드의 장식입니다. 유전형·성별·무정란 여부를 나타내지 않습니다.</p></Dialog>}
 </section>;
}
