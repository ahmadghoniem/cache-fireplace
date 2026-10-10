# Draws frames.json the way a dark terminal would, as a GIF.
# Run: python tools/render-preview.py out/frames.json out/preview.gif [--light]
import json, sys
from PIL import Image, ImageDraw, ImageFont
src, dst = sys.argv[1], sys.argv[2]
light = '--light' in sys.argv
data = json.load(open(src))
cols, rows = data['cols'], data['rows']
CW, CH = 9, 18
BG = (250, 249, 245) if light else (12, 12, 12)
FG = (40, 40, 40) if light else (220, 220, 220)
font = ImageFont.truetype('C:/Windows/Fonts/consola.ttf', 15)
# Braille dots on a 2 x 4 grid; bit i is dot i + 1
DOTS = [(0, 0), (0, 1), (0, 2), (1, 0), (1, 1), (1, 2), (0, 3), (1, 3)]
def rgb(c, dflt):
    return dflt if c & 0x01000000 else ((c >> 16) & 255, (c >> 8) & 255, c & 255)
frames = []
for f in data['frames']:
    im = Image.new('RGB', (cols * CW + 16, rows * CH + 34), BG)
    d = ImageDraw.Draw(im)
    d.text((8, 4), f['title'], fill=(140, 135, 128), font=font)
    c = f['cells']
    fc, fr = f.get('cols', cols), f.get('rows', rows)
    for r in range(fr):
        for k in range(fc):
            cp, fg, bg = c[(r * fc + k) * 3: (r * fc + k) * 3 + 3]
            x, y = 8 + k * CW, 26 + r * CH
            fgc, bgc = rgb(fg, FG), rgb(bg, BG)
            d.rectangle([x, y, x + CW - 1, y + CH - 1], fill=bgc)
            if cp == 0x2580: d.rectangle([x, y, x + CW - 1, y + CH // 2 - 1], fill=fgc)
            elif cp == 0x2584: d.rectangle([x, y + CH // 2, x + CW - 1, y + CH - 1], fill=fgc)
            elif cp == 0x2588: d.rectangle([x, y, x + CW - 1, y + CH - 1], fill=fgc)
            elif 0x2591 <= cp <= 0x2593:
                for j in range(8):
                    for i in range(4):
                        on = (i + 2 * j) % 4 == 0 if cp == 0x2591 else (i + j) % 2 == 0 if cp == 0x2592 else (i + 2 * j) % 4 != 0
                        if on: d.rectangle([x + i * CW / 4, y + j * CH / 8, x + (i + 1) * CW / 4 - 1, y + (j + 1) * CH / 8 - 1], fill=fgc)
            # Eighth-cell edges: the mortar lines
            elif cp == 0x2594: d.rectangle([x, y, x + CW - 1, y + CH / 8 - 1], fill=fgc)
            elif cp == 0x2581: d.rectangle([x, y + CH - CH / 8, x + CW - 1, y + CH - 1], fill=fgc)
            elif cp == 0x258f: d.rectangle([x, y, x + CW / 8 - 1, y + CH - 1], fill=fgc)
            elif cp == 0x2595: d.rectangle([x + CW - CW / 8, y, x + CW - 1, y + CH - 1], fill=fgc)
            elif cp == 0x2500: d.line([x, y + CH // 2, x + CW - 1, y + CH // 2], fill=fgc, width=2)
            elif cp == 0x2572: d.line([x, y, x + CW - 1, y + CH - 1], fill=fgc, width=2)
            elif 0x2800 <= cp <= 0x28ff:
                for bit, (i, j) in enumerate(DOTS):
                    if (cp - 0x2800) >> bit & 1:
                        cx, cy = x + CW * (0.3 + 0.4 * i), y + CH * (0.17 + 0.22 * j)
                        d.ellipse([cx - 1.2, cy - 1.2, cx + 1.2, cy + 1.2], fill=fgc)
            elif cp != 0x20:
                d.text((x, y + 1), chr(cp), fill=fgc, font=font)
    frames.append(im)
frames[0].save(dst, save_all=True, append_images=frames[1:], duration=data['step'], loop=0)
# A contact sheet of every 4th frame, for a quick look
sheet = frames[::4]
cols_n = 4
w, h = sheet[0].size
S = Image.new('RGB', (w * cols_n, h * ((len(sheet) + cols_n - 1) // cols_n)), BG)
for i, fr in enumerate(sheet): S.paste(fr, ((i % cols_n) * w, (i // cols_n) * h))
S.save(dst.rsplit('.', 1)[0] + '-sheet.png')
