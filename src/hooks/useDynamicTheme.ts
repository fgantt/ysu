import { useEffect } from 'react';
import { bundledBoardColor } from '../utils/boardPalette';

const variables = [
  'bg-modal', 'bg-panel', 'bg-card', 'text-primary', 'text-secondary', 'text-muted',
  'heading', 'border-light', 'border-medium', 'border-dark', 'button-primary',
  'button-primary-hover', 'button-primary-active', 'button-primary-text',
  'button-secondary', 'button-secondary-hover', 'button-secondary-active',
  'button-secondary-text', 'input-bg', 'input-border', 'input-focus',
  'input-text', 'input-placeholder', 'accent', 'accent-hover', 'accent-light',
  'select-bg', 'select-border', 'select-text', 'tab-active', 'tab-inactive',
  'tab-hover', 'link', 'link-hover',
];

// Sample only local assets. A failed or unsampleable image retains the warm wood fallback.
function sampleColor(url: string): Promise<[number, number, number] | null> {
  return new Promise(resolve => {
    if (!url || !url.startsWith('/')) { resolve(null); return; }
    const image = new Image();
    let settled = false;
    const finish = (color: [number, number, number] | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(color);
    };
    const timeout = setTimeout(() => finish(null), 1500);
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 32;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) { finish(null); return; }
        context.drawImage(image, 0, 0, 32, 32);
        const pixels = context.getImageData(0, 0, 32, 32).data;
        const sums = [0, 0, 0];
        let count = 0;
        for (let i = 0; i < pixels.length; i += 4) {
          const [r, g, b, a] = pixels.slice(i, i + 4);
          const brightness = (r + g + b) / 3;
          if (a < 200 || brightness < 32 || brightness > 240) continue;
          sums[0] += r; sums[1] += g; sums[2] += b; count++;
        }
        finish(count ? sums.map(sum => sum / count) as [number, number, number] : null);
      } catch { finish(null); }
    };
    image.onerror = () => finish(null);
    image.src = url;
  });
}

export function paletteFromColors(board: [number, number, number] | null, piece: [number, number, number] | null): Record<string, string> {
  const base = board ?? piece ?? [172, 119, 67];
  const mixed = base.map((channel, i) => Math.round(channel * (board && piece ? 0.8 : 1) + (board && piece ? piece[i] * 0.2 : 0)));
  const [r, g, b] = mixed.map(channel => channel / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
  let hue = 0;
  if (delta) {
    if (max === r) hue = ((g - b) / delta) % 6;
    else if (max === g) hue = (b - r) / delta + 2;
    else hue = (r - g) / delta + 4;
  }
  hue = ((Math.round(hue * 60) % 360) + 360) % 360;
  const saturation = max ? Math.round(delta / max * 100) : 0;
  const s = Math.max(12, Math.min(38, saturation));
  // Spread wood tones across a wider dark-to-light range while keeping the
  // pale end dark enough for the existing light labels.
  const sourceBrightness = mixed[0] * 0.2126 + mixed[1] * 0.7152 + mixed[2] * 0.0722;
  const panel = Math.round(Math.max(12, Math.min(35, 8 + (sourceBrightness - 50) * 0.18)));
  const card = panel + 3;
  const button = Math.round(Math.max(31, Math.min(40, 35 + (sourceBrightness - 95) * 0.045)));
  const hsl = (lightness: number, sat = s) => `hsl(${hue} ${sat}% ${lightness}%)`;
  return {
    'bg-modal': hsl(panel - 2), 'bg-panel': hsl(panel), 'bg-card': hsl(card),
    'text-primary': hsl(98, 12), 'text-secondary': hsl(91, 12), 'text-muted': hsl(82, 12),
    heading: hsl(98, 14), 'border-light': hsl(card + 9), 'border-medium': hsl(card + 17), 'border-dark': hsl(card + 25),
    'button-primary': hsl(button, Math.max(s, 38)), 'button-primary-hover': hsl(button + 5, Math.max(s, 38)),
    'button-primary-active': hsl(button - 5, Math.max(s, 38)), 'button-primary-text': '#ffffff',
    'button-secondary': hsl(Math.min(38, panel + 2)),
    'button-secondary-hover': hsl(Math.min(38, panel + 4)),
    'button-secondary-active': hsl(Math.min(38, panel + 6)),
    'button-secondary-text': hsl(95, 12),
    'input-bg': hsl(panel + 1), 'input-border': hsl(card + 17), 'input-focus': hsl(65, Math.max(s, 40)),
    'input-text': hsl(96, 12), 'input-placeholder': hsl(70, 12),
    accent: hsl(68, Math.max(s, 40)), 'accent-hover': hsl(78, Math.max(s, 40)), 'accent-light': hsl(card + 9),
    'select-bg': hsl(panel + 1), 'select-border': hsl(card + 17), 'select-text': hsl(96, 12),
    'tab-active': hsl(68, Math.max(s, 40)), 'tab-inactive': hsl(72, 12), 'tab-hover': hsl(card + 8),
    link: hsl(73, Math.max(s, 40)), 'link-hover': hsl(83, Math.max(s, 40)),
  };
}

export function useDynamicTheme() {
  useEffect(() => {
    let revision = 0;
    const root = document.documentElement;
    if (!root.hasAttribute('data-theme')) {
      root.setAttribute('data-theme', localStorage.getItem('shogiVibeTheme') || 'light');
    }
    const clear = () => variables.forEach(name => root.style.removeProperty(`--color-${name}`));
    const update = async () => {
      const current = ++revision;
      if (root.getAttribute('data-theme') !== 'dynamic') { clear(); return; }
      const board = localStorage.getItem('shogi-board-background') || '';
      const piece = localStorage.getItem('shogi-piece-label-type') || '';
      const apply = (boardColor: [number, number, number] | null, pieceColor: [number, number, number] | null) => {
        if (current !== revision || root.getAttribute('data-theme') !== 'dynamic') return;
        Object.entries(paletteFromColors(boardColor, pieceColor)).forEach(([name, value]) => {
          root.style.setProperty(`--color-${name}`, value);
        });
      };
      const bundledColor = bundledBoardColor(board);
      // Every bundled board changes the chrome immediately, independent of image loading.
      apply(bundledColor, null);
      const pieceUrl = piece && piece !== 'kanji' && piece !== 'english'
        ? `/piece-themes/${encodeURIComponent(piece)}/0FU.svg` : '';
      const [boardColor, pieceColor] = await Promise.all([
        bundledColor ? Promise.resolve(bundledColor) : sampleColor(board),
        sampleColor(pieceUrl),
      ]);
      apply(boardColor, pieceColor);
    };
    const observer = new MutationObserver(() => { void update(); });
    observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    window.addEventListener('storage', update);
    window.addEventListener('shogi-appearance-change', update);
    window.addEventListener('themeChange', update);
    void update();
    return () => {
      revision++;
      observer.disconnect();
      window.removeEventListener('storage', update);
      window.removeEventListener('shogi-appearance-change', update);
      window.removeEventListener('themeChange', update);
      clear();
    };
  }, []);
}
