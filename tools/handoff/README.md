# Sprite handoff for ChatGPT Images 2.0

Two sheets to explore: fireplace styles in each state, and logs. Each prompt goes in a new
ChatGPT chat with the attachments listed under it (all in `attachments/`). Save a result you
like as a PNG into `results/` with the name given, then tell Claude. Claude cuts the sheet with
`tools/import-sheet.py` and swaps the sprites in `hooks/sprites.ts`; `tools/tuner.html` then
shows them in every state.

## Rules every sheet shares

The importer reads the sheet by color and by grid, so these matter more than style:

- Background: flat pure magenta `#FF00FF` everywhere, no gradient, no shadow, no grid lines, no text.
- Hard square pixels: each sprite pixel is one big flat square, all the same size. No anti-aliasing, no blur, no dithering.
- Each sprite sits inside its own cell with magenta margin around it, nothing crossing into a neighbouring cell.
- Colors from `palette.png` where they fit. New colors are fine; keep them few and flat.

---

## 1. Fireplaces → `results/fireplace.png`

Attach: `tilt-sketch.png`, `fireplace.png`, `palette.png`

```
A pixel-art sprite sheet of 4 small fireplaces, each in 4 states: 4 columns by 4 rows.

Angle: tilt-sketch.png shows it. Each fireplace is turned to face left, toward a character
standing on its left. Its left side is pushed back: the left foot sits higher (the red arrow
pointing up) and the left edge is shorter. Its right side comes toward the viewer: the right
foot sits lower (the red arrow pointing down), the right edge is the tallest, and a narrow
strip of the right side wall shows. Ignore the crossed-out woodpile in the sketch: instead,
a small stack of 2 to 4 logs fills the gap under the raised left side, tucked under it.

fireplace.png is the current one, straight on, at its real pixel size: keep its flat style.
The character beside it is a coral block 17 pixels wide and 9 tall, with no outlines.
Few colors, no outlines, no texture noise.

Every sprite, its log stack included, fits in 16 pixels wide by 10 tall, each pixel a large
hard square of the same size in all 16 cells, standing on the bottom of its cell.

Rows, one style each:
1 stone fireplace: pale stone mantel and hearth (#94A0B0, shade #465160), stone sides
  (#5F6B7A), an opening with dark firebrick (#33190F). A cleaner take on the attachment.
2 red brick fireplace (#8B3A2A, #6E2C20) with a wooden mantel beam (#8B5A2B).
3 small black iron wood stove on short legs (#2A2A30, highlight #4A4A55), a door with
  a window that shows the fire, a short chimney pipe up to the top edge.
4 open campfire: a ring of round grey stones on the ground, logs crossed in the middle,
  no walls; the fire rises in the open.

Columns, one state each, the same fireplace in all four:
1 empty: the space where the fire burns filled with flat pure cyan #00FFFF, the logs
  in place under it (bark #8B5A2B, shade #5E3A1A, cut ends #BE8E5C).
2 burning: flames 2 to 3 pixels high over the logs in yellow #FDE047, orange #F59E0B
  and red #EF4444, the firebrick or stones nearest the fire lit warmer.
3 embers: no flames, a few orange and red pixels left on the logs, one grey puff of
  smoke (#9AA3AD) rising.
4 ash: the logs burnt to grey ash (#5B5550), dark and cold, a thin thread of smoke.

Flat pure magenta #FF00FF background in every cell, no grid lines, no text, no shadows,
no anti-aliasing.
```

Claude imports the empty column as the sprite and reads the other three to set how the
game draws the fire, embers and ash:
`--cols 4 --rows 4 --sizes 16x10,16x10,16x10,16x10,16x10,16x10,16x10,16x10,16x10,16x10,16x10,16x10,16x10,16x10,16x10,16x10 --alias 00ffff=D`.

## 2. Logs → `results/logs.png`

Attach: `tilt-sketch.png`, `logs.png`, `palette.png`

```
A pixel-art sprite sheet of 4 log styles: 4 columns by 2 rows. logs.png is the current log
at its real pixel size. There is no separate woodpile: the logs are kept tucked under a
fireplace that is turned to face left, in the gap under its raised left side (see
tilt-sketch.png and ignore the crossed-out pile in it). Flat style, few colors, no outlines.

Top row: the stack that fills that gap, wedge-shaped, taller on the left and thinning to the
right, at most 6 pixels wide by 3 tall, standing on the bottom of its cell.
Bottom row: under each stack, one log from it seen from the side, 3 or 4 pixels wide by
2 tall: the character pulls it out and throws it into the fire.
Each pixel is a large hard square of the same size in all 8 cells.

Columns, one style each:
1 split logs: brown bark #8B5A2B with a shade #5E3A1A, pale cut ends #BE8E5C.
2 round birch logs: white bark (#E8E2D6) with a few dark marks (#3A3A3A), pale ends.
3 round logs seen end-on: rings on each cut end.
4 rough dark logs (#5E3A1A, #3B2410) with pale cut ends.

Flat pure magenta #FF00FF background in every cell, no grid lines, no text, no shadows,
no anti-aliasing.
```

Claude imports it with `--cols 4 --rows 2 --per-cell`.

---

## When a result is off

Ask in the same chat; ChatGPT keeps the sheet and changes what you name.

- Soft edges or uneven pixels: "Redraw it with hard square pixels, exactly 14 x 8 pixels per sprite, no anti-aliasing."
- One cell wrong: "Keep every cell the same except row 3, column 2: the stove's window should show flames."
- Background not pure: "Make the background exactly #FF00FF, flat, with no texture."
- Too detailed: "Fewer pixels: keep the shapes as simple as the attached version."

## Attachments

| File | What it shows |
| --- | --- |
| `tilt-sketch.png` | the angle wanted: left foot up, right foot down, the separate woodpile dropped |
| `fireplace.png` | the current fireplace, the space for the fire in cyan |
| `logs.png` | the current woodpile and the log Clawd carries |
| `scene.png` | the scene as the terminal draws it, for scale (Clawd is drawn smaller than he will be) |
| `palette.png` | the colors the mod uses, with hex codes |

They are made from the mod's own sprites; after a sprite change, regenerate them:

```
bun tools/handoff/dump.ts tools/out/sprites.json
python -I tools/handoff/make-attachments.py tools/out/sprites.json
```
