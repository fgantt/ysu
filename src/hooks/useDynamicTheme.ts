import { useEffect } from 'react';

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
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 32;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) { resolve(null); return; }
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
        resolve(count ? sums.map(sum => sum / count) as [number, number, number] : null);
      } catch { resolve(null); }
    };
    image.onerror = () => resolve(null);
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
  const hsl = (lightness: number, sat = s) => `hsl(${hue} ${sat}% ${lightness}%)`;
  return {
    'bg-modal': hsl(15), 'bg-panel': hsl(17), 'bg-card': hsl(23),
    'text-primary': hsl(96, 12), 'text-secondary': hsl(85, 12), 'text-muted': hsl(72, 12),
    heading: hsl(98, 14), 'border-light': hsl(32), 'border-medium': hsl(41), 'border-dark': hsl(52),
    'button-primary': hsl(38, Math.max(s, 38)), 'button-primary-hover': hsl(45, Math.max(s, 38)),
    'button-primary-active': hsl(32, Math.max(s, 38)), 'button-primary-text': '#ffffff',
    'button-secondary': hsl(27), 'button-secondary-hover': hsl(33), 'button-secondary-active': hsl(38),
    'button-secondary-text': hsl(95, 12),
    'input-bg': hsl(20), 'input-border': hsl(43), 'input-focus': hsl(65, Math.max(s, 40)),
    'input-text': hsl(96, 12), 'input-placeholder': hsl(70, 12),
    accent: hsl(68, Math.max(s, 40)), 'accent-hover': hsl(78, Math.max(s, 40)), 'accent-light': hsl(32),
    'select-bg': hsl(20), 'select-border': hsl(43), 'select-text': hsl(96, 12),
    'tab-active': hsl(68, Math.max(s, 40)), 'tab-inactive': hsl(72, 12), 'tab-hover': hsl(31),
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
      const pieceUrl = piece && piece !== 'kanji' && piece !== 'english'
        ? `/piece-themes/${encodeURIComponent(piece)}/0FU.svg` : '';
      const [boardColor, pieceColor] = await Promise.all([sampleColor(board), sampleColor(pieceUrl)]);
      if (current !== revision || root.getAttribute('data-theme') !== 'dynamic') return;
      Object.entries(paletteFromColors(boardColor, pieceColor)).forEach(([name, value]) => {
        root.style.setProperty(`--color-${name}`, value);
      });
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
