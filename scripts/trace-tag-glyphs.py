# Vectorise les icones /public/tags/*.png (silhouettes noires, decoupes transparentes)
# en chemins SVG -> src/lib/tagGlyphs.ts. Usage: python scripts/trace-tag-glyphs.py
import json, numpy as np, potrace
from PIL import Image
OUT = {}
for name in ['rc', 'auto', 'patch', 'num']:
    im = Image.open(f'public/tags/{name}.png').convert('RGBA')
    im = im.crop(im.getbbox())
    w, h = im.size
    s = 700 / max(w, h)
    im = im.resize((round(w * s), round(h * s)), Image.LANCZOS)
    W, H = im.size
    a = np.array(im.split()[3]) > 127
    bm = potrace.Bitmap(a)
    plist = bm.trace(turdsize=6, alphamax=1.0, opticurve=True, opttolerance=0.4)
    d = []
    f = lambda p: f'{p.x:.1f} {p.y:.1f}'
    for curve in plist:
        d.append('M' + f(curve.start_point))
        for seg in curve.segments:
            if seg.is_corner:
                d.append('L' + f(seg.c) + 'L' + f(seg.end_point))
            else:
                d.append('C' + f(seg.c1) + ' ' + f(seg.c2) + ' ' + f(seg.end_point))
        d.append('Z')
    OUT[name] = {'w': W, 'h': H, 'd': ''.join(d)}
    print(name, W, H, len(OUT[name]['d']))
ts = '// Genere par scripts/trace-tag-glyphs.py -- ne pas editer a la main.\n'
ts += 'export const TAG_GLYPHS: Record<"rc" | "auto" | "patch" | "num", { w: number; h: number; d: string }> = ' + json.dumps(OUT) + '\n'
open('src/lib/tagGlyphs.ts', 'w', encoding='utf-8').write(ts)
