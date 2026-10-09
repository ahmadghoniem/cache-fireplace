# Sprite handoff for ChatGPT Images 2.0

Three sheets, one per object: Clawd's poses, furnace designs, and the things Clawd throws.
Each prompt goes in a new ChatGPT chat with the attachments listed under it (all in
`attachments/`). Save each result you like as a PNG into `results/` with the name given,
then tell Claude. Claude cuts the sheet with `tools/import-sheet.py`, adds it as a new
design in `hooks/sprites.ts`, and it shows up as a choice in the tuner
(`tools/tuner.html`: Clawd → art, Furnace → design, Thrown → object).

Several results of one sheet are fine: name them `clawd-2.png`, `furnaces-dark.png`, and so on.

## Rules every sheet shares

The importer reads the sheet by color and by grid, so these matter more than style:

- Background: flat pure magenta `#FF00FF` everywhere, no gradient, no shadow, no grid lines, no text.
- Hard square pixels: each sprite pixel is one big flat square, all the same size. No anti-aliasing, no blur, no dithering, no outlines that are not part of the grid.
- Each sprite sits inside its own cell with magenta margin around it, nothing crossing into a neighbouring cell.
- Colors from `palette.png` where they fit. New colors are fine; keep them few and flat.

---

## 1. Clawd's poses → `results/clawd.png`

Attach: `clawd-still.png`, `clawd-poses.png`, `palette.png`, `scene-burning.png`

```
A pixel-art sprite sheet of one character in 9 poses, 3 columns by 3 rows, square image.
The attached clawd-poses.png is the current low-resolution version in exactly this
layout; redraw it as a better sheet with the same grid. clawd-still.png is the
character's official look; scene-burning.png shows where it lives (beside a small
furnace in a terminal).

Every sprite is drawn on a grid of exactly 12 pixels wide by 8 pixels tall (two poses
are 7 tall, one is 13 wide, noted below), each pixel a large hard square of the same
size in every cell. Sprites stand on the bottom of their cell, centred.

The character "Clawd": a blocky coral creature (#D97757). Its body is a wide rectangle,
8 pixels wide; two stub arms make rows 3 and 4 stick out one pixel more on each side
(12 wide there); two square black eyes (#000000), one pixel each, on row 2; four
one-pixel legs, two rows long. No mouth, nose, outline or shading. Darker coral #A8523A
for shut eyes and folded arms.

Poses, left to right, top to bottom:
1 front: standing, looking at the viewer.
2 right: standing, eyes shifted right, looking at a furnace to its right.
3 blink: as 2 with eyes closed (no eye pixels).
4 crouch: squatting to pick something up, 7 pixels tall, feet spread.
5 up: both arms raised overhead (arms above the head, holding nothing), eyes forward.
6 warm: facing right, both arms stretched toward the right to warm its hands, 13 wide.
7 hug: cold, arms folded across its body, hunched.
8 sleep: sitting, eyes shut as two short darker lines, 7 tall.
9 scarf: as 2 wearing a blue scarf (#4A7FC1, shade #2F5D96) with one tail hanging down.

Flat pure magenta #FF00FF background in every cell, no grid lines, no text, no shadows,
no anti-aliasing.
```

Claude imports it with:
`--cols 3 --rows 3 --names front,right,blink,crouch,up,warm,hug,sleep,scarf --sizes 12x8,12x8,12x8,12x7,12x8,13x8,12x8,12x7,12x8`
(the scarf cell becomes the overlay worn over `right`).

## 2. Furnace designs → `results/furnaces.png`

Attach: `furnaces.png`, `palette.png`, `scene-burning.png`

