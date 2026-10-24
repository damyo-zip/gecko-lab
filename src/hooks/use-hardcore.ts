"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Action, HardcoreGame } from "@/game/hardcore/model";
import { actWithTime, needsTimeSync, synchronizeTime } from "@/game/hardcore/time-source";
import { deviceClock, seoulDate, type Clock } from "@/game/hardcore/time";
import { loadGame, persistHardcore, type LoadedHardcore } from "@/storage/hardcore";
import { SaveConflict } from "@/storage/indexed-db";
import {RushClient} from '@/storage/rush-client';

export function useHardcore(clock: Clock = deviceClock) {
  const [game, setGame] = useState<HardcoreGame | null>(null), [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [conflict, setConflict] = useState(false);
  const current = useRef<LoadedHardcore | null>(null), lock = useRef(false), mounted = useRef(false), stale = useRef(false);
  const rush=useRef<RushClient|null>(null);
  const prepareRush=useCallback(async()=>{
    if(!current.current)return;
    rush.current??=new RushClient();await rush.current.prepare(current.current);
  },[]);
  const run = useCallback(async (action?: Action, replacement?: HardcoreGame) => {
    if (lock.current || stale.current || (!current.current && !replacement)) return false;
    lock.current = true; setBusy(true);
    try {
      const date = seoulDate(clock.now());
      const source = current.current?.game;
      // Animation checkpoints keep the exact persistence contract off the UI thread.
      // All other actions (including payroll) retain the established path below.
      if(action?.type==='stepRush'&&!replacement&&current.current){
        rush.current??=new RushClient();
        const loaded=await rush.current.step(current.current,action,date);
        if(loaded){current.current=loaded;if(mounted.current){setGame(loaded.game);setError('');}return true;}
      }
      const synced = synchronizeTime(replacement ?? source!, date);
      // Daily losses/events still commit when a now-invalid action fails (e.g. feeding a dead animal).
      let next = synced, actionError: unknown;
      if (action) { try { next = actWithTime(synced, action, date); } catch (e) { actionError = e; } }
      if (replacement || next !== source) {
        const loaded = await persistHardcore(next, current.current?.writeRevision ?? null, !!replacement);
        if(replacement||action?.type==='claimRush')rush.current?.dispose();
        // Prepare before the first animation frame, avoiding a large transfer mid-jump.
        if(action?.type==='startRush'){
          rush.current??=new RushClient();await rush.current.prepare(loaded);
        }
        current.current = loaded; if (mounted.current) setGame(loaded.game);
      }
      // A focus/midnight signal can arrive while an IndexedDB commit holds the lock.
      // Drain the clock after each commit, before unlocking; never replay the user action.
      while (current.current && needsTimeSync(current.current.game, seoulDate(clock.now()))) {
        const updated = synchronizeTime(current.current.game, seoulDate(clock.now()));
        const loaded = await persistHardcore(updated, current.current.writeRevision);
        current.current = loaded; if (mounted.current) setGame(loaded.game);
      }
      if (actionError) throw actionError;
      if (mounted.current) setError(""); return true;
    } catch (e) {
      if (mounted.current) {
        setError(e instanceof Error ? e.message : "저장 실패");
        if (e instanceof SaveConflict) { stale.current = true; setConflict(true); }
      }
      return false;
    } finally {
      // Keep all turn entry points locked through a rapid second physical tap,
      // including devices where IndexedDB finishes before that tap arrives.
      if(action?.type==='endTurn')await new Promise(resolve=>setTimeout(resolve,350));
      lock.current = false; if (mounted.current) setBusy(false);
    }
  }, [clock]);
  useEffect(() => {
    mounted.current = true; let cancelled = false;
    loadGame(seoulDate(clock.now())).then(loaded => {
      if (cancelled) return; current.current = loaded; setGame(loaded.game); setLoading(false);
      if (needsTimeSync(loaded.game, seoulDate(clock.now()))) void run();
    }).catch(e => { if (!cancelled) { setError(e instanceof Error ? e.message : "저장 읽기 실패"); setLoading(false); } });
    return () => { cancelled = true; mounted.current = false; rush.current?.dispose();rush.current=null; };
  }, [clock, run]);
  useEffect(() => {
    const sync = () => { if (current.current && needsTimeSync(current.current.game, seoulDate(clock.now()))) void run(); };
    const timer = window.setInterval(sync, 30_000);
    window.addEventListener("focus", sync); window.addEventListener("online", sync); document.addEventListener("visibilitychange", sync);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", sync); window.removeEventListener("online", sync); document.removeEventListener("visibilitychange", sync); };
  }, [run, clock]);
  const act=useCallback((action:Action)=>run(action),[run]);
  const replace=useCallback((next:HardcoreGame)=>run(undefined,next),[run]);
  return { game, loading, busy, error, conflict, act, replace,prepareRush };
}
