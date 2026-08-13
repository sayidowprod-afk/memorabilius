#!/usr/bin/env python3
"""
Compare Gemini 2.5 Flash vs Flash-Lite sur une carte locale.
Usage:
  set GEMINI_API_KEY=ta_cle
  python scripts/test_flashlite.py
  python scripts/test_flashlite.py chemin\recto.jpg chemin\verso.jpg
"""
from __future__ import annotations
import base64, io, json, os, re, sys, time
from PIL import Image
import urllib.request, urllib.error

API_KEY = os.environ.get('GEMINI_API_KEY', '')
if not API_KEY:
    print('❌  GEMINI_API_KEY non définie. Lance: set GEMINI_API_KEY=ta_cle')
    sys.exit(1)

RECTO = sys.argv[1] if len(sys.argv) > 1 else r'C:\Users\killi\Pictures\ControlCenter4\Cards_Final\fini\34r.jpg'
VERSO = sys.argv[2] if len(sys.argv) > 2 else r'C:\Users\killi\Pictures\ControlCenter4\Cards_Final\fini\34v.jpg'

MODEL = 'gemini-2.5-flash'

PROMPT_OLD = """Tu es un expert mondial en cartes de collection sportives (NBA, NFL, MLB, NHL, soccer, WNBA) et TCG (Pokémon, Magic, Yu-Gi-Oh, One Piece, Dragon Ball, etc.).
Réponds UNIQUEMENT avec un objet JSON valide, sans markdown ni explication.

{
  "nom": "Joueur/personnage. Multi-joueurs: séparés par ' / '. Carte équipe: nom de l'équipe.",
  "equipe": "Sports US: ville+surnom (ex: Los Angeles Lakers). Soccer: club (ex: Real Madrid). World Cup: nation. Vide si TCG.",
  "annee": "Année ou saison (ex: 2023-24, 2023)",
  "marque": "Fabricant (ex: Panini, Topps, Upper Deck, Leaf, Sage, Pokémon, Konami, Bandai)",
  "collection": "SET sans la marque (ex: Prizm, Chrome, Mosaic, Optic, Select)",
  "variation": "Parallèle ou variante EXACTE. Vide si base standard.",
  "num": "Tirage sériel imprimé: '/Y' ou 'X/Y' (ex: '48/99', '/10', '1/1'). Vide sinon.",
  "card_number": "Numéro set au verso, sans '#' (ex: '48', 'HTR-IFS'). Vide si absent.",
  "grade": "Raw",
  "rc": false,
  "auto": false,
  "patch": false
}

═══ SLABS ═══
Slab PSA/BGS/CGC/SGC/HGA : étiquette = SOURCE PRIORITAIRE. Copie nom, année, collection, variation, num EXACTEMENT de l'étiquette.
grade: "PSA 10" / "BGS 9.5" / "CGC 9" / "SGC 10" / "HGA 10" (note exacte). Illisible → "PSA ?" etc.
"AUTO"→auto=true | "PATCH"/"RELIC"→patch=true | "RC"→rc=true

═══ VARIATIONS ═══

▸ PANINI (Prizm, Optic, Mosaic, Select, Hoops, Donruss, Contenders, Chronicles, Flux, Origins, Court Kings, Revolution, Noir, Obsidian, Encased…)
Nom = EFFET/COULEUR + SET. Ex: "Silver Prizm", "Holo Hoops", "Blue Mosaic".
Base→"" | Holo argenté→"Silver/Holo [Set]" | Couleur unie→"[Couleur] [Set]" | Gold /10→"Gold [Set]" | Black /1→"Black [Set]" | Gold Vinyl/Logoman /1→noter tel quel
Effets: Cracked Ice | Disco | Fast Break | Mojo | Hyper | Laser | Velocity | Shock | Neon→"Neon [Couleur] [Set]"
INSERTS: nom IMPRIMÉ sur la carte → lire EN PRIORITÉ. Combinaison possible: "Bang! Silver Prizm".
SELECT: niveaux Concourse/Field Level/Premier Level ≠ variation.
PREMIUM (Immaculate/NT/Noir/Obsidian/Flawless): texte imprimé priorité absolue.

▸ TOPPS/BOWMAN
Base→"" | Refractor (miroir irisé)→"Refractor"
1st Bowman (logo "1st")→rc=true, variation=""

▸ UPPER DECK: Young Guns→rc=true variation="Young Guns" | SP Authentic Future Watch→rc=true

▸ SOCCER: equipe=CLUB (ex: Real Madrid) | World Cup→equipe=NATION (ex: France)

▸ POKÉMON/TCG
VMAX/VSTAR/V/ex/GX/EX/LV.X→variation · raretés (Holo Rare, Full Art, Alt Art…)→variation

═══ RÈGLES ═══
VARIATION: 1.Texte imprimé 2.Étiquette slab 3.Tirage (/10=Gold, /1=Black/SuperFractor) 4.Visuel 5.Standard→""
ANNÉE: verso d'abord (copyright, saison, logo set) puis recto. Slab→étiquette.
MARQUE vs COLLECTION: "Panini Prizm"→marque=Panini, collection=Prizm
rc: logo RC (étoile jaune), "Rookie Card"/"RC"/"Young Guns"/"1st Bowman", ou "Rookie" dans l'insert
auto: signature manuscrite ou "Autograph"/"Auto" imprimé (sticker inclus)
patch: fenêtre tissu/jersey. Manufactured patch (estampé)→false
num ≠ card_number: num=tirage limité, card_number=numéro catalogue au verso
SI VERSO: image 1=recto, image 2=verso. Verso AUTORITÉ: collection, variation, num, rc, auto, patch, année."""

