"""Draws the pictures to attach to the image prompts in README.md.

  bun tools/handoff/dump.ts tools/out/sprites.json
  python -I tools/handoff/make-attachments.py tools/out/sprites.json

Writes tools/handoff/attachments/*.png: the current fireplace and logs blown up on
flat magenta, so the generator copies their grid, and the scene as a terminal shows it.
"""
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
OUT = HERE / 'attachments'
MAGENTA = (255, 0, 255)
CYAN = (0, 255, 255)
PX = 24
font = ImageFont.truetype('C:/Windows/Fonts/consola.ttf', 18)

data = json.load(open(sys.argv[1], encoding='utf-8'))
PAL = {k: ((v >> 16) & 255, (v >> 8) & 255, v & 255) for k, v in data['pal'].items()}


def color(ch, cyan_inside):
    return CYAN if cyan_inside and ch == 'D' else PAL.get(ch)


def stamp(px, art, x0, y0, cyan_inside=False):
    for y, line in enumerate(art):
        for x, ch in enumerate(line):
            c = color(ch, cyan_inside)
            if c:
                px[x0 + x, y0 + y] = c


def grid(cells, cols, cw, ch, cyan_inside=False):
    """Sprites in a grid of cw x ch pixel cells, each centred and standing on the cell's floor."""
    rows = (len(cells) + cols - 1) // cols
    im = Image.new('RGB', (cols * cw, rows * ch), MAGENTA)
    px = im.load()
    for i, art in enumerate(cells):
        w = max(len(l) for l in art)
        stamp(px, art, (i % cols) * cw + (cw - w) // 2, (i // cols) * ch + ch - 1 - len(art), cyan_inside)
    return im.resize((im.width * PX, im.height * PX), Image.NEAREST)


# Braille dots on a 2 x 4 grid; bit i is dot i + 1
DOTS = [(0, 0), (0, 1), (0, 2), (1, 0), (1, 1), (1, 2), (0, 3), (1, 3)]


def scene(shot, light=False):
    CW, CH = 12, 24
    bg, fg = ((250, 249, 245), (40, 40, 40)) if light else ((12, 12, 12), (220, 220, 220))
    cols, rows, c = shot['columns'], shot['rows'], shot['cells']
    im = Image.new('RGB', (cols * CW + 24, rows * CH + 24), bg)
    d = ImageDraw.Draw(im)
    rgb = lambda n, dflt: dflt if n & 0x01000000 else ((n >> 16) & 255, (n >> 8) & 255, n & 255)
    for r in range(rows):
        for k in range(cols):
            cp, f, b = c[(r * cols + k) * 3:(r * cols + k) * 3 + 3]
            x, y = 12 + k * CW, 12 + r * CH
            d.rectangle([x, y, x + CW - 1, y + CH - 1], fill=rgb(b, bg))
            if cp == 0x2580:
                d.rectangle([x, y, x + CW - 1, y + CH // 2 - 1], fill=rgb(f, fg))
            elif cp == 0x2584:
                d.rectangle([x, y + CH // 2, x + CW - 1, y + CH - 1], fill=rgb(f, fg))
            elif 0x2800 <= cp <= 0x28ff:
                for bit, (i, j) in enumerate(DOTS):
                    if (cp - 0x2800) >> bit & 1:
                        cx, cy = x + CW * (0.3 + 0.4 * i), y + CH * (0.17 + 0.22 * j)
                        d.ellipse([cx - 1.5, cy - 1.5, cx + 1.5, cy + 1.5], fill=rgb(f, fg))
            elif cp != 0x20:
                d.text((x, y + 2), chr(cp), fill=rgb(f, fg), font=font)
    return im


def palette():
    names = {
        'C': 'Clawd', 'c': 'Clawd, far side', 'B': 'scarf',
        'R': 'stone, lit edge', 'P': 'stone', 'H': 'stone shade', 'k': 'firebrick', 'D': 'inside the fireplace',
        'L': 'bark', 'l': 'bark shade', 'W': 'log end', 'a': 'ash', 'F': 'flame', 'f': 'flame, red',
        'y': 'flame tip', 's': 'smoke', 'G': 'floor',
    }
    rows = [(n, PAL[k]) for k, n in names.items()] + [('inside the opening (fill)', CYAN)]
    im = Image.new('RGB', (360, 34 * len(rows) + 10), (24, 24, 24))
    d = ImageDraw.Draw(im)
    for i, (n, c) in enumerate(rows):
        d.rectangle([10, 8 + i * 34, 60, 34 + i * 34], fill=c)
        d.text((74, 12 + i * 34), f'#{c[0]:02X}{c[1]:02X}{c[2]:02X}  {n}', fill=(230, 230, 230), font=font)
    return im


OUT.mkdir(exist_ok=True)
for old in OUT.glob('*.png'):
    old.unlink()
grid([data['fireplace']], 1, 18, 10, cyan_inside=True).save(OUT / 'fireplace.png')
grid([data['woodpile'], data['log']], 2, 8, 6).save(OUT / 'logs.png')
scene(data['scene']).save(OUT / 'scene.png')
palette().save(OUT / 'palette.png')
print('wrote', ', '.join(sorted(p.name for p in OUT.iterdir())))
