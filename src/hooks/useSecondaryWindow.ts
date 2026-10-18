import { useCallback, useEffect, useRef, useState } from 'react';
import { emitTo, listen } from '@tauri-apps/api/event';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { focusSecondaryPanel } from '../components/SecondaryPanelFrame';
import { SECONDARY_VIEW_TOGGLE_EVENT, secondaryViewWindowLabels, useSecondaryViewShortcuts, type SecondaryView } from '../components/SecondaryViewMenu';
import { getCurrentWindow } from '@tauri-apps/api/window';

export interface SecondaryWindowConfig {
  label: string;
  panelId?: string;
  route: string;
  queryKey: string;
  updateEvent: string;
  closeEvent: string;
  boundsKey: string;
  title: string;
  errorNoun: string;
  defaultWidth: number;
  defaultHeight: number;
  minWidth: number;
  minHeight: number;
}

export function readSecondaryWindowPayload<T>(queryKey: string, fallback: T): T {
  try {
    const query = new URLSearchParams(window.location.search);
    const bootstrap = query.get('bootstrap');
    const raw = bootstrap && /^[a-z0-9-]+$/.test(bootstrap) ? localStorage.getItem(`secondary-window-bootstrap:${bootstrap}`) : query.get(queryKey);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch { return fallback; }
}

let returningWindow: string | null = null;
export async function returnSecondaryWindow(config: SecondaryWindowConfig) {
  returningWindow = config.label;
  try { await getCurrentWindow().close(); } catch (error) { returningWindow = null; throw error; }
}

/** Shared native lifecycle and shortcut toggling for each main-owned secondary panel. */
export function useSecondaryWindowHost<T>(config: SecondaryWindowConfig, payload: T, onDismiss: () => void, onReturn?: () => void, toggle?: { visible: boolean; onShow: () => void }) {
  const callbacks = useRef({ onDismiss, onReturn });
  callbacks.current = { onDismiss, onReturn };
  const [poppedOut, setPoppedOut] = useState(false);
  const [error, setError] = useState('');
  const payloadKey = JSON.stringify(payload);
  const toggleState = useRef({ poppedOut, toggle });
  toggleState.current = { poppedOut, toggle };
  const toggling = useRef(false);

  useEffect(() => {
    let disposed = false;
    const handle = async (view: SecondaryView) => {
      if (disposed || secondaryViewWindowLabels[view] !== config.label || !toggleState.current.toggle || toggling.current) return;
      const current = toggleState.current;
      if (!current.poppedOut) {
        if (current.toggle!.visible) callbacks.current.onDismiss();
        else { current.toggle!.onShow(); focusSecondaryPanel(config.panelId ?? config.label); }
        return;
      }
      toggling.current = true;
      try {
        const native = await WebviewWindow.getByLabel(config.label);
        if (native) {
          if (current.toggle!.visible) {
            await native.hide();
            if (!disposed) callbacks.current.onDismiss();
          } else {
            await native.show();
            await native.setFocus();
            if (!disposed) current.toggle!.onShow();
          }
        } else if (!disposed) {
          setPoppedOut(false);
          if (current.toggle!.visible) callbacks.current.onDismiss();
          else { current.toggle!.onShow(); focusSecondaryPanel(config.panelId ?? config.label); }
        }
      } catch (cause) { setError(`Could not dismiss ${config.errorNoun} window: ${String(cause)}`); }
      finally { toggling.current = false; }
    };
    const local = (event: Event) => { void handle((event as CustomEvent<SecondaryView>).detail); };
    window.addEventListener(SECONDARY_VIEW_TOGGLE_EVENT, local);
    let unlisten: (() => void) | undefined;
    void listen<SecondaryView>(SECONDARY_VIEW_TOGGLE_EVENT, event => { void handle(event.payload); })
      .then(fn => { if (disposed) fn(); else unlisten = fn; }).catch(() => {});
    return () => { disposed = true; unlisten?.(); window.removeEventListener(SECONDARY_VIEW_TOGGLE_EVENT, local); };
  }, [config.label, config.panelId, config.errorNoun]);


  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void listen<{ redock?: boolean }>(config.closeEvent, event => {
      if (!disposed) {
        setPoppedOut(false);
        if (event.payload?.redock) {
          window.dispatchEvent(new CustomEvent('secondary-panel:dock', { detail: config.panelId ?? config.label }));
          callbacks.current.onReturn?.();
        } else callbacks.current.onDismiss();
      }
    }).then(fn => { if (disposed) fn(); else unlisten = fn; });
    void WebviewWindow.getByLabel(config.label).then(win => { if (win && !disposed) setPoppedOut(true); });
    return () => { disposed = true; unlisten?.(); };
  }, [config.closeEvent, config.label, config.panelId]);

  useEffect(() => {
    if (poppedOut) void emitTo(config.label, config.updateEvent, payload).catch(console.error);
  }, [config.label, config.updateEvent, payloadKey, poppedOut]);

  const popOut = useCallback(async () => {
    setError('');
    try {
      const existing = await WebviewWindow.getByLabel(config.label);
      if (existing) { await existing.show(); await existing.setFocus(); }
      else {
        let bounds: { x: number; y: number; width: number; height: number } | null = null;
        try {
          const stored = localStorage.getItem(config.boundsKey);
          if (stored) {
            const parsed = JSON.parse(stored);
            if ([parsed.x, parsed.y, parsed.width, parsed.height].every(Number.isFinite) && parsed.width >= config.minWidth && parsed.height >= config.minHeight) bounds = parsed;
          }
        } catch { /* Invalid saved geometry: use native default placement. */ }
        let url = `${config.route}?${config.queryKey}=${encodeURIComponent(payloadKey)}`;
        if (payloadKey.length > 12000) {
          try {
            localStorage.setItem(`secondary-window-bootstrap:${config.label}`, payloadKey);
            url = `${config.route}?bootstrap=${encodeURIComponent(config.label)}`;
          } catch { /* If storage is unavailable, retain the initial query payload. */ }
        }
        const window = new WebviewWindow(config.label, {
          url, title: config.title, width: bounds?.width ?? config.defaultWidth, height: bounds?.height ?? config.defaultHeight,
          ...(bounds ? { x: bounds.x, y: bounds.y } : {}),
          transparent: true, backgroundColor: [0, 0, 0, 0],
          minWidth: config.minWidth, minHeight: config.minHeight, resizable: true,
        });
        await new Promise<void>((resolve, reject) => {
          void window.once('tauri://created', () => resolve());
          void window.once('tauri://error', event => reject(event.payload));
        });
      }
      setPoppedOut(true);
      if (toggleState.current.toggle && !toggleState.current.toggle.visible) toggleState.current.toggle.onShow();
    } catch (cause) { setError(`Could not open ${config.errorNoun} window: ${String(cause)}`); }
  }, [config, payloadKey]);

  return { poppedOut, error, popOut };
}

