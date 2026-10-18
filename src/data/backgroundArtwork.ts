export const BACKGROUND_ARTWORK_DESCRIPTIONS: Record<string, string> = {
  'frost-ash': 'Natural pale ash wood with carved leaves and roots at the corners; pairs with oak Yggdrasil Runes',
  'yggdrasil-night': 'An ancient living Yggdrasil above a misty Nordic fjord beneath stars and an aurora',
  'four-guardians': 'Dragon, phoenix, white tiger and tortoise with a softly faded jade and gold border',
  'sakura-washi': 'Cherry blossoms on a soft washi wash',
  'bamboo-morning': 'Bamboo silhouettes in celadon morning mist',
  'maple-stream': 'Autumn leaves drifting across amber water',
  'moonlit-cranes': 'Cranes, reeds and a quiet moon',
  'ocean-tide': 'Gentle coastal waves in a woodblock palette',
  'lantern-evening': 'Warm lanterns and rain reflections at blue hour',
  'snow-temple': 'A mountain temple beneath fresh snow',
  'coastal-dawn': 'Pacific cliffs beneath a luminous sunrise',
  'autumn-reflections': 'A mountain lake painted in autumn colors',
  'celestial-dragon': 'A paper-cut dragon among stars and clouds',
};


export const NEW_BOARD_BACKGROUNDS = ['four-guardians', 'sakura-washi', 'bamboo-morning', 'maple-stream', 'moonlit-cranes', 'ocean-tide'].map(name => `/boards/${name}.png`).concat('/boards/frost-ash.svg');
export const NEW_WALLPAPERS = ['lantern-evening', 'snow-temple', 'coastal-dawn', 'autumn-reflections', 'celestial-dragon'].map(name => `/wallpapers/${name}.png`).concat('/wallpapers/yggdrasil-night.svg');


const bundledArtwork = new Set([...NEW_BOARD_BACKGROUNDS, ...NEW_WALLPAPERS]);

// In a live dev session these cards can mount before generation copies the files.
// Version the request to replace cached failed loads, while keeping saved paths stable.
export function backgroundImageUrl(path: string): string {
  if (path === '/boards/frost-ash.svg' || path === '/wallpapers/yggdrasil-night.svg') return `${path}?artwork=natural-norse-3`;
  if (path === '/boards/four-guardians.png') return `${path}?artwork=2026-10-10-2`;
  return bundledArtwork.has(path) ? `${path}?artwork=2026-10-07-1` : path;
}
