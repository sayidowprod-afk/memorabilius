"""
Carte mystère : choisit les meilleures cartes à proposer et fabrique les visuels.

    python scripts/carte_mystere.py                      # liste les 8 meilleures candidates (images dans docs/rdv/candidats/)
    python scripts/carte_mystere.py apercu 3             # carte quadrillée pour repérer les coordonnées du zoom
    python scripts/carte_mystere.py choisir 3            # retient la n° 3 (le joueur ne sera plus proposé)
    python scripts/carte_mystere.py fabriquer 3 --niveau moyen
                                                         # fabrique la story + le post X ; niveaux : facile (portrait), moyen (visage), difficile (yeux)
                                                         # ou --zoom x0,y0,x1,y1 (fractions de la carte) pour cadrer à la main
                                                         # affiche aussi 4 réponses pour le sticker quiz d'Instagram

Règles de sélection (les autos d'abord) :
    auto : +100    patch : +60    tirage : 1/1 +100, /10 +80, /25 +60, /49 +45, /99 +30, /199 +15
Un seul exemplaire par joueur dans la liste, et jamais un joueur déjà retenu (docs/rdv/mystere-historique.json).
Lecture seule sur la base. Les accès viennent de .env.local (jamais affichés).
"""
import importlib.util, json, os, random, re, sys, unicodedata, urllib.request

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RDV = os.path.join(ROOT, 'docs', 'rdv')
CAND_DIR = os.path.join(RDV, 'candidats')
HIST = os.path.join(RDV, 'mystere-historique.json')
CAND_JSON = os.path.join(CAND_DIR, 'candidats.json')

_spec = importlib.util.spec_from_file_location('classement', os.path.join(ROOT, 'scripts', 'classement_hebdo.py'))
ch = importlib.util.module_from_spec(_spec)
_argv, sys.argv = sys.argv, ['x']
_spec.loader.exec_module(ch)  # réutilise l'accès à la base et les polices
sys.argv = _argv


def norm(s):
    s = unicodedata.normalize('NFD', s or '')
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn').lower()
    return re.sub(r'[^a-z0-9 ]+', ' ', s).strip()


def tirage(num):
    m = re.search(r'/\s*(\d+)', num or '')
    return int(m.group(1)) if m else None


def score(r):
    pts, why = 0, []
    if r.get('auto'):
        pts += 100; why.append('AUTO')
    if r.get('patch'):
        pts += 60; why.append('PATCH')
    t = tirage(r.get('num'))
    if t:
        for limite, p in ((1, 100), (10, 80), (25, 60), (49, 45), (99, 30), (199, 15)):
            if t <= limite:
                pts += p; why.append('/%d' % t); break
    return pts, why


def load_hist():
    if os.path.exists(HIST):
        with open(HIST, encoding='utf-8') as f:
            return json.load(f)
    return {'joueurs': [], 'cartes': []}


