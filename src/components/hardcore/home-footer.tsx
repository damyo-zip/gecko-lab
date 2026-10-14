import type {HardcoreGame} from "@/game/hardcore/model";
import type {Play} from "./common";
import {EndTurnButton} from "./end-turn";
import {HomeIcon, type HomeIconName} from "./home-icons";

const TABS = [
  {id:"collection",label:"컬렉션",icon:"collection"},
  {id:"incubator",label:"인큐베이터",icon:"egg"},
  {id:"lineage",label:"혈통도",icon:"tree"},
  {id:"shop",label:"상점",icon:"shop"},
] as const satisfies readonly {id:string;label:string;icon:HomeIconName}[];

/** One persistent footer: tab contents cannot resize or move these controls. */
export function HomeFooter({game,busy,tab,play,onFood,onTab}:{game:HardcoreGame|null;busy:boolean;tab:string;play:Play;onFood:()=>void;onTab:(tab:string)=>void}) {
  const label=<><HomeIcon name="dna" size={42}/><HomeIcon name="heart" size={12}/><span>턴 넘기기</span><HomeIcon name="chevron" size={24}/><HomeIcon name="heart" size={12}/><HomeIcon name="dna" size={42}/></>;
  return <footer className="home-footer">
    <div className="home-cta-surround">{game
      ? <EndTurnButton game={game} busy={busy} play={play} onShop={onFood} className="home-turn-cta">{label}</EndTurnButton>
      : <button className="home-turn-cta" disabled>{label}</button>}
    </div>
    <nav className="game-bottom-nav hc-nav home-nav" aria-label="게임 탭">{TABS.map(t=><button key={t.id} aria-pressed={tab===t.id} disabled={!game||busy} onClick={()=>onTab(t.id)}><HomeIcon name={t.icon} size={33}/><span>{t.label}</span></button>)}</nav>
  </footer>;
}
