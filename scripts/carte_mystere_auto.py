"""
Carte mystère automatique (GitHub Actions) : choisit une carte, fabrique les visuels et les envoie sur Discord.

    python scripts/carte_mystere_auto.py mystere   --etat etat.json [--discord]   # le matin : zoom serré sur les yeux + 4 réponses
    python scripts/carte_mystere_auto.py resultat  --etat etat.json [--discord]   # le soir : la carte entière et le nom

Sélection : autos d'abord, puis patchs et faibles tirages ; un seul exemplaire par joueur ; jamais un joueur déjà utilisé
(mémorisé dans le fichier d'état). Le cadrage est automatique (détection du visage) : une carte sans visage détecté est écartée.
Le fichier d'état garde le joueur du jour entre le matin et le soir, et l'historique des joueurs déjà proposés.
"""
import importlib.util, io, json, os, random, re, sys, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

_spec = importlib.util.spec_from_file_location('cm', os.path.join(ROOT, 'scripts', 'carte_mystere.py'))
cm = importlib.util.module_from_spec(_spec)
_argv, sys.argv = sys.argv, ['x']
_spec.loader.exec_module(cm)
sys.argv = _argv
ch = cm.ch

OUT = os.path.join(ROOT, 'docs', 'rdv', 'auto')
P = os.path.join(ROOT, 'public') + os.sep
WHITE, BLUE, GOLD, GREY, NAVY, LINE = '#ffffff', '#5b8def', '#f5c451', '#b9c3e0', '#06122e', '#243063'
X = 90


