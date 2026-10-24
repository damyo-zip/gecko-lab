"use client";
import {memo,useState} from 'react';
import {BREEDING_CHALLENGES,challengeById,type ChallengeId,isCurrentChallengeId} from '@/game/hardcore/challenge-rules';
import {challengeLockRemaining,challengeFeedSlots,trophySpecimen} from '@/game/hardcore/challenges';
import type {ChallengeCompletion} from '@/game/hardcore/challenges';
import {Dialog,Sprite,type ViewProps} from './common';
import {HomeIcon} from './home-icons';
import {breederRank} from '@/game/hardcore/breeder-rank';
import {forgeChallengePreview as challengePreview,forgeReferenceGecko} from '@/game/hardcore/challenge-previews';
import {SpriteCanvas} from '@/components/sprite-canvas';
import {foodDemand} from '@/game/hardcore/lifecycle';
import {inspectChallenge} from '@/game/hardcore/challenge-observation';
import {challengeExamples} from '@/game/hardcore/challenge-examples';
import {useConvenience} from './convenience';
import {bornIndividual} from '@/game/hardcore/egg-outcome';

type Props=Pick<ViewProps,'game'|'busy'|'play'>;
const ChallengePreview=memo(function ChallengePreview({id,testId='challenge-preview'}:{id:ChallengeId;testId?:string}){
 const {observe}=useConvenience();
 return <button type="button" className="challenge-preview" data-challenge-id={id} aria-label={challengeById(id).target+' 목표 예시 확대 관찰'} onClick={()=>observe(forgeReferenceGecko(id))}>
  <SpriteCanvas specimen={challengePreview(id)} scale={3} testId={testId}/>
 </button>;
});
export function BreedingChallengePanel({game,busy,play}:Props){
 const [open,setOpen]=useState(false),s=game.breedingChallenges,active=s?.activeId?challengeById(s.activeId):null;
 const rank=breederRank(game),remaining=challengeLockRemaining(game),completed=s?.completed??[],done=completed.some(c=>c.challengeId===active?.id);
 return <>
  <section className="breeding-challenge-panel album-metal" aria-labelledby="challenge-title">
   <div className="album-section-title"><HomeIcon name="star"/><h2 id="challenge-title">브리딩 도전</h2><span className="challenge-count">완료 {rank.completed}/8</span></div>
   <div className={'challenge-summary'+(active?' has-preview':'')}>
    <div className="challenge-summary-copy">
     <strong className="challenge-active-name">{active?.name??'도전 목표를 선택하세요'}</strong>
     <p>{active?active.target:'원하는 모프의 새끼를 탄생시키는 나만의 목표를 골라보세요.'}</p>
     <div className="challenge-status"><span>{done?'목표 달성 · 변경 가능':remaining?`목표 변경까지 ${remaining}턴` : active?'목표 유지 중 · 변경 가능':'8개 목표 모두 도전 가능'}</span><small>최초 달성: 15만원 · 사료 30개</small></div>
    </div>
    {active&&<ChallengePreview id={active.id}/>}
   </div>
   <button className="album-small-button" disabled={busy} onClick={()=>setOpen(true)}>전체 도전 목표 보기</button>
  </section>
  {open&&<BreedingChallengeGoals game={game} busy={busy} play={play} onClose={()=>setOpen(false)}/>}
 </>;
}
/** Shared goal picker: lineage and the collection manager use the same state,
 * lock controls, previews and game actions. Closing only dismisses this dialog. */
