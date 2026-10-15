import {useMemo} from 'react';
import type {Gecko,HardcoreGame,TimedEgg} from '@/game/hardcore/model';
import {appearanceProfile} from '@/game/hardcore/appearance';
import {specimen,visualName,disclosedSex} from '@/game/hardcore/adapter';
import {Sprite} from './common';
import {HomeIcon} from './home-icons';

/** Resolve archived/sold/dead parents from the same pedigree records as the collection. */
export function eggParents(game:HardcoreGame,egg:TimedEgg){
 const ids=egg.embryo.parents??(egg.matingId?game.matings[egg.matingId]?.parents:null);
 return {mother:ids?game.individuals[ids.motherId]??null:null,father:ids?game.individuals[ids.fatherId]??null:null};
}
function visibleFeatures(g:Gecko){
 const profile=appearanceProfile(g);
 if(profile)return [profile.names.color,...profile.names.features].filter(Boolean).join(' · ')||'기본 패턴';
 const art=specimen(g).appearance,colors={orange:'오렌지',brown:'브라운',cream:'크림',slate:'회색'};
 return [colors[art.bodyColor]+' 체색',art.spotCount?'반점 표현':art.flankCoverage>.5?'풍부한 측면 패턴':'등 패턴'].join(' · ');
}
export function IncubatorParents({game,egg,onDetail}:{game:HardcoreGame;egg:TimedEgg|null;onDetail:(id:string)=>void}){
 const parents=useMemo(()=>egg?eggParents(game,egg):null,[game.individuals,game.matings,egg]);
 const rows=useMemo(()=>parents?[{label:'어미',sex:'female' as const,gecko:parents.mother},{label:'아비',sex:'male' as const,gecko:parents.father}].map(row=>({...row,features:row.gecko?visibleFeatures(row.gecko):''})):[],[parents]);
 return <div className={'inc-hero inc-metal'+(egg?' has-selection':'')} data-testid="incubator-hero">
  <div className="inc-hero-art" aria-hidden="true"/>
  {!egg?<div className="inc-parent-prompt" data-testid="incubator-parent-empty"><HomeIcon name="egg"/><p>알을 선택하면<br/>부모 개체를 확인할 수 있습니다</p></div>:<>
   <div className="inc-parent-pair" aria-label="선택한 알의 부모 외형">{rows.map(row=><div className={'inc-parent '+row.sex} key={row.sex} data-testid={'incubator-parent-'+row.sex} data-parent-id={row.gecko?.id??''}>
    <span>{row.label}</span>
    {row.gecko?<button type="button" className="inc-parent-art" aria-label={row.label+' '+row.gecko.name+' 상세 정보'} onClick={()=>onDetail(row.gecko!.id)}><Sprite gecko={row.gecko}/></button>:<div className="inc-parent-art inc-parent-unknown">정보 없음</div>}
    <strong title={row.gecko?.name}>{row.gecko?<><HomeIcon name={row.sex} size={12}/>{row.gecko.name}</>:'정보 없음'}</strong>
   </div>)}</div>
   <div className="inc-info inc-metal" data-testid="incubator-parent-info"><h2>부모 정보</h2>{rows.map(row=><div className="inc-parent-info-row" key={row.sex}>
    <h3><span>{row.label} · {row.gecko?disclosedSex(row.gecko):'정보 없음'}</span>{row.gecko&&<strong title={row.gecko.name}>{row.gecko.name}</strong>}</h3>
    {row.gecko?<><p className="inc-parent-morph" title={visualName(row.gecko)}>{visualName(row.gecko)}</p><p className="inc-parent-features" title={row.features}>{row.features}</p></>:<p>부모 기록이 없습니다</p>}
   </div>)}</div>
  </>}
 </div>;
}
