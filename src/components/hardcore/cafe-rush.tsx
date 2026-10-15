"use client";
import {useCallback,useEffect,useLayoutEffect,useMemo,useRef,useState,type CSSProperties} from 'react';
import {RUSH_V1,RUSH_CURRENT_VERSION,rushPlan,rushDeadline,rushGeometry,rushSummary,rushComplete,rushFeedback,rushStreak,rushGrade,type RushTap,type RushGrade} from '@/game/rush';
import {Dialog,won,type ViewProps} from './common';
import {HomeIcon} from './home-icons';
import {RushSprite,prepareRushArt} from './rush-sprite';

interface Effect {id:number;grade:RushGrade;variant:number;x:number;y:number;size:number;rotation:number;feedback:string}
export function CafeRush({game,busy,play,onClose,saveError}:Pick<ViewProps,'game'|'busy'|'play'> & {onClose:()=>void;saveError?:string}){
  const s=game.cafeRush?.shift,version=game.cafeRush?.version??RUSH_CURRENT_VERSION;
  const sessionKey=s?game.gameId+':'+s.turn+':'+version:'',complete=!!s&&rushComplete(s),intro=!s||s.paid&&s.turn<game.turn;
  const plan=useMemo(()=>rushPlan(game.seed,s?.turn??game.turn,version),[game.seed,s?.turn,game.turn,version]);
  const [clock,setClock]=useState(s?.elapsedMs??0),[running,setRunning]=useState(false),[ready,setReady]=useState(false);
  const [error,setError]=useState(''),[effects,setEffects]=useState<Effect[]>([]),[combo,setCombo]=useState('');
  const [size,setSize]=useState({width:320,height:420}),[closing,setClosing]=useState(false),[contacts,setContacts]=useState<Record<number,number>>({});
  const [haptics,setHaptics]=useState(false),[canVibrate,setCanVibrate]=useState(false);
  const stage=useRef<HTMLDivElement>(null),latest=useRef({game,play}),elapsed=useRef(clock),presented=useRef(clock),committed=useRef(s?.elapsedMs??0);
  const queue=useRef<RushTap[]>([]),seen=useRef(new Set<number>()),fxSeen=useRef(new Set<number>()),comboSeen=useRef(new Set<string>());
  const flight=useRef<Promise<boolean>|null>(null),autoStart=useRef(false),mounted=useRef(true),mainAction=useRef(false);
  useLayoutEffect(()=>{latest.current={game,play};presented.current=clock;},[game,play,clock]);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  useEffect(()=>{setCanVibrate(typeof navigator.vibrate==='function');try{setHaptics(localStorage.getItem('gecko-rush-haptics')==='on');}catch{/* Optional device preference. */}},[]);
  useEffect(()=>{let live=true;prepareRushArt().then(()=>{if(live)setReady(true);}).catch(()=>{if(live)setError('정면 아트를 불러오지 못했습니다. 연결을 확인하고 다시 열어주세요.');});return()=>{live=false;};},[]);
  useEffect(()=>{
    elapsed.current=presented.current=committed.current=s?.elapsedMs??0;queue.current=[];seen.current=new Set();
    fxSeen.current=new Set(s?.results.flatMap((r,i)=>r?[i]:[])??[]);comboSeen.current=new Set();
    setClock(elapsed.current);setEffects([]);setContacts({});setRunning(autoStart.current);autoStart.current=false;
    // Reset only on a new attempt, never on a checkpoint or pause/resume.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[sessionKey]);
  useEffect(()=>{const node=stage.current;if(!node)return;const observer=new ResizeObserver(([r])=>setSize({width:r.contentRect.width,height:r.contentRect.height}));observer.observe(node);return()=>observer.disconnect();},[intro,complete]);
  const flush=useCallback(async function commit(force=false):Promise<boolean>{
    if(flight.current){const ok=await flight.current;if(!ok)return false;return force?commit(true):true;}
    const shift=latest.current.game.cafeRush?.shift;if(!shift||shift.paid||rushComplete(shift))return true;
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
    const tick=(time:number)=>{
      if(document.hidden)return;
      if(last!==undefined)elapsed.current=Math.min(RUSH_V1.durationMs,elapsed.current+Math.max(0,time-last));
      last=time;setClock(elapsed.current);
      if(elapsed.current<RUSH_V1.durationMs)frame=requestAnimationFrame(tick);else setRunning(false);
    };
    frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);
  },[running,sessionKey,complete]);
  useEffect(()=>{
    if(!s||s.paid||complete)return;
    // Escape feedback should arrive on its deadline, rather than wait for the 800ms checkpoint.
    const expired=plan.some(t=>!s.results[t.id]&&rushDeadline(t)<=clock&&rushDeadline(t)>committed.current);
    if(expired||Math.floor(clock)-committed.current>=RUSH_V1.checkpointMs||clock>=RUSH_V1.durationMs)void flush();
  },[clock,s,complete,flush,plan]);
  useEffect(()=>{
    const leaving=()=>{setRunning(false);void flush(true);},pause=()=>{if(document.hidden)leaving();};
    document.addEventListener('visibilitychange',pause);window.addEventListener('pagehide',leaving);
    return()=>{document.removeEventListener('visibilitychange',pause);window.removeEventListener('pagehide',leaving);};
  },[flush]);
  useEffect(()=>{
    if(!s)return;const next:Effect[]=[];
    s.results.forEach((r,id)=>{
      if(!r||fxSeen.current.has(id))return;fxSeen.current.add(id);
      const t=plan[id],g=rushGeometry(t,r.atMs,size.width,size.height);
      next.push({id,grade:r.grade,variant:t.variant,x:g.x/size.width,y:g.y/size.height,size:g.size,rotation:g.rotation,feedback:rushFeedback(t,r)});
    });
    if(!next.length)return;
    setEffects(list=>[...list,...next]);
    if(haptics&&canVibrate&&next.some(f=>f.grade!=='miss'))try{navigator.vibrate(next.some(f=>f.grade==='perfect')?12:6);}catch{/* Never required for play. */}
    const chain=rushStreak(s).current;
    if([3,6,10].includes(chain)&&!comboSeen.current.has('chain'+chain)){comboSeen.current.add('chain'+chain);setCombo(chain+' 연속 포획!');}
    for(let wave=4;wave<=6;wave++)if(!comboSeen.current.has('wave'+wave)){
      const group=plan.filter(t=>t.wave===wave);
      if(group.every(t=>s.results[t.id]?.grade==='perfect')){comboSeen.current.add('wave'+wave);setCombo(group.length===3?'TRIPLE PERFECT!':'DOUBLE PERFECT!');}
    }
  },[s,plan,haptics,canVibrate,size]);
  async function close(){if(closing)return;setClosing(true);setRunning(false);if(await flush(true))onClose();else setClosing(false);}
  async function begin(){
    if(busy||mainAction.current)return;mainAction.current=true;setError('');autoStart.current=true;
    try{if(!await play({type:'startRush'})){autoStart.current=false;setError('알바를 시작하지 못했습니다. 저장 상태를 확인해주세요.');}}finally{mainAction.current=false;}
  }
  async function receive(){
    if(busy||mainAction.current)return;mainAction.current=true;setError('');
    try{if(!await play({type:'claimRush'}))setError('급여를 저장하지 못했습니다. 다시 시도해주세요.');}finally{mainAction.current=false;}
  }
  function tap(id:number){
    if(!running||seen.current.has(id)||latest.current.game.cafeRush?.shift.results[id])return;
    const atMs=Math.floor(presented.current);seen.current.add(id);queue.current.push({id,atMs});
    // Immediate contact pose is not a grade/reward acknowledgement. Those wait for the durable save.
    setContacts(c=>({...c,[id]:atMs}));void flush(true);
  }
  function toggleHaptics(){const enabled=!haptics;setHaptics(enabled);try{localStorage.setItem('gecko-rush-haptics',enabled?'on':'off');}catch{/* Optional. */}}
  const summary=s?rushSummary(s):{perfect:0,good:0,miss:0,caught:0,resolved:0,reward:0},streak=s?rushStreak(s):{current:0,best:0,perfect:0};
  const wave=Math.max(1,...plan.filter(t=>t.spawnMs<=clock).map(t=>t.wave)),canRun=!!s&&!s.paid&&!complete;
  const activeCount=plan.filter(t=>!s?.results[t.id]&&clock>=t.spawnMs&&clock<rushDeadline(t)).length;
  const upcoming=plan.find(t=>t.spawnMs>clock);
  const title=summary.perfect===10?'빈틈없는 카페 지킴이!':summary.caught===10?'크레 전원 포획!':summary.caught>=7?'든든한 카페 지킴이!':'오늘도 수고했어요!';
  return <Dialog title={<><HomeIcon name="leaf"/><span>크레 러시</span></>} onClose={()=>void close()} className="rush-dialog">
    {intro?<section className="rush-intro">
      <p className="rush-eyebrow">GECKO CAFÉ · 파충류 카페 알바</p>
      <div className="rush-intro-art"><i aria-hidden="true"/><RushSprite onReady={()=>setReady(true)} onError={()=>setError('정면 아트를 불러오지 못했습니다. 연결을 확인하고 다시 열어주세요.')}/></div>
      <span className="rush-shift-tag">25초의 작은 소동</span><h3>도망가는 크레를 잡아주세요!</h3>
      <p>커지는 크레를 보고, 한 박자 기다렸다가<br/><strong>링이 밝아지는 순간 직접 터치!</strong></p>
      <div className="rush-pay-guide"><span>PERFECT <b>300원</b></span><span>GOOD <b>200원</b></span><span>MISS <b>0원</b></span></div>
      <small>6웨이브 · 10마리 · 턴당 한 번 · 최대 {won(3000)}<br/>빈 배경 터치는 포획되지 않아요</small>
      <button className="game-primary rush-main-button" disabled={busy||!ready} onClick={()=>void begin()}>{ready?'알바 시작':'스프라이트 준비 중…'}</button>
    </section>:complete&&s?<section className="rush-results">
      <p className="rush-eyebrow">{s.paid?'이번 턴 아르바이트 완료':'파충류 카페 알바 완료!'}</p>
      <div className={'rush-result-art '+(summary.perfect===10?'flawless':'')}><RushSprite variant={1} pose={2}/></div>
      <h3>{title}</h3><span className="rush-shift-tag">최고 연속 포획 {streak.best}마리</span>
      <div className="rush-catch-record" aria-label="10마리 판정 기록">{s.results.map((r,id)=><i key={id} className={r?.grade} aria-label={(id+1)+'번 '+r?.grade}/>)}</div>
      <dl><div><dt>PERFECT</dt><dd data-testid="rush-perfect">{summary.perfect}마리</dd></div><div><dt>GOOD</dt><dd data-testid="rush-good">{summary.good}마리</dd></div><div><dt>MISS</dt><dd data-testid="rush-miss">{summary.miss}마리</dd></div></dl>
      <div className="rush-wage-receipt"><small>오늘의 일당</small><strong data-testid="rush-pay">{won(summary.reward)}</strong><span>오늘 지켜낸 크레들의 포획 실적</span></div>
      {summary.perfect<10&&<p className="rush-result-tip">{summary.miss>0?'멀리 있을 땐 기다리고, 밝은 링을 노려보세요.':'다음엔 한 박자만 조절해 PERFECT에 도전해요.'}</p>}
      {s.turn!==game.turn&&<small>TURN {s.turn} 알바 기록 · 현재 TURN {game.turn}</small>}
      {s.paid?<><b className="rush-paid" role="status">급여 수령 완료</b><p>{s.turn>game.turn?`TURN ${s.turn} 이후에 다시 일할 수 있어요.`:'다음 턴에도 카페에서 만나요!'}</p></>:<button className="game-primary rush-main-button" disabled={busy} onClick={()=>void receive()}>급여 받기</button>}
    </section>:<>
      <div className="rush-hud"><div><small>웨이브</small><strong data-testid="rush-wave">{wave} / 6</strong></div><div><small>포획 {streak.current>=2&&<b className="rush-chain">{streak.current}연속</b>}</small><strong data-testid="rush-caught">{summary.caught} / 10</strong></div><div><small>현재 일당</small><strong data-testid="rush-wage">{won(summary.reward)}</strong></div></div>
      <div className="rush-wave-track" aria-label="웨이브 진행">{RUSH_V1.waves.map((_,i)=><i key={i} className={wave>i+1?'done':wave===i+1?'current':''}/>)}</div>
      <div ref={stage} className="rush-stage" aria-label="크레 러시 플레이 영역" data-testid="rush-stage" data-elapsed={Math.floor(clock)}>
        <div className="rush-cafe-sign" aria-hidden="true">GECKO CAFÉ <span>작은 탈출 소동</span></div><div className="rush-stage-light" aria-hidden="true"/>
        {plan.map(t=>{
          const r=s?.results[t.id],pending=contacts[t.id]!==undefined,g=rushGeometry(t,pending?contacts[t.id]:Math.floor(clock),size.width,size.height);
          const active=clock>=t.spawnMs&&clock<rushDeadline(t),escaping=!r&&g.progress>=.98&&g.progress<1.16;
          if(r||clock<t.spawnMs||!active&&!escaping&&!pending)return null;
          const phase=g.progress>=.98?'late':rushGrade(t,pending?contacts[t.id]:Math.floor(clock))==='perfect'?'ideal':g.progress>=.5?'ready':'far';
          return <button key={t.id} type="button" className={'rush-target '+phase+(escaping?' escaping':'')+(pending?' pending':'')} aria-label={'크레 '+(t.id+1)+' 포획'} data-testid={'rush-target-'+t.id} data-progress={g.progress.toFixed(4)} disabled={!running||pending||!active} style={{left:g.x,top:g.y,width:g.hitSize,height:g.hitSize}} onPointerDown={e=>{e.preventDefault();e.stopPropagation();tap(t.id);}} onClick={e=>{if(e.detail===0)tap(t.id);}}>
            <span style={{width:g.size,height:g.size,transform:`rotate(${g.rotation}deg)`}}><i className="rush-flight-shadow" aria-hidden="true"/><RushSprite variant={t.variant} pose={g.pose}/><i className="rush-aim" aria-hidden="true"/></span>
          </button>;
        })}
        {effects.map(f=><div key={f.id} className={'rush-catch-effect '+f.grade} style={{left:f.x*100+'%',top:f.y*100+'%',width:f.size,'--rush-escape-distance':((1-f.y)*size.height+f.size)+'px','--rush-escape-scale':Math.max(1.65,Math.min(4,165/f.size))} as CSSProperties} onAnimationEnd={e=>{if(e.target===e.currentTarget&&['rush-catch','rush-good','rush-miss','rush-feedback-reduced'].includes(e.animationName))setEffects(list=>list.filter(x=>x.id!==f.id));}}>
          <div style={{rotate:f.rotation+'deg'}}><RushSprite variant={f.variant} pose={2}/></div><i aria-hidden="true"/>
          <strong>{f.grade.toUpperCase()}{f.grade!=='miss'&&'!'}<small>{f.grade==='miss'?f.feedback:'+'+RUSH_V1.pay[f.grade]+'원'}</small><em>{f.grade!=='miss'&&f.feedback}</em></strong>
        </div>)}
        {combo&&<div key={combo} className="rush-combo" onAnimationEnd={()=>setCombo('')}>{combo}</div>}
        {!activeCount&&running&&<div className="rush-next-wave" aria-live="off">{upcoming?<>WAVE {upcoming.wave} <span>{upcoming.wave>=4?'여러 마리가 와요 · 하나씩 차례로!':'곧 크레가 나타나요'}</span></>:<>포획 기록 정리 중<span>수고했어요!</span></>}</div>}
        {!running&&canRun&&clock<RUSH_V1.durationMs&&<div className="rush-paused"><HomeIcon name="leaf" size={34}/><strong>알바 잠시 쉬는 중</strong><span>화면 밖에서는 시간이 흐르지 않아요.</span><button className="game-primary" disabled={busy||!!error||!ready} onClick={()=>setRunning(true)}>알바 계속하기</button></div>}
      </div>
      <div className="rush-progress" aria-label="남은 알바 시간"><span style={{width:(1-clock/RUSH_V1.durationMs)*100+'%'}}/></div>
      <p className="rush-instruction">한 박자 기다렸다가 <b>밝은 링에 터치!</b><span>{Math.ceil((RUSH_V1.durationMs-clock)/1000)}초</span></p>
    </>}
    {error&&<div className="rush-error" role="alert"><p>{error}</p>{saveError&&<p>{saveError}</p>}<button className="game-secondary" disabled={busy} onClick={async()=>{if(await flush(true))setError('');}}>저장 재시도</button><button className="game-secondary" onClick={()=>location.reload()}>저장 상태 새로고침</button></div>}
    <footer className="rush-footer"><div><small>{closing?'진행 저장 중…':busy?'자동 저장 중…':s&&!intro?'진행 자동 저장 · 급여는 한 번만':'알바로 게임 턴은 진행되지 않아요'}</small><button className="rush-haptics" aria-pressed={haptics} disabled={!canVibrate} onClick={toggleHaptics}>{canVibrate?'진동 '+(haptics?'켜짐':'꺼짐'):'진동 미지원'}</button></div><button className="game-secondary" disabled={closing} onClick={()=>void close()}>닫기</button></footer>
  </Dialog>;
}
