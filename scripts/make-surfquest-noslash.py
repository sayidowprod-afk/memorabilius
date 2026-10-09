# Fabrique public/Surfquest-NoSlash.otf : le chiffre 0 (barre) est remplace par le dessin de la lettre O,
# mis a l'echelle pour avoir EXACTEMENT la hauteur des autres chiffres. Usage : python scripts/make-surfquest-noslash.py
from fontTools.ttLib import TTFont
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.t2CharStringPen import T2CharStringPen

SRC = 'public/Surfquest-3zVXL.otf'
OUT = 'public/Surfquest-NoSlash.otf'

font = TTFont(SRC)
gs = font.getGlyphSet()
cmap = font.getBestCmap()
g0, gO = cmap[ord('0')], cmap[ord('O')]

def bounds(name):
    bp = BoundsPen(gs)
    gs[name].draw(bp)
    return bp.bounds  # (xMin, yMin, xMax, yMax)

b0, bO = bounds(g0), bounds(gO)
# hauteur de reference : celle des chiffres (on prend la moyenne des chiffres 1-9 pour ne pas dependre du 0 barre)
hs = [bounds(cmap[ord(str(d))]) for d in range(1, 10)]
digit_ymin = sum(b[1] for b in hs) / len(hs)
digit_ymax = sum(b[3] for b in hs) / len(hs)
sy = (digit_ymax - digit_ymin) / (bO[3] - bO[1])
sx = sy  # meme echelle : on garde les proportions du O
tx = -bO[0] * sx + (b0[0])          # aligne le bord gauche sur celui du 0 d'origine
ty = digit_ymin - bO[1] * sy
adv_O = font['hmtx'][gO][0]
adv = round(adv_O * sx)

pen = T2CharStringPen(adv, gs)
gs[gO].draw(TransformPen(pen, (sx, 0, 0, sy, tx, ty)))
new_cs = pen.getCharString()

cff = font['CFF '].cff[0]
old_cs = cff.CharStrings[g0]
new_cs.private = old_cs.private
new_cs.globalSubrs = old_cs.globalSubrs
cff.CharStrings[g0] = new_cs
font['hmtx'][g0] = (adv, round(b0[0]))
font.save(OUT)

chk = TTFont(OUT)
cs = chk.getGlyphSet()
bp = BoundsPen(cs); cs[g0].draw(bp)
print('0 original', b0, '-> nouveau', bp.bounds, '| chiffres 1-9 : yMin', round(digit_ymin), 'yMax', round(digit_ymax), '| avance', adv)
