"use client";
import {useEffect,useMemo,useRef,useState} from 'react';
import type {Action,Gecko,HardcoreGame} from '@/game/hardcore/model';
import {validatedGeckoName} from '@/game/hardcore/names';
import {saleRestriction} from '@/game/hardcore/economy';
import {valueGecko} from '@/game/hardcore/market';
import {Dialog,Sprite,won,type Play} from './common';
import {salePriceTags} from './sale-price-tags';

export type CardAction={kind:'rename'|'sell';id:string};
type Props={gecko:Gecko;busy:boolean;play:Play;onClose:()=>void};
/** One modal host, outside the virtualized cards. Existing durable actions remain
 * the only writer; the synchronous latch also covers two taps before React paints. */
function useCardSubmit({busy,play,onClose}:Omit<Props,'gecko'>){
 const latch=useRef(false),[pending,setPending]=useState(false),[error,setError]=useState('');
 const close=()=>{if(!latch.current)onClose();};
 const submit=async(action:Action)=>{
  if(busy||latch.current)return;
  latch.current=true;setPending(true);setError('');
  try{if(await play(action))onClose();else setError('저장하지 못했습니다. 다시 시도해주세요.');}
  catch(e){setError(e instanceof Error?e.message:'저장하지 못했습니다.');}
  finally{latch.current=false;setPending(false);}
 };
 return {pending:pending||busy,error,setError,close,submit};
}
function RenameCard(props:Props){
 const {gecko:g}=props,input=useRef<HTMLInputElement>(null),dialog=useRef<HTMLDialogElement>(null);
 const [name,setName]=useState(g.name),state=useCardSubmit(props);
 const fit=()=>{
  const viewport=window.visualViewport;
  dialog.current?.style.setProperty('--card-viewport-top',(viewport?.offsetTop??0)+'px');
  dialog.current?.style.setProperty('--card-viewport-height',(viewport?.height??window.innerHeight)+'px');
 };
 useEffect(()=>{
  // Android Chrome can shrink only the visual viewport when its keyboard opens.
  const viewport=window.visualViewport;viewport?.addEventListener('resize',fit);viewport?.addEventListener('scroll',fit);window.addEventListener('resize',fit);
  return()=>{viewport?.removeEventListener('resize',fit);viewport?.removeEventListener('scroll',fit);window.removeEventListener('resize',fit);};
 },[]);
 return <Dialog title="이름 수정" minimal className="card-rename-dialog" onClose={state.close} onOpen={element=>{
  dialog.current=element;fit();input.current?.focus({preventScroll:true});input.current?.select();
 }}>
  <form onSubmit={event=>{event.preventDefault();try{const valid=validatedGeckoName(name);void state.submit({type:'rename',id:g.id,name:valid});}catch(e){state.setError((e as Error).message);}}}>
   <input ref={input} type="text" aria-label="개체 이름" value={name} maxLength={24} required enterKeyHint="done" autoComplete="off" autoCapitalize="off" spellCheck={false} readOnly={state.pending} onChange={event=>{setName(event.target.value);state.setError('');}}/>
   {state.error&&<p className="card-action-error" role="alert">{state.error}</p>}
   <div className="card-action-buttons"><button type="button" className="game-secondary" disabled={state.pending} onClick={state.close}>취소</button><button type="submit" className="game-primary" disabled={state.pending}>저장</button></div>
  </form>
 </Dialog>;
}
function SellCard({game,...props}:Props&{game:HardcoreGame}){
 const {gecko:g}=props,state=useCardSubmit(props),quote=useMemo(()=>valueGecko(g),[g]),tags=useMemo(()=>salePriceTags(g),[g]);
 const restriction=saleRestriction(game,g);
 return <Dialog title="개체 분양" className="card-sale-dialog" onClose={state.close}>
  <div className="card-sale-art"><Sprite gecko={g} large/></div><h3 className="card-sale-name">{g.name}</h3>
  <p className="card-sale-price"><span>분양 예상가</span><strong>{won(quote.sell)}</strong></p>
  {!!tags.length&&<div className="card-sale-tags" aria-label="실제 가격 반영 요소">{tags.map(tag=><span key={tag.id} className={'card-price-tag '+tag.tone} data-factor={tag.id}>{tag.label}</span>)}</div>}
  {(restriction||state.error)&&<p className="card-action-error" role="alert">{restriction||state.error}</p>}
  <div className="card-action-buttons"><button type="button" className="game-secondary" disabled={state.pending} onClick={state.close}>취소</button><button type="button" className="game-primary" disabled={state.pending||!!restriction} onClick={()=>void state.submit({type:'sell',id:g.id})}>판매</button></div>
 </Dialog>;
}
export function CardActionDialog({action,game,...props}:Omit<Props,'gecko'>&{action:CardAction;game:HardcoreGame}){
 const g=game.individuals[action.id];
 if(!g||g.status!=='owned')return null;
 return action.kind==='rename'?<RenameCard key={g.id} gecko={g} {...props}/>:<SellCard key={g.id} game={game} gecko={g} {...props}/>;
}
