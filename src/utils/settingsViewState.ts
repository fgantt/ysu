export type SettingsTab = 'appearance' | 'display' | 'notation' | 'backgrounds' | 'engines';

export interface SettingsViewState {
  activeTab: SettingsTab;
  scrollTop: Record<SettingsTab, number>;
  collapsed: {
    boardBackground: boolean;
    wallpaper: boolean;
    colorTheme: boolean;
    pieceThemes: boolean;
  };
}

const STORAGE_KEY = 'shogi-settings-view';
const TABS: SettingsTab[] = ['appearance', 'display', 'notation', 'backgrounds', 'engines'];

const defaults = (): SettingsViewState => ({
  activeTab: 'appearance',
  scrollTop: { appearance: 0, display: 0, notation: 0, backgrounds: 0, engines: 0 },
  collapsed: { boardBackground: false, wallpaper: false, colorTheme: false, pieceThemes: false },
});

export function loadSettingsViewState(): SettingsViewState {
  const fallback = defaults();
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!parsed || typeof parsed !== 'object') return fallback;
    const scrollTop = Object.fromEntries(TABS.map(tab => [tab, Number.isFinite(parsed.scrollTop?.[tab]) ? Math.max(0, parsed.scrollTop[tab]) : 0])) as SettingsViewState['scrollTop'];
    return {
      activeTab: TABS.includes(parsed.activeTab) ? parsed.activeTab : fallback.activeTab,
      scrollTop,
      collapsed: {
        boardBackground: parsed.collapsed?.boardBackground === true,
        wallpaper: parsed.collapsed?.wallpaper === true,
        colorTheme: parsed.collapsed?.colorTheme === true,
        pieceThemes: parsed.collapsed?.pieceThemes === true,
      },
    };
  } catch { return fallback; }
}

export function saveSettingsViewState(state: SettingsViewState): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch { /* Settings still work when storage is unavailable. */ }
}
