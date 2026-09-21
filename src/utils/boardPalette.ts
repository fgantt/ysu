// Average colors of the bundled board artwork. These let the Dynamic theme
// update immediately even when a desktop webview cannot read image pixels.
const colors: Record<string, [number, number, number]> = {
  'cityscape.png': [149, 139, 125], 'cityscape2.png': [48, 57, 54],
  'cranes-1.png': [180, 123, 61], 'doubutsu.png': [196, 207, 161],
  'fox-sun.png': [178, 146, 109], 'grey-dragon.png': [149, 145, 136],
  'guardian-lion-dog.png': [115, 103, 86], 'guardian-lions.png': [97, 87, 71],
  'koi-bw.jpg': [172, 174, 170], 'marble-calacatta.jpg': [228, 224, 214],
  'marble.jpg': [227, 227, 227], 'naval-battle.png': [131, 117, 90],
  'origami.png': [147, 109, 70], 'quartz-1.jpg': [219, 183, 199],
  'quartz-2.jpg': [198, 194, 188], 'shogi.png': [93, 75, 48],
  'stars-1.jpg': [17, 37, 79], 'stars-2.jpg': [62, 51, 113],
  'urushi-midnight-makie.png': [35, 25, 19],
  'wood-agathis-1.jpg': [172, 138, 93], 'wood-agathis-2.jpg': [161, 116, 76],
  'wood-bambo.jpg': [218, 163, 108],
  'wood-boxwood-1.jpg': [218, 175, 131], 'wood-boxwood-2.jpg': [215, 168, 117],
  'wood-boxwood-3.jpg': [190, 142, 78], 'wood-boxwood-4.jpg': [202, 142, 74],
  'wood-cherry-1.jpg': [171, 85, 29], 'wood-cherry-2.jpg': [170, 60, 14],
  'wood-cherry-3.jpg': [128, 68, 32],
  'wood-cypress-1.jpg': [219, 174, 122], 'wood-cypress-2.jpg': [186, 138, 96],
  'wood-ginkgo-1.jpg': [211, 178, 132], 'wood-ginkgo-2.jpg': [200, 156, 108],
  'wood-ginkgo-3.jpg': [180, 144, 93], 'wood-hiba-1.jpeg': [228, 198, 149],
  'wood-hickory-1.jpg': [200, 156, 115], 'wood-katsura-1.png': [179, 124, 68],
  'wood-mahogany-1.jpg': [162, 76, 53], 'wood-maple-1.jpg': [184, 148, 119],
  'wood-maple-2.webp': [222, 185, 140],
  'wood-mikurajima-boxwood-dark.webp': [163, 103, 40],
  'wood-mikurajima-boxwood-natural.webp': [230, 176, 93],
  'wood-pecan-1.jpg': [169, 109, 56], 'wood-pecan-2.jpg': [171, 130, 90],
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
