# Yggdrasil collection

Choose Yggdrasil Runes pieces, Frost Ash board, and Yggdrasil Night wallpaper.
Existing selection IDs and background paths are preserved, with fresh URL revisions.

The pieces use warm carved oak, fine grain, larger ivory-inlaid runes, and copper
promotion chevrons. Optional game tooltips identify the pieces; there is no visible
role text. Shared traditional size ratios remain in scripts/shogi-piece-dimensions.json.
Promoted pieces retain the base piece size. Generate all 30 vector pieces with
scripts/generate-yggdrasil-pieces.py.

The board is pale natural ash with botanical carving at opposite corners and an
open center. The wallpaper depicts a living, gnarled Yggdrasil above a Nordic fjord,
with mossy roots, a leafy canopy, mist, stars, and an aurora. The rich midnight
palette was inspired by Celestial Dragon, without copying its scene.

## Saved assets and prompts

- public/piece-themes/yggdrasil-runes/ — all 30 SVG piece faces.
- public/boards/frost-ash.svg — revised board at its original saved-selection path.
- public/wallpapers/yggdrasil-night.svg — revised wallpaper at its original path.
- output/imagegen/frost-ash-natural.png — original generated board image.
- output/imagegen/yggdrasil-night-natural.png — original generated wallpaper image.
- output/imagegen/norse-natural-prompts.json — complete final prompts for both assets.

Both raster artworks were generated with the built-in image_gen tool. Each PNG
is embedded losslessly in its SVG background, avoiding external image dependencies
while preserving existing saved selections and native discovery. Piece faces remain
editable vector art.

## Rune associations

The rune marks are modern game mnemonics, not historical translations of kanji:
K for king, R for rook, B for bishop, F for gold/wealth, S for silver,
H for knight/horse, spear-shaped T for lance, M for pawn/man.
The English associations are deliberately modern, not Old Norse spellings.
Runes record sounds and do not provide direct equivalents of each kanji name.

Background: [Viking Ship Museum, Runes](https://www.vikingeskibsmuseet.dk/en/professions/education/exercises/runes)
and [Jesse Byock, Runes and Old Norse](https://oldnorse.org/wp-content/uploads/2020/03/runes-and-old-norse-from-viking-language-1-learn-old-norse-jesse-byock-lesson-3.pdf).