# ── État ───────────────────────────────────────────────────────────────────
def load_state(path):
    if path and os.path.exists(path):
        try:
            with open(path, encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            pass
    return {'joueurs': [], 'courant': None, 'numero': 0}


def save_state(path, st):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(st, f, ensure_ascii=False, indent=1)


def download(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (carte-mystere)'})
    with urllib.request.urlopen(req, timeout=40) as r:
        return r.read()


# ── Détection du visage ────────────────────────────────────────────────────
def detect_face(data):
    """Plus grand visage détecté (x, y, w, h) en pixels, ou None. Face + profils (gauche et droite)."""
    import cv2, numpy as np
    im = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
    if im is None:
        return None
    g = cv2.equalizeHist(cv2.cvtColor(im, cv2.COLOR_BGR2GRAY))
    h, w = g.shape
    if min(w, h) < 400:
        return None  # trop petite : le zoom serré serait illisible
    # YuNet (modèle officiel OpenCV, scripts/models/) : bien plus fiable que les cascades classiques,
    # qui prenaient un morceau de tissu de patch pour un visage.
    model = os.path.join(ROOT, 'scripts', 'models', 'face_detection_yunet_2023mar.onnx')
    det = cv2.FaceDetectorYN.create(model, '', (w, h), 0.8, 0.3, 5000)
    _, faces = det.detect(im)
    if faces is None or len(faces) == 0:
        return None
    best = max(faces, key=lambda f: float(f[2]) * float(f[3]))
    x, y, fw, fh = [int(v) for v in best[:4]]
    if fw < 140:  # sous ~140 px de large, le zoom serré devient une bouillie de pixels
        return None  # visage minuscule : le zoom serait flou
    return (max(0, x), max(0, y), fw, fh)


def eyes_crop(face, size):
    """Cadrage serré : le front, les yeux et le nez seulement (pas la bouche, pas le menton)."""
    x, y, fw, fh = face
    w, h = size
    box = (x - 0.12 * fw, y + 0.08 * fh, x + 1.12 * fw, y + 0.60 * fh)
    return (max(0, int(box[0])), max(0, int(box[1])), min(w, int(box[2])), min(h, int(box[3])))


def face_crop(face, size):
    """Indice : tout le visage (front, yeux, bouche, menton) avec un peu de marge, mais ni le nom ni le décor de la carte."""
    x, y, fw, fh = face
    w, h = size
    box = (x - 0.30 * fw, y - 0.20 * fh, x + 1.30 * fw, y + 1.15 * fh)
    return (max(0, int(box[0])), max(0, int(box[1])), min(w, int(box[2])), min(h, int(box[3])))


# ── Sélection ──────────────────────────────────────────────────────────────
def pick(state):
    rows = ch.api('cartes_manuelles', {
        'select': 'id,user_id,nom,equipe,annee,marque,collection,auto,patch,num,image_recto,image_recto_hd',
        'or': '(auto.eq.true,patch.eq.true,num.not.is.null)',
    })
    deja = set(state.get('joueurs', []))
    best = {}
    for r in rows:
        img = r.get('image_recto_hd') or r.get('image_recto')
        if not img or 'placehold.co' in img or not r.get('nom'):
            continue
        pts, why = cm.score(r)
        key = cm.norm(r['nom'])
        if pts <= 0 or not key or key in deja:
            continue
        r['_img'], r['_pts'], r['_why'] = img, pts, why
        if key not in best or (pts, random.random()) > (best[key]['_pts'], 0.5):
            best[key] = r
    ordered = sorted(best.values(), key=lambda r: (-r['_pts'], random.random()))
    for r in ordered[:150]:
        try:
            data = download(r['_img'])
            face = detect_face(data)
        except Exception as e:
            print('Carte ignorée (%s) : %s' % (r['nom'], e))
            continue
        if face:
            return r, data, face
        print('Pas de visage détecté, carte ignorée :', r['nom'])
    sys.exit('Aucune carte exploitable trouvée.')


# ── Visuels ────────────────────────────────────────────────────────────────
def canvas(story, badge_text):
    from PIL import Image, ImageDraw, ImageFont
    import numpy as np
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
    BD = lambda s: ImageFont.truetype(ch.find_bold_font(), s)
    SQ = lambda s: ImageFont.truetype(P + 'Surfquest-NoSlash.otf', s)
    bw = sum(d.textlength(c_, font=BD(26)) + 5 for c_ in badge_text) + 36
    bx, by = W - X - bw, (244 if story else 64)
    d.rectangle((bx, by, bx + bw, by + 56), fill=WHITE)
    x = bx + 18
    for c_ in badge_text:
        d.text((x, by + 11), c_, font=BD(26), fill=NAVY); x += d.textlength(c_, font=BD(26)) + 5
    fy = 1700 if story else H - 70
    d.rectangle((0, fy, W, fy + 70), fill=WHITE)
    x = X
    for c_ in 'MEMORABILIUS.FR':
        d.text((x, fy + 16), c_, font=BD(28), fill=NAVY); x += d.textlength(c_, font=BD(28)) + 6
    return img, d, W, H, SQ, BD


def fit(im, max_w, max_h):
    from PIL import Image
    s = min(max_w / im.width, max_h / im.height)
    return im.resize((max(1, int(im.width * s)), max(1, int(im.height * s))), Image.LANCZOS)


def render_mystere(crop, numero, story, out, titre='QUI EST-CE ?', badge='CARTE MYSTÈRE'):
    img, d, W, H, SQ, BD = canvas(story, '%s N° %02d' % (badge, numero))
    d.text((X, 400 if story else 160), titre, font=SQ(160 if story else 118), fill=WHITE)
    fy, max_h = (620, 620) if story else (310, 700)  # story : la zone sous la photo reste libre pour le sticker quiz
    pic = fit(crop, W - 2 * X, max_h)
    fx = (W - pic.width) // 2
    d.rectangle((fx - 8, fy - 8, fx + pic.width + 8, fy + pic.height + 8), fill=BLUE)
    img.paste(pic, (fx, fy))
    if not story:
        cy = fy + pic.height + 34
        d.text((X, cy), 'Réponse ce soir', font=SQ(60), fill=GOLD)
        d.text((X, cy + 74), 'Dis-nous en commentaire', font=BD(28), fill=GREY)
    img.save(out, 'JPEG', quality=95, subsampling=0, optimize=True)


def render_resultat(card, info, numero, story, out):
    img, d, W, H, SQ, BD = canvas(story, 'RÉPONSE N° %02d' % numero)
    d.text((X, 395 if story else 150), 'C’ÉTAIT…', font=SQ(70 if story else 56), fill=BLUE)
    name = info['joueur'].upper()
    size = 150 if story else 104
    while d.textlength(name, font=SQ(size)) > W - 2 * X and size > 50:
        size -= 4
    d.text((X, (470 if story else 215)), name, font=SQ(size), fill=WHITE)
    top = 700 if story else 340
    pic = fit(card, W - 2 * X, 760 if story else 560)
    fx = (W - pic.width) // 2
    d.rectangle((fx - 8, top - 8, fx + pic.width + 8, top + pic.height + 8), fill=BLUE)
    img.paste(pic, (fx, top))
    y = top + pic.height + (40 if story else 26)
    # pastilles (auto, patch, tirage)
    x = X
    for tag in info.get('tags', []):
        tw = d.textlength(tag, font=BD(26)) + 30
        d.rectangle((x, y, x + tw, y + 48), fill=GOLD)
        d.text((x + 15, y + 8), tag, font=BD(26), fill=NAVY)
        x += tw + 12
    y += 64
    detail = info.get('detail', '')
    if detail:
        d.text((X, y), detail[:60], font=BD(28), fill=GREY); y += 42
    d.text((X, y), 'Carte de %s' % info.get('membre', ''), font=BD(32 if story else 28), fill=GOLD)
    img.save(out, 'JPEG', quality=95, subsampling=0, optimize=True)


# ── Modes ──────────────────────────────────────────────────────────────────
def mode_mystere(state, discord):
    from PIL import Image
    r, data, face = pick(state)
    im = Image.open(io.BytesIO(data)).convert('RGB')
    crop = im.crop(eyes_crop(face, im.size))
    numero = state.get('numero', 0) + 1
    pseudos = ch.names_for({r['user_id']})
    info = {
        'id': r['id'], 'joueur': r['nom'], 'equipe': r.get('equipe'), 'membre': pseudos.get(r['user_id'], 'un membre'),
        'tags': r['_why'], 'img_url': r['_img'], 'numero': numero,
        'detail': ' '.join(str(x) for x in (r.get('annee'), r.get('marque'), r.get('collection')) if x),
    }
    opts = cm.reponses_quiz({'joueur': r['nom'], 'equipe': r.get('equipe')})
    info['reponses'] = opts
    state['courant'] = info
    state['joueurs'] = state.get('joueurs', []) + [cm.norm(r['nom'])]
    state['numero'] = numero
    os.makedirs(OUT, exist_ok=True)
    story = os.path.join(OUT, 'mystere-story.jpg'); post = os.path.join(OUT, 'mystere-post.jpg')
    render_mystere(crop, numero, True, story)
    render_mystere(crop, numero, False, post)
    lettre = 'ABCD'[[cm.norm(o) for o in opts].index(cm.norm(r['nom']))]
    rep = '\n'.join('%s. %s' % ('ABCD'[i], o) for i, o in enumerate(opts))
    txt_story = ('📸 **Story Instagram — carte mystère n° %02d** (la zone libre en bas est pour ton sticker quiz)\n'
                 'Les 4 réponses à mettre dans le sticker :\n%s\nBonne réponse : ||%s||  ·  carte de %s'
                 % (numero, rep, lettre, info['membre']))
    txt_x = ('🐦 **Post X — carte mystère n° %02d**\n```\nCarte mystère n° %02d 🕵️ Qui est-ce ? Réponse ce soir. '
             'Carte de %s. #MemorabiliusGalerie\n```' % (numero, numero, info['membre']))
    print('Carte mystère n° %02d choisie (%d tests de visage ok).' % (numero, 1))
    if discord:
        ch.post_discord(discord, txt_story, [('mystere-story.jpg', story)])
        ch.post_discord(discord, txt_x, [('mystere-post.jpg', post)])
        print('Envoyé sur Discord')
    else:
        print(txt_story); print(txt_x); print('Images :', OUT)


def mode_resultat(state, discord):
    from PIL import Image
    info = state.get('courant')
    if not info:
        print('Aucune carte mystère en cours : rien à révéler.')
        return
    card = Image.open(io.BytesIO(download(info['img_url']))).convert('RGB')
    os.makedirs(OUT, exist_ok=True)
    story = os.path.join(OUT, 'resultat-story.jpg'); post = os.path.join(OUT, 'resultat-post.jpg')
    n = info['numero']
    render_resultat(card, info, n, True, story)
    render_resultat(card, info, n, False, post)
    txt_story = '📸 **Story Instagram — réponse de la carte mystère n° %02d** : %s' % (n, info['joueur'])
    txt_x = ('🐦 **Post X — réponse de la carte mystère n° %02d**\n```\nRéponse de la carte mystère n° %02d : %s ! %s. '
             'Carte de %s. Bravo à ceux qui ont trouvé 👏 #MemorabiliusGalerie\n```'
             % (n, n, info['joueur'], ' · '.join(info.get('tags', [])) or 'belle carte', info['membre']))
    if discord:
        ch.post_discord(discord, txt_story, [('resultat-story.jpg', story)])
        ch.post_discord(discord, txt_x, [('resultat-post.jpg', post)])
        print('Envoyé sur Discord')
    else:
        print(txt_story); print(txt_x); print('Images :', OUT)
    state['courant'] = None


# Heures conseillées pour publier (à adapter) : tout arrive le matin dans Discord, tu publies à ces moments-là.
HEURES = {'mystere': '11 h', 'indice': '16 h', 'resultat': '20 h 30'}


def mode_tout(state, discord):
    """Tout le programme du jour d'un coup (mystère, indice, réponse) : envoyé le matin, publié à la main aux bonnes heures."""
    from PIL import Image
    r, data, face = pick(state)
    im = Image.open(io.BytesIO(data)).convert('RGB')
    numero = state.get('numero', 0) + 1
    pseudos = ch.names_for({r['user_id']})
    info = {
        'id': r['id'], 'joueur': r['nom'], 'equipe': r.get('equipe'), 'membre': pseudos.get(r['user_id'], 'un membre'),
        'tags': r['_why'], 'numero': numero,
        'detail': ' '.join(str(x) for x in (r.get('annee'), r.get('marque'), r.get('collection')) if x),
    }
    opts = cm.reponses_quiz({'joueur': r['nom'], 'equipe': r.get('equipe')})
    state['joueurs'] = state.get('joueurs', []) + [cm.norm(r['nom'])]
    state['numero'] = numero
    state['courant'] = None
    os.makedirs(OUT, exist_ok=True)
    files = {}
    for story, suffixe in ((True, 'story'), (False, 'post')):
        files['mystere-' + suffixe] = os.path.join(OUT, 'mystere-%s.jpg' % suffixe)
        files['indice-' + suffixe] = os.path.join(OUT, 'indice-%s.jpg' % suffixe)
        files['resultat-' + suffixe] = os.path.join(OUT, 'SPOILER_resultat-%s.jpg' % suffixe)  # masquée dans Discord jusqu'au clic
        render_mystere(im.crop(eyes_crop(face, im.size)), numero, story, files['mystere-' + suffixe])
        render_mystere(im.crop(face_crop(face, im.size)), numero, story, files['indice-' + suffixe], titre='UN INDICE', badge='INDICE')
        render_resultat(im, info, numero, story, files['resultat-' + suffixe])
    lettre = 'ABCD'[[cm.norm(o) for o in opts].index(cm.norm(r['nom']))]
    rep = '\n'.join('%s. %s' % ('ABCD'[i], o) for i, o in enumerate(opts))
    msgs = [
        ('🗓️ **Carte mystère n° %02d : le programme du jour** (carte de %s)\n'
         '• %s : le mystère  • %s : l\'indice  • %s : la réponse\n\n'
         'Les 4 réponses du sticker quiz Instagram (au moment du mystère) :\n%s\nBonne réponse : ||%s||'
         % (numero, info['membre'], HEURES['mystere'], HEURES['indice'], HEURES['resultat'], rep, lettre), []),
        ('🕵️ **1. Le mystère, à publier vers %s**\n📸 Story : laisse la zone libre pour le sticker quiz.\n🐦 Post X :\n```\n'
         'Carte mystère n° %02d 🕵️ Qui est-ce ? Indice cet après-midi, réponse ce soir. Carte de %s. #MemorabiliusGalerie\n```'
         % (HEURES['mystere'], numero, info['membre']),
         [('mystere-story.jpg', files['mystere-story']), ('mystere-post.jpg', files['mystere-post'])]),
        ('👀 **2. L\'indice, à publier vers %s**\n🐦 Post X :\n```\n'
         'Indice de la carte mystère n° %02d : voici le visage en entier. Toujours pas trouvé ? Réponse ce soir. #MemorabiliusGalerie\n```'
         % (HEURES['indice'], numero),
         [('indice-story.jpg', files['indice-story']), ('indice-post.jpg', files['indice-post'])]),
        ('🎉 **3. La réponse, à publier vers %s** (images masquées : clique pour afficher)\n🐦 Post X :\n```\n'
         'Réponse de la carte mystère n° %02d : %s ! %s. Carte de %s. Bravo à ceux qui ont trouvé 👏 #MemorabiliusGalerie\n```'
         % (HEURES['resultat'], numero, r['nom'], ' · '.join(info['tags']) or 'belle carte', info['membre']),
         [('SPOILER_resultat-story.jpg', files['resultat-story']), ('SPOILER_resultat-post.jpg', files['resultat-post'])]),
    ]
    if discord:
        for texte, fichiers in msgs:
            ch.post_discord(discord, texte, fichiers)
        print('Carte mystère n° %02d envoyée sur Discord (4 messages).' % numero)
    else:
        for texte, fichiers in msgs:
            print(texte, [n for n, _ in fichiers], '\n')


def mode_reset(state, discord):
    """Repart de zéro : tous les joueurs redeviennent proposables et la numérotation revient à 1."""
    state.clear()
    state.update({'joueurs': [], 'courant': None, 'numero': 0})
    print('Historique de la carte mystère remis à zéro.')


if __name__ == '__main__':
    a = sys.argv[1:]
    if not a or a[0] not in ('mystere', 'resultat', 'tout', 'reset'):
        sys.exit(__doc__)
    etat = a[a.index('--etat') + 1] if '--etat' in a else os.path.join(ROOT, 'docs', 'rdv', 'etat-mystere.json')
    hook = ch.ENV.get('DISCORD_WEBHOOK_URL') if '--discord' in a else None
    if '--discord' in a and not hook:
        sys.exit('--discord demandé mais DISCORD_WEBHOOK_URL est absent')
    st = load_state(etat)
    {'mystere': mode_mystere, 'resultat': mode_resultat, 'tout': mode_tout, 'reset': mode_reset}[a[0]](st, hook)
    save_state(etat, st)
