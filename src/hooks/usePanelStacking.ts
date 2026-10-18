import { useEffect, useSyncExternalStore } from 'react';
export const PANEL_FOCUS_EVENT = 'secondary-panel:focus';
const order: string[] = [];
const subscribers = new Set<() => void>();
const instances = new Map<string, number>();
function notify() { subscribers.forEach(listener => listener()); }
function activate(id: string) {
  const index = order.indexOf(id);
  if (index < 0 || index === order.length - 1) return;
  order.splice(index, 1); order.push(id); notify();
}
function subscribe(listener: () => void) { subscribers.add(listener); return () => { subscribers.delete(listener); }; }
/** Shared stacking order keeps previously raised panels in their relative order. */
export function usePanelStacking(id: string) {
  const zIndex = useSyncExternalStore(subscribe, () => 950 + Math.max(0, order.indexOf(id)), () => 950);
  useEffect(() => {
    instances.set(id, (instances.get(id) ?? 0) + 1);
    if (!order.includes(id)) { order.push(id); notify(); }
    const focus = (event: Event) => { if ((event as CustomEvent<string>).detail === id) activate(id); };
    window.addEventListener(PANEL_FOCUS_EVENT, focus);
    return () => {
      window.removeEventListener(PANEL_FOCUS_EVENT, focus);
      const count = (instances.get(id) ?? 1) - 1;
      if (count) instances.set(id, count);
      else { instances.delete(id); const index = order.indexOf(id); if (index >= 0) order.splice(index, 1); notify(); }
    };
  }, [id]);
  return zIndex;
}
