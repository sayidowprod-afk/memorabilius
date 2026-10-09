# Convertit public/Surfquest-NoSlash.otf (CFF) en TrueType (glyf) : pdf-lib integre mal les polices CFF,
# les lecteurs PDF refusent le fichier. Sortie : public/presskit/Surfquest.ttf  (utilisee par src/lib/presskit/generate.ts)
# Usage : python scripts/presskit/otf2ttf.py     (recette fontTools "otf2ttf")
from fontTools.ttLib import TTFont, newTable
from fontTools.pens.cu2quPen import Cu2QuPen
from fontTools.pens.ttGlyphPen import TTGlyphPen

SRC = 'public/Surfquest-NoSlash.otf'
OUT = 'public/presskit/Surfquest.ttf'
MAX_ERR = 1.0
POST_FORMAT = 2.0

font = TTFont(SRC)
glyphOrder = font.getGlyphOrder()
gs = font.getGlyphSet()

glyf = newTable('glyf')
glyf.glyphOrder = glyphOrder
glyf.glyphs = {}
for name in glyphOrder:
    pen = TTGlyphPen(gs)
    gs[name].draw(Cu2QuPen(pen, MAX_ERR, reverse_direction=True))
    glyf.glyphs[name] = pen.glyph()
font['glyf'] = glyf
font['loca'] = newTable('loca')

maxp = font['maxp']
maxp.tableVersion = 0x00010000
maxp.maxZones = 1
maxp.maxTwilightPoints = 0
maxp.maxStorage = 0
maxp.maxFunctionDefs = 0
maxp.maxInstructionDefs = 0
maxp.maxStackElements = 0
maxp.maxSizeOfInstructions = 0
maxp.maxComponentElements = max(len(g.components if hasattr(g, 'components') else []) for g in glyf.glyphs.values())
maxp.maxPoints = maxp.maxContours = maxp.maxCompositePoints = maxp.maxCompositeContours = maxp.maxComponentDepth = 0

post = font['post']
post.formatType = POST_FORMAT
post.extraNames = []
post.mapping = {}
post.glyphOrder = glyphOrder

font['head'].glyphDataFormat = 0
del font['CFF ']
if 'VORG' in font:
    del font['VORG']
font.sfntVersion = '\x00\x01\x00\x00'
font.save(OUT)
t = TTFont(OUT)
print('ok', OUT, 'glyphes', len(t.getGlyphOrder()), 'avance du 0', t['hmtx'][t.getBestCmap()[ord('0')]])