```
A pixel-art sprite sheet of 4 small furnaces, 2 columns by 2 rows, square image.
furnaces.png shows two current designs at their real pixel size; scene-burning.png
shows one in place beside the character, which is 12 x 8 pixels.

Every furnace is drawn on a grid of exactly 12 pixels wide by 10 pixels tall, each
pixel a large hard square of the same size in all four cells. Side-on, standing on the
bottom of its cell.

Each furnace has:
- an open firebox in the front, at least 6 pixels wide and 3 tall, filled with flat
  pure cyan #00FFFF and nothing else (the game draws the fire there; no flames, no logs),
- a chimney pipe 2 pixels wide on top, reaching the top edge of the grid,
- iron colors: #3B3B42, shadow #26262B, highlight #5C5C66, pipe #4A4A52; brass #C9A227
  for a knob or trim.

Designs:
1 a round pot-belly stove on short legs,
2 a square cast-iron box stove with a wide firebox,
3 a small brick oven (bricks #8B3A2A and #6E2C20, mortar #5C5C66) with an arched mouth,
4 a tall narrow kiln with a riveted iron band (rivets #8A8A95).

Flat pure magenta #FF00FF background in every cell, no grid lines, no text, no shadows,
no anti-aliasing.
```

Claude imports it with `--cols 2 --rows 2 --sizes 12x10,12x10,12x10,12x10 --alias 00ffff=D`;
the cyan becomes the firebox and the top row's pipe pixels become the chimney.

## 3. Things Clawd throws → `results/throwables.png`

Attach: `throwables.png`, `palette.png`, `scene-burning.png`

```
A pixel-art sprite sheet, 3 columns by 2 rows, landscape 3:2 image.
throwables.png is the current version in exactly this layout. Each column is one thing a
small creature throws into a furnace: the top row is the single piece it carries
(about 4 x 2 pixels), the bottom row is the pile it takes pieces from (about 5 x 6 pixels).
All sprites share one pixel size: each pixel a large hard square.

Columns:
1 logs: bark #8B5A2B, shadow #5E3A1A, pale cut ends #D9B77E; the pile is three logs stacked.
2 coal: lumps #1D1D22 with grey shine #6A6A78; the pile is a small iron scuttle heaped with coal.
3 paper: crumpled pages #EEEAE0 with ruled lines #9A958C; the pile is a small stack.

Flat pure magenta #FF00FF background in every cell, no grid lines, no text, no shadows,
no anti-aliasing.
```

Swap a column for something else if you like (kindling, pinecones, a cookie): say in the
prompt what it is and keep the two-row layout. Tell Claude what each column holds.

Claude imports it with `--cols 3 --rows 2 --sizes 4x2,4x2,4x2,5x6,5x6,5x6` (adjusted to what came back).

---

## When a result is off

Ask in the same chat; ChatGPT keeps the sheet and changes what you name.

- Soft edges or uneven pixels: "Redraw it with hard square pixels, exactly 12 x 8 pixels per sprite, no anti-aliasing."
- One cell wrong: "Keep every cell the same except cell 6 (warm): both arms reach right at the height of rows 3 and 4."
- Background not pure: "Make the background exactly #FF00FF, flat, with no texture."
- Too detailed: "Fewer pixels: at this size a 12 x 8 grid has only 96 pixels; keep the shapes as simple as the attached version."
- Drifting from Clawd: attach `clawd-still.png` again and say "keep this character's proportions".

## Attachments

| File | What it shows |
| --- | --- |
| `clawd-still.png` | Clawd's official still, from the mascot animations |
| `clawd-poses.png` | the mod's current 9 poses, in the layout sheet 1 asks for |
| `furnaces.png` | the two current furnaces, firebox in cyan |
| `throwables.png` | the current held pieces (top) and piles (bottom) |
| `scene-burning.png`, `scene-cold.png` | the scene as the terminal draws it, at 75% |
| `palette.png` | every color the mod uses, with hex codes |

They are made from the mod's own sprites; after a sprite change, regenerate them:

```
bun tools/handoff/dump.ts tools/out/sprites.json
python -I tools/handoff/make-attachments.py tools/out/sprites.json
```
