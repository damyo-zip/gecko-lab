"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GameAction, GameState } from "@/game/model";
import { applyAction } from "@/game/play";
import { loadOrCreateGame, persistGame, SaveConflict, type LoadedGame } from "@/storage/indexed-db";

export function useGame() {
  const [game, setGame] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const current = useRef<LoadedGame | null>(null);
  const lock = useRef(false);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    let cancelled = false;
    loadOrCreateGame().then((loaded) => {
      if (cancelled) return;
      current.current = loaded; setGame(loaded.game); setLoading(false);
    }).catch((caught) => {
      if (!cancelled) { setError(caught instanceof Error ? caught.message : "저장 데이터 읽기 실패"); setLoading(false); }
    });
    return () => { cancelled = true; mounted.current = false; };
  }, []);

  const commit = useCallback(async (next: GameState, recovery = false): Promise<boolean> => {
    if (lock.current || conflict) return false;
    lock.current = true; setBusy(true);
    try {
      const loaded = await persistGame(next, current.current?.writeRevision ?? null, recovery);
      current.current = loaded;
      if (mounted.current) { setGame(loaded.game); setError(""); setConflict(false); }
      return true;
    } catch (caught) {
      if (mounted.current) {
        setError(caught instanceof Error ? caught.message : "자동 저장 실패");
        if (caught instanceof SaveConflict) setConflict(true);
      }
      return false;
    } finally { lock.current = false; if (mounted.current) setBusy(false); }
  }, [conflict]);
  const act = useCallback(async (action: GameAction): Promise<boolean> => {
    if (!current.current || lock.current || conflict) return false;
    try { return await commit(applyAction(current.current.game, action)); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "진행할 수 없습니다."); return false; }
  }, [commit, conflict]);
  const replace = useCallback((next: GameState) => commit(next, current.current === null), [commit]);
  return { game, loading, busy, error, conflict, act, replace };
}
