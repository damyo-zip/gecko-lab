"use client";
import {useEffect,useMemo,useRef,useState} from 'react';
import {descendantIds,familySummary,familyTree,pedigreeIndex,recordedAge,searchIndividuals} from '@/game/hardcore/family-album';
import {visualName,disclosedSex} from '@/game/hardcore/adapter';
import {STAGE_LABELS} from '@/game/model';
import type {Gecko} from '@/game/hardcore/model';
import {Sprite,STATUS,type ViewProps} from './common';
import {HomeIcon} from './home-icons';
import {AlbumPicker} from './album-picker';
import {BreedingChallengePanel} from './breeding-challenges';

function Sex({g}:{g:Gecko}){
 const sex=g.stage==='adult'?g.sex:'unknown';
 return <span className={'album-sex '+sex} title={disclosedSex(g)} aria-label={disclosedSex(g)}>{sex==='unknown'?'?':<HomeIcon name={sex} size={24}/>}</span>;
}
function TreeCard({g,role,current=false,onSelect}:{g:Gecko|undefined;role:string;current?:boolean;onSelect:(id:string)=>void}){
 return <div className={'album-tree-cell'+(current?' is-current':'')}>
  <span className="album-tree-role">{role}{g&&<small>{g.generation}세대</small>}</span>
  {g?<button className="album-tree-card" onClick={()=>onSelect(g.id)} data-id={g.id} aria-label={role+' '+g.name+' 혈통 보기'} title={g.id}>
   <div className="album-art"><Sprite gecko={g}/></div><strong>{current&&<Sex g={g}/>}<span>{g.name}</span></strong><span className="album-id">#{g.id}</span><span className="album-tree-morph">{visualName(g)}</span><span className="album-record-status">{STATUS[g.status]}</span>
  </button>:<div className="album-tree-missing"><HomeIcon name="tree" size={24}/><span>정보 없음</span></div>}
 </div>;
}
export function Lineage({game,busy,play,onDetail,selectedId,onSelect}:ViewProps&{selectedId:string;onSelect:(id:string)=>void}){
 const index=useMemo(()=>pedigreeIndex(game),[game]),records=useMemo(()=>Object.values(game.individuals),[game]);
 const root=game.individuals[selectedId]??records.find(g=>g.status==='owned')??records[0];
 const treeScroll=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  const node=treeScroll.current;if(!node)return;
  const center=()=>{node.scrollLeft=(node.scrollWidth-node.clientWidth)/2;};center();
  const observer=new ResizeObserver(center);observer.observe(node);return()=>observer.disconnect();
 },[root?.id]);
 const [descendantLimit,setDescendantLimit]=useState(12),[descendantQuery,setDescendantQuery]=useState('');
 const [picker,setPicker]=useState<'root'|'left'|'right'|null>(null),[comparison,setComparison]=useState<{left:string;right:string}|null>(null);
 const favorites=Object.values(game.lineages).filter(l=>l.favorite!==false),summaries=useMemo(()=>new Map(Object.values(game.lineages).filter(l=>l.favorite!==false).map(l=>[l.id,familySummary(game,l,index)])),[game,index]);
 const families=root?favorites.filter(l=>summaries.get(l.id)?.members.includes(root.id)):[];
 const currentLine=families[0],lineSummary=currentLine?summaries.get(currentLine.id):undefined;
 const future=useMemo(()=>root?[...descendantIds(index,root.id)]:[],[index,root]);
 const descendantResults=searchIndividuals(game,descendantQuery,0,descendantLimit,future);
 const tree=root?familyTree(game,root.id):null;
 const choose=(id:string)=>{onSelect(id);setComparison(null);setDescendantLimit(12);setDescendantQuery('');};
 const directAncestor=root?.parents?(game.individuals[root.parents.fatherId]??game.individuals[root.parents.motherId]):undefined;
 const defaultLeft=lineSummary?.founder??directAncestor;
 const left=comparison?game.individuals[comparison.left]:defaultLeft,right=comparison?game.individuals[comparison.right]:defaultLeft?.id===root?.id?undefined:root;
 const quickOptions=records.slice(0,24);if(root&&!quickOptions.some(g=>g.id===root.id))quickOptions.push(root);
 const age=root?recordedAge(game,root):null;
 return <section className="album-reference" aria-label="혈통 앨범">
  <h1 className="sr-only">혈통도</h1>
  <BreedingChallengePanel game={game} busy={busy} play={play}/>
  {root&&tree&&age?<>
   <section className="album-selected album-metal" aria-labelledby="album-selected-title">
    <div className="album-section-title"><HomeIcon name="collection"/><h2 id="album-selected-title">선택한 개체</h2><label className="album-quick-select"><span className="sr-only">혈통을 볼 개체</span><select aria-label="혈통을 볼 개체" value={root.id} onChange={e=>choose(e.target.value)}>{quickOptions.map(g=><option value={g.id} key={g.id}>{g.name} · Gen {g.generation} · {STATUS[g.status]}</option>)}</select></label></div>
    <div className="lineage-root" data-id={root.id}>
     <div className="album-selected-art album-art"><Sprite gecko={root} large/><div className="album-selected-name"><Sex g={root}/><h3>{root.name}</h3><div><span>{disclosedSex(root).split(' ')[0]}</span><span>{root.generation}세대</span><span>{STAGE_LABELS[root.stage]}</span></div></div></div>
     <div className="album-selected-facts"><dl><div><dt>모프</dt><dd>{visualName(root)}</dd></div><div><dt>가문</dt><dd>{families.map(l=>l.name).join(' / ')||'등록된 가문 없음'}</dd></div><div><dt>부화일</dt><dd>{root.birthDate}</dd></div><div><dt>나이</dt><dd>{age.turns}턴 · {age.days}일{age.archived?' (당시)':''}</dd></div><div><dt>상태</dt><dd>{STATUS[root.status]}{root.diedDate&&' · '+root.diedDate}</dd></div><div><dt>고유 ID</dt><dd className="album-full-id">{root.id}</dd></div></dl><button className="album-small-button" onClick={()=>onDetail(root.id)}>상세 정보</button></div>
    </div>
   </section>
   <section className="album-family album-metal" aria-labelledby="album-family-title">
    <div className="album-section-title"><HomeIcon name="tree"/><h2 id="album-family-title">가족 혈통도</h2><span>3세대</span><button className="album-small-button" onClick={()=>setPicker('root')}><HomeIcon name="refresh" size={16}/>다른 개체 보기</button></div>
    <p className="album-scroll-note">가족을 누르면 그 개체의 혈통으로 이동합니다. 좌우로 밀어 조부모까지 살펴보세요.</p>
    <div className="album-tree-scroll" ref={treeScroll} role="region" aria-label="3세대 가족 혈통도" tabIndex={0}><div className="album-tree ancestor-list">
     <svg className="album-connectors" viewBox="0 0 660 284" preserveAspectRatio="none" aria-hidden="true"><g fill="none" stroke="#99d858" strokeWidth="2"><path d="M108 85H126V160H141 M108 227H126V160 M235 160H282 M378 160H426 M519 160H537V85H551 M537 160V227H551"/></g></svg>
     <div className="album-grandparents"><TreeCard g={tree.paternalGrandfather} role="친할아버지" onSelect={choose}/><TreeCard g={tree.paternalGrandmother} role="친할머니" onSelect={choose}/></div>
     <TreeCard g={tree.father} role="아버지" onSelect={choose}/><TreeCard g={tree.current} role="현재 개체" current onSelect={choose}/><TreeCard g={tree.mother} role="어머니" onSelect={choose}/>
     <div className="album-grandparents"><TreeCard g={tree.maternalGrandfather} role="외할아버지" onSelect={choose}/><TreeCard g={tree.maternalGrandmother} role="외할머니" onSelect={choose}/></div>
    </div></div>
    <div className="album-children"><div><strong>후손 {future.length}마리</strong>{future.length>0&&<label><span className="sr-only">후손 검색</span><input type="search" aria-label="후손 검색" placeholder="후손 이름 / ID" value={descendantQuery} onChange={e=>{setDescendantQuery(e.target.value);setDescendantLimit(12);}}/></label>}</div>
     {descendantResults.items.length?<div className="album-child-grid">{descendantResults.items.map(g=><button key={g.id} onClick={()=>choose(g.id)} data-id={g.id} aria-label={g.name+' 후손 혈통 보기'}><div className="album-art"><Sprite gecko={g}/></div><span><strong>{g.name}</strong><small>{g.generation}세대 · {STATUS[g.status]}</small><small>{visualName(g)}</small></span></button>)}</div>:<p className="album-note">{future.length?'검색한 후손이 없습니다.':'아직 후손이 없습니다. 부화한 자손은 이곳에 연결됩니다.'}</p>}
     {descendantResults.total>descendantLimit&&<button className="album-small-button" onClick={()=>setDescendantLimit(n=>n+12)}>혈통 기록 더 보기</button>}
    </div>
   </section>
   <section className="album-comparison album-metal" aria-labelledby="album-comparison-title">
    <div className="album-section-title"><HomeIcon name="compare"/><h2 id="album-comparison-title">세대 비교</h2><span>조상과 후손의 모습을 나란히 살펴보세요.</span></div>
    <div className="album-comparison-grid">{[{g:left,side:'left' as const,title:comparison?'왼쪽 개체':'과거 조상 / 시조'},{g:right,side:'right' as const,title:comparison?'오른쪽 개체':'현재 선택한 후손'}].map(({g,side,title})=><article key={side} className="album-compare-card" data-side={side} data-id={g?.id}>
     <button className="album-compare-select" aria-label={side==='left'?'왼쪽 비교 개체 변경':'오른쪽 비교 개체 변경'} onClick={()=>setPicker(side)}><span>{title}</span><HomeIcon name="pen" size={15}/></button>
     {g?<><div className="album-art"><Sprite gecko={g} large/></div><div className="album-compare-caption"><strong>{g.name}</strong><span>{g.generation}세대</span><small className="album-id" title={g.id}>#{g.id}</small><p>{visualName(g)}</p><small>{STATUS[g.status]}</small></div></>:<div className="album-compare-empty"><HomeIcon name="tree" size={32}/><p>비교할 {side==='left'?'조상':'후손'} 기록이 없습니다.<br/>실제 개체를 직접 선택해주세요.</p></div>}
    </article>)}<span className="album-compare-arrow" aria-hidden="true">››</span></div>
    {left&&right&&left.id===right.id&&<p className="album-note">현재 같은 개체를 비교 중입니다. 다른 개체를 선택해보세요.</p>}
    <p className="album-note">판매·폐사 개체의 외형도 기록 그대로 비교할 수 있습니다.</p>
   </section>
  </>:<div className="album-metal album-empty"><HomeIcon name="collection" size={48}/><p>아직 가족 앨범에 개체가 없습니다.<br/>상점에서 첫 게코를 데려오면 혈통 기록이 시작됩니다.</p></div>}
  <p className="album-save-note" role="status">{game.lastDate} · {game.turn}턴 · {busy?'저장 중…':'자동 저장 완료'}{game.notices.length?' · '+game.notices.at(-1):''}</p>
  {picker&&<AlbumPicker game={game} title={picker==='root'?'혈통을 볼 개체 선택':picker==='left'?'왼쪽 비교 개체 선택':'오른쪽 비교 개체 선택'} onClose={()=>setPicker(null)} onChoose={id=>{if(picker==='root')choose(id);else setComparison({left:picker==='left'?id:left?.id??'',right:picker==='right'?id:right?.id??''});setPicker(null);}}/>}

 </section>;
}
