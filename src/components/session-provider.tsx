'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { advanceSession, createSession, faultSession } from '@/lib/session';
import { decodeSession, STORAGE_KEY } from '@/lib/storage';
import { DT, MAX_TICKS } from '@/lib/types';
import type { FaultType, Session } from '@/lib/types';

interface SessionContextValue {
  session: Session | null; ready: boolean; running: boolean; error: string | null;
  start: () => void; pause: () => void; reset: () => void; inject: (type: FaultType) => void;
}
const Context = createContext<SessionContextValue | null>(null);
// getRandomValues also works on plain HTTP development origins.
const fresh = (incidents: Session['incidents'] = []) => createSession(Date.now(), Array.from(crypto.getRandomValues(new Uint8Array(6)), n => n.toString(16).padStart(2, '0')).join(''), incidents);
export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const current = useRef<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const blocked = useRef(false);
  const lastSavedTick = useRef(-1);
  const commit = useCallback((value: Session) => { current.current = value; setSession(value); }, []);
  const save = useCallback(() => {
    if (!current.current || blocked.current) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(current.current));
      lastSavedTick.current = current.current.sim.tick;
      setError(null);
    } catch { setError('Browser storage is unavailable or full. This session works in memory, but it may be lost on reload.'); }
  }, []);
  useEffect(() => {
    try { const raw = localStorage.getItem(STORAGE_KEY); commit(raw ? decodeSession(raw) : fresh()); }
    catch (e) { blocked.current = true; setError(e instanceof Error ? e.message : 'Unable to read saved data.'); commit(fresh()); }
    setReady(true);
  }, [commit]);
  useEffect(() => {
    if (!ready) return;
    const timer = setInterval(() => { if (current.current?.sim.tick !== lastSavedTick.current) save(); }, 1000);
    window.addEventListener('pagehide', save);
    return () => { clearInterval(timer); window.removeEventListener('pagehide', save); };
  }, [ready, save]);
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => {
      if (!current.current) return;
      const next = advanceSession(current.current);
      commit(next);
      if (next.sim.tick >= MAX_TICKS) { setRunning(false); save(); }
    }, DT * 1000);
    return () => clearInterval(timer);
  }, [running, commit, save]);
  const start = () => { if (!blocked.current && current.current && current.current.sim.tick < MAX_TICKS) setRunning(true); };
  const pause = () => { setRunning(false); save(); };
  const reset = () => { setRunning(false); blocked.current = false; commit(fresh(current.current?.incidents)); save(); };
  const inject = (type: FaultType) => { if (running && current.current && current.current.sim.tick >= 25) { commit(faultSession(current.current, type)); save(); } };
  return <Context.Provider value={{session,ready,running,error,start,pause,reset,inject}}>{children}</Context.Provider>;
}
export function useSession() {
  const context = useContext(Context);
  if (!context) throw new Error('SessionProvider is required');
  return context;
}
