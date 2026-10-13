"use client";

import { useState } from "react";
import { createNewGame, DEFAULT_RULES } from "@/game/play";
import { exportBackup, MAX_BACKUP_BYTES, parseBackup } from "@/game/save";
import { TRAIT_KEYS, TRAIT_LABELS } from "@/genetics/traits";
import type { GameRules, GameState } from "@/game/model";
import { Dialog } from "./common";

export function GameSettings({ game, busy, error, replace, onClose, onReplaced }: {
  game: GameState | null; busy: boolean; error: string; replace: (game: GameState) => Promise<boolean>;
  onClose: () => void; onReplaced: () => void;
}) {
  const [seed,setSeed] = useState("GECKO-LAB-NEW");
  const [rules,setRules] = useState<GameRules>(() => structuredClone(DEFAULT_RULES));
  const [localError,setLocalError] = useState("");
  const [newGameOpen,setNewGameOpen] = useState(false);
  const [pending,setPending] = useState<{kind:"restore"|"new";game:GameState}|null>(null);
  const backup = () => {
    if (!game) return;
    const url = URL.createObjectURL(new Blob([exportBackup(game)],{type:"application/json"}));
    const link = document.createElement("a"); link.href = url; link.download = "gecko-lab-turn-"+game.turn+".json"; link.click();
    setTimeout(() => URL.revokeObjectURL(url),1000);
  };
  const numberFields: {key:"incubationTurns"|"juvenileAfter"|"adultAfter"|"cooldownTurns";label:string;min:number;max:number}[] = [
    {key:"incubationTurns",label:"부화 기간",min:1,max:30},{key:"juvenileAfter",label:"아성체가 되는 나이",min:1,max:100},
    {key:"adultAfter",label:"성체가 되는 나이",min:2,max:200},{key:"cooldownTurns",label:"교배 대기 기간",min:0,max:100},
  ];
  return <Dialog title="저장 및 게임 설정" onClose={onClose}>
    <p className="game-section-copy">이 브라우저의 IndexedDB에 자동 저장합니다. 브라우저 데이터를 지우면 진행도 삭제되므로 JSON 백업을 보관하세요.</p>
    {(localError || error) && <p className="game-warning" role="alert">{localError || error}</p>}
    {pending ? <div className="replacement-confirm" data-testid="replacement-confirm">
      <h3>{pending.kind === "restore" ? "백업 복원을 확인해 주세요" : "새 게임 시작을 확인해 주세요"}</h3>
      <p>현재 저장 슬롯의 진행을 교체합니다. 기존 진행을 남기려면 먼저 JSON 백업을 저장하세요.</p>
      <dl><div><dt>복원할 턴</dt><dd>TURN {pending.game.turn}</dd></div><div><dt>개체 · 알</dt><dd>{Object.keys(pending.game.individuals).length}마리 · {Object.keys(pending.game.eggs).length}개</dd></div></dl>
      <div className="confirm-actions"><button type="button" className="game-secondary" disabled={busy} onClick={() => {setPending(null);setLocalError("");}}>취소</button>
        <button type="button" className="game-primary" disabled={busy} onClick={async () => {
          if (await replace(pending.game)) onReplaced();
          else setLocalError("진행을 교체하지 못했습니다. 저장소 권한·용량과 다른 창의 변경을 확인해 주세요.");
        }}>{pending.kind === "restore" ? "복원 실행" : "새 게임 시작"}</button></div>
      {game && <button type="button" className="game-secondary full-width" onClick={backup}>현재 진행 JSON 백업</button>}
    </div> : <>
      <div className="backup-panel"><h3>백업과 복원</h3>
        <button type="button" className="game-secondary full-width" disabled={!game || busy} onClick={backup}>JSON 백업 저장</button>
        <label className="file-restore">JSON 백업 파일<input type="file" accept=".json,application/json" disabled={busy} onChange={async event => {
          const file = event.target.files?.[0]; event.target.value = "";
          if (!file) return;
          try {
            if (file.size > MAX_BACKUP_BYTES) throw new Error("백업 파일은 16MB 이하여야 합니다.");
            const restored = parseBackup(await file.text());
            setLocalError(""); setPending({kind:"restore",game:restored});
          } catch (caught) { setLocalError(caught instanceof Error ? caught.message : "백업을 읽을 수 없습니다."); }
        }} /></label>
      </div>
      <details className="new-game-settings" open={newGameOpen} onToggle={event => setNewGameOpen(event.currentTarget.open)}><summary>새 게임 설정</summary>
        <form onSubmit={event => {
          event.preventDefault();
          try { setPending({kind:"new",game:createNewGame(seed.trim(),rules)});setLocalError(""); }
          catch (caught) { setLocalError(caught instanceof Error ? caught.message : "규칙을 확인해 주세요."); }
        }}>
          <fieldset disabled={busy}><label className="seed-setting" htmlFor="game-seed">새 게임 시드<input id="game-seed" value={seed} maxLength={128} onChange={event => setSeed(event.target.value)} /></label>
            <p className="game-small-note">같은 시드와 플레이 순서로 같은 자손을 재현합니다. 새 게임은 시작 성체 6마리를 제공합니다.</p>
            <div className="rule-fields">{numberFields.map(field => <label key={field.key}>{field.label} (턴)
              <input type="number" min={field.min} max={field.max} value={rules[field.key]} required onChange={e => setRules(current => ({...current,[field.key]:Number(e.target.value)}))} /></label>)}</div>
            <h3>외형 형질별 변이 폭</h3><p className="game-small-note">부모 평균 ± 아래 폭의 균등 변이입니다. 실제 유전 확률이 아닌 게임 설정입니다.</p>
            <div className="variation-fields">{TRAIT_KEYS.map(key => <label key={key}>{TRAIT_LABELS[key]} ±
              <input type="number" min="0" max="100" step="1" value={Math.round(rules.traitVariation[key]*100)} onChange={e => setRules(current => ({
                ...current,traitVariation:{...current.traitVariation,[key]:Number(e.target.value)/100},
              }))} />%</label>)}</div>
            <button type="submit" className="game-primary full-width">새 게임 준비</button>
          </fieldset>
        </form>
      </details>
    </>}
  </Dialog>;
}
