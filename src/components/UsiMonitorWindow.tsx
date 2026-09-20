import { useEffect, useState } from 'react';
import { emitTo, listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { sendUsiCommand } from '../utils/tauriEngine';
import { TauriUsiMonitor } from './TauriUsiMonitor';
import { USI_WINDOW_BOUNDS_KEY, type MonitorSession } from './UsiMonitorHost';
import '../styles/themes.css';
import './UsiMonitor.css';

function initialSession(): MonitorSession | null {
  try {
    const raw = new URLSearchParams(window.location.search).get('session');
    return raw ? JSON.parse(raw) as MonitorSession : null;
  } catch { return null; }
}

export function UsiMonitorWindow() {
  const [session, setSession] = useState(initialSession);

  useEffect(() => {
    const applyTheme = () => document.documentElement.setAttribute('data-theme', localStorage.getItem('shogiVibeTheme') || 'light');
    applyTheme();
    window.addEventListener('storage', applyTheme);
    return () => window.removeEventListener('storage', applyTheme);
  }, []);

  useEffect(() => {
    let disposed = false;
    let closing = false;
    let unlistenSession: (() => void) | undefined;
    let unlistenClose: (() => void) | undefined;
    void listen<MonitorSession>('usi-monitor:session', event => setSession(event.payload))
      .then(fn => { if (disposed) fn(); else unlistenSession = fn; });
    void getCurrentWindow().onCloseRequested(async event => {
      if (closing) return;
      event.preventDefault();
      closing = true;
      try { await emitTo('main', 'usi-monitor:closed'); }
      finally { await getCurrentWindow().close(); }
    })
      .then(fn => { if (disposed) fn(); else unlistenClose = fn; });
    return () => { disposed = true; unlistenSession?.(); unlistenClose?.(); };
  }, []);

  useEffect(() => {
    const current = getCurrentWindow();
    let disposed = false;
    const listeners: Array<() => void> = [];
    let timer: ReturnType<typeof setTimeout>;
    const saveBounds = () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        try {
          const [position, size] = await Promise.all([current.outerPosition(), current.innerSize()]);
          localStorage.setItem(USI_WINDOW_BOUNDS_KEY, JSON.stringify({ x: position.x, y: position.y, width: size.width, height: size.height }));
        } catch (error) { console.error('Failed to save monitor bounds:', error); }
      }, 250);
    };
    void current.onMoved(saveBounds).then(fn => { if (disposed) fn(); else listeners.push(fn); });
    void current.onResized(saveBounds).then(fn => { if (disposed) fn(); else listeners.push(fn); });
    return () => { disposed = true; clearTimeout(timer); listeners.forEach(fn => fn()); };
  }, []);

  if (!session) return <p>Waiting for an active game…</p>;
  return (
    <main className="usi-monitor-window">
      <TauriUsiMonitor
        engineIds={session.engineIds} engineNames={new Map(Object.entries(session.engineNames))}
        isVisible externalWindow onToggle={() => void getCurrentWindow().close()}
        onSendCommand={(engineId, command) => void sendUsiCommand(engineId, command)}
        player1EngineId={session.player1EngineId} player2EngineId={session.player2EngineId}
        player1Type={session.player1Type} player2Type={session.player2Type}
      />
    </main>
  );
}