export function BreedingChallengeGoals({game,busy,play,onClose}:Props&{onClose:()=>void}){
 const s=game.breedingChallenges,active=s?.activeId?challengeById(s.activeId):null;
 const rank=breederRank(game),demand=foodDemand(game),remaining=challengeLockRemaining(game),completed=s?.completed??[];
 return <Dialog title="전체 도전 목표" className="breeding-challenge-dialog" onClose={onClose}>
   <p className="game-small-note">새 게임의 기본 목표는 바로 바꿀 수 있습니다. 목표를 교체하면 5턴 동안 바꿀 수 없습니다. 성공하면 즉시 잠금이 풀립니다. 목표를 선택한 뒤 실제 부화한 개체만 인정합니다.</p>
   <div className="challenge-goals">{BREEDING_CHALLENGES.map(c=>{const record=completed.find(r=>r.challengeId===c.id),selected=active?.id===c.id;return <article key={c.id} className={'challenge-goal'+(selected?' is-selected':'')}>
    <header><h3>{c.name}</h3><span>{record?'완료':selected?'현재 목표':'미완료'}</span></header>
    <div className="challenge-goal-body">
     <div className="challenge-goal-copy"><strong>{c.target}</strong><p>{c.description}</p><p className="challenge-hint">힌트 · {c.hint}</p></div>
     <ChallengePreview id={c.id} testId="challenge-goal-preview"/>
    </div>
    <GoalCriteria id={c.id}/>
    <small>최초 보상: 150,000원 · 사료 30개</small>
    {record&&<Trophy game={game} busy={busy} play={play} record={record}/>}
    <button className="game-secondary full-width" disabled={busy||selected||remaining>0} onClick={()=>play({type:'selectChallenge',challengeId:c.id})}>{selected?'현재 선택한 목표':remaining?`잠금 · ${remaining}턴`:record?'대표 갱신 도전':'이 목표 선택'}</button>
   </article>;})}</div>
   <section className="challenge-rewards"><h3>획득한 보상</h3><p>매 턴 최대 {challengeFeedSlots(game)}마리 먹이 면제</p><small>완료한 도전 2개마다 1마리분의 사료가 자동 면제됩니다. 최대 4마리까지 적용됩니다. 별도 배정 없이 하트가 낮은 개체부터 급여합니다.</small><p>보유 {demand.animals}마리 · 면제 {demand.exempt}마리 · 필요 사료 {demand.needed}개</p>
    <p>현재 칭호: <strong>{rank.title}</strong>{rank.legendary?' · 8개 완주!':''}</p><small>2개 모프 탐구가 · 4개 혈통 설계자 · 6개 모프 마스터 · 8개 전설의 브리더</small><p>8개 완주 보너스: 300,000원{rank.legendary?' · 획득 완료':''}</p><small>서로 다른 목표 {rank.completed}/8개 달성 · 칭호는 자동으로 승급합니다.</small>
   </section>
   <p className="game-small-note">파이어 업 상태의 옆모습을 기준으로 판정합니다. 눈·윤곽·점은 체색 면적에서 제외합니다. 예시와 같은 시드일 필요는 없으며 각 인정 조건을 모두 만족해야 합니다. 완료 뒤에도 같은 목표에서 태어난 성공 개체로 트로피 대표를 바꿀 수 있습니다.</p>
  </Dialog>;
}
/** Player-wide, independent of the manager's selected animal. */
export const BreedingChallengeStatus=memo(function BreedingChallengeStatus({game,busy,play}:Props){
 const [open,setOpen]=useState(false),s=game.breedingChallenges,active=s?.activeId?challengeById(s.activeId):null;
 const remaining=challengeLockRemaining(game),rank=breederRank(game),done=s?.completed.some(c=>c.challengeId===active?.id);
 return <>
  <button type="button" className={'collection-challenge-status'+(!active?' is-empty':'')} aria-label="브리딩 도전 목표 설정" data-testid="collection-challenge" disabled={busy} onClick={()=>setOpen(true)}>
   <span className="collection-challenge-copy"><span className="collection-challenge-heading">브리딩 도전 <small>완료 {rank.completed}/8</small></span>
    <strong title={active?.name}>{active?.target??'진행 중인 브리딩 도전 없음'}</strong>
    <small>{active?`${done?'목표 달성':'도전 중'} · ${remaining?`목표 변경까지 ${remaining}턴`:'변경 가능'}`:'터치해서 도전 목표를 선택하세요'}</small>
   </span>
   {active&&<ChallengePreview id={active.id} testId="collection-challenge-preview"/>}
  </button>
  {open&&<BreedingChallengeGoals game={game} busy={busy} play={play} onClose={()=>setOpen(false)}/>}
 </>;
});
export function ChallengeCelebration({game,completion,busy,play}:Props&{completion:ChallengeCompletion}){
 const c=challengeById(completion.challengeId),rank=breederRank(game),close=()=>{if(!busy)void play({type:'acknowledgeChallenge',challengeId:c.id});};
 return <Dialog title="브리딩 도전 성공!" className="challenge-celebration" onClose={close}>
  <h3>{c.name}</h3><div className="challenge-winner"><Sprite gecko={completion.specimen} large/></div>
  <strong>{completion.specimen.name}</strong><p>{c.target} · {completion.achievedTurn}턴</p><Evidence gecko={completion.specimen} id={c.id}/>
  <p>지원금 150,000원 · 사료 30개 지급 완료{completion.reward.bonus?' · 완주 보너스 300,000원':''}<br/>매 턴 최대 {challengeFeedSlots(game)}마리 면제<br/>현재 브리더 칭호: {rank.title}</p><small>{completion.reward.feedExemptionSlots?'급여 면제 1마리분 추가! 다음 턴 급여부터 자동 적용됩니다.':'두 도전마다 급여 면제와 칭호가 승급합니다.'} 같은 목표의 보상은 다시 지급되지 않습니다.</small>
  <p className="challenge-unlocked">목표 변경 잠금 해제! 다음 목표를 직접 선택하세요.</p>
  <button className="game-primary full-width" disabled={busy} onClick={close}>확인</button>
 </Dialog>;
}

