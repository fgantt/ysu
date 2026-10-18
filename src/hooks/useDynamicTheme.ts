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

type RGB = [number, number, number];

export interface ImagePalette {
  dominant: readonly [number, number, number];
  dark: readonly [number, number, number];
  mid: readonly [number, number, number];
  light: readonly [number, number, number];
  accent: readonly [number, number, number];
}

const luminance = ([r, g, b]: readonly [number, number, number]) => r * 0.2126 + g * 0.7152 + b * 0.0722;
const saturation = ([r, g, b]: RGB) => Math.max(r, g, b) - Math.min(r, g, b);
const average = (colors: RGB[]): RGB => colors.reduce<RGB>(
  (sum, color) => [sum[0] + color[0], sum[1] + color[1], sum[2] + color[2]],
  [0, 0, 0],
).map(channel => Math.round(channel / colors.length)) as RGB;

export function extractImagePalette(colors: RGB[]): ImagePalette | null {
  const usable = colors.filter(color => luminance(color) > 18 && luminance(color) < 247);
  if (!usable.length) return null;
  const sorted = [...usable].sort((a, b) => luminance(a) - luminance(b));
  const buckets = new Map<string, RGB[]>();
  usable.forEach(color => {
    // Broad color buckets find the actual material/background color instead
    // of averaging unrelated ink, illustration, and grain colors together.
    const key = color.map(channel => Math.floor(channel / 48)).join('-');
    const bucket = buckets.get(key) ?? [];
    bucket.push(color);
    buckets.set(key, bucket);
  });
  const dominantBucket = [...buckets.values()].sort((a, b) => b.length - a.length)[0] ?? usable;
  const band = (from: number, to: number) => {
    const start = Math.floor(sorted.length * from);
    const end = Math.max(start + 1, Math.ceil(sorted.length * to));
    return average(sorted.slice(start, end));
  };
  const center = band(.35, .65);
  const colorful = [...usable].sort((a, b) => {
    const aScore = saturation(a) * 1.5 + Math.abs(luminance(a) - luminance(center)) * .2;
    const bScore = saturation(b) * 1.5 + Math.abs(luminance(b) - luminance(center)) * .2;
    return bScore - aScore;
  });
  return {
    dominant: average(dominantBucket),
    dark: band(.08, .28),
    mid: center,
    light: band(.72, .92),
    accent: average(colorful.slice(0, Math.max(1, Math.ceil(colorful.length * .12)))),
  };
}

// Sample only local assets. A failed or unsampleable image retains the bundled fallback.
function samplePalette(url: string): Promise<ImagePalette | null> {
  return new Promise(resolve => {
    if (!url || !url.startsWith('/')) { resolve(null); return; }
    const image = new Image();
    let settled = false;
    const finish = (palette: ImagePalette | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(palette);
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
        const colors: RGB[] = [];
        for (let i = 0; i < pixels.length; i += 4) {
          if (pixels[i + 3] < 200) continue;
          colors.push([pixels[i], pixels[i + 1], pixels[i + 2]]);
        }
        finish(extractImagePalette(colors));
      } catch { finish(null); }
    };
    image.onerror = () => finish(null);
    image.src = url;
  });
}

