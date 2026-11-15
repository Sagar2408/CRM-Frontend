import { useCallback, useEffect, useRef, useState } from "react";
import {
  getProcessWorkStatusApi,
  startWorkApi,
  startBreakApi,
  stopBreakApi,
} from "../../services/processService";

const RESYNC_MS = 60 * 1000;

export const formatClock = (total) => {
  const s = Math.max(0, Math.floor(total || 0));
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
};

/**
 * Process Person work / break clock. The server owns the numbers: this hook fetches
 * `state` ({ workSeconds, breakSeconds, onBreak, working }), then only *renders*
 * elapsed time on top of it with ONE interval, and re-syncs from the server every
 * minute and whenever the tab becomes visible again. Because the base always comes
 * from the server, refreshing or navigating never resets or duplicates time.
 *
 * Mount it once (ProcessLayout). It starts / resumes today's work session when the
 * state says nothing is running (idempotent on the server).
 */
export default function useProcessWorkClock(userId) {
  const [base, setBase] = useState(null); // server snapshot + when we received it
  const [, tick] = useState(0);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const aliveRef = useRef(true);

  const apply = useCallback((state) => {
    if (!aliveRef.current || !state) return;
    setBase({
      workSeconds: state.workSeconds || 0,
      breakSeconds: state.breakSeconds || 0,
      onBreak: !!state.onBreak,
      working: !!state.working,
      receivedAt: Date.now(),
    });
  }, []);

  const sync = useCallback(async () => {
    if (!userId) return;
    try {
      const { state } = await getProcessWorkStatusApi();
      if (state && !state.working && !state.onBreak) {
        // Nothing running (first login today, or resumed after logout): open a work segment.
        const res = await startWorkApi(userId);
        apply(res.state || state);
      } else {
        apply(state);
      }
    } catch (err) {
      console.error("Work clock sync failed:", err.message);
    }
  }, [userId, apply]);

  useEffect(() => {
    aliveRef.current = true;
    sync();
    const resync = setInterval(sync, RESYNC_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") sync();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      aliveRef.current = false;
      clearInterval(resync);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [sync]);

  // One render tick per second, only while a segment is actually running.
  const running = !!base && (base.working || base.onBreak);
  useEffect(() => {
    if (!running) return undefined;
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  const elapsed = base ? Math.max(0, Math.floor((Date.now() - base.receivedAt) / 1000)) : 0;
  const workSeconds = (base?.workSeconds || 0) + (base?.working ? elapsed : 0);
  const breakSeconds = (base?.breakSeconds || 0) + (base?.onBreak ? elapsed : 0);

  const toggleBreak = useCallback(async () => {
    if (!userId || busyRef.current || !base) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const res = base.onBreak ? await stopBreakApi(userId) : await startBreakApi(userId);
      apply(res.state);
    } catch (err) {
      console.error("Break toggle failed:", err.message);
      await sync();
    } finally {
      busyRef.current = false;
      if (aliveRef.current) setBusy(false);
    }
  }, [userId, base, apply, sync]);

  return {
    loaded: !!base,
    working: !!base?.working,
    onBreak: !!base?.onBreak,
    workTimer: formatClock(workSeconds),
    breakTimer: formatClock(breakSeconds),
    workSeconds,
    breakSeconds,
    busy,
    toggleBreak,
    refresh: sync,
  };
}