PROMPT_NEW = """Tu es un expert en cartes de collection sportives et TCG. Réponds UNIQUEMENT avec un objet JSON valide, sans markdown.

{
  "nom": "Joueur/personnage. Multi: séparés par ' / '. Carte équipe: nom équipe.",
  "equipe": "Sports US: ville+surnom (ex: Los Angeles Lakers). Soccer: club. World Cup: nation. Vide si TCG.",
  "annee": "Année ou saison (ex: 2023-24). Lis sur la carte.",
  "marque": "Fabricant (ex: Panini, Topps, Upper Deck, Pokémon, Konami)",
  "collection": "Set sans la marque (ex: Prizm, Chrome, Mosaic, Select)",
  "variation": "Parallèle/variante EXACTE imprimée. Vide si base standard.",
  "num": "Tirage sériel imprimé: '/Y' ou 'X/Y'. Vide sinon.",
  "card_number": "Numéro au verso, sans '#'. Vide si absent.",
  "grade": "Raw",
  "rc": false,
  "auto": false,
  "patch": false
}

═══ SLABS (PSA/BGS/CGC/SGC/HGA) ═══
Étiquette = SOURCE PRIORITAIRE. Copie nom, année, collection, variation, num EXACTEMENT de l'étiquette.
grade: "PSA 10" / "BGS 9.5" / "CGC 9" / "SGC 10" / "HGA 10". Illisible → "PSA ?" etc.
AUTO→auto=true | PATCH/RELIC→patch=true | RC→rc=true

═══ VARIATIONS ═══
PRIORITÉ: 1.Texte imprimé 2.Étiquette slab 3.Tirage inferré 4.Visuel 5.Base→""

PANINI: variation = EFFET/COULEUR + SET. Ex: "Silver Prizm", "Holo Hoops", "Blue Mosaic", "Cracked Ice Select".
/10 non imprimé→"Gold [Set]" | /1→"Black [Set]" (ou "Gold Vinyl/Logoman" si applicable).
Inserts: lire NOM IMPRIMÉ en priorité (ex: "Bang!", "Stained Glass", "Kaboom"). Combo: "Bang! Silver Prizm".
Select: niveaux Concourse/Field Level/Premier Level ≠ variation (ne pas inclure dans variation).
Premium (Immaculate/NT/Noir/Obsidian/Flawless): texte imprimé priorité absolue, sinon ta connaissance du set.

TOPPS/BOWMAN: Refractor (miroir irisé)→"Refractor". 1st Bowman→rc=true, variation="".
UPPER DECK: Young Guns→rc=true, variation="Young Guns". SP Authentic Future Watch→rc=true.
SOCCER: equipe=CLUB (ex: Real Madrid) ou NATION si World Cup (ex: France). Mêmes règles parallèles que NBA.
POKÉMON/TCG: VMAX/VSTAR/V/ex/GX/EX→inclure dans variation. Rareté (Holo Rare, Full Art, Alt Art…)→variation.

═══ RÈGLES ═══
MARQUE vs COLLECTION: "Panini Prizm"→marque=Panini, collection=Prizm.
ANNÉE: verso d'abord (copyright, logo set). Slab→étiquette. Set connu→ta connaissance. Impossible→"".
rc: logo RC (étoile jaune), "Rookie Card"/"RC"/"Young Guns"/"1st Bowman", ou "Rookie" dans l'insert.
auto: signature manuscrite ou "Autograph"/"Auto" imprimé (sticker inclus).
patch: fenêtre tissu/jersey encapsulée. Manufactured patch (estampé en plastique)→false.
num ≠ card_number: num=tirage limité imprimé, card_number=numéro catalogue au verso.
Image: à l'envers→lire normalement | sleeve/toploader→lire à travers | slab→étiquette d'abord | plusieurs cartes→la plus centrale.
SI VERSO: image 1=recto, image 2=verso. Verso AUTORITÉ: collection, variation, num, rc, auto, patch, année."""

