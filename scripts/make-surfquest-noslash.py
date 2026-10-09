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
# Le O reprend EXACTEMENT la boite et l'avance du 0 barre d'origine : meme taille, meme position,
# memes espacements que les autres chiffres (echelle x et y calculees separement).
sx = (b0[2] - b0[0]) / (bO[2] - bO[0])
sy = (b0[3] - b0[1]) / (bO[3] - bO[1])
tx = b0[0] - bO[0] * sx
ty = b0[1] - bO[1] * sy
adv = font['hmtx'][g0][0]
print('echelle x', round(sx, 3), 'y', round(sy, 3), '| avance du 0 d origine', adv)

pen = T2CharStringPen(None, gs)   # pas de largeur explicite : le glyphe prend defaultWidthX (339), comme le 0 d'origine
gs[gO].draw(TransformPen(pen, (sx, 0, 0, sy, tx, ty)))
cff = font['CFF '].cff[0]
old_cs = cff.CharStrings[g0]
# private requis : la largeur est codee par rapport a nominalWidthX / defaultWidthX du dictionnaire prive
new_cs = pen.getCharString(private=old_cs.private, globalSubrs=old_cs.globalSubrs)
new_cs.private = old_cs.private
new_cs.globalSubrs = old_cs.globalSubrs
cff.CharStrings[g0] = new_cs
font['hmtx'][g0] = (adv, round(b0[0]))
font.save(OUT)

chk = TTFont(OUT)
cs = chk.getGlyphSet()
bp = BoundsPen(cs); cs[g0].draw(bp)
print('0 original', b0, '-> nouveau', bp.bounds, '| avance', adv)
