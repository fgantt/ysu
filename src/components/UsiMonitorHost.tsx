import { useCallback, useEffect, useMemo, useState } from 'react';
import { emitTo, listen } from '@tauri-apps/api/event';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { sendUsiCommand } from '../utils/tauriEngine';
import { TauriUsiMonitor } from './TauriUsiMonitor';
import { SecondaryPanelFrame } from './SecondaryPanelFrame';
import type { EngineConfig } from '../types/engine';

export const USI_WINDOW_LABEL = 'usi-monitor';
export const USI_WINDOW_BOUNDS_KEY = 'shogi-usi-monitor-window-bounds';

export interface MonitorSession {
  engineIds: string[];
  engineNames: Record<string, string>;
  player1EngineId: string | null;
  player2EngineId: string | null;
  player1Type: 'human' | 'ai';
  player2Type: 'human' | 'ai';
}

interface Props {
  session: MonitorSession;
  engines: EngineConfig[];
  isVisible: boolean;
  onToggle: () => void;
  onDismiss: () => void;
}

export function UsiMonitorHost({ session, engines, isVisible, onToggle, onDismiss }: Props) {
  const [poppedOut, setPoppedOut] = useState(false);
  const [error, setError] = useState('');
  const sessionKey = JSON.stringify(session);
  const names = useMemo(() => new Map(Object.entries(session.engineNames)), [sessionKey]);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    listen('usi-monitor:closed', () => {
      if (!disposed) {
        setPoppedOut(false);
        onDismiss();
      }
    }).then(fn => { if (disposed) fn(); else unlisten = fn; });
    WebviewWindow.getByLabel(USI_WINDOW_LABEL).then(win => {
      if (win && !disposed) setPoppedOut(true);
    });
    return () => { disposed = true; unlisten?.(); };
  }, [onDismiss]);

  useEffect(() => {
    if (poppedOut) void emitTo(USI_WINDOW_LABEL, 'usi-monitor:session', session).catch(console.error);
  }, [poppedOut, sessionKey]);

  const popOut = useCallback(async () => {
    setError('');
    try {
      const existing = await WebviewWindow.getByLabel(USI_WINDOW_LABEL);
      if (existing) {
        await existing.show();
        await existing.setFocus();
      } else {
        const url = `/monitor/usi?session=${encodeURIComponent(JSON.stringify(session))}`;
        let bounds: { x: number; y: number; width: number; height: number } | null = null;
        try {
          const stored = localStorage.getItem(USI_WINDOW_BOUNDS_KEY);
          if (stored) {
            const parsed = JSON.parse(stored);
            if ([parsed.x, parsed.y, parsed.width, parsed.height].every(Number.isFinite) && parsed.width >= 420 && parsed.height >= 260) bounds = parsed;
          }
        } catch { /* Invalid saved geometry: use native default placement. */ }
        const window = new WebviewWindow(USI_WINDOW_LABEL, {
          url, title: 'USI Monitor', width: bounds?.width ?? 760, height: bounds?.height ?? 650,
          ...(bounds ? { x: bounds.x, y: bounds.y } : {}),
          minWidth: 420, minHeight: 260, resizable: true,
        });
        await new Promise<void>((resolve, reject) => {
          void window.once('tauri://created', () => resolve());
          void window.once('tauri://error', event => reject(event.payload));
        });
      }
      setPoppedOut(true);
    } catch (cause) {
      setError(`Could not open monitor window: ${String(cause)}`);
    }
  }, [sessionKey]);

  return (
    <section className="secondary-panel-dock" aria-label="Secondary panels">
      {poppedOut ? (
        <button className="toggle-button" onClick={() => void popOut()}>Show USI Monitor window</button>
      ) : (
        <SecondaryPanelFrame id="usi-monitor" active={isVisible}>
          {(floating, dock) => <TauriUsiMonitor
            engineIds={session.engineIds} engines={engines} engineNames={names}
            isVisible={isVisible} onToggle={onToggle} onPopOut={() => void popOut()}
            onDock={floating ? dock : undefined}
            onSendCommand={(engineId, command) => void sendUsiCommand(engineId, command)}
            player1EngineId={session.player1EngineId} player2EngineId={session.player2EngineId}
            player1Type={session.player1Type} player2Type={session.player2Type}
          />}
        </SecondaryPanelFrame>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
