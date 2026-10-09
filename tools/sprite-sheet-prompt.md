# Sprite sheet prompt for gpt-image-2

Generate at 1024x1024 (square, 4 x 4 cells of 256 px), quality high, opaque background.
Then cut it with:

```
python -I tools/import-sheet.py sheet.png --cols 4 --rows 4 --width 40 --gif tools/out/sheet.gif --ts hooks/sheet-frames.ts
```

`--width 40` matches the mod's stage (40 x 16 pixels). Check `tools/out/sheet.gif` before using the frames.

## Prompt (throw sequence)

```
A pixel-art sprite sheet, 4 columns by 4 rows, 16 frames of one animation, read left to right, top to bottom.
Flat solid magenta background (#FF00FF) in every cell, no grid lines, no borders, no text, no shadows on the background.

Style: strict pixel art like an 8-bit game. Every pixel is a hard square on one shared pixel grid,
the same pixel size in every frame. No anti-aliasing, no gradients, no blur, no dithering on the characters.
Side view, camera fixed: the furnace and the woodpile stay in exactly the same place and size in all 16 frames.
Each cell shows the whole scene with a little magenta margin; nothing crosses into a neighbouring cell.

Scene, left to right: a small woodpile of three stacked logs (brown bark #8B5A2B, darker bark #5E3A1A,
pale cut ends #D9B77E); the character; a cast-iron pot-belly furnace.

The character "Clawd": a tiny blocky creature, exactly 12 pixels wide and 8 pixels tall when standing.
Body a solid flat coral orange (#D97757), a wide rectangle. Two square black eyes, one pixel each, on the
second row. Short stub arms: the third and fourth rows stick out one pixel further on each side than the body.
Four thin one-pixel legs, two rows long. No mouth, no nose, no outline, no shading.

The furnace: about 16 pixels wide and 14 tall, dark iron (#3B3B42, shadow #26262B, highlight #5C5C66),
a rounded dome top, a short chimney pipe on the top right (#4A4A52), a brass knob (#C9A227) on the right side,
an arched firebox opening on the front showing the fire inside, two short feet.
Fire colors only: #5A1208, #9C1F0A, #D4400F, #F07818, #F9B233, #FFE680.

Frames:
1-2   Clawd stands beside the woodpile, facing the furnace; small low fire in the firebox.
3     Clawd crouches (one pixel shorter) and grabs the top log.
4-5   Clawd stands up with the log held overhead in both arms, takes one step toward the furnace.
6-7   Clawd throws: the log flies in an arc toward the firebox opening.
8     The log enters the firebox opening.
9-10  The fire flares up high and bright yellow, three sparks rise out of the chimney.
11-12 Clawd does a happy hop (one pixel up), eyes shut as two short lines.
13-14 Clawd walks back to its spot beside the woodpile; the fire settles to a strong steady blaze.
15-16 Clawd stands still and content; the fire flickers (different flame shapes in 15 and 16).
```

## Prompt (cold sequence)

Same text, with the scene and frames replaced by:

```
The fire is almost out: a few dark red embers in the firebox, a thin grey wisp of smoke from the chimney.
Light snow falls (single white #EEF7FF and pale blue #B9DCF5 pixels).
Clawd's body is a paler, frosted coral (#D9A090) and it shivers.

Frames:
1-4   Clawd shivers in place, shifting one pixel left and right; tiny white breath puffs by its face in 2 and 4.
5-8   The embers dim; frost (pale blue #BFE6FF) creeps over the furnace's top highlight.
9-12  Clawd hugs itself (arms pulled in to the body), snow settles on its head.
13-16 Clawd is frozen inside a pale blue ice block (#6F9FC0 fill, #D6F1FF edges), eyes shut; snow keeps falling.
```

## Calling the API

```
curl https://api.openai.com/v1/images/generations \
  -H "Authorization: Bearer $OPENAI_API_KEY" -H "Content-Type: application/json" \
  -d '{"model": "gpt-image-2", "size": "1024x1024", "quality": "high", "prompt": "<the prompt above>"}' \
  | python -c "import sys, json, base64; open('sheet.png', 'wb').write(base64.b64decode(json.load(sys.stdin)['data'][0]['b64_json']))"
```
