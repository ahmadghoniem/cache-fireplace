"""Cut a generated sprite sheet into frames, shrink each to a pixel grid, and write
a GIF and the frames as sprite strings the mod can draw.

  python -I tools/import-sheet.py sheet.png --cols 4 --rows 4 --width 40 \
      --gif tools/out/sheet.gif --ts hooks/sheet-frames.ts

The background is the color in the sheet's corners (the prompt asks for flat
magenta). One crop box is shared by every frame, so the animation does not jitter.
Colors snap to the mod's palette (sprites.ts) plus up to --extra colors of the
sheet's own.
"""
import argparse
import json
import re
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
SPRITES = HERE.parent / 'hooks' / 'sprites.ts'
# Characters for the sheet's own colors, after the mod's
EXTRA_CHARS = 'abcdefgijlmnpqstuvxyzACFGHIJLMNOQRSTUVYZ0123456789'


def mod_palette():
    text = SPRITES.read_text(encoding='utf-8')
    block = text.split('export const PAL', 1)[1].split('}', 1)[0]
    return {m[0]: int(m[1], 16) for m in re.findall(r"(\w):\s*0x([0-9a-fA-F]{6})", block)}


def rgb(n):
    return (n >> 16) & 255, (n >> 8) & 255, n & 255


def dist(a, b):
    # Weighted RGB distance, close enough to how eyes compare colors
    return 2 * (a[0] - b[0]) ** 2 + 4 * (a[1] - b[1]) ** 2 + 3 * (a[2] - b[2]) ** 2


def cells(sheet, cols, rows, inset):
    w, h = sheet.width / cols, sheet.height / rows
    out = []
    for r in range(rows):
        for c in range(cols):
            box = (round(c * w + inset), round(r * h + inset), round((c + 1) * w - inset), round((r + 1) * h - inset))
            out.append(sheet.crop(box))
    return out


def background(sheet):
    px = sheet.load()
    corners = [px[0, 0], px[sheet.width - 1, 0], px[0, sheet.height - 1], px[sheet.width - 1, sheet.height - 1]]
    return max(set(corners), key=corners.count)


def mask(frame, bg, tol):
    """True where the frame is not background."""
    px = frame.load()
    return [[dist(px[x, y], bg) > tol for x in range(frame.width)] for y in range(frame.height)]


def bbox(masks):
    xs, ys = [], []
    for m in masks:
        for y, row in enumerate(m):
            for x, on in enumerate(row):
                if on:
                    xs.append(x)
                    ys.append(y)
    if not xs:
        raise SystemExit('every frame is background: check --cols/--rows and --tol')
    return min(xs), min(ys), max(xs) + 1, max(ys) + 1


