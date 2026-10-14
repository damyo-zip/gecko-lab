"use client";
import { useState } from "react";
import type { HardcoreGame, TimeMode } from "@/game/hardcore/model";
import { newGame } from "@/game/hardcore/play";
import { exportBackup, parseBackup } from "@/game/hardcore/save";
import { MAX_BACKUP_BYTES } from "@/game/save";
import { seoulDate } from "@/game/hardcore/time";
import { listArchives } from "@/storage/hardcore";
import { Dialog, type Play } from "./common";
export function downloadJSON(text:string,name:string) {
  const url=URL.createObjectURL(new Blob([text],{type:"application/json"})),a=document.createElement("a");
  a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function Settings({game,busy,error,play,replace,onClose,onReplaced}: {
  game:HardcoreGame|null;busy:boolean;error:string;play:Play;replace:(g:HardcoreGame)=>Promise<boolean>;onClose:()=>void;onReplaced:()=>void;
}) {
  const [seed,setSeed] = useState("GECKO-"+Date.now()),[localError,setLocalError] = useState("");
  const [pending,setPending] = useState<{game:HardcoreGame;kind:"new"|"restore"}|null>(null);
  const [archives,setArchives] = useState<{key:string;data:unknown}[]|null>(null);
  const [mode,setMode] = useState<TimeMode>(game?.time.mode ?? "turn"), [newMode,setNewMode] = useState<TimeMode>("turn");
  return <Dialog title="저장 및 게임 설정" onClose={onClose}>
    <p className="game-section-copy">IndexedDB 자동 저장 · 저장 v8 · v1.2. v2·v3·v4·v5·v6·v7 백업을 이전하며 과거 외형 대립유전자는 미확인으로 보존합니다. 게임 날짜와 개체·알·혈통 기록을 보존합니다.</p>
    {(localError || error) && <p className="game-warning" role="alert">{localError || error}</p>}
    {game && <button className="game-secondary full-width" onClick={()=>downloadJSON(exportBackup(game),"gecko-"+game.lastDate+".json")}>JSON 백업 저장</button>}
    {pending ? <div className="replacement-confirm"><h3>{pending.kind==="new" ? "새 게임 시작 확인" : "백업 복원 확인"}</h3><p>기존 진행은 별도 아카이브에 보존합니다. 새 게임은 새 혈통으로 시작하며 이전 개체를 되살리지 않습니다. 복원은 v1.2 수동 턴 방식으로 진행합니다.</p><p>{pending.game.gameId} · {pending.game.lastDate}</p><div className="confirm-actions"><button className="game-secondary" disabled={busy} onClick={()=>setPending(null)}>취소</button><button className="game-primary" disabled={busy} onClick={async()=>{if(await replace(pending.game)) onReplaced();}}>{pending.kind==="new" ? "새 게임 시작" : "복원 실행"}</button></div></div> : <>
      {game && <form className="hc-time-settings" onSubmit={async e=>{e.preventDefault();if(await play({type:"setTimeMode",mode})) setLocalError("");}}><label>시간 진행 방식<select aria-label="시간 진행 방식" value={mode} disabled={busy} onChange={e=>setMode(e.target.value as TimeMode)}><option value="turn">턴 마치기</option><option value="realtime" disabled>한국 자정 (이전 규칙용 어댑터 보존)</option></select></label><p className="game-small-note">v1.2는 턴 마치기로만 진행하며 1턴은 7일입니다. 재접속·현실 시간·새로고침으로 성장이나 수명이 진행되지 않습니다.</p><button className="game-primary full-width" disabled={busy || mode===game.time.mode}>시간 방식 저장</button></form>}
      <label className="file-restore">JSON 백업 파일<input type="file" accept=".json,application/json" disabled={busy} onChange={async e=>{const file=e.target.files?.[0];e.target.value="";if(!file)return;try{if(file.size>MAX_BACKUP_BYTES)throw new Error("백업 파일은 16MB 이하여야 합니다.");const restored=parseBackup(await file.text(),seoulDate(Date.now()));setLocalError("");setPending({kind:"restore",game:restored});}catch(e){setLocalError(e instanceof Error ? e.message : "복원 실패");}}}/></label>
      <form className="hc-new-game" onSubmit={e=>{e.preventDefault();try{setPending({kind:"new",game:newGame(seed,seoulDate(Date.now()),undefined,undefined,newMode)});setLocalError("");}catch(e){setLocalError(e instanceof Error ? e.message : "새 게임 오류");}}}><label>새 게임 시드<input value={seed} maxLength={128} required onChange={e=>setSeed(e.target.value)}/></label><label>새 게임 시간 방식<select aria-label="새 게임 시간 방식" value={newMode} disabled={busy} onChange={e=>setNewMode(e.target.value as TimeMode)}><option value="turn">턴 마치기</option><option value="realtime" disabled>한국 자정 (이전 규칙용 어댑터 보존)</option></select></label><button className="game-secondary full-width" disabled={busy}>새 게임 준비</button></form>
      <button className="game-secondary full-width" onClick={async()=>{try{setArchives(await listArchives());}catch(e){setLocalError(e instanceof Error ? e.message : "아카이브 오류");}}}>이전 게임 아카이브 조회</button>
      {archives && <div className="hc-archives"><h3>보존된 이전 게임 {archives.length}개</h3>{archives.map(a=><div key={a.key}><code>{a.key}</code><button className="game-secondary full-width" onClick={()=>downloadJSON(JSON.stringify(a.data,null,2),a.key+".json")}>아카이브 JSON 다운로드</button></div>)}<p className="game-small-note">아카이브는 읽기 전용 기록입니다. 현재 게임에 이전 개체를 합치거나 부활시키지 않습니다.</p></div>}
    </>}
  </Dialog>;
}
