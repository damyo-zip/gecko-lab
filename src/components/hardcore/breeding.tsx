"use client";
import {displayAge} from '@/game/hardcore/family-album';
import { useMemo, useState } from 'react';
import { breedingCheck } from '@/game/hardcore/breeding';
import { breedingRisk } from '@/game/hardcore/breeding-risk';
import { freeSlots } from '@/game/hardcore/survival';
import { lifecycleRules, lifeStage } from '@/game/hardcore/lifecycle';
import {koreanMorphText} from '@/phenotype/display-name';
import { visualName } from '@/game/hardcore/adapter';
import { appearanceProfile } from '@/game/hardcore/appearance';
import { familyTree } from '@/game/hardcore/family-album';
import { Sprite, Dialog, type ViewProps } from './common';
import { HomeIcon } from './home-icons';
import { GeneticForecast, GeneticsGuide } from './genetics-panel';
import type { Gecko } from '@/game/hardcore/model';
import { ParentSearch } from './parent-search';

function Parent({g,sex,game,busy,onDetail,onSearch}:Pick<ViewProps,'game'|'busy'|'onDetail'> & {g:Gecko|undefined;sex:'male'|'female';onSearch:(sex:'male'|'female')=>void}){
    const traits=g?appearanceProfile(g)?.names.features.slice(0,3)??[]:[];
    return <article className={'parent-summary breed-parent '+sex} data-testid={'breed-parent-'+sex} data-parent-id={g?.id??''}>
      <div className="breed-parent-heading"><HomeIcon name={sex}/><strong>{g?.name??(sex==='male'?'수컷 선택':'암컷 선택')}</strong>
        {g&&<small title={g.id}>#{g.id.split('-').slice(-2).join('-')}</small>}
        <button disabled={!g||busy} aria-label={(sex==='male'?'수컷':'암컷')+' 상세 정보'} onClick={()=>g&&onDetail(g.id)}><HomeIcon name="search"/></button></div>
      <div className="breed-parent-art">{g?<Sprite gecko={g} large/>:<div className="breed-parent-empty"><HomeIcon name="leaf" size={52}/><span>부모를 선택해주세요</span></div>}</div>
      <div className="breed-parent-caption"><strong title={g?visualName(g):''}>{g?visualName(g):'나의 게코'}</strong>
        <span>{g?`${lifeStage(game,g)} · ${displayAge(game,g)}`:'성체 개체를 선택하세요'}</span>
        {g&&<small className="breed-parent-id" title={g.id}>#{g.id.split("-").slice(-2).join("-")}</small>}
        <div className="breed-trait-chips">{traits.map(t=><span key={t}>{t}</span>)}{g&&<span>{g.generation}세대</span>}</div>
      </div>
      <button type="button" className="breed-change" aria-label={sex==='male'?'수컷 개체 변경':'암컷 개체 변경'} disabled={busy} onClick={()=>onSearch(sex)}><HomeIcon name="refresh"/><span>개체 변경</span></button>
    </article>;
  }

export function Breeding({game,busy,play,onDetail,fatherId,motherId,onFather,onMother,onStarted,onClose,onResources}:ViewProps & {
  fatherId:string;motherId:string;onFather:(id:string)=>void;onMother:(id:string)=>void;onStarted:()=>void;onClose:()=>void;onResources:()=>void;
}) {
  const [information,setInformation]=useState<'genetics'|'family'|null>(null),[confirmation,setConfirmation]=useState<string|null>(null);
  const [searchSex,setSearchSex]=useState<'male'|'female'|null>(null);
  const father=game.individuals[fatherId],mother=game.individuals[motherId],check=breedingCheck(game,fatherId,motherId);
  const risk=useMemo(()=>father&&mother?breedingRisk(game,father,mother):null,[game,father,mother]);
  async function mate(acknowledged?:string){
    if(await play({type:'breed',fatherId,motherId,riskAcknowledgement:acknowledged}))onStarted();
  }
  return <Dialog title={<><HomeIcon name="heart"/><span>교배</span><HomeIcon name="leaf"/></>} onClose={onClose} className="breed-dialog"><section className="hc-breeding breed-reference">
    <div className="breed-parent-grid"><Parent g={father} sex="male" game={game} busy={busy} onDetail={onDetail} onSearch={setSearchSex}/><div className="breed-pair-symbol" aria-hidden="true"><HomeIcon name="heart"/><span>×</span></div><Parent g={mother} sex="female" game={game} busy={busy} onDetail={onDetail} onSearch={setSearchSex}/></div>
    <div className="breed-status-grid">
      <div className={check.reasons.length?'breed-unavailable':'breed-ready'}><span className="breed-status-icon">{check.reasons.length?'!':'✓'}</span><strong>{check.reasons.length?'조건 확인':'교배 가능'}</strong><small>{check.reasons.length?'일반 교배 조건을 확인하세요.':risk?.warnings.length?'주의 사항 확인 후 진행합니다.':'두 개체 모두 교배 조건을 충족합니다.'}</small></div>
      <div><HomeIcon name="heart"/><strong>혈연 관계</strong><small data-testid="breeding-relationship">{risk?.relationship??'부모 선택 대기'}{risk&&<span>기록 기준 F {(risk.pedigree.coefficient*100).toFixed(2)}%</span>}</small></div>
      <div><HomeIcon name="egg"/><strong>인큐베이터</strong><small data-testid="breeding-slots">{freeSlots(game)<2?<button type="button" className="housing-shortage" disabled={busy} onClick={onResources}>빈 슬롯 {freeSlots(game)}개 · 필요 2개 · 공간 확보</button>:<>빈 슬롯 {freeSlots(game)}개<span> · 필요 2개</span></>}</small></div>
    </div>
    {check.reasons.length>0&&<div className="game-warning" role="status">{check.reasons.map(r=><p key={r}>{r.includes("공간")?<button type="button" className="housing-shortage" disabled={busy} onClick={onResources}>{r}</button>:r}</p>)}</div>}
    {risk?.warnings.length?<p className="breed-caution" data-testid="breeding-caution">{risk.warnings.map(w=>w.title).join(' · ')} · 실행 전 확인</p>:null}
    <div className="breed-info-actions"><button aria-label="혈통 비교" disabled={!father||!mother||busy} onClick={()=>setInformation('family')}><HomeIcon name="tree"/><span><strong>혈통 비교</strong><small>부모와 조상 확인</small></span><HomeIcon name="chevron"/></button>
      <button aria-label="유전 정보" disabled={busy} onClick={()=>setInformation('genetics')}><HomeIcon name="dna"/><span><strong>유전 정보</strong><small>형질과 유전 가능성</small></span><HomeIcon name="chevron"/></button></div>
    <button className="breed-submit breed-button" aria-label="교배하기" data-testid="breed-submit" disabled={busy||!!check.reasons.length} onClick={()=>{if(risk?.warnings.length)setConfirmation(risk.acknowledgement);else void mate();}}><HomeIcon name="heart"/><span>교배하기</span></button>
    {information==='genetics'&&<Dialog title="유전 정보" onClose={()=>setInformation(null)}>{father&&mother?<GeneticForecast father={father} mother={mother}/>:<p>부모를 선택하면 공개 정보에 따른 자손 확률을 확인할 수 있습니다.</p>}<p>교배 1회 · 2칸 예약 · {lifecycleRules(game).firstLayAfter}턴 후 알 2개 산란 · 알 수거 후 {lifecycleRules(game).hatchAfter}턴 판정 · 부화 후 {game.rules.adultAfter}개월 성체</p><p>기본 무정란 5% · 생존 가능한 수정란의 기본 부화 성공률 95%. 실제 배아별 유전적 영향이 추가로 적용될 수 있습니다.</p><GeneticsGuide/></Dialog>}
    {information==='family'&&father&&mother&&<Dialog title="혈통 비교" onClose={()=>setInformation(null)}><div className="breed-family-comparison">{[father,mother].map(g=>{const tree=familyTree(game,g.id),roles:Record<string,string>={current:'선택한 부모',father:'아버지',mother:'어머니',paternalGrandfather:'친가 할아버지',paternalGrandmother:'친가 할머니',maternalGrandfather:'외가 할아버지',maternalGrandmother:'외가 할머니'};return <section key={g.id}><h3>{g.name}</h3>{Object.entries(tree).map(([role,relative])=><div key={role}><small>{roles[role]}</small>{relative?<><Sprite gecko={relative}/><strong>{relative.name}</strong><small>{relative.id}</small><span>{visualName(relative)}</span></>:<span>정보 없음</span>}</div>)}</section>;})}</div><p>{risk?.relationship} · 예상 자손 F {((risk?.pedigree.coefficient??0)*100).toFixed(2)}%</p><p>기록 없는 시조와 부모 {risk?.pedigree.founderAssumptions}개를 비근친·상호 비혈연으로 가정한 계산입니다. 실제 비혈연이 확인되었다는 뜻은 아닙니다.</p></Dialog>}
    {risk&&confirmation===risk.acknowledgement&&<Dialog title="교배 전 위험 확인" onClose={()=>setConfirmation(null)} className="breed-risk-dialog">
      {risk.warnings.map(w=><section key={w.code}><h3>{w.title}</h3><p>{koreanMorphText(w.message)}</p></section>)}
      <p className="game-small-note">기록 없는 조상은 비근친·상호 비혈연으로 가정합니다. 숨은 유전 정보는 공개하지 않습니다. 실제 결과는 각 알의 상속된 유전형에 따라 달라집니다.</p>
      <div className="breed-risk-actions"><button className="game-secondary" disabled={busy} onClick={()=>setConfirmation(null)}>취소</button><button className="game-primary" disabled={busy} onClick={()=>void mate(confirmation)}>위험을 확인하고 교배하기</button></div>
    </Dialog>}
    {searchSex&&<ParentSearch game={game} busy={busy} sex={searchSex} currentId={searchSex==='male'?fatherId:motherId} opponentId={searchSex==='male'?motherId:fatherId} onClose={()=>setSearchSex(null)} onSelect={id=>{setConfirmation(null);(searchSex==='male'?onFather:onMother)(id);setSearchSex(null);}}/>}
  </section></Dialog>;
}
