"use client";
import {useCallback,useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {RUSH_V1,rushPlan,rushDeadline,rushGeometry,rushSummary,rushComplete,type RushTap,type RushGrade} from '@/game/rush';
import {Dialog,won,type ViewProps} from './common';
import {HomeIcon} from './home-icons';
import {RushSprite,prepareRushArt} from './rush-sprite';

interface Effect {id:number;grade:RushGrade;variant:number;x:number;y:number;size:number}
export function CafeRush({game,busy,play,onClose}:Pick<ViewProps,'game'|'busy'|'play'> & {onClose:()=>void}){
  const s=game.cafeRush?.shift,sessionKey=s?game.gameId+':'+s.turn:'',complete=!!s&&rushComplete(s),intro=!s||s.paid&&s.turn<game.turn;
  const plan=useMemo(()=>rushPlan(game.seed,s?.turn??game.turn),[game.seed,s?.turn,game.turn]);
  const [clock,setClock]=useState(s?.elapsedMs??0),[running,setRunning]=useState(false),[ready,setReady]=useState(false),[error,setError]=useState(''),[effects,setEffects]=useState<Effect[]>([]),[combo,setCombo]=useState('');
  const [size,setSize]=useState({width:320,height:420}),[closing,setClosing]=useState(false);
  const stage=useRef<HTMLDivElement>(null),latest=useRef({game,play}),elapsed=useRef(clock),presented=useRef(clock),committed=useRef(s?.elapsedMs??0),queue=useRef<RushTap[]>([]),seen=useRef(new Set<number>()),fxSeen=useRef(new Set<number>()),comboSeen=useRef(new Set<number>()),flight=useRef<Promise<boolean>|null>(null),autoStart=useRef(false),mounted=useRef(true),mainAction=useRef(false);
  useLayoutEffect(()=>{latest.current={game,play};presented.current=clock;},[game,play,clock]);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  useEffect(()=>{let live=true;prepareRushArt().then(()=>{if(live)setReady(true);}).catch(()=>{if(live)setError('정면 아트를 불러오지 못했습니다. 연결을 확인하고 다시 열어주세요.');});return()=>{live=false;};},[]);
  useEffect(()=>{
    elapsed.current=presented.current=committed.current=s?.elapsedMs??0;queue.current=[];seen.current=new Set();fxSeen.current=new Set(s?.results.flatMap((r,i)=>r?[i]:[])??[]);comboSeen.current=new Set();
    setClock(elapsed.current);setEffects([]);setRunning(autoStart.current);autoStart.current=false;
    // Session identity changes only when starting a new turn's shift.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[sessionKey]);
  useEffect(()=>{const node=stage.current;if(!node)return;const observer=new ResizeObserver(([r])=>setSize({width:r.contentRect.width,height:r.contentRect.height}));observer.observe(node);return()=>observer.disconnect();},[intro,complete]);
  const flush=useCallback(async function commit(force=false):Promise<boolean>{
    if(flight.current){const ok=await flight.current;if(!ok)return false;return force?commit(true):true;}
    const shift=latest.current.game.cafeRush?.shift;if(!shift||shift.paid)return true;
    const at=Math.min(RUSH_V1.durationMs,Math.max(committed.current,Math.floor(presented.current))),taps=[...queue.current];
    if(at<=committed.current&&!taps.length)return true;
    const operation=(async()=>{
      const ok=await latest.current.play({type:'stepRush',elapsedMs:at,taps});
      if(ok){committed.current=at;queue.current=queue.current.filter(t=>!taps.includes(t));}
      else if(mounted.current){setRunning(false);setError('자동 저장을 완료하지 못했습니다. 저장 재시도로 진행 기록을 보존해주세요.');}
      return ok;
    })();flight.current=operation;
    try{return await operation;}finally{flight.current=null;}
  },[]);
  useEffect(()=>{
    if(!running||complete)return;
    let frame=0,last:number|undefined;
    const tick=(time:number)=>{if(document.hidden)return;if(last!==undefined)elapsed.current=Math.min(RUSH_V1.durationMs,elapsed.current+Math.max(0,time-last));last=time;setClock(elapsed.current);if(elapsed.current<RUSH_V1.durationMs)frame=requestAnimationFrame(tick);else setRunning(false);};
    frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);
  },[running,sessionKey,complete]);
  useEffect(()=>{if(!s||s.paid||complete)return;if(Math.floor(clock)-committed.current>=RUSH_V1.checkpointMs||clock>=RUSH_V1.durationMs)void flush();},[clock,s,complete,flush]);
  useEffect(()=>{const leaving=()=>{setRunning(false);void flush(true);},pause=()=>{if(document.hidden)leaving();};document.addEventListener('visibilitychange',pause);window.addEventListener('pagehide',leaving);return()=>{document.removeEventListener('visibilitychange',pause);window.removeEventListener('pagehide',leaving);};},[flush]);
  useEffect(()=>{
    if(!s)return;const next:Effect[]=[];
    s.results.forEach((r,id)=>{if(!r||fxSeen.current.has(id))return;fxSeen.current.add(id);const t=plan[id],g=rushGeometry(t,r.atMs,size.width,size.height);next.push({id,grade:r.grade,variant:t.variant,x:g.x/size.width,y:g.y/size.height,size:g.size});});
    if(next.length)setEffects(list=>[...list,...next]);
    for(let wave=4;wave<=6;wave++)if(!comboSeen.current.has(wave)){
      const group=plan.filter(t=>t.wave===wave);if(group.every(t=>s.results[t.id]?.grade==='perfect')){comboSeen.current.add(wave);setCombo(group.length===3?'TRIPLE CATCH!':'DOUBLE CATCH!');}
    }
  },[s,plan]);
  async function close(){if(closing)return;setClosing(true);setRunning(false);if(await flush(true))onClose();else setClosing(false);}
  async function begin(){if(busy||mainAction.current)return;mainAction.current=true;setError('');autoStart.current=true;try{if(!await play({type:'startRush'})){autoStart.current=false;setError('알바를 시작하지 못했습니다. 저장 상태를 확인해주세요.');}}finally{mainAction.current=false;}}
  async function receive(){if(busy||mainAction.current)return;mainAction.current=true;setError('');try{if(!await play({type:'claimRush'}))setError('급여를 저장하지 못했습니다. 다시 시도해주세요.');}finally{mainAction.current=false;}}
  const summary=s?rushSummary(s):{perfect:0,good:0,miss:0,caught:0,resolved:0,reward:0};
  const wave=Math.max(1,...plan.filter(t=>t.spawnMs<=clock).map(t=>t.wave));
  const canRun=!!s&&!s.paid&&!complete;
  return <Dialog title={<><HomeIcon name="leaf"/><span>크레 러시</span></>} onClose={()=>void close()} className="rush-dialog">
    {intro?<section className="rush-intro"><p className="rush-eyebrow">파충류 카페 알바</p><div className="rush-intro-art"><RushSprite onReady={()=>setReady(true)} onError={()=>setError('정면 아트를 불러오지 못했습니다. 연결을 확인하고 다시 열어주세요.')}/></div><h3>도망가는 크레를 잡아주세요!</h3><p>작게 나타나는 크레가 정면으로 돌진해요.<br/>커지는 속도를 보고 <strong>밝은 링이 생기는 순간</strong><br/>해당 크레를 직접 터치하세요.</p><div className="rush-pay-guide"><span>PERFECT <b>300원</b></span><span>GOOD <b>200원</b></span><span>MISS <b>0원</b></span></div><small>25초 · 6웨이브 · 10마리 · 턴당 한 번<br/>최대 일당 {won(plan.length*RUSH_V1.pay.perfect)} · 빈 배경 터치는 포획되지 않아요</small><button className="game-primary rush-main-button" disabled={busy||!ready} onClick={()=>void begin()}>{ready?'알바 시작':'스프라이트 준비 중…'}</button></section>:
    complete&&s?<section className="rush-results"><p className="rush-eyebrow">{s.paid?'이번 턴 아르바이트 완료':'파충류 카페 알바 완료!'}</p><div className="rush-result-art"><RushSprite variant={1}/></div><h3>{summary.caught===10?'크레 전원 포획!':'오늘도 수고했어요!'}</h3><dl><div><dt>PERFECT</dt><dd data-testid="rush-perfect">{summary.perfect}마리</dd></div><div><dt>GOOD</dt><dd data-testid="rush-good">{summary.good}마리</dd></div><div><dt>MISS</dt><dd data-testid="rush-miss">{summary.miss}마리</dd></div></dl><p>오늘의 일당 <strong data-testid="rush-pay">{won(summary.reward)}</strong></p>{s.turn!==game.turn&&<small>TURN {s.turn} 알바 기록 · 현재 TURN {game.turn}</small>}{s.paid?<><b className="rush-paid" role="status">급여 수령 완료</b><p>{s.turn>game.turn?`TURN ${s.turn} 이후에 다시 일할 수 있어요.`:"다음 턴에 다시 일할 수 있어요."}</p></>:<button className="game-primary rush-main-button" disabled={busy} onClick={()=>void receive()}>급여 받기</button>}</section>:
    <>
      <div className="rush-hud"><div><small>웨이브</small><strong data-testid="rush-wave">{wave} / {RUSH_V1.waves.length}</strong></div><div><small>포획</small><strong data-testid="rush-caught">{summary.caught} / {plan.length}</strong></div><div><small>현재 일당</small><strong data-testid="rush-wage">{won(summary.reward)}</strong></div></div>
      <div ref={stage} className="rush-stage" aria-label="크레 러시 플레이 영역" data-testid="rush-stage" data-elapsed={Math.floor(clock)}>
        <div className="rush-cafe-sign" aria-hidden="true">GECKO CAFÉ <span>크레 러시</span></div><div className="rush-stage-light" aria-hidden="true"/>
        {plan.map(t=>{const r=s?.results[t.id],g=rushGeometry(t,clock,size.width,size.height),active=clock>=t.spawnMs&&clock<rushDeadline(t),escaping=!r&&g.progress>=RUSH_V1.good[1]&&g.progress<1.16;
          if(r||clock<t.spawnMs||!active&&!escaping)return null;
          return <button key={t.id} type="button" className={'rush-target '+(escaping?'escaping':g.progress>=RUSH_V1.perfect[0]&&g.progress<=RUSH_V1.perfect[1]?'ideal':'')+(seen.current.has(t.id)?' pending':'')} aria-label={'크레 '+(t.id+1)+' 포획'} data-testid={'rush-target-'+t.id} data-progress={g.progress.toFixed(4)} disabled={!running||seen.current.has(t.id)||!active} style={{left:g.x,top:g.y,width:g.hitSize,height:g.hitSize}} onPointerDown={e=>{
            if(!running||seen.current.has(t.id)||latest.current.game.cafeRush?.shift.results[t.id])return;e.preventDefault();e.stopPropagation();seen.current.add(t.id);queue.current.push({id:t.id,atMs:Math.floor(presented.current)});void flush(true);
          }} onClick={e=>{if(e.detail===0&&!seen.current.has(t.id)&&running){seen.current.add(t.id);queue.current.push({id:t.id,atMs:Math.floor(presented.current)});void flush(true);}}}><span style={{width:g.size,height:g.size}}><RushSprite variant={t.variant}/></span></button>;
        })}
        {effects.map(f=><div key={f.id} className={'rush-catch-effect '+f.grade} style={{left:f.x*100+'%',top:f.y*100+'%',width:f.size}} onAnimationEnd={e=>{if(e.target===e.currentTarget&&["rush-catch","rush-escape"].includes(e.animationName))setEffects(list=>list.filter(x=>x.id!==f.id));}}><div><RushSprite variant={f.variant}/></div><strong>{f.grade.toUpperCase()}{f.grade==='miss'?'':'!'}{f.grade!=='miss'&&<small>+{RUSH_V1.pay[f.grade]}원</small>}</strong></div>)}
        {combo&&<div key={combo} className="rush-combo" onAnimationEnd={()=>setCombo('')}>{combo}</div>}
        {!running&&canRun&&clock<RUSH_V1.durationMs&&<div className="rush-paused"><HomeIcon name="leaf" size={34}/><strong>알바 잠시 쉬는 중</strong><span>화면 밖에서는 시간이 흐르지 않아요.</span><button className="game-primary" disabled={busy||!!error||!ready} onClick={()=>setRunning(true)}>알바 계속하기</button></div>}
      </div><div className="rush-progress"><span style={{width:clock/RUSH_V1.durationMs*100+'%'}}/></div><p className="rush-instruction">커지는 크레를 직접 터치! <b>밝은 링 = PERFECT 타이밍</b></p>
    </>}
    {error&&<div className="rush-error" role="alert"><p>{error}</p><button className="game-secondary" disabled={busy} onClick={async()=>{if(await flush(true))setError('');}}>저장 재시도</button><button className="game-secondary" onClick={()=>location.reload()}>저장 상태 새로고침</button></div>}
    <footer className="rush-footer"><small>{closing?'진행 저장 중…':busy?'자동 저장 중…':s&&!intro?'진행 자동 저장 · 급여는 한 번만 지급':'1턴 = 7일 · 알바로 턴이 진행되지 않아요'}</small><button className="game-secondary" disabled={closing} onClick={()=>void close()}>닫기</button></footer>
  </Dialog>;
}
