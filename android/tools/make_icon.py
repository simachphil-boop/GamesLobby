"""Generates the BOARDVERSE launcher icon (original artwork: gold die + board ring on deep purple)."""
from PIL import Image, ImageDraw, ImageFilter
import sys
S = 768
img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
bg = Image.new("RGBA", (S, S))
px = bg.load()
for y in range(S):
    for x in range(S):
        t = (x + y) / (2 * S)
        r = int(18 + 60 * t); g = int(16 + 10 * t); b = int(60 + 90 * t)
        px[x, y] = (r, g, b, 255)
mask = Image.new("L", (S, S), 0)
ImageDraw.Draw(mask).rounded_rectangle([0, 0, S - 1, S - 1], radius=170, fill=255)
img.paste(bg, (0, 0), mask)
d = ImageDraw.Draw(img)
# glow ring (board)
glow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
gd = ImageDraw.Draw(glow)
gd.ellipse([110, 110, S - 110, S - 110], outline=(120, 190, 255, 200), width=34)
glow = glow.filter(ImageFilter.GaussianBlur(18))
img.alpha_composite(glow)
d.ellipse([120, 120, S - 120, S - 120], outline=(150, 210, 255, 255), width=14)
# gold die
die = [214, 214, S - 214, S - 214]
shadow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
ImageDraw.Draw(shadow).rounded_rectangle([die[0] + 14, die[1] + 24, die[2] + 14, die[3] + 24], radius=70, fill=(0, 0, 0, 150))
img.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(16)))
gold = Image.new("RGBA", (S, S))
gp = gold.load()
for y in range(S):
    for x in range(S):
        t = (y - die[1]) / (die[3] - die[1])
        t = max(0, min(1, t))
        gp[x, y] = (int(255 - 40 * t), int(222 - 80 * t), int(120 - 90 * t), 255)
dm = Image.new("L", (S, S), 0)
ImageDraw.Draw(dm).rounded_rectangle(die, radius=70, fill=255)
img.paste(gold, (0, 0), dm)
d = ImageDraw.Draw(img)
d.rounded_rectangle([die[0] + 16, die[1] + 12, die[2] - 16, die[1] + 60], radius=24, fill=(255, 245, 210, 90))
cx = (die[0] + die[2]) // 2; q = (die[2] - die[0]) // 4
for (dx, dy) in [(-1, -1), (1, 1), (0, 0), (1, -1), (-1, 1)]:
    x, y = cx + dx * q, cx + dy * q
    d.ellipse([x - 30, y - 30, x + 30, y + 30], fill=(40, 22, 90, 255))
img = img.resize((192, 192), Image.LANCZOS)
img.save(sys.argv[1])
img.resize((512, 512), Image.LANCZOS)