def candidats():
    rows = ch.api('cartes_manuelles', {
        'select': 'id,user_id,nom,equipe,annee,marque,collection,auto,patch,num,image_recto,image_recto_hd',
        'or': '(auto.eq.true,patch.eq.true,num.not.is.null)',
    })
    hist = set(load_hist()['joueurs'])
    best = {}
    for r in rows:
        img = r.get('image_recto_hd') or r.get('image_recto')
        if not img or 'placehold.co' in img or not r.get('nom'):
            continue
        pts, why = score(r)
        if pts <= 0:
            continue
        key = norm(r['nom'])
        if not key or key in hist:
            continue
        r['_img'], r['_pts'], r['_why'] = img, pts, why
        # un seul exemplaire par joueur : le mieux noté (à égalité, tirage au sort)
        if key not in best or (pts, random.random()) > (best[key]['_pts'], 0.5):
            best[key] = r
    top = sorted(best.values(), key=lambda r: (-r['_pts'], random.random()))[:8]
    pseudos = ch.names_for({r['user_id'] for r in top})
    os.makedirs(CAND_DIR, exist_ok=True)
    out = []
    for i, r in enumerate(top, 1):
        path = os.path.join(CAND_DIR, '%d-%s.jpg' % (i, re.sub(r'\s+', '-', norm(r['nom']))[:30]))
        try:
            req = urllib.request.Request(r['_img'], headers={'User-Agent': 'Mozilla/5.0 (carte-mystere)'})
            with urllib.request.urlopen(req, timeout=30) as resp, open(path, 'wb') as f:
                f.write(resp.read())
        except Exception as e:
            path = ''
            print('Image non téléchargée pour', r['nom'], '-', e)
        out.append({'rang': i, 'id': r['id'], 'joueur': r['nom'], 'membre': pseudos.get(r['user_id'], '?'),
                    'raisons': r['_why'], 'points': r['_pts'], 'fichier': path,
                    'equipe': r.get('equipe'), 'detail': ' '.join(str(x) for x in (r.get('annee'), r.get('marque'), r.get('collection')) if x)})
    with open(CAND_JSON, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    print('Candidates (images dans %s) :\n' % CAND_DIR)
    for c in out:
        print('%d. %-28s %-18s %s  (carte de %s)' % (c['rang'], c['joueur'][:28], ' '.join(c['raisons']), c['detail'][:40], c['membre']))
    print('\nÉtape suivante : python scripts/carte_mystere.py choisir <numéro>')


NIVEAUX = {
    'facile': '0.12,0.10,0.88,0.75',     # portrait entier
    'moyen': '0.30,0.12,0.70,0.42',      # le visage seulement
    'difficile': '0.38,0.15,0.62,0.30',  # les yeux et le front
}


def reponses_quiz(c):
    """4 réponses pour le sticker quiz d'Instagram : la bonne + 3 joueurs vraisemblables (même équipe si possible)."""
    rows = ch.api('cartes_manuelles', {'select': 'nom,equipe', 'nom': 'not.is.null'})
    bonne = norm(c['joueur'])
    meme_equipe = [r['nom'] for r in rows if r.get('equipe') and r['equipe'] == c.get('equipe') and norm(r['nom']) != bonne]
    autres = [r['nom'] for r in rows if norm(r['nom']) != bonne]
    pool, vus = [], {bonne}
    random.shuffle(meme_equipe); random.shuffle(autres)
    for nom in meme_equipe + autres:
        k = norm(nom)
        if k not in vus and len(nom) <= 24:
            vus.add(k); pool.append(nom)
        if len(pool) == 3:
            break
    opts = pool + [c['joueur']]
    random.shuffle(opts)
    return opts


def get_candidate(rang):
    with open(CAND_JSON, encoding='utf-8') as f:
        for c in json.load(f):
            if c['rang'] == rang:
                return c
    sys.exit('Numéro inconnu : relance d\'abord la liste.')


def choisir(rang):
    c = get_candidate(rang)
    hist = load_hist()
    hist['joueurs'].append(norm(c['joueur']))
    hist['cartes'].append({'id': c['id'], 'joueur': c['joueur'], 'membre': c['membre']})
    with open(HIST, 'w', encoding='utf-8') as f:
        json.dump(hist, f, ensure_ascii=False, indent=1)
    print('Retenue : %s (carte de %s). Ce joueur ne sera plus proposé.' % (c['joueur'], c['membre']))
    print('Pense à créditer @%s dans le post, avec son accord.' % c['membre'])
    print('Fabrication : python scripts/carte_mystere.py fabriquer %d --niveau moyen' % rang)


def apercu(rang):
    """Carte quadrillée (une ligne tous les 10 %) pour repérer les coordonnées du zoom."""
    from PIL import Image, ImageDraw, ImageFont
    c = get_candidate(rang)
    im = Image.open(c['fichier']).convert('RGB')
    w, h = im.size
    d = ImageDraw.Draw(im)
    f = ImageFont.truetype(ch.find_bold_font(), max(14, w // 40))
    for i in range(1, 10):
        v = i / 10.0
        d.line((int(w * v), 0, int(w * v), h), fill=(255, 0, 80), width=1)
        d.line((0, int(h * v), w, int(h * v)), fill=(255, 0, 80), width=1)
        d.text((int(w * v) + 3, 3), '%.1f' % v, font=f, fill=(255, 0, 80))
        d.text((3, int(h * v) + 3), '%.1f' % v, font=f, fill=(255, 0, 80))
    out = os.path.join(CAND_DIR, 'apercu-%d.jpg' % rang)
    im.save(out, quality=92)
    print('Aperçu quadrillé :', out)
    print('Lis les repères (x en haut, y à gauche) puis : fabriquer %d --zoom x0,y0,x1,y1' % rang)


def fabriquer(rang, zoom, niveau='moyen'):
    from PIL import Image, ImageDraw, ImageFont
    import numpy as np
    c = get_candidate(rang)
    if not c['fichier'] or not os.path.exists(c['fichier']):
        sys.exit('Image de la carte introuvable.')
    x0, y0, x1, y1 = [float(v) for v in zoom.split(',')]
    numero = len(load_hist()['cartes']) or 1
    P = os.path.join(ROOT, 'public') + os.sep
    SQ = lambda s: ImageFont.truetype(P + 'Surfquest-NoSlash.otf', s)
    BD = lambda s: ImageFont.truetype(ch.find_bold_font(), s)
    WHITE, BLUE, GOLD, GREY, NAVY = '#ffffff', '#5b8def', '#f5c451', '#b9c3e0', '#06122e'
    X = 90
    for story, out in ((True, 'carte-mystere-%02d-story.jpg' % numero), (False, 'carte-mystere-%02d-post.jpg' % numero)):
        W, H = (1080, 1920) if story else (1080, 1350)
        ys, xs = np.mgrid[0:H, 0:W].astype(np.float32)
        tt = xs * 0.342 + ys * 0.940; tt = (tt - tt.min()) / (tt.max() - tt.min())
        stops = [(0.0, (5, 9, 18)), (0.55, (8, 21, 59)), (1.0, (10, 36, 104))]
        bg = np.zeros((H, W, 3), np.float32)
        for (a, ca), (b, cb) in zip(stops, stops[1:]):
            m = (tt >= a) & (tt <= b); u = ((tt - a) / (b - a))[m][:, None]
            bg[m] = np.array(ca) * (1 - u) + np.array(cb) * u
        bg += np.random.default_rng(3).normal(0, 3, (H, W, 1))
        img = Image.fromarray(np.clip(bg, 0, 255).astype(np.uint8))
        lg = Image.open(P + 'Memorabiliuslogo.png'); lg = lg.crop(lg.getbbox())
        lw = 330 if story else 270
        lg = lg.resize((lw, int(lg.height * lw / lg.width)), Image.LANCZOS)
        wh = Image.new('RGBA', lg.size, (255, 255, 255, 255)); wh.putalpha(lg.getchannel('A'))
        img.paste(wh, (X, 235 if story else 60), wh)
        d = ImageDraw.Draw(img)
        label = 'CARTE MYSTÈRE N° %02d' % numero
        bw = sum(d.textlength(ch_, font=BD(26)) + 5 for ch_ in label) + 36
        bx, by = W - X - bw, (244 if story else 64)
        d.rectangle((bx, by, bx + bw, by + 56), fill=WHITE)
        x = bx + 18
        for ch_ in label:
            d.text((x, by + 11), ch_, font=BD(26), fill=NAVY); x += d.textlength(ch_, font=BD(26)) + 5
        d.text((X, 400 if story else 160), 'QUI EST-CE ?', font=SQ(160 if story else 118), fill=WHITE)
        src = Image.open(c['fichier']).convert('RGB')
        w, h = src.size
        src = src.crop((int(w * x0), int(h * y0), int(w * x1), int(h * y1)))
        fy, fh = (620, 620) if story else (310, 770)  # story : zone libre en dessous pour le sticker quiz
        fw = int(fh * src.width / src.height)
        if fw > W - 2 * X:  # cadre trop large : on borne la largeur
            fw = W - 2 * X; fh = int(fw * src.height / src.width)
        src = src.resize((fw, fh), Image.LANCZOS)
        fx = (W - fw) // 2
        d.rectangle((fx - 8, fy - 8, fx + fw + 8, fy + fh + 8), fill=BLUE)
        img.paste(src, (fx, fy))
        if not story:
            cy = fy + fh + 24
            d.text((X, cy), 'Réponse ce soir', font=SQ(60), fill=GOLD)
            d.text((X, cy + 74), 'Dis-nous en commentaire', font=BD(28), fill=GREY)
        fy2 = 1700 if story else H - 70
        d.rectangle((0, fy2, W, fy2 + 70), fill=WHITE)
        x = X
        for ch_ in 'MEMORABILIUS.FR':
            d.text((x, fy2 + 16), ch_, font=BD(28), fill=NAVY); x += d.textlength(ch_, font=BD(28)) + 6
        img.save(os.path.join(RDV, out), 'JPEG', quality=95, subsampling=0, optimize=True)
        print('Écrit :', os.path.join(RDV, out))
    print('Texte du post : Carte mystère n° %02d. Qui est-ce ? Réponse ce soir. Carte de @%s. #MemorabiliusGalerie' % (numero, c['membre']))
    print('Réponse du soir : %s (%s)' % (c['joueur'], c['detail']))
    opts = reponses_quiz(c)
    print('\nSticker quiz Instagram (4 réponses, à placer dans la zone libre de la story) :')
    for i, o in enumerate(opts):
        print('  %s. %s%s' % ('ABCD'[i], o, '   <- bonne réponse' if norm(o) == norm(c['joueur']) else ''))


if __name__ == '__main__':
    a = sys.argv[1:]
    if not a:
        candidats()
    elif a[0] == 'choisir' and len(a) > 1:
        choisir(int(a[1]))
    elif a[0] == 'apercu' and len(a) > 1:
        apercu(int(a[1]))
    elif a[0] == 'fabriquer' and len(a) > 1:
        niv = a[a.index('--niveau') + 1] if '--niveau' in a else 'moyen'
        z = a[a.index('--zoom') + 1] if '--zoom' in a else NIVEAUX[niv]
        fabriquer(int(a[1]), z, niv)
    else:
        print(__doc__)
