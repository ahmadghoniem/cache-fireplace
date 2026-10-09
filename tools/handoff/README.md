# Sprite handoff for ChatGPT Images 2.0

Two sheets: Clawd's poses and the fireplace. Each prompt goes in a new ChatGPT chat with
the attachments listed under it (all in `attachments/`), plus the official references from
`Desktop/lean-claude/clawd-mascot-animations/` named in the prompt. Save a result you like
as a PNG into `results/` with the name given, then tell Claude. Claude cuts the sheet with
`tools/import-sheet.py` and swaps the sprites in `hooks/sprites.ts`; `tools/tuner.html`
then shows them in every state.

## Rules every sheet shares

The importer reads the sheet by color and by grid, so these matter more than style:

- Background: flat pure magenta `#FF00FF` everywhere, no gradient, no shadow, no grid lines, no text.
- Hard square pixels: each sprite pixel is one big flat square, all the same size. No anti-aliasing, no blur, no dithering.
- Each sprite sits inside its own cell with magenta margin around it, nothing crossing into a neighbouring cell.
- Colors from `palette.png` where they fit. New colors are fine; keep them few and flat.

---

## 1. Clawd's poses → `results/clawd.png`

Attach: `clawd-still.png`, `Clawd-Basketball.gif`, `Clawd-Lurking.gif`, `clawd-poses.png`,
`palette.png`, `scene-burning.png`

```
A pixel-art sprite sheet of one character in 6 poses, 3 columns by 2 rows.
The attached clawd-poses.png is the current version in exactly this layout; redraw it
with the same grid, in the style of the official animations attached
(clawd-still.png, Clawd-Basketball.gif, Clawd-Lurking.gif). scene-burning.png shows
where it lives: beside a small stone fireplace in a terminal.

Every sprite is 17 pixels wide by 10 tall (pose 4 is 19 wide), each pixel a large hard
square of the same size in every cell. Sprites stand on the bottom of their cell.

The character "Clawd": a blocky coral creature (#D77757). Its body is a rectangle 13
pixels wide and 8 tall; two stub arms stick out 2 pixels on each side at body rows 5
and 6; eyes are black (#141414), 1 pixel wide and 2 tall; four 1-pixel legs, two rows
long, under the outer columns of the body. No mouth, nose or outline. Clawd faces
right, toward the fireplace: the column on its far (left) side is a darker coral
#BE684D down the body, the arm and the first leg, as in Clawd-Basketball.gif.

Poses, left to right, top to bottom:
1 stand: facing right, eyes toward the right.
2 front: looking at the viewer, no far-side shade.
3 crouch: reaching down to a woodpile, body a pixel lower, eyes squeezed to 2 x 1
  dashes, the right arm lowered, legs bent as a short diagonal step.
4 toss: the right arm raised up and out in a diagonal, throwing; eyes looking up.
5 hop: a small hop after the throw, the back legs trailing as a diagonal, as the
  legs look when Clawd enters the frame in Clawd-Lurking.gif.
6 scarf: pose 1 wearing a blue scarf (#4A7FC1, shade #2F5D96) around the arm line,
  one short tail hanging in front.

Flat pure magenta #FF00FF background in every cell, no grid lines, no text, no shadows,
no anti-aliasing.
```

Claude imports it with:
`--cols 3 --rows 2 --names stand,front,crouch,toss,hop,scarf --sizes 17x10,17x10,17x10,19x10,17x10,17x10`
(the scarf cell becomes the overlay worn over `stand`).

## 2. The fireplace → `results/fireplace.png`

Attach: `fireplace.png`, `palette.png`, `scene-burning.png`, `clawd-still.png`

```
A pixel-art sprite sheet of 4 small stone fireplaces, 2 columns by 2 rows.
fireplace.png is the current one at its real pixel size; scene-burning.png shows it in
place beside the character, which is 17 x 10 pixels. Draw 4 variations of it, in the
flat, simple style of the attached character art.

Every fireplace is 20 pixels wide by 12 tall, each pixel a large hard square of the same
size in all four cells, seen from the front:
- a mantel shelf across the top 2 rows and a hearth across the bottom 2 rows, in pale
  stone #94A0B0 with a shade row #465160,
- stone sides #5F6B7A, the right side in shade #465160,
- an arched opening in the middle, 14 pixels wide, its inside filled with flat pure cyan
  #00FFFF (the game draws the fire there) and dark firebrick #33190F,
- two logs lying on an iron grate at the bottom of the opening (bark #8B5A2B, shade
  #5E3A1A, cut ends #BE8E5C, grate #2A2A30). Keep the opening and the logs where the
  attached fireplace.png has them.

Variations: 1 as attached, cleaner; 2 rough fieldstone; 3 brick (#8B3A2A, #6E2C20);
4 a plain cottage hearth with a wooden mantel beam.

Flat pure magenta #FF00FF background in every cell, no grid lines, no text, no shadows,
no anti-aliasing.
```

Claude imports it with `--cols 2 --rows 2 --sizes 20x12,20x12,20x12,20x12 --alias 00ffff=D`.

---

## When a result is off

Ask in the same chat; ChatGPT keeps the sheet and changes what you name.

- Soft edges or uneven pixels: "Redraw it with hard square pixels, exactly 17 x 10 pixels per sprite, no anti-aliasing."
- One cell wrong: "Keep every cell the same except cell 3 (crouch): the right arm hangs lower than the left."
- Background not pure: "Make the background exactly #FF00FF, flat, with no texture."
- Too detailed: "Fewer pixels: keep the shapes as simple as the attached version."
- Drifting from Clawd: attach `clawd-still.png` again and say "keep this character's proportions".

## Attachments

| File | What it shows |
| --- | --- |
| `clawd-still.png` | Clawd's official still, from the mascot animations |
| `clawd-poses.png` | the mod's current 6 poses, in the layout sheet 1 asks for |
| `fireplace.png` | the current fireplace, the inside of the opening in cyan |
| `scene-burning.png`, `scene-cold.png` | the scene as the terminal draws it |
| `palette.png` | every color the mod uses, with hex codes |

They are made from the mod's own sprites; after a sprite change, regenerate them:

```
bun tools/handoff/dump.ts tools/out/sprites.json
python -I tools/handoff/make-attachments.py tools/out/sprites.json
```
