"use client";
import {useEffect,useState} from 'react';
import {Dialog,Sprite,won,type ViewProps} from './common';
import {HomeIcon} from './home-icons';
import {EndTurnButton} from './end-turn';
import {freeSlots} from '@/game/hardcore/survival';
import {visualName,disclosedSex} from '@/game/hardcore/adapter';
import {ageTurns,V12} from '@/game/hardcore/lifecycle';
import {STAGE_LABELS} from '@/game/model';
import {SHOP_REFRESH_PRICE} from '@/game/hardcore/shop-family';
import {MARKET} from '@/game/hardcore/market';
import type {Gecko} from '@/game/hardcore/model';
import {appearanceProfile} from '@/game/hardcore/appearance';
/** Visible phenotype only; no carrier beliefs or secret alleles in parent popup. */
export function shopMorph(g:Gecko):string {
 return visualName(g);
}
export function Shop({game,busy,play,onFood}:ViewProps&{onFood:()=>void}){
 const [inspect,setInspect]=useState(''),[confirm,setConfirm]=useState(false);
 useEffect(()=>{window.scrollTo({top:0,behavior:'instant'});},[]);
 const offers=Object.values(game.shop.offers),selected=game.shop.offers[inspect];
 const reroll=async()=>{if(await play({type:'refreshShop'})){setConfirm(false);setInspect('');}};
 return <section className="shop-reference" aria-label="상점 화면">
  <h1 className="sr-only">상점</h1>
  <div className="shop-today shop-metal"><div><HomeIcon name="calendar"/><h2>오늘의 매물</h2></div><p role={game.money<SHOP_REFRESH_PRICE?"status":undefined}>{game.money<SHOP_REFRESH_PRICE?<>자금 부족<br/>{won(SHOP_REFRESH_PRICE-game.money)} 더 필요</>:<>오늘 만나는<br/>새로운 혈통</>}</p><button className="shop-refresh" aria-label="발품팔기 2,000원" disabled={busy||game.money<SHOP_REFRESH_PRICE} onClick={()=>setConfirm(true)}><HomeIcon name="refresh"/><span>발품팔기<strong>{SHOP_REFRESH_PRICE.toLocaleString('ko-KR')}원</strong></span></button></div>
  <div className="shop-offer-grid hc-grid">{offers.map(o=>{
   const g=o.individual,sex=g.stage==='adult'?g.sex:'unknown',noMoney=game.money<o.askPrice,noSpace=freeSlots(game)<1,unavailable=busy||!!o.purchased||noMoney||noSpace;
   const buyLabel=o.purchased?'구매 완료':noMoney?'자금 부족':noSpace?'공간 부족':'구매하기';
   return <article className={'shop-offer shop-metal'+(o.purchased?' purchased':'')} key={o.id} data-testid={'shop-offer-'+o.id}>
    <div className="shop-offer-art"><Sprite gecko={g} large/><button className="shop-parents shop-metal" aria-label={g.name+' 부모'} disabled={busy} onClick={()=>setInspect(o.id)}>부모</button><span className={'shop-sex '+sex} aria-label={disclosedSex(g)}>{sex==='unknown'?'?':<HomeIcon name={sex}/>}</span>{o.purchased&&<span className="shop-sold">구매 완료</span>}</div>
    <h3 title={g.name}>{g.name}</h3><p className="shop-morph" title={shopMorph(g)}>{shopMorph(g)}</p><p className="shop-age">{STAGE_LABELS[g.stage]} · {ageTurns(game,g)}턴 ({ageTurns(game,g)*V12.daysPerTurn}일) · {sex==='unknown'?'성별 미구분':sex==='male'?'수컷':'암컷'}</p>
    <strong className="shop-price">{won(o.askPrice)}</strong>
    <button className="shop-buy" aria-label={g.name+' 구매'} aria-description={buyLabel} disabled={unavailable} onClick={()=>void play({type:'buyGecko',offerId:o.id})}><HomeIcon name="cart"/><span>{buyLabel}</span></button>
   </article>;
  })}</div>
  <div className="shop-cta-wrap"><EndTurnButton game={game} busy={busy} play={play} onShop={onFood} className="shop-turn-cta"><HomeIcon name="dna"/><HomeIcon name="heart"/><span>턴 넘기기</span><HomeIcon name="chevron"/><HomeIcon name="heart"/><HomeIcon name="dna"/></EndTurnButton></div>
  {game.notices.length>0&&<div className="hc-notices" role="status">{game.notices.slice(-5).map((n,i)=><p key={i}>{n}</p>)}</div>}
  <p className="shop-market-note">{MARKET.status==='provisional-game-prices'?'임시 게임 가격 · 국내 시세 미검증':'검토된 시장 추정가'} · {MARKET.version}<br/>턴 진행 시 매물 갱신 · 성별은 성체 때 공개</p>
  {confirm&&<Dialog title="발품팔기 확인" onClose={()=>setConfirm(false)}><p>현재 매물을 새로운 게코 4마리로 바꿉니다. 게임 자금 {won(SHOP_REFRESH_PRICE)}을 소비하며 턴은 진행하지 않습니다.</p><p>보유 자금 {won(game.money)} · 실행 후 {won(game.money-SHOP_REFRESH_PRICE)}</p><button className="game-primary full-width" disabled={busy||game.money<SHOP_REFRESH_PRICE} onClick={()=>void reroll()}>2,000원 사용하고 매물 갱신</button><button className="game-secondary full-width" disabled={busy} onClick={()=>setConfirm(false)}>취소</button></Dialog>}
  {selected&&<Dialog title={selected.individual.name+' 부모 정보'} onClose={()=>setInspect('')}>
   <div className="shop-family-child"><Sprite gecko={selected.individual}/><div><strong>{selected.individual.name}</strong><p>{shopMorph(selected.individual)}</p><p>{STAGE_LABELS[selected.individual.stage]} · {ageTurns(game,selected.individual)}턴 ({ageTurns(game,selected.individual)*7}일) · {disclosedSex(selected.individual)}</p><small>ID {selected.id}</small></div></div>
   {selected.family?<><div className="shop-family-grid">{[selected.family.father,selected.family.mother].map((p,n)=><article className="shop-metal" key={p.id}><h3>{n===0?'아버지':'어머니'}</h3><div className="shop-family-art"><Sprite gecko={p} large/></div><strong>{shopMorph(p)}</strong><p>{appearanceProfile(p)?.names.features.join(' · ')}</p><p>{p.sex==='male'?'수컷':'암컷'} · 교배 당시 {selected.family!.matingTurn-p.birthTurn}턴</p><p>교배 당시 {(selected.family!.matingTurn-p.birthTurn)*7}일</p></article>)}</div><p className="game-small-note">실제 부모 유전체에서 전달된 자손입니다. 부모의 외형만 공개합니다. 숨은 유전형과 조부모 정보는 표시하지 않습니다.</p></>:<p className="game-empty">기존 매물에 부모 기록이 없습니다. 확인되지 않은 부모 정보를 만들어 표시하지 않습니다.</p>}
  </Dialog>}
 </section>;
}
