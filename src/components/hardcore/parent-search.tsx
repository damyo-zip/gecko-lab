"use client";
import {koreanMorphText} from "@/phenotype/display-name";
import {memo,useMemo,useState} from 'react';
import type {Gecko,HardcoreGame} from '@/game/hardcore/model';
import {STAGE_LABELS} from '@/game/model';
import {collectionPatternFilters} from './collection-query';
import {Dialog,Sprite} from './common';
import {HomeIcon} from './home-icons';
import {parentCandidates,filterParents,DEFAULT_PARENT_QUERY,PARENT_SORTS,COLLECTION_MORPHS,COMPLEX_MORPHS,type ParentQuery,type ParentCandidate} from './parent-search-query';

const Preview=memo(function Preview({gecko}:{gecko:Gecko}){return <Sprite gecko={gecko}/>;});
export function ParentSearch({game,busy,sex,currentId,opponentId,onSelect,onClose}:{
  game:HardcoreGame;busy:boolean;sex:'male'|'female';currentId:string;opponentId:string;onSelect:(id:string)=>void;onClose:()=>void;
}){
  const [query,setQuery]=useState<ParentQuery>({...DEFAULT_PARENT_QUERY}),[limit,setLimit]=useState(24);
  const rows=useMemo(()=>parentCandidates(game,sex,opponentId),[game,sex,opponentId]);
  const results=useMemo(()=>filterParents(rows,query),[rows,query]);
  const visibleComplex=COMPLEX_MORPHS.filter(n=>rows.some(r=>r.visibleMorphs.includes(n)));
  const patternFilters=collectionPatternFilters(!!game.forge).filter(n=>!visibleComplex.some(c=>koreanMorphText(c)===n));
  const options=useMemo(()=>({
    generations:[...new Set(rows.map(r=>r.gecko.generation))].sort((a,b)=>a-b),
    confirmed:[...new Map(rows.flatMap(r=>r.confirmed).map(t=>[t.id,t])).values()],
    possible:[...new Map(rows.flatMap(r=>r.possible).map(t=>[t.id,t])).values()],
  }),[rows]);
  function change<K extends keyof ParentQuery>(key:K,value:ParentQuery[K]){setQuery(q=>({...q,[key]:value}));setLimit(24);}
  const reset=()=>{setQuery({...DEFAULT_PARENT_QUERY});setLimit(24);};
  function select(r:ParentCandidate){if(!busy&&r.selectable)onSelect(r.gecko.id);}
  return <Dialog title={<><HomeIcon name="search"/>{sex==='male'?'수컷':'암컷'} 개체 선택</>} onClose={onClose} className="parent-search-dialog">
    <div className="parent-search-controls">
      <p className="parent-search-opponent">상대: <strong>{game.individuals[opponentId]?.name??'선택 대기'}</strong><span>성장 중 개체는 두 목록에 성별 미구분으로 표시 · 성체 후 선택</span></p>
      <label className="parent-search-input"><span className="sr-only">개체 이름·번호·모프 검색</span><HomeIcon name="search"/><input type="search" value={query.search} placeholder="이름 · 개체번호 · 모프 검색" onChange={e=>change('search',e.target.value)}/></label>
      <div className="parent-search-quick">
        <label>모프<select aria-label="모프 필터" value={query.morph} onChange={e=>change('morph',e.target.value)}><option value="all">모프 전체</option>{Object.entries(COLLECTION_MORPHS).map(([v,n])=><option key={v} value={v}>{n}</option>)}<optgroup label="관찰된 복합 모프">{visibleComplex.map(n=><option key={n} value={'visible:'+n}>{koreanMorphText(n)}</option>)}</optgroup><optgroup label="관찰된 무늬">{patternFilters.map(n=><option key={n} value={'pattern:'+n}>{n}</option>)}</optgroup></select></label>
        <label>교배 상태<select aria-label="교배 상태 필터" value={query.status} onChange={e=>change('status',e.target.value)}><option value="all">상태 전체</option><option value="ready">교배 가능</option><option value="rest">휴식기</option><option value="blocked">기타 불가능</option></select></label>
        <label>정렬<select aria-label="개체 정렬" value={query.sort} onChange={e=>change('sort',e.target.value as ParentQuery['sort'])}>{Object.entries(PARENT_SORTS).map(([v,n])=><option key={v} value={v}>{n}</option>)}</select></label>
      </div>
      <details className="parent-search-advanced"><summary>상세 조건 <small>{Object.entries(query).filter(([k,v])=>!['search','sort'].includes(k)&&v!=='all').length}개 적용</small></summary><div>
        <label>성장 단계<select aria-label="성장 단계 필터" value={query.stage} onChange={e=>change('stage',e.target.value)}><option value="all">전체</option><option value="growing">성장 중</option><option value="adult">성체</option></select></label>
        <label>세대<select aria-label="세대 필터" value={query.generation} onChange={e=>change('generation',e.target.value)}><option value="all">전체</option>{options.generations.map(g=><option key={g} value={g}>{g}세대</option>)}</select></label>
        <label>확인된 유전 형질<select aria-label="확인된 유전 형질 필터" value={query.confirmed} onChange={e=>change('confirmed',e.target.value)}><option value="all">전체</option>{options.confirmed.map(t=><option key={t.id} value={t.id}>{t.label}</option>)}</select></label>
        <label>공개 possible het<select aria-label="공개 possible het 필터" value={query.possible} onChange={e=>change('possible',e.target.value)}><option value="all">전체</option>{options.possible.map(t=><option key={t.id} value={t.id}>{t.label}</option>)}</select></label>
        <label>상대와 혈통 관계<select aria-label="혈통 관계 필터" value={query.relation} onChange={e=>change('relation',e.target.value)}><option value="all">전체</option><option value="none">기록상 공통 조상 없음</option><option value="close">가까운 혈연</option><option value="distant">먼 혈연</option><option value="unknown">혈통 확인 불가</option></select></label>
      </div><p>확인·공개된 정보만 검색합니다. 혈연 정렬은 기록상 거리이며, 누락된 혈통은 뒤에 표시합니다.</p></details>
    </div>
    <div className="parent-search-count" role="status"><span>{results.length} / {rows.length}마리</span><button onClick={reset}>조건 초기화</button></div>
    <div className="parent-search-results" aria-label="교배 후보 목록" tabIndex={0}>
      {!results.length&&<div className="parent-search-empty"><HomeIcon name="leaf" size={40}/><p>조건에 맞는 개체가 없습니다.</p><button className="game-secondary" onClick={reset}>필터 초기화</button></div>}
      {results.slice(0,limit).map(r=>{const g=r.gecko,relation=r.relationship,selected=currentId===g.id;return <article key={g.id} className={'parent-search-card '+(selected?'selected':'')} data-testid={'parent-candidate-'+g.id}>
        <div className="parent-search-art"><Preview gecko={g}/><span>{g.stage==='adult'?g.sex==='male'?'♂ 수컷':'♀ 암컷':'? 성별 미구분'}</span></div>
        <div className="parent-search-description"><div className="parent-search-name"><strong>{g.name}</strong>{selected&&<b>선택됨</b>}</div><small className="parent-search-id">#{g.id}</small><p className="parent-search-morph">{r.morph}</p>
          <span>{g.generation}세대 · {STAGE_LABELS[g.stage]} · {r.age}턴 ({r.age*7}일)</span>
          <strong className={'parent-search-status '+(r.status.ready?'ready':'')}>{r.status.label}</strong>
          {g.hearts<=2&&g.hearts>0&&<small>컨디션 관리 권장 · 하트 {g.hearts}/5</small>}
          <span className={'parent-relation '+relation.tone} title={relation.note}><HomeIcon name="tree" size={16}/>{relation.label}</span>
          {(relation.incomplete&&relation.group!=='waiting'||relation.additional.length>0)&&<small>{[relation.incomplete?'일부 혈통 확인 불가':'',...relation.additional].filter(Boolean).join(' · ')}</small>}
          {r.confirmed.length+r.possible.length>0&&<small className="parent-public-traits">{[...r.confirmed,...r.possible].map(t=>t.label).join(' · ')}</small>}
          <button className="game-primary parent-search-select" disabled={busy||!r.selectable} aria-pressed={selected} onClick={()=>select(r)}>{r.selectable?'이 개체 선택':'성체 후 선택 가능'}</button>
        </div>
      </article>;})}
      {results.length>limit&&<button className="game-secondary parent-search-more" onClick={()=>setLimit(n=>n+24)}>개체 더 보기 · {results.length-limit}마리 남음</button>}
    </div>
    <footer className="parent-search-footer"><button className="game-secondary" disabled={busy||!currentId} onClick={()=>onSelect('')}>선택 해제</button><button className="game-secondary" onClick={onClose}>취소</button></footer>
  </Dialog>;
}
