import { useEffect, useState } from 'react';
export const SECONDARY_TRANSPARENCY_KEY = 'shogi-secondary-transparency';
const EVENT = 'secondary-transparency:change';
export function normalizeSecondaryTransparency(value: number) { return Number.isFinite(value) ? Math.max(0, Math.min(60, Math.round(value))) : 0; }
export function loadSecondaryTransparency() {
  try { return normalizeSecondaryTransparency(Number(localStorage.getItem(SECONDARY_TRANSPARENCY_KEY) ?? 0)); } catch { return 0; }
}
export function useSecondaryTransparency() {
  const [transparency, setValue] = useState(loadSecondaryTransparency);
  useEffect(() => {
    const local = (event: Event) => setValue(normalizeSecondaryTransparency((event as CustomEvent<number>).detail));
    const storage = (event: StorageEvent) => { if (event.key === SECONDARY_TRANSPARENCY_KEY || event.key === null) setValue(loadSecondaryTransparency()); };
    window.addEventListener(EVENT, local); window.addEventListener('storage', storage);
    return () => { window.removeEventListener(EVENT, local); window.removeEventListener('storage', storage); };
  }, []);
  const setTransparency = (value: number) => {
    const next = normalizeSecondaryTransparency(value);
    try { localStorage.setItem(SECONDARY_TRANSPARENCY_KEY, String(next)); } catch { /* Live changes remain available. */ }
    window.dispatchEvent(new CustomEvent(EVENT, { detail: next }));
    setValue(next);
  };
  return { transparency, setTransparency };
}
export function SecondaryTransparencyStyle() {
  const { transparency } = useSecondaryTransparency();
  useEffect(() => { document.documentElement.style.setProperty('--secondary-window-opacity', String(1 - transparency / 100)); }, [transparency]);
  useEffect(() => {
    const native = window.location.pathname.startsWith('/monitor/');
    document.documentElement.classList.toggle('secondary-native-surface', native);
    return () => document.documentElement.classList.remove('secondary-native-surface');
  }, []);
  return null;
}
