"""Draws the pictures to attach to the image prompts in README.md.

  bun tools/handoff/dump.ts tools/out/sprites.json
  python -I tools/handoff/make-attachments.py tools/out/sprites.json

Writes tools/handoff/attachments/*.png: the current sprites blown up on flat
magenta, so the generator copies their grid, and the scene as a terminal shows it.
"""
import json
import shutil
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
OUT = HERE / 'attachments'
MASCOTS = Path('C:/Users/Ahmed Ibrahim/Desktop/lean-claude/clawd-mascot-animations')
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


def overlay(base, top):
    return [''.join(t if t != '.' else b for b, t in zip(bl.ljust(len(tl), '.'), tl.ljust(len(bl), '.')))
            for bl, tl in zip(base, top + [''] * (len(base) - len(top)))]


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
            elif cp != 0x20:
                d.text((x, y + 2), chr(cp), fill=rgb(f, fg), font=font)
    return im


def palette():
    names = {
        'X': 'Clawd', 'x': 'Clawd shade', 'E': 'eyes', 'W': 'bark', 'w': 'bark shade', 'o': 'log end',
        'K': 'iron', 'k': 'iron shade', 'h': 'iron highlight', 'r': 'rivet', 'P': 'pipe', 'B': 'brass',
        'c': 'coal', 'g': 'coal shine', 'p': 'paper', 'q': 'paper line', 'S': 'scarf', 's': 'scarf shade',
    }
    rows = [(n, PAL[k]) for k, n in names.items()] + [('firebox (fill)', CYAN)]
    im = Image.new('RGB', (360, 34 * len(rows) + 10), (24, 24, 24))
    d = ImageDraw.Draw(im)
    for i, (n, c) in enumerate(rows):
        d.rectangle([10, 8 + i * 34, 60, 34 + i * 34], fill=c)
        d.text((74, 12 + i * 34), f'#{c[0]:02X}{c[1]:02X}{c[2]:02X}  {n}', fill=(230, 230, 230), font=font)
    return im


OUT.mkdir(exist_ok=True)
clawd = data['clawds']['built-in']
poses = [clawd[p] for p in ['front', 'right', 'blink', 'crouch', 'up', 'warm', 'hug', 'sleep']] + [overlay(clawd['right'], data['scarf'])]
grid(poses, 3, 16, 11).save(OUT / 'clawd-poses.png')
grid([f['art'] for f in data['furnaces'].values()], 2, 16, 13, cyan_inside=True).save(OUT / 'furnaces.png')
thrown = list(data['thrown'].values())
grid([t['held'] for t in thrown] + [t['pile'] for t in thrown], 3, 9, 9).save(OUT / 'throwables.png')
scene(data['scenes']['burning']).save(OUT / 'scene-burning.png')
scene(data['scenes']['cold']).save(OUT / 'scene-cold.png')
palette().save(OUT / 'palette.png')
shutil.copy(MASCOTS / 'Clawd-Still.png', OUT / 'clawd-still.png')
print('wrote', ', '.join(sorted(p.name for p in OUT.iterdir())))
