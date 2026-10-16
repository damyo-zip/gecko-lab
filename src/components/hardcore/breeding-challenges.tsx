"use client";
import {memo,useState} from 'react';
import {BREEDING_CHALLENGES,challengeById,type ChallengeId} from '@/game/hardcore/challenge-rules';
import {challengeLockRemaining,challengeFeedSlots} from '@/game/hardcore/challenges';
import type {ChallengeCompletion} from '@/game/hardcore/challenges';
import {Dialog,Sprite,type ViewProps} from './common';
import {HomeIcon} from './home-icons';
import {breederRank} from '@/game/hardcore/breeder-rank';
import {challengePreview} from '@/game/hardcore/challenge-previews';
import {SpriteCanvas} from '@/components/sprite-canvas';

type Props=Pick<ViewProps,'game'|'busy'|'play'>;
const ChallengePreview=memo(function ChallengePreview({id,testId='challenge-preview'}:{id:ChallengeId;testId?:string}){
 return <div className="challenge-preview" data-challenge-id={id}>
  <SpriteCanvas specimen={challengePreview(id)} scale={3} testId={testId}/>
 </div>;
});
export function BreedingChallengePanel({game,busy,play}:Props){
 const [open,setOpen]=useState(false),s=game.breedingChallenges,active=s?.activeId?challengeById(s.activeId):null;
 const rank=breederRank(game),remaining=challengeLockRemaining(game),completed=s?.completed??[],done=completed.some(c=>c.challengeId===active?.id);
 return <>
  <section className="breeding-challenge-panel album-metal" aria-labelledby="challenge-title">
   <div className="album-section-title"><HomeIcon name="star"/><h2 id="challenge-title">브리딩 도전</h2><span className="challenge-count">완료 {rank.completed}/5</span></div>
   <div className={'challenge-summary'+(active?' has-preview':'')}>
    <div className="challenge-summary-copy">
     <strong className="challenge-active-name">{active?.name??'도전 목표를 선택하세요'}</strong>
     <p>{active?active.target:'원하는 모프의 새끼를 탄생시키는 나만의 목표를 골라보세요.'}</p>
     <div className="challenge-status"><span>{done?'목표 달성 · 변경 가능':remaining?`목표 변경까지 ${remaining}턴` : active?'목표 유지 중 · 변경 가능':'5개 목표 모두 도전 가능'}</span><small>최초 달성: 먹이 면제 슬롯 +1 · 칭호 승급</small></div>
    </div>
    {active&&<ChallengePreview id={active.id}/>}
   </div>
   <button className="album-small-button" disabled={busy} onClick={()=>setOpen(true)}>전체 도전 목표 보기</button>
  </section>
  {open&&<Dialog title="전체 도전 목표" className="breeding-challenge-dialog" onClose={()=>setOpen(false)}>
   <p className="game-small-note">선택하면 10턴 동안 목표를 바꿀 수 없습니다. 성공하면 즉시 잠금이 풀립니다. 목표를 선택한 뒤 실제 부화한 개체만 인정합니다.</p>
   <div className="challenge-goals">{BREEDING_CHALLENGES.map(c=>{const record=completed.find(r=>r.challengeId===c.id),selected=active?.id===c.id;return <article key={c.id} className={'challenge-goal'+(selected?' is-selected':'')}>
    <header><h3>{c.name}</h3><span>{record?'완료':selected?'현재 목표':'미완료'}</span></header>
    <div className="challenge-goal-body">
     <div className="challenge-goal-copy"><strong>{c.target}</strong><p>{c.description}</p><p className="challenge-hint">힌트 · {c.hint}</p></div>
     <ChallengePreview id={c.id} testId="challenge-goal-preview"/>
    </div>
    <small>보상: 먹이 면제 슬롯 +1 · 브리더 칭호 승급</small>
    {record&&<div className="challenge-history"><Sprite gecko={record.specimen}/><div>{record.specimen.name}<small>{record.morph} · {record.achievedTurn}턴 달성</small><small>#{record.specimen.id}</small></div></div>}
    <button className="game-secondary full-width" disabled={busy||!!record||selected||remaining>0} onClick={()=>play({type:'selectChallenge',challengeId:c.id})}>{record?'달성 완료':selected?'현재 선택한 목표':remaining?`잠금 · ${remaining}턴`:'이 목표 선택'}</button>
   </article>;})}</div>
   <section className="challenge-rewards"><h3>획득한 보상</h3><p>먹이 면제 슬롯 {challengeFeedSlots(game)}개 적립</p><small>먹이 면제 기능은 아직 없어 슬롯을 보관합니다. 현재 자동 급여 규칙은 유지됩니다.</small>
    <p>현재 칭호: <strong>{rank.title}</strong></p><small>서로 다른 목표 {rank.completed}/5개 달성 · 칭호는 자동으로 승급합니다.</small>
   </section>
   <p className="game-small-note">현재는 렌더링된 무늬 면적과 체색의 게임용 임시 기준입니다. 이전 외형 버전은 정밀 판정할 수 없으며, 팬텀 유전자와 실제 전신 품질을 검증하지 않습니다.</p>
  </Dialog>}
 </>;
}
export function ChallengeCelebration({game,completion,busy,play}:Props&{completion:ChallengeCompletion}){
 const c=challengeById(completion.challengeId),rank=breederRank(game),close=()=>{if(!busy)void play({type:'acknowledgeChallenge',challengeId:c.id});};
 return <Dialog title="브리딩 도전 성공!" className="challenge-celebration" onClose={close}>
  <h3>{c.name}</h3><div className="challenge-winner"><Sprite gecko={completion.specimen} large/></div>
  <strong>{completion.specimen.name}</strong><p>{completion.morph} · {completion.achievedTurn}턴</p>
  <p>먹이 면제 슬롯 +1 적립<br/>현재 브리더 칭호: {rank.title}</p><small>목표 최초 달성 수에 따라 자동으로 승급합니다.</small>
  <p className="challenge-unlocked">목표 변경 잠금 해제! 다음 목표를 직접 선택하세요.</p>
  <button className="game-primary full-width" disabled={busy} onClick={close}>확인</button>
 </Dialog>;
}
