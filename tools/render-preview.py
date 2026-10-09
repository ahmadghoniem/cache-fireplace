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
SHADE = {0x2591: 0.25, 0x2592: 0.5, 0x2593: 0.75}
def rgb(c, dflt):
    return dflt if c & 0x01000000 else ((c >> 16) & 255, (c >> 8) & 255, c & 255)
frames = []
for f in data['frames']:
    im = Image.new('RGB', (cols * CW + 16, rows * CH + 34), BG)
    d = ImageDraw.Draw(im)
    d.text((8, 4), f['title'], fill=(140, 135, 128), font=font)
    c = f['cells']
    for r in range(rows):
        for k in range(cols):
            cp, fg, bg = c[(r * cols + k) * 3: (r * cols + k) * 3 + 3]
            x, y = 8 + k * CW, 26 + r * CH
            fgc, bgc = rgb(fg, FG), rgb(bg, BG)
            d.rectangle([x, y, x + CW - 1, y + CH - 1], fill=bgc)
            if cp == 0x2580: d.rectangle([x, y, x + CW - 1, y + CH // 2 - 1], fill=fgc)
            elif cp == 0x2584: d.rectangle([x, y + CH // 2, x + CW - 1, y + CH - 1], fill=fgc)
            elif cp == 0x2588: d.rectangle([x, y, x + CW - 1, y + CH - 1], fill=fgc)
            elif cp in SHADE:
                p = SHADE[cp]
                for yy in range(CH):
                    for xx in range(CW):
                        if ((xx * 7 + yy * 13) % 16) / 16 < p: im.putpixel((x + xx, y + yy), fgc)
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
