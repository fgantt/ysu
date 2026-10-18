"""Build the original rune set in carved oak using shared shogi face proportions."""
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
DIMENSIONS = json.loads((ROOT / 'scripts/shogi-piece-dimensions.json').read_text())['pieces']
MARKS = {
    'M': 'M24 47V25L35 36L46 25V47M24 25L46 47M46 25L24 47',
    'T': 'M35 48V24M24 35L35 24L46 35',
    'H': 'M25 24V48M45 24V48M25 30L45 42M25 42L45 30',
    'S': 'M46 24L25 33L45 40L24 49',
    'F': 'M28 49V24M28 28L45 21M28 38L44 31',
    'B': 'M27 23V49L45 42L27 35L45 29Z',
    'R': 'M27 49V23L45 29L27 36L46 49',
    'K': 'M28 24V49M28 36L45 24M28 36L45 49',
}
PIECES = {'FU': ('M', 'Pawn'), 'KY': ('T', 'Lance'), 'KE': ('H', 'Knight'),
          'GI': ('S', 'Silver'), 'KI': ('F', 'Gold'), 'KA': ('B', 'Bishop'),
          'HI': ('R', 'Rook'), 'OU': ('K', 'King'), 'GY': ('K', 'King')}
for promoted, base in [('TO', 'FU'), ('NY', 'KY'), ('NK', 'KE'), ('NG', 'GI'), ('UM', 'KA'), ('RY', 'HI')]:
    mark, name = PIECES[base]
    PIECES[promoted] = (mark, f'Promoted {name}')
FACE = 'M35 3L59 14L63 68Q35 73 7 68L11 14Z'
output = ROOT / 'public/piece-themes/yggdrasil-runes'
output.mkdir(parents=True, exist_ok=True)
for side in [0, 1]:
    for code, (mark, name) in PIECES.items():
        size = DIMENSIONS[code]
        transform = f'translate(35 38) scale({size["width"] / 28.7:.8f} {size["height"] / 32:.8f}) translate(-35 -38)'
        promoted = name.startswith('Promoted')
        ink = '#edaa78' if promoted else '#fff0cb'
        chevron = '<path d="M23 63L35 67L47 63" fill="none" stroke="#edaa78" stroke-width="2"/>' if promoted else ''
        svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 70 76">
<title>{name} — Yggdrasil Runes</title>
<defs>
<linearGradient id="oak" x1="0" y1="0" x2="1" y2=".7"><stop stop-color="#b28450"/><stop offset=".24" stop-color="#9a6c3d"/><stop offset=".65" stop-color="#79502d"/><stop offset="1" stop-color="#59371e"/></linearGradient>
<clipPath id="face"><path d="{FACE}"/></clipPath>
<pattern id="grain" width="28" height="90" patternUnits="userSpaceOnUse"><g fill="none" stroke="#422a18" stroke-width=".6" opacity=".28"><path d="M2 -10Q11 15 5 42T4 100M10 -10Q19 24 12 46T14 100M21 -10Q15 24 23 55T22 100"/><path d="M8 0Q18 30 9 60M20 25Q12 45 21 78" stroke="#ead0a0" opacity=".6"/></g></pattern>
</defs>
<g data-piece-width-mm="{size['width']}" data-piece-height-mm="{size['height']}" transform="{transform}"><g transform="rotate({180 if side else 0} 35 38)">
<path d="M35 4L60 15L65 70Q35 76 5 70L10 15Z" fill="#342113"/>
<path d="{FACE}" fill="url(#oak)" stroke="#4e311b" stroke-width="1.2"/>
<path d="{FACE}" fill="url(#grain)" clip-path="url(#face)"/>
<path d="M35 6L57 16L60 66Q35 70 10 66L14 16Z" fill="none" stroke="#d3aa70" stroke-width=".7" opacity=".7"/>
<g id="rune" transform="translate(35 38) scale(1.38 1.42) translate(-35 -35)" fill="none" stroke-linejoin="round" stroke-linecap="round">
<path d="{MARKS[mark]}" stroke="#3b2415" stroke-width="3.8"/>
<path d="{MARKS[mark]}" stroke="{ink}" stroke-width="2.4"/>
</g>{chevron}</g></g></svg>'''
        (output / f'{side}{code}.svg').write_text(svg + '\n')
