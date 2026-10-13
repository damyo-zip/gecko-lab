"use client";
import { SpriteCanvas } from "../sprite-canvas";
import { specimen, morph, disclosedSex } from "@/game/hardcore/adapter";
import { STAGE_LABELS } from "@/game/model";
import { Icon } from "../icons";
import type { Action, Gecko, HardcoreGame } from "@/game/hardcore/model";
export { Dialog } from "../game/common";
export type Play = (action: Action) => Promise<boolean>;
export interface ViewProps { game: HardcoreGame; busy: boolean; play: Play; onDetail: (id: string) => void }
export const won = (n: number) => "₩" + n.toLocaleString("ko-KR");
export const STATUS = { owned: "보유 중", sold: "판매 완료", dead: "폐사" };
export function SectionHeading({title,eyebrow,icon,count,children}:{title:string;eyebrow:string;icon:React.ComponentProps<typeof Icon>["name"];count?:number;children?:React.ReactNode}){
 return <div className="game-section-heading"><div><p className="eyebrow">{eyebrow}</p><div className="hc-title-line"><h1>{title}</h1>{count!==undefined&&<span className="hc-title-count" aria-label={count+"개"}>{count}</span>}</div></div>{children??<span className="hc-section-icon"><Icon name={icon} size={22}/></span>}</div>;
}
export function Sprite({ gecko, large = false,fire="up" }: { gecko: Gecko; large?: boolean;fire?:"up"|"down" }) {
  return <SpriteCanvas specimen={specimen(gecko,fire)} scale={large ? 3 : 1} testId={"hardcore-sprite-" + gecko.id} />;
}
export function Hearts({ gecko }: { gecko: Gecko }) {
  return <span className={"hc-hearts " + (gecko.hearts <= 2 ? "danger" : "")} aria-label={"하트 " + gecko.hearts + "/5"}>{"♥".repeat(gecko.hearts)}<i>{"♡".repeat(5-gecko.hearts)}</i></span>;
}
export function Card({ gecko, onDetail, children, statusLabel }: { gecko: Gecko; onDetail: (id: string) => void; children?: React.ReactNode; statusLabel?: string }) {
  const publicSex=gecko.stage==="adult"?gecko.sex:"unknown";
  return <article className={"hc-card " + gecko.status} data-testid={"hc-card-" + gecko.id}>
    <button className="hc-card-open" onClick={() => onDetail(gecko.id)} aria-label={gecko.name + " 상세보기"}>
      <div className="hc-card-meta"><span>Gen {gecko.generation}</span><span>{statusLabel ?? STATUS[gecko.status]}</span></div>
      <div className="game-card-art"><Sprite gecko={gecko} /></div><strong><span className={"hc-sex-mark "+publicSex} aria-hidden="true">{publicSex==="male"?"♂":publicSex==="female"?"♀":"?"}</span>{gecko.name}</strong>
      <span className="game-morph">{morph(gecko)}</span><span>{STAGE_LABELS[gecko.stage]} · {disclosedSex(gecko)}</span>
      <Hearts gecko={gecko} />
    </button>{children}
  </article>;
}
