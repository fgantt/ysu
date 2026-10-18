"""Build scalable themes and Hari-Seldon dark variants from existing vector lettering."""
from pathlib import Path
import copy
import json
from html import escape
import re
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'public/piece-themes'
NS = '{http://www.w3.org/2000/svg}'
ET.register_namespace('', NS[1:-1])
CODES = ['FU', 'KY', 'KE', 'GI', 'KI', 'KA', 'HI', 'OU', 'GY', 'TO', 'NY', 'NK', 'NG', 'UM', 'RY']
DIMENSIONS = json.loads((ROOT / 'scripts/shogi-piece-dimensions.json').read_text())['pieces']


def sized_artwork(code, artwork):
    size = DIMENSIONS[code]
    king = DIMENSIONS['GY']
    transform = f'translate(50 55) scale({size["width"] / king["width"]:.8f} {size["height"] / king["height"]:.8f}) translate(-50 -55)'
    return f'<g data-piece-width-mm="{size["width"]}" data-piece-height-mm="{size["height"]}" transform="{transform}">{artwork}</g>'


PROMOTED = {'TO', 'NY', 'NK', 'NG', 'UM', 'RY'}
THEMES = [
    ('ivory-vermilion-kanji', 'Ivory & Vermilion', 'Warm ivory with black single-character kanji and vermilion promotions.', '#fff8df', '#d8c7a0', '#282119', '#aa241f'),
    ('midnight-lacquer-kanji', 'Midnight Lacquer', 'Charcoal lacquer with cream kanji and copper promotion accents.', '#343942', '#111820', '#fff4d6', '#ffb786'),
    ('indigo-porcelain-kanji', 'Indigo Porcelain', 'Pale glazed ceramic with cobalt kanji and burgundy promotions.', '#ffffff', '#c4d7e5', '#193d83', '#8e204b'),
    ('modern-mono-kanji', 'Modern Mono', 'Flat ivory pieces with bold single-character kanji and marked promotions.', '#f4f2eb', '#f4f2eb', '#181818', '#181818'),
    ('learning-arrows', 'Learning Arrows', 'English labels and movement guides: dots step once, arrows slide, and N jumps two ranks. Promoted pieces show their new moves.', '#f8f3df', '#e4d5b3', '#202d3b', '#9a251d'),
]


def lettering(theme, code):
    source = ET.parse(ASSETS / theme / f'0{code}.svg').getroot()
    layer = source.find(NS + 'g')
    path = copy.deepcopy(list(layer)[-1])
    # Each final path combines two closed outline subpaths followed by lettering.
    # Retain the exact lettering, resolving its first relative move after stripping the outline.
    parts = [p for p in re.split(r'(?=[Mm])', path.attrib['d']) if p.strip()]
    if len(parts) < 3 or not all(p.rstrip().lower().endswith('z') for p in parts[:2]):
        raise ValueError(f'Unexpected source outline: {theme}/{code}')
    origin = [0.0, 0.0]
    for part in parts[:3]:
        numbers = list(re.finditer(r'[-+]?(?:\d*\.)?\d+(?:[eE][-+]?\d+)?', part))[:2]
        xy = [float(match[0]) for match in numbers]
        origin = xy if part[0] == 'M' else [origin[i] + xy[i] for i in range(2)]
    parts[2] = f'M {origin[0]:.8f} {origin[1]:.8f}' + parts[2][numbers[1].end():]
    path.set('d', ''.join(parts[2:]))
    path.attrib.pop('style', None)
    path.attrib.pop('id', None)
    # Only rendering attributes are needed from the source vector.
    path.attrib = {k: v for k, v in path.attrib.items() if k in {'d', 'transform', 'fill-rule'}}
    wrapper = ET.Element(NS + 'svg', {'viewBox': source.attrib['viewBox'], 'width': '100', 'height': '110'})
    group = ET.SubElement(wrapper, NS + 'g', {'transform': layer.attrib['transform']})
    group.append(path)
    return ET.tostring(wrapper, encoding='unicode')


def guide(code, ink):
    diagonals = [(-1, -1), (1, -1), (-1, 1), (1, 1)]
    cross = [(0, -1), (-1, 0), (1, 0), (0, 1)]
    gold = [(-1, -1), (0, -1), (1, -1), (-1, 0), (1, 0), (0, 1)]
    steps, rays = [], []
    if code == 'FU': steps = [(0, -1)]
    elif code == 'KY': rays = [(0, -1)]
    elif code == 'KE': steps = [(-1, -2), (1, -2)]
    elif code == 'GI': steps = [(-1, -1), (0, -1), (1, -1), (-1, 1), (1, 1)]
    elif code in {'KI', 'TO', 'NY', 'NK', 'NG'}: steps = gold
    elif code in {'OU', 'GY'}: steps = diagonals + cross
    elif code == 'KA': rays = diagonals
    elif code == 'HI': rays = cross
    elif code == 'UM': rays, steps = diagonals, cross
    elif code == 'RY': rays, steps = cross, diagonals
    out = [f'<g stroke="{ink}" fill="{ink}" stroke-width="1.8" stroke-linecap="round"><circle cx="50" cy="81" r="2.2"/>']
    for dx, dy in steps:
        x, y = 50 + dx * 12, 81 + dy * 9
        out.append(f'<path d="M50 81 L{x} {y}" opacity=".4"/><circle cx="{x}" cy="{y}" r="2.3"/>')
    for dx, dy in rays:
        x, y = 50 + dx * 15, 81 + dy * 15
        out.append(f'<path d="M50 81 L{x} {y}" marker-end="url(#arrow)"/>')
    return ''.join(out) + '</g>'