def shrink(frame, m, box, gw, gh):
    """Each grid pixel takes the most common foreground color of its block, or none."""
    x0, y0, x1, y1 = box
    px = frame.load()
    out = []
    for gy in range(gh):
        row = []
        for gx in range(gw):
            bx0 = x0 + (x1 - x0) * gx / gw
            bx1 = x0 + (x1 - x0) * (gx + 1) / gw
            by0 = y0 + (y1 - y0) * gy / gh
            by1 = y0 + (y1 - y0) * (gy + 1) / gh
            # Sample the middle of the block: edges carry the generator's soft seams
            counts, total = {}, 0
            for y in range(int(by0 + (by1 - by0) * 0.2), max(int(by0 + (by1 - by0) * 0.2) + 1, int(by1 - (by1 - by0) * 0.2))):
                for x in range(int(bx0 + (bx1 - bx0) * 0.2), max(int(bx0 + (bx1 - bx0) * 0.2) + 1, int(bx1 - (bx1 - bx0) * 0.2))):
                    total += 1
                    if m[y][x]:
                        c = tuple(v // 8 * 8 for v in px[x, y])
                        counts[c] = counts.get(c, 0) + 1
            fg = sum(counts.values())
            row.append(max(counts, key=counts.get) if fg * 2 > total else None)
        out.append(row)
    return out


def choose_extra(grids, pal, n, tol):
    """The sheet's most used colors that no palette color is close to."""
    counts = {}
    for g in grids:
        for row in g:
            for c in row:
                if c is not None and min(dist(c, p) for p in pal.values()) > tol:
                    counts[c] = counts.get(c, 0) + 1
    picked = []
    for c, _ in sorted(counts.items(), key=lambda kv: -kv[1]):
        if len(picked) >= n:
            break
        if all(dist(c, p) > tol for p in picked):
            picked.append(c)
    return picked


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('sheet')
    ap.add_argument('--cols', type=int, required=True)
    ap.add_argument('--rows', type=int, required=True)
    ap.add_argument('--frames', type=int, help='how many cells hold frames (default: all)')
    ap.add_argument('--width', type=int, required=True, help='pixels wide after shrinking')
    ap.add_argument('--height', type=int, help='pixels tall (default: keeps the aspect)')
    ap.add_argument('--inset', type=int, default=4, help='pixels cut from each cell edge, past grid lines')
    ap.add_argument('--tol', type=int, default=6000, help='how far from the background a pixel must be')
    ap.add_argument('--extra', type=int, default=8, help='colors of the sheet kept beside the palette')
    ap.add_argument('--ms', type=int, default=125, help='frame time of the GIF')
    ap.add_argument('--scale', type=int, default=10, help='GIF pixel size')
    ap.add_argument('--gif')
    ap.add_argument('--ts', help='TypeScript file of sprite strings')
    ap.add_argument('--name', default='SHEET', help='export name in the TypeScript file')
    a = ap.parse_args()

    sheet = Image.open(a.sheet).convert('RGB')
    bg = background(sheet)
    frames = cells(sheet, a.cols, a.rows, a.inset)[: a.frames or a.cols * a.rows]
    masks = [mask(f, bg, a.tol) for f in frames]
    box = bbox(masks)
    gw = a.width
    gh = a.height or max(1, round(gw * (box[3] - box[1]) / (box[2] - box[0])))
    grids = [shrink(f, m, box, gw, gh) for f, m in zip(frames, masks)]

    pal = {k: rgb(v) for k, v in mod_palette().items()}
    extra = choose_extra(grids, pal, a.extra, 2500)
    for ch, c in zip(EXTRA_CHARS, extra):
        pal[ch] = c

    def char(c):
        return '.' if c is None else min(pal, key=lambda k: dist(pal[k], c))

    art = [[''.join(char(c) for c in row) for row in g] for g in grids]
    used = sorted({ch for frame in art for row in frame for ch in row} - {'.'})
    print(f'{len(art)} frames, {gw}x{gh} pixels, background #{bg[0]:02x}{bg[1]:02x}{bg[2]:02x}, colors {"".join(used)}')

    if a.ts:
        own = {ch: c for ch, c in pal.items() if ch in used and ch in EXTRA_CHARS}
        lines = [f'// Written by tools/import-sheet.py from {Path(a.sheet).name}; run it again rather than editing', '']
        if own:
            lines.append(f'// Colors of the sheet beside PAL: merge into PAL in sprites.ts')
            lines.append(f'export const {a.name}_PAL: Record<string, number> = {{')
            lines += [f"  {ch}: 0x{c[0]:02x}{c[1]:02x}{c[2]:02x}," for ch, c in own.items()]
            lines += ['}', '']
        lines.append(f'export const {a.name}: string[][] = [')
        for frame in art:
            lines.append('  [')
            lines += [f'    {json.dumps(row)},' for row in frame]
            lines.append('  ],')
        lines.append(']')
        Path(a.ts).write_text('\n'.join(lines) + '\n', encoding='utf-8')
        print('wrote', a.ts)

    if a.gif:
        dark = (12, 12, 12)
        images = []
        for frame in art:
            im = Image.new('RGB', (gw, gh), dark)
            px = im.load()
            for y, row in enumerate(frame):
                for x, ch in enumerate(row):
                    if ch != '.':
                        px[x, y] = pal[ch]
            images.append(im.resize((gw * a.scale, gh * a.scale), Image.NEAREST))
        images[0].save(a.gif, save_all=True, append_images=images[1:], duration=a.ms, loop=0)
        print('wrote', a.gif)


if __name__ == '__main__':
    main()