/** State synchronization, closing, and bounds persistence for a popped-out panel. */
export function useSecondaryWindow<T>(config: SecondaryWindowConfig, initialPayload: T) {
  const [payload, setPayload] = useState(initialPayload);
  useSecondaryViewShortcuts(view => { void emitTo('main', SECONDARY_VIEW_TOGGLE_EVENT, view).catch(console.error); }, () => true);

  useEffect(() => {
    let disposed = false;
    let closing = false;
    let unlistenPayload: (() => void) | undefined;
    let unlistenClose: (() => void) | undefined;
    void listen<T>(config.updateEvent, event => setPayload(event.payload))
      .then(fn => { if (disposed) fn(); else unlistenPayload = fn; });
    void getCurrentWindow().onCloseRequested(async event => {
      if (closing) return;
      event.preventDefault();
      closing = true;
      try { if (returningWindow === config.label) { returningWindow = null; await emitTo('main', config.closeEvent, { redock: true }); } else await emitTo('main', config.closeEvent); }
      finally { await getCurrentWindow().close(); }
    }).then(fn => { if (disposed) fn(); else unlistenClose = fn; });
    return () => { disposed = true; unlistenPayload?.(); unlistenClose?.(); };
  }, [config.closeEvent, config.updateEvent]);

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
          localStorage.setItem(config.boundsKey, JSON.stringify({ x: position.x, y: position.y, width: size.width, height: size.height }));
        } catch (error) { console.error('Failed to save monitor bounds:', error); }
      }, 250);
    };
    void current.onMoved(saveBounds).then(fn => { if (disposed) fn(); else listeners.push(fn); });
    void current.onResized(saveBounds).then(fn => { if (disposed) fn(); else listeners.push(fn); });
    return () => { disposed = true; clearTimeout(timer); listeners.forEach(fn => fn()); };
  }, [config.boundsKey]);

  return payload;
}
