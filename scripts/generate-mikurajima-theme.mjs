import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const outputDirectory = path.resolve('public/piece-themes/mikurajima-moriage');
const baseImagePath = path.join(outputDirectory, 'piece-base.png');

const pieces = {
  FU: ['歩', '兵'],
  KY: ['香', '車'],
  KE: ['桂', '馬'],
  GI: ['銀', '将'],
  KI: ['金', '将'],
  KA: ['角', '行'],
  HI: ['飛', '車'],
  OU: ['王', '将'],
  GY: ['玉', '将'],
  TO: ['と', '金'],
  NY: ['成', '香'],
  NK: ['成', '桂'],
  NG: ['成', '銀'],
  UM: ['龍', '馬'],
  RY: ['龍', '王'],
};

const promotedPieces = new Set(['TO', 'NY', 'NK', 'NG', 'UM', 'RY']);

function createSvg(code, characters, rotated, baseImageData) {
  const lacquer = promotedPieces.has(code) ? '#a31713' : '#070504';
  const rotation = rotated ? ' transform="rotate(180 50 55)"' : '';
  const [topCharacter, bottomCharacter] = characters;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 110" role="img" aria-label="${topCharacter}${bottomCharacter} shogi piece">
  <g${rotation}>
    <image href="data:image/png;base64,${baseImageData}" x="1" y="0" width="98" height="110" preserveAspectRatio="none"/>
    <g fill="${lacquer}"
       text-anchor="middle" font-family="Hiragino Mincho ProN, Yu Mincho, Noto Serif CJK JP, serif" font-weight="700">
      <text x="50" y="48" font-size="34">${topCharacter}</text>
      <text x="50" y="84" font-size="34">${bottomCharacter}</text>
    </g>
  </g>
</svg>
`;
}

await mkdir(outputDirectory, { recursive: true });
const baseImageData = (await readFile(baseImagePath)).toString('base64');

for (const [code, characters] of Object.entries(pieces)) {
  await Promise.all([
    writeFile(path.join(outputDirectory, `0${code}.svg`), createSvg(code, characters, false, baseImageData)),
    writeFile(path.join(outputDirectory, `1${code}.svg`), createSvg(code, characters, true, baseImageData)),
  ]);
}

console.log(`Generated ${Object.keys(pieces).length * 2} piece assets in ${outputDirectory}`);