function toHsl(color: readonly [number, number, number]): [number, number, number] {
  const [r, g, b] = color.map(channel => channel / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
  let hue = 0;
  if (delta) {
    if (max === r) hue = ((g - b) / delta) % 6;
    else if (max === g) hue = (b - r) / delta + 2;
    else hue = (r - g) / delta + 4;
  }
  hue = ((Math.round(hue * 60) % 360) + 360) % 360;
  const lightness = (max + min) / 2;
  const sat = delta ? delta / (1 - Math.abs(2 * lightness - 1)) : 0;
  return [hue, Math.round(sat * 100), Math.round(lightness * 100)];
}

const blend = (a: readonly [number, number, number], b: readonly [number, number, number], bWeight: number): RGB => a.map(
  (channel, index) => Math.round(channel * (1 - bWeight) + b[index] * bWeight),
) as RGB;

export function paletteFromImagePalette(board: ImagePalette | null, piece: readonly [number, number, number] | null): Record<string, string> {
  const fallback: RGB = [172, 119, 67];
  const mid = board?.dominant ?? board?.mid ?? piece ?? fallback;
  const dark = board?.dark ?? mid;
  const light = board?.light ?? mid;
  // Pieces only lend a restrained note to interactive accents. Board-derived
  // colors remain authoritative for all structural surfaces.
  const accentSource = piece ? blend(board?.accent ?? mid, piece, .12) : board?.accent ?? mid;
  const sourceBrightness = luminance(mid);
  const usesLightSurfaces = sourceBrightness >= 190;
  const panel = Math.round(Math.max(11, Math.min(38, 3 + sourceBrightness * .17)));
  const card = Math.min(43, panel + 6);
  const modalHsl = toHsl(dark);
  const panelHsl = toHsl(blend(dark, mid, .42));
  const cardHsl = toHsl(mid);
  const borderHsl = toHsl(light);
  const accentHsl = toHsl(accentSource);
  const color = (source: [number, number, number], l: number, minSat = 12) =>
    `hsl(${source[0]} ${Math.max(minSat, Math.min(62, source[1]))}% ${Math.round(l)}%)`;
  const surface = (source: [number, number, number], l: number) => color(source, l, 14);
  const accent = (l: number) => color(accentHsl, l, 42);
  if (usesLightSurfaces) {
    const lightPanel = Math.round(Math.max(72, Math.min(86, 58 + (sourceBrightness - 170) * .35)));
    const lightCard = Math.min(94, lightPanel + 6);
    const palePanelHsl = toHsl(blend(mid, light, .28));
    const paleCardHsl = toHsl(light);
    const darkTextHsl = toHsl(blend(dark, mid, .18));
    return {
      'bg-modal': surface(cardHsl, lightPanel - 5),
      'bg-panel': surface(palePanelHsl, lightPanel),
      'bg-card': surface(paleCardHsl, lightCard),
      'text-primary': surface(darkTextHsl, 12), 'text-secondary': surface(darkTextHsl, 24),
      'text-muted': surface(darkTextHsl, 39), heading: surface(darkTextHsl, 10),
      'border-light': surface(borderHsl, lightPanel - 9), 'border-medium': surface(darkTextHsl, 52),
      'border-dark': surface(darkTextHsl, 36),
      'button-primary': accent(40), 'button-primary-hover': accent(34),
      'button-primary-active': accent(29), 'button-primary-text': '#ffffff',
      'button-secondary': surface(paleCardHsl, lightPanel - 5),
      'button-secondary-hover': surface(paleCardHsl, lightPanel - 10),
      'button-secondary-active': surface(paleCardHsl, lightPanel - 14),
      'button-secondary-text': surface(darkTextHsl, 13),
      'input-bg': surface(paleCardHsl, Math.min(96, lightCard + 2)),
      'input-border': surface(darkTextHsl, 53), 'input-focus': accent(42),
      'input-text': surface(darkTextHsl, 11), 'input-placeholder': surface(darkTextHsl, 43),
      accent: accent(39), 'accent-hover': accent(31), 'accent-light': accent(78),
      'select-bg': surface(paleCardHsl, Math.min(96, lightCard + 2)),
      'select-border': surface(darkTextHsl, 53), 'select-text': surface(darkTextHsl, 11),
      'tab-active': accent(38), 'tab-inactive': surface(darkTextHsl, 42),
      'tab-hover': surface(paleCardHsl, lightPanel - 7), link: accent(35), 'link-hover': accent(27),
    };
  }
  const button = Math.max(34, Math.min(48, panel + 13));
  return {
    'bg-modal': surface(modalHsl, Math.max(8, panel - 4)),
    'bg-panel': surface(panelHsl, panel),
    'bg-card': surface(cardHsl, card),
    'text-primary': surface(borderHsl, 97), 'text-secondary': surface(borderHsl, 90), 'text-muted': surface(borderHsl, 76),
    heading: surface(borderHsl, 97), 'border-light': surface(borderHsl, card + 8),
    'border-medium': surface(borderHsl, card + 17), 'border-dark': surface(borderHsl, card + 25),
    'button-primary': accent(button), 'button-primary-hover': accent(button + 7),
    'button-primary-active': accent(button - 5), 'button-primary-text': '#ffffff',
    'button-secondary': surface(cardHsl, panel + 3), 'button-secondary-hover': surface(cardHsl, panel + 7),
    'button-secondary-active': surface(cardHsl, panel + 10), 'button-secondary-text': surface(borderHsl, 95),
    'input-bg': surface(modalHsl, panel - 1), 'input-border': surface(borderHsl, card + 17), 'input-focus': accent(66),
    'input-text': surface(borderHsl, 96), 'input-placeholder': surface(borderHsl, 70),
    accent: accent(62), 'accent-hover': accent(72), 'accent-light': accent(card + 10),
    'select-bg': surface(modalHsl, panel - 1), 'select-border': surface(borderHsl, card + 17), 'select-text': surface(borderHsl, 96),
    'tab-active': accent(62), 'tab-inactive': surface(borderHsl, 72), 'tab-hover': surface(cardHsl, card + 8),
    link: accent(68), 'link-hover': accent(78),
  };
}

export function paletteFromColors(board: RGB | null, piece: readonly [number, number, number] | null): Record<string, string> {
  const imagePalette = board ? { dominant: board, dark: board, mid: board, light: board, accent: board } : null;
  return paletteFromImagePalette(imagePalette, piece);
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
      const apply = (boardPalette: ImagePalette | null, pieceColor: readonly [number, number, number] | null) => {
        if (current !== revision || root.getAttribute('data-theme') !== 'dynamic') return;
        Object.entries(paletteFromImagePalette(boardPalette, pieceColor)).forEach(([name, value]) => {
          root.style.setProperty(`--color-${name}`, value);
        });
      };
      const bundledColor = bundledBoardColor(board);
      // Every bundled board changes the chrome immediately, independent of image loading.
      apply(bundledColor ? { dominant: bundledColor, dark: bundledColor, mid: bundledColor, light: bundledColor, accent: bundledColor } : null, null);
      const pieceUrl = piece && piece !== 'kanji' && piece !== 'english'
        ? `/piece-themes/${encodeURIComponent(piece)}/0FU.svg` : '';
      const [sampledBoardPalette, piecePalette] = await Promise.all([
        samplePalette(board),
        samplePalette(pieceUrl),
      ]);
      const fallbackPalette = bundledColor
        ? { dominant: bundledColor, dark: bundledColor, mid: bundledColor, light: bundledColor, accent: bundledColor }
        : null;
      // A verified bundled dominant color is authoritative. Webview canvas
      // sampling may still enrich its shadows/highlights/accent, but cannot
      // replace the board's primary material color with a muddy average.
      const boardPalette = sampledBoardPalette && bundledColor
        ? { ...sampledBoardPalette, dominant: bundledColor }
        : sampledBoardPalette ?? fallbackPalette;
      apply(boardPalette, piecePalette?.dominant ?? piecePalette?.mid ?? null);
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