PROMPTS = [('Prompt ANCIEN', PROMPT_OLD), ('Prompt NOUVEAU', PROMPT_NEW)]


def compress(path: str) -> str:
    img = Image.open(path).convert('RGB')
    img.thumbnail((700, 700), Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, 'JPEG', quality=85)
    return base64.b64encode(buf.getvalue()).decode()


def call(model: str, prompt: str, recto_b64: str, verso_b64: str | None) -> tuple[dict | None, str]:
    url = f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={API_KEY}'
    parts: list = [{'text': prompt},
                   {'inline_data': {'mime_type': 'image/jpeg', 'data': recto_b64}}]
    if verso_b64:
        parts.append({'inline_data': {'mime_type': 'image/jpeg', 'data': verso_b64}})

    body = json.dumps({
        'contents': [{'parts': parts}],
        'generationConfig': {'temperature': 0, 'maxOutputTokens': 800, 'thinkingConfig': {'thinkingBudget': 0}},
    }).encode()

    req = urllib.request.Request(url, data=body, headers={'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            data = json.loads(r.read())
    except urllib.error.HTTPError as e:
        return None, f'HTTP {e.code}: {e.read().decode()[:200]}'

    raw_parts = data.get('candidates', [{}])[0].get('content', {}).get('parts', [])
    text = ''.join(p.get('text', '') for p in raw_parts if not p.get('thought'))
    m = re.search(r'\{[\s\S]*\}', text)
    if m:
        try:
            return json.loads(m.group()), ''
        except Exception:
            pass
    return None, f'parse_error: {text[:300]}'


# ── Préparer les images ──────────────────────────────────────────────────────
print('Compression...')
recto_b64 = compress(RECTO)
print(f'  recto : {len(recto_b64)//1024} KB')
verso_b64 = None
try:
    verso_b64 = compress(VERSO)
    print(f'  verso : {len(verso_b64)//1024} KB')
except FileNotFoundError:
    print('  verso : absent')

# ── Tester chaque prompt ─────────────────────────────────────────────────────
results = {}
for label, prompt in PROMPTS:
    print(f'\n{"─"*55}')
    print(f'  {label}')
    t0 = time.time()
    card, err = call(MODEL, prompt, recto_b64, verso_b64)
    elapsed = time.time() - t0
    if card:
        print(f'  ✓  {elapsed:.1f}s')
        print(json.dumps(card, indent=4, ensure_ascii=False))
        results[label] = card
    else:
        print(f'  ✗  {elapsed:.1f}s  →  {err}')
        results[label] = None

# ── Comparaison champ par champ ──────────────────────────────────────────────
vals = [v for v in results.values() if v]
if len(vals) == 2:
    print(f'\n{"═"*55}')
    print('  DIFF ancien vs nouveau prompt')
    print(f'{"═"*55}')
    a, b = vals
    fields = ['nom', 'equipe', 'annee', 'marque', 'collection', 'variation',
              'num', 'card_number', 'rc', 'auto', 'patch']
    for f in fields:
        va, vb = a.get(f, ''), b.get(f, '')
        eq = '✓' if str(va).lower() == str(vb).lower() else '✗'
        print(f'  {eq}  {f:15s}  ancien={str(va)!r:25s}  nouveau={str(vb)!r}')
