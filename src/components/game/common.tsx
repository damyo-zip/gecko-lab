"use client";

import { useId, useLayoutEffect, useRef } from "react";
import { phenotypeOf, toSpecimen } from "@/game/adapter";
import { genotypeLabel } from "@/genetics/mendel";
import { SEX_LABELS, STAGE_LABELS, type Individual } from "@/game/model";
import { SpriteCanvas } from "../sprite-canvas";

export function GameSprite({ individual, scale = 1 }: { individual: Individual; scale?: 1 | 3 | 4 }) {
  return <SpriteCanvas specimen={toSpecimen(individual)} growthStage={individual.stage} scale={scale} testId={"game-sprite-" + individual.id} />;
}
export function IndividualCard({ individual, onOpen, turn }: { individual: Individual; onOpen: () => void; turn: number }) {
  const phenotype = phenotypeOf(individual);
  return <button type="button" className="game-individual-card" onClick={onOpen}
    data-testid={"individual-card-" + individual.id} aria-label={individual.name + " 상세보기"}>
    <div className="game-card-top"><span className={"sex-mark " + individual.sex}>{individual.sex === "male" ? "♂" : "♀"}</span>
      <span>Gen {individual.generation}</span></div>
    <div className="game-card-art"><GameSprite individual={individual} /></div>
    <strong>{individual.name}</strong><span className="game-morph">{phenotype.description}</span>
    <span className="game-genotype">{genotypeLabel(individual.genotype)}</span>
    <span className={"game-stage " + individual.stage}>{STAGE_LABELS[individual.stage]}
      {individual.stage === "adult" ? individual.nextBreedTurn <= turn ? " · 교배 가능" : " · 대기 중" : " · 성장 중"}</span>
  </button>;
}
export function ParentSummary({ individual, title }: { individual: Individual | undefined; title: string }) {
  return <div className="parent-summary">
    <span className="eyebrow">{title}</span>
    {individual ? <><div className="parent-art"><GameSprite individual={individual} /></div>
      <strong>{individual.name}</strong><span>{SEX_LABELS[individual.sex]} · Gen {individual.generation}</span>
      <span>{phenotypeOf(individual).description}</span><code>{genotypeLabel(individual.genotype)}</code>
      <span className={"game-stage " + individual.stage}>{STAGE_LABELS[individual.stage]}</span></> : <p>부모를 선택하세요.</p>}
  </div>;
}
export function Dialog({ title, onClose, children, className = '',headerActions, minimal=false,onOpen }: { title: React.ReactNode; onClose: () => void; children: React.ReactNode; className?:string;headerActions?:React.ReactNode;minimal?:boolean;onOpen?:(dialog:HTMLDialogElement)=>void }) {
  const ref = useRef<HTMLDialogElement>(null), titleId = useId();
  // Layout effect keeps focus within the opening tap/user activation on mobile.
  useLayoutEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) {dialog.showModal();onOpen?.(dialog);}
    return () => { if (dialog?.open) dialog.close(); };
  }, []);
  return <dialog ref={ref} className={'game-dialog '+className} aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); event.stopPropagation(); onClose(); }}>
    <>{minimal?<span id={titleId} hidden>{title}</span>:<div className="dialog-heading"><h2 id={titleId}>{title}</h2>{headerActions&&<div className="dialog-header-actions">{headerActions}</div>}<button type="button" onClick={onClose} aria-label="상세 창 닫기">×</button></div>}</>
    {children}
  </dialog>;
}
