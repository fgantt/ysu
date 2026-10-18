"""Apply shared traditional face proportions to the Yggdrasil rune artwork."""
from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parents[1]
dimensions = json.loads((ROOT / 'scripts/shogi-piece-dimensions.json').read_text())['pieces']
for path in (ROOT / 'public/piece-themes/yggdrasil-runes').glob('*.svg'):
    svg = path.read_text()
    if 'data-piece-width-mm' in svg:
        continue
    svg = re.sub(r'<text\b[^>]*>.*?</text>', '', svg)
    size = dimensions[path.stem[1:]]
    king = dimensions['GY']
    transform = f'translate(35 38) scale({size["width"] / king["width"]:.8f} {size["height"] / king["height"]:.8f}) translate(-35 -38)'
    start = svg.index('<g transform="rotate(')
    svg = svg[:start] + f'<g data-piece-width-mm="{size["width"]}" data-piece-height-mm="{size["height"]}" transform="{transform}">' + svg[start:]
    svg = svg.replace('</svg>', '</g></svg>')
    path.write_text(svg)
