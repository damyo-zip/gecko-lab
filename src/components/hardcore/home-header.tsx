import type {HardcoreGame} from "@/game/hardcore/model";
import {HomeIcon} from "./home-icons";
export function HomeHeader({game,disabled,onSettings,onShop}:{game:HardcoreGame|null;disabled:boolean;onSettings:()=>void;onShop:()=>void}) {
  const money=game?(game.money>=10_000_000?new Intl.NumberFormat("ko-KR",{notation:"compact",maximumFractionDigits:1}).format(game.money):game.money.toLocaleString("ko-KR")):"—";
  return <header className="home-header">
    <button className="home-settings home-frame" aria-label="저장 및 게임 설정" disabled={disabled} onClick={onSettings}><HomeIcon name="gear"/></button>
    <a className="home-brand" href="/" aria-label="GECKO LAB 홈">
      <div><HomeIcon name="leaf"/><img src="/ui/home-wordmark.svg" width={209} height={28} alt="GECKO LAB"/><HomeIcon name="leaf"/></div>
      <small><span aria-hidden="true">✣</span> 나만의 크레스티드 게코 연구소 <span aria-hidden="true">✣</span></small>
    </a>
    <div className="home-resources home-frame" aria-label="연구소 자원">
      <div><HomeIcon name="coin"/><b data-testid="game-money" aria-label="게임 자금 (원)" title={game?game.money.toLocaleString("ko-KR")+"원":undefined}>{money}</b><button aria-label="자금 및 상점 보기" disabled={disabled} onClick={onShop}><HomeIcon name="plus" size={14}/></button></div>
      <div><HomeIcon name="food"/><b data-testid="game-food" aria-label="먹이 재고">{game?game.food.toLocaleString("ko-KR"):"—"}</b><button aria-label="먹이 구입하기" disabled={disabled} onClick={onShop}><HomeIcon name="plus" size={14}/></button></div>
    </div>
  </header>;
}
