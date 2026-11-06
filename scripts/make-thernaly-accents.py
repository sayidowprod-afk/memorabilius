# Fabrique public/Thernaly.ttf à partir de la police d'origine (GGBotNet, licence SIL OFL 1.1) : corrige les lettres accentuées.
# Dans l'original, une capitale accentuée (É, È, À, Ç caron...) a son corps RACCOURCI (768 au lieu de 896) pour que l'accent tienne dans la même hauteur :
# le É paraît plus petit que les lettres voisines. Ici, chaque lettre retrouve le corps COMPLET de sa lettre de base et l'accent est posé au-dessus
# (accent d'origine, simplement décalé vers le haut). Les marges de ligne (ascender) sont relevées pour que l'accent ne soit pas rogné.
# Usage : python scripts/make-thernaly-accents.py [source] [sortie]
import sys
import unicodedata
from fontTools.ttLib import TTFont
from fontTools.ttLib.tables import ttProgram
from fontTools.ttLib.tables._g_l_y_f import Glyph, GlyphCoordinates

SRC = sys.argv[1] if len(sys.argv) > 1 else 'public/_fonts/thernaly.regular.otf'
OUT = sys.argv[2] if len(sys.argv) > 2 else 'public/Thernaly.ttf'

font = TTFont(SRC)
glyf, cmap, hmtx = font['glyf'], font.getBestCmap(), font['hmtx']


def contours(name):
    """Liste de contours : (points [(x, y)], drapeaux 'sur la courbe') ; vide pour un glyphe composite."""
    g = glyf[name]
    if g.isComposite() or g.numberOfContours <= 0:
        return []
    coords, ends, flags = g.getCoordinates(glyf)
    out, start = [], 0
    for e in ends:
        out.append(([tuple(p) for p in coords[start:e + 1]], [f & 1 for f in flags[start:e + 1]]))
        start = e + 1
    return out


def ymin(c): return min(p[1] for p in c[0])
def ymax(c): return max(p[1] for p in c[0])


CAP = 896       # hauteur des capitales de Thernaly
fixed, skipped = [], []
done = set()
for cp, gname in sorted(cmap.items()):
    if gname in done:
        continue
    done.add(gname)
    parts = unicodedata.normalize('NFD', chr(cp))
    if len(parts) < 2:
        continue  # pas de lettre accentuée
    base_ch = parts[0]
    if ord(base_ch) not in cmap:
        continue
    cs = contours(gname)
    if len(cs) < 2:
        continue
    accents = [c for c in cs if ymin(c) >= 800]          # contours posés tout en haut de la case
    body = [c for c in cs if ymin(c) < 800]
    if not accents or not body or max(ymax(c) for c in body) != 768:
        continue  # glyphe qui n'est pas du type « corps raccourci + accent » (cédille en bas, etc.)
    base_cs = contours(cmap[ord(base_ch)])
    if not base_cs or max(ymax(c) for c in base_cs) != CAP:
        skipped.append(gname)
        continue
    dy = CAP - 768                                        # le corps remonte de 128 : l'accent suit
    adv = hmtx[gname][0]
    coords, flags, ends = GlyphCoordinates(), bytearray(), []
    for pts, fl in base_cs + [([(x, y + dy) for x, y in c[0]], c[1]) for c in accents]:
        for (x, y), on in zip(pts, fl):
            coords.append((x, y)); flags.append(on)
        ends.append(len(coords) - 1)
    g = Glyph()
    g.coordinates, g.flags, g.endPtsOfContours, g.numberOfContours = coords, flags, ends, len(ends)
    g.program = ttProgram.Program(); g.program.fromBytecode(b'')
    glyf[gname] = g
    g.recalcBounds(glyf)
    hmtx[gname] = (adv, g.xMin)
    fixed.append(gname)

# accents jusqu'à 896 + 128 = 1024 : on relève l'ascender pour qu'ils ne soient pas rognés (la descente ne change pas)
TOP = 1024
font['hhea'].ascent = TOP
font['OS/2'].sTypoAscender = TOP
font['OS/2'].usWinAscent = TOP
font.save(OUT)
print(len(fixed), 'glyphes corrigés ;', len(skipped), 'ignorés', skipped[:8], '-> ', OUT)
