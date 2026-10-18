// Precomputed dominant colors of the bundled board artwork. Unlike whole-image
// averages, these represent the material or background actually covering most
// of the board. They also work when a desktop webview cannot read canvas pixels.
const colors: Record<string, [number, number, number]> = {
  'frost-ash.svg': [235, 210, 172],
  'four-guardians.png': [194, 200, 178],
  'cityscape.png': [94, 90, 80], 'cityscape2.png': [27, 40, 44],
  'cranes-1.png': [199, 153, 68], 'doubutsu.png': [202, 207, 104],
  'fox-sun.png': [218, 194, 153], 'grey-dragon.png': [227, 220, 211],
  'guardian-lion-dog.png': [118, 105, 86], 'guardian-lions.png': [81, 72, 57],
  'koi-bw.jpg': [247, 246, 246], 'marble-calacatta.jpg': [226, 221, 210],
  'marble.jpg': [235, 235, 235], 'naval-battle.png': [113, 102, 76],
  'origami.png': [152, 113, 71], 'quartz-1.jpg': [213, 168, 184],
  'quartz-2.jpg': [199, 194, 188], 'shogi.png': [110, 84, 50],
  'stars-1.jpg': [9, 19, 50], 'stars-2.jpg': [23, 21, 54],
  'urushi-midnight-makie.png': [30, 22, 16],
  'wood-agathis-1.jpg': [172, 138, 93], 'wood-agathis-2.jpg': [161, 116, 76],
  'wood-bambo.jpg': [218, 163, 108],
  'wood-boxwood-1.jpg': [218, 175, 131], 'wood-boxwood-2.jpg': [215, 168, 117],
  'wood-boxwood-3.jpg': [190, 142, 78], 'wood-boxwood-4.jpg': [202, 142, 74],
  'wood-cherry-1.jpg': [171, 85, 29], 'wood-cherry-2.jpg': [170, 60, 14],
  'wood-cherry-3.jpg': [128, 68, 32],
  'wood-cypress-1.jpg': [214, 168, 115], 'wood-cypress-2.jpg': [218, 177, 140],
  'wood-ginkgo-1.jpg': [208, 170, 120], 'wood-ginkgo-2.jpg': [210, 167, 120],
  'wood-ginkgo-3.jpg': [177, 138, 86], 'wood-hiba-1.jpeg': [230, 199, 149],
  'wood-hickory-1.jpg': [200, 156, 115], 'wood-katsura-1.png': [179, 124, 68],
  'wood-mahogany-1.jpg': [162, 76, 53], 'wood-maple-1.jpg': [184, 148, 119],
  'wood-maple-2.webp': [214, 179, 138],
  'wood-mikurajima-boxwood-dark.webp': [163, 103, 40],
  'wood-mikurajima-boxwood-natural.webp': [230, 176, 93],
  'wood-pecan-1.jpg': [176, 109, 47], 'wood-pecan-2.jpg': [183, 134, 83],
  'wood-red-spruce-1.jpg': [222, 161, 115],
};

export function bundledBoardColor(path: string): [number, number, number] | null {
  try {
    const url = new URL(path, window.location.href);
    if (!url.pathname.startsWith('/boards/')) return null;
    return colors[url.pathname.split('/').pop() || ''] || null;
  } catch {
    return null;
  }
}