const criteriaCache=new Map<ChallengeId,ReturnType<typeof inspectChallenge>>();
function GoalCriteria({id}:{id:ChallengeId}){
 const [showExamples,setShowExamples]=useState(false),{observe}=useConvenience();
 if(!isCurrentChallengeId(id))return null;
 let result=criteriaCache.get(id);if(!result){result=inspectChallenge(forgeReferenceGecko(id),id);criteriaCache.set(id,result);}
 return <details className="challenge-criteria"><summary>달성 인정 기준</summary><ul>{result.checks.map(c=><li key={c.label}>{c.label} · {c.maximum!==undefined?`${Math.round(c.maximum*100)}% 이하`:c.minimum<1?`${Math.round(c.minimum*100)}% 이상`:c.minimum===1?'필수':`${c.minimum} 이상`}</li>)}</ul><small>색 면적은 옆구리의 실제 노출 색을 측정합니다. 흰색은 밝기·색 편차, 붉은색·주황·황금색은 색상·채도·밝기 범위를 함께 검사합니다.</small><button type="button" className="album-small-button" onClick={()=>setShowExamples(v=>!v)}>{showExamples?'예시 접기':'인정·불인정 예시 보기'}</button>{showExamples&&<div className="challenge-examples">{challengeExamples(id).map((example,n)=><div key={n} data-accepted={example.accepted}><button type="button" className="challenge-example-art" aria-label={challengeById(id).target+' '+(example.accepted?'인정':'불인정')+' 예시 '+(n+1)+' 확대 관찰'} onClick={()=>observe(example.gecko)}><Sprite gecko={example.gecko}/></button><strong>{example.accepted?'인정':'불인정'}</strong><small>{example.reason}{example.accepted?'':' 조건 미달'}</small></div>)}</div>}</details>;
}
function Trophy({game,busy,play,record}:{game:Props['game'];busy:Props['busy'];play:Props['play'];record:ChallengeCompletion}){
 const {observe}=useConvenience(),g=trophySpecimen(game,record),name=game.individuals[g.id]?.name??g.name;
 const parents=g.parents?`${game.individuals[g.parents.fatherId]?.name??g.parents.fatherId} × ${game.individuals[g.parents.motherId]?.name??g.parents.motherId}`:'부모 기록 없음';
 return <div className="challenge-trophy"><div className="challenge-history"><Sprite gecko={g}/><div>{name}<small>{record.achievedTurn}턴 최초 달성 · #{g.id}</small><small>부모 · {parents}</small></div></div>
  <Evidence gecko={g} id={record.challengeId}/>
  <button type="button" className="album-small-button" onClick={()=>observe({...g,name})}>대표 개체 확대 관찰</button>
  {record.trophyEggIds&&<label className="game-small-note">트로피 대표 · 성공 기록 {record.trophyEggIds.length}마리<select aria-label={challengeById(record.challengeId).target+' 트로피 대표'} value={record.representativeEggId} disabled={busy} onChange={e=>void play({type:'setChallengeRepresentative',challengeId:record.challengeId,eggId:e.target.value})}>{record.trophyEggIds.map(id=>{const egg=game.eggs[id],baby=bornIndividual(egg.embryo);return <option key={id} value={id}>{game.individuals[baby.id]?.name??baby.name} · {baby.birthTurn}턴 · #{baby.id}</option>;})}</select></label>}
 </div>;
}

function Evidence({gecko,id}:{gecko:ChallengeCompletion['specimen'];id:ChallengeId}){
 if(!isCurrentChallengeId(id))return null;
 const result=inspectChallenge(gecko,id);
 return <details className="challenge-criteria"><summary>실제 개체의 달성 판정</summary><ul>{result.checks.map(c=><li key={c.label}>{c.label} · {c.minimum===1&&c.maximum===undefined?(c.passed?'충족':'미달'):c.minimum<1||c.maximum!==undefined?`${(c.value*100).toFixed(1)}%`:(Number.isInteger(c.value)?c.value:c.value.toFixed(1))}</li>)}</ul></details>;
}
