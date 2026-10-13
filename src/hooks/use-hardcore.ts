"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Action, HardcoreGame } from "@/game/hardcore/model";
import { act as reduceAction, synchronize } from "@/game/hardcore/play";
import { deviceClock, seoulDate, type Clock } from "@/game/hardcore/time";
import { loadGame, persistHardcore, type LoadedHardcore } from "@/storage/hardcore";
import { SaveConflict } from "@/storage/indexed-db";

export function useHardcore(clock: Clock = deviceClock) {
  const [game, setGame] = useState<HardcoreGame | null>(null), [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [conflict, setConflict] = useState(false);
  const current = useRef<LoadedHardcore | null>(null), lock = useRef(false), mounted = useRef(false), stale = useRef(false);
  useEffect(() => {
    mounted.current = true; let cancelled = false;
    loadGame(seoulDate(clock.now())).then(loaded => {
      if (cancelled) return; current.current = loaded; setGame(loaded.game); setLoading(false);
    }).catch(e => { if (!cancelled) { setError(e instanceof Error ? e.message : "저장 읽기 실패"); setLoading(false); } });
    return () => { cancelled = true; mounted.current = false; };
  }, [clock]);
  const run = useCallback(async (action?: Action, replacement?: HardcoreGame) => {
    if (lock.current || stale.current || (!current.current && !replacement)) return false;
    lock.current = true; setBusy(true);
    const date = seoulDate(clock.now());
    try {
      const source = current.current?.game;
      const synced = synchronize(replacement ?? source!, date);
      // Daily losses/events still commit when a now-invalid action fails (e.g. feeding a dead animal).
      let next = synced, actionError: unknown;
      if (action) { try { next = reduceAction(synced, action, date); } catch (e) { actionError = e; } }
      if (replacement || next !== source) {
        const loaded = await persistHardcore(next, current.current?.writeRevision ?? null, !!replacement);
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
    } finally { lock.current = false; if (mounted.current) setBusy(false); }
  }, [clock]);
  useEffect(() => {
    const sync = () => { if (current.current && current.current.game.lastDate !== seoulDate(clock.now())) void run(); };
    const timer = window.setInterval(sync, 30_000);
    window.addEventListener("focus", sync); window.addEventListener("online", sync); document.addEventListener("visibilitychange", sync);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", sync); window.removeEventListener("online", sync); document.removeEventListener("visibilitychange", sync); };
  }, [run, clock]);
  return { game, loading, busy, error, conflict, act: (action: Action) => run(action), replace: (next: HardcoreGame) => run(undefined, next) };
}
