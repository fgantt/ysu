import { useMemo } from 'react';
import { sendUsiCommand } from '../utils/tauriEngine';
import { TauriUsiMonitor } from './TauriUsiMonitor';
import { SecondaryPanelFrame } from './SecondaryPanelFrame';
import type { EngineConfig } from '../types/engine';
import { useSecondaryWindowHost, type SecondaryWindowConfig } from '../hooks/useSecondaryWindow';

export const USI_WINDOW_LABEL = 'usi-monitor';
export const USI_WINDOW_BOUNDS_KEY = 'shogi-usi-monitor-window-bounds';
export const USI_WINDOW_CONFIG: SecondaryWindowConfig = {
  label: USI_WINDOW_LABEL, route: '/monitor/usi', queryKey: 'session',
  updateEvent: 'usi-monitor:session', closeEvent: 'usi-monitor:closed',
  boundsKey: USI_WINDOW_BOUNDS_KEY, title: 'USI Monitor', errorNoun: 'monitor',
  defaultWidth: 760, defaultHeight: 650, minWidth: 420, minHeight: 260,
};

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
  const sessionKey = JSON.stringify(session);
  const names = useMemo(() => new Map(Object.entries(session.engineNames)), [sessionKey]);
  const { poppedOut, error, popOut } = useSecondaryWindowHost(USI_WINDOW_CONFIG, session, onDismiss, () => { if (!isVisible) onToggle(); }, { visible: isVisible, onShow: onToggle });

  return (
    <section hidden={poppedOut || !isVisible} className="secondary-panel-dock" aria-label="Secondary panels">
        <SecondaryPanelFrame id="usi-monitor" active={isVisible && !poppedOut}>
          {(floating, dock) => <TauriUsiMonitor
            engineIds={session.engineIds} engines={engines} engineNames={names}
            isVisible onToggle={onToggle} onPopOut={() => void popOut()}
            onDock={floating ? dock : undefined}
            onSendCommand={(engineId, command) => void sendUsiCommand(engineId, command)}
            player1EngineId={session.player1EngineId} player2EngineId={session.player2EngineId}
            player1Type={session.player1Type} player2Type={session.player2Type}
          />}
        </SecondaryPanelFrame>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
