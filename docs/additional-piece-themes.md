# Additional piece themes — October 8, 2026

Seven themes are available in Settings → Appearance → Piece Themes:

- Ivory & Vermilion: warm ivory, black single-character lettering, red promotions.
- Midnight Lacquer: charcoal surfaces, cream lettering, copper promotions.
- Indigo Porcelain: pale ceramic surfaces, cobalt lettering, burgundy promotions.
- Modern Mono: flat ivory and black, with an underline marking promoted pieces.
- Learning Arrows: English initials, step dots, sliding arrows and knight jumps. Promoted minor pieces have gold movement; horse and dragon combine sliding and stepping directions. Movement is relative to the piece's owner, so the entire guide rotates for Gote. Guides describe movement geometry, not legal moves in a particular position.
- Hari-Seldon 1 — Dark and Hari-Seldon 2 — Dark: existing vector lettering preserved on the existing dark Mikurajima figured-boxwood base, including both king characters and red promotions.

Each theme supplies 30 self-contained SVGs: 15 piece designs in both orientations. The six kanji sets use extracted Hari-Seldon vector outlines rather than platform fonts. Original outline subpaths are removed before placement; lettering coordinates and transforms are retained. The dark backgrounds are embedded from the existing Mikurajima asset. Learning Arrows uses system sans-serif English labels and vector movement diagrams.

The six derivative kanji sets retain LuffyKudo / Shogi-Themes attribution and CC BY-SA 4.0 licensing in the theme catalog. The new surface designs and derived lettering in those sets are distributed under that same license. Learning Arrows contains original geometry and labels.

Regenerate from the repository root:

```sh
python3 scripts/generate-additional-piece-themes.py
```

The generator validates source outline structure and updates the catalog without duplicate IDs. Tests validate XML and complete assets for both players, king paths, derivative attribution, movement indicators, knight destinations and settings style filtering. Browser checks confirmed all seven themes render, discovery in the actual selector, searching and selected-preview updates. Native settings selection remains a manual check.

## Realistic relative sizes — October 8, 2026

The seven new sets and both Mikurajima Lacquer sets now use six graduated face sizes. Representative reference dimensions (width × length in millimeters) are: pawn 22.5 × 27; lance 23.5 × 28; knight 25.5 × 29; gold/silver 26.7 × 30; bishop/rook 27.7 × 31; king 28.7 × 32. This is a typical-size model, not a claim that every craftsman uses identical measurements.

Research: [YouGoJapan's complete size guide](https://yougojapan.com/shogi-pieces-size-guide/) gives the six tiers. Actual [Tohsin Mikurajima pieces](https://www.tohsin.com/koma/koma-sonota1003.html) measure approximately 31.9 × 28.4 mm for a king and 27.0 × 22.5 mm for a pawn; a [second Tohsin set](https://tohsin.com/koma/koma-sonota325.html) measures 32.0 × 28.7 mm and 27.4 × 22.8 mm, respectively. These product measurements corroborate the relative king/pawn proportions and show natural variation between sets. In a real set promotion turns over the same piece, so every promoted form retains its original dimensions.

`scripts/shogi-piece-dimensions.json` is the common reference used by both generators. Each asset keeps its 100 × 110 viewBox and centers its artwork with separate width/height ratios relative to the king. Surface, lettering and movement guides scale together. Gote orientation is applied outside that sizing transform. The stable canvas preserves board cell/captured-piece interaction areas while the visible pieces become progressively smaller. Settings previews and any other consumer of the SVGs inherit the same proportions without special rendering rules.

To regenerate all nine sets, run these commands in order:

```sh
node scripts/generate-mikurajima-theme.mjs
node scripts/build-mikurajima-dark-pieces.mjs
python3 scripts/generate-additional-piece-themes.py
```

Regression coverage checks both orientations of every piece in all nine sets, the six width/length ratios, king variants and matching promoted/unpromoted sizing. Browser verification showed the complete pawn-to-king sequence in each set.
