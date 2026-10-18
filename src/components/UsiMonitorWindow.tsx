import { useEffect } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { sendUsiCommand } from '../utils/tauriEngine';
import { TauriUsiMonitor } from './TauriUsiMonitor';
import { USI_WINDOW_CONFIG, type MonitorSession } from './UsiMonitorHost';
import '../styles/themes.css';
import './UsiMonitor.css';
import { useDynamicTheme } from '../hooks/useDynamicTheme';
import { returnSecondaryWindow, readSecondaryWindowPayload, useSecondaryWindow } from '../hooks/useSecondaryWindow';

export function UsiMonitorWindow() {
  useDynamicTheme();
  const session = useSecondaryWindow(USI_WINDOW_CONFIG, readSecondaryWindowPayload<MonitorSession | null>('session', null));

  useEffect(() => {
    const applyTheme = () => document.documentElement.setAttribute('data-theme', localStorage.getItem('shogiVibeTheme') || 'light');
    applyTheme();
    window.addEventListener('storage', applyTheme);
    return () => window.removeEventListener('storage', applyTheme);
  }, []);

  if (!session) return <p>Waiting for an active game…</p>;
  return (
    <main className="usi-monitor-window">
      <TauriUsiMonitor
        engineIds={session.engineIds} engineNames={new Map(Object.entries(session.engineNames))}
        isVisible externalWindow onDock={() => void returnSecondaryWindow(USI_WINDOW_CONFIG).catch(console.error)} onToggle={() => void getCurrentWindow().close()}
        onSendCommand={(engineId, command) => void sendUsiCommand(engineId, command)}
        player1EngineId={session.player1EngineId} player2EngineId={session.player2EngineId}
        player1Type={session.player1Type} player2Type={session.player2Type}
      />
    </main>
  );
}