shape = 'M50 3 L78 15 L94 106 L6 106 L22 15 Z'
labels = dict(zip(CODES, ['P', 'L', 'N', 'S', 'G', 'B', 'R', 'K', 'K', '+P', '+L', '+N', '+S', '+B', '+R']))
dark_source = ET.parse(ASSETS / 'mikurajima-moriage-dark/0FU.svg').getroot()
dark_image = ET.tostring(dark_source.find('.//' + NS + 'image'), encoding='unicode')

for theme_id, name, description, top, bottom, ink, promotion in THEMES:
    folder = ASSETS / theme_id
    folder.mkdir(exist_ok=True)
    for code in CODES:
        color = promotion if code in PROMOTED else ink
        body = f'<path d="{shape}" fill="url(#surface)" stroke="{bottom if top != bottom else "#77746a"}" stroke-width="1.8"/>'
        if theme_id == 'learning-arrows':
            content = f'<text x="50" y="46" text-anchor="middle" font-family="Arial, sans-serif" font-weight="700" font-size="30" fill="{color}">{labels[code]}</text>' + guide(code, color)
        else:
            content = f'<g fill="{color}">{lettering("Hari-Seldon-1-kanji", code)}</g>'
            if code in PROMOTED:
                content += f'<path d="M31 98 H69" stroke="{color}" stroke-width="2.4"/>'
        if theme_id == 'midnight-lacquer-kanji':
            body += '<path d="M24 17 L50 7 L76 17" fill="none" stroke="#89939c" opacity=".6" stroke-width="1.5"/>'
        if theme_id == 'indigo-porcelain-kanji':
            body += '<path d="M26 18 L50 9 L74 18" fill="none" stroke="#7398c5" stroke-width="1.5"/>'
        defs = f'<defs><linearGradient id="surface" x2=".75" y2="1"><stop stop-color="{top}"/><stop offset="1" stop-color="{bottom}"/></linearGradient><marker id="arrow" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0 0 L6 3 L0 6 Z" fill="{color}"/></marker></defs>'
        for player in [0, 1]:
            rotation = ' transform="rotate(180 50 55)"' if player else ''
            svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 110" role="img" aria-label="{escape(name, quote=True)} {code}">{defs}<g{rotation}>{sized_artwork(code, body + content)}</g></svg>\n'
            (folder / f'{player}{code}.svg').write_text(svg)

for number in [1, 2]:
    folder = ASSETS / f'Hari-Seldon-{number}-kanji-dark'
    folder.mkdir(exist_ok=True)
    for code in CODES:
        color = '#a31713' if code in PROMOTED else '#070504'
        for player in [0, 1]:
            rotation = ' transform="rotate(180 50 55)"' if player else ''
            sized_content = sized_artwork(code, dark_image + f'<g fill="{color}">{lettering(f"Hari-Seldon-{number}-kanji", code)}</g>')
            svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 110" role="img" aria-label="Hari-Seldon {number} Dark {code}"><g{rotation}>{sized_content}</g></svg>\n'
            (folder / f'{player}{code}.svg').write_text(svg)

config_path = ASSETS / 'themes.json'
config = json.loads(config_path.read_text())
source_attribution = next(t['attribution'] for t in config['themes'] if t['id'] == 'Hari-Seldon-1-kanji')
additions = [{'id': row[0], 'displayName': row[1], 'description': row[2], **({'attribution': source_attribution} if row[0] != 'learning-arrows' else {})} for row in THEMES]
additions += [{'id': f'Hari-Seldon-{n}-kanji-dark', 'displayName': f'Hari-Seldon {n} — Dark', 'description': f'Original Hari-Seldon {n} vector lettering on dark figured boxwood, with red promotions.', 'attribution': source_attribution} for n in [1, 2]]
ids = {t['id'] for t in additions}
config['themes'] = [t for t in config['themes'] if t['id'] not in ids] + additions
config_path.write_text(json.dumps(config, indent=2) + '\n')
print('Generated seven themes, 30 SVG pieces each.')
