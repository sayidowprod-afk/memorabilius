"""
Classements hebdomadaires de Memorabilius : podium des cartes ajoutées + classement des pronos.

Calcule les deux classements de la semaine (lundi 00:00 -> dimanche 23:59, heure de Paris), remplit les deux
visuels (format story 1080x1920) et écrit les légendes prêtes à publier.

Usage (depuis le dossier du projet) :
    python scripts/classement_hebdo.py            # semaine en cours, jusqu'à maintenant
    python scripts/classement_hebdo.py --last     # semaine précédente, complète (à lancer le lundi matin)

Sortie : docs/classements/AAAA-Sww/ : cartes.jpg et pronos.jpg (stories Instagram), x-cartes.jpg et x-pronos.jpg
(post X), textes.txt, post-x.txt.  Option --discord : envoie le tout sur le webhook DISCORD_WEBHOOK_URL.

Lit NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY dans .env.local (jamais affichées). Lecture seule.
Les pronos sont comptés depuis xp_events (type pronos_win), rattachés à la semaine du match (meta.kickoff_at,
écrit par le cron /api/cron/pronos-resolve), ou à la date de versement pour les anciens enregistrements.
"""
import json, os, re, sys, urllib.request, urllib.parse
from datetime import datetime, timedelta, timezone
from collections import defaultdict

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOP = 5


# ── Config ─────────────────────────────────────────────────────────────────
def load_env():
    # Variables d'environnement d'abord (GitHub Actions), sinon .env.local (usage local).
    # .strip() : un secret GitHub collé avec un retour à la ligne final rendrait l'en-tête HTTP invalide.
    env = {k: os.environ[k].strip() for k in ('NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'DISCORD_WEBHOOK_URL', 'DISCORD_USER_ID') if os.environ.get(k, '').strip()}
    path = os.path.join(ROOT, '.env.local')
    if os.path.exists(path):
        with open(path, encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith('#') or '=' not in line:
                    continue
                k, v = line.split('=', 1)
                env.setdefault(k.strip(), v.strip().strip('"').strip("'"))
    for k in ('NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'):
        if not env.get(k):
            sys.exit('Variable manquante : %s (secrets GitHub ou .env.local)' % k)
    return env


ENV = load_env()
BASE = ENV['NEXT_PUBLIC_SUPABASE_URL'].rstrip('/') + '/rest/v1'
KEY = ENV['SUPABASE_SERVICE_ROLE_KEY']


def api(path, params=None, page=1000):
    """GET paginé sur l'API REST de Supabase."""
    out, start = [], 0
    while True:
        url = BASE + '/' + path + ('?' + urllib.parse.urlencode(params, safe='(),.:*>-') if params else '')
        req = urllib.request.Request(url, headers={
            'apikey': KEY, 'Authorization': 'Bearer ' + KEY,
            'Range-Unit': 'items', 'Range': '%d-%d' % (start, start + page - 1),
        })
        with urllib.request.urlopen(req, timeout=60) as r:
            rows = json.loads(r.read().decode('utf-8'))
        out.extend(rows)
        if len(rows) < page:
            return out
        start += page


# ── Semaine (heure de Paris) ───────────────────────────────────────────────
def last_sunday(year, month):
    d = datetime(year, month, 31 if month in (3, 10) else 30, tzinfo=timezone.utc)
    while d.weekday() != 6:
        d -= timedelta(days=1)
    return d


def paris_offset(dt_utc):
    dst_start = last_sunday(dt_utc.year, 3).replace(hour=1)
    dst_end = last_sunday(dt_utc.year, 10).replace(hour=1)
    return timedelta(hours=2 if dst_start <= dt_utc < dst_end else 1)


def to_paris(dt_utc):
    return dt_utc + paris_offset(dt_utc)


def paris_week_bounds(now_utc, last):
    local = to_paris(now_utc)
    monday = (local - timedelta(days=local.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
    if last:
        monday -= timedelta(days=7)
    sunday_end = monday + timedelta(days=7)
    # retour en UTC (le décalage peut changer dans la semaine : on le recalcule à chaque borne)
    def back(naive_local):
        guess = naive_local.replace(tzinfo=timezone.utc) - timedelta(hours=1)
        return naive_local.replace(tzinfo=timezone.utc) - paris_offset(guess)
    return back(monday.replace(tzinfo=None)), back(sunday_end.replace(tzinfo=None)), monday


def parse_ts(s):
    # Python 3.8 n'accepte que 3 ou 6 décimales de secondes : on normalise.
    s = s.replace('Z', '+00:00')
    m = re.match(r'^(.*?\.)(\d+)(.*)$', s)
    if m:
        s = m.group(1) + m.group(2)[:6].ljust(6, '0') + m.group(3)
    return datetime.fromisoformat(s)


def iso(dt):
    return dt.strftime('%Y-%m-%dT%H:%M:%SZ')


# ── Données ────────────────────────────────────────────────────────────────
AVATARS = {}


def names_for(user_ids):
    names = {}
    ids = list(user_ids)
    for i in range(0, len(ids), 80):
        chunk = ids[i:i + 80]
        rows = api('profiles', {'select': 'id,display_name,avatar_url,is_demo', 'id': 'in.(' + ','.join(chunk) + ')'})
        for r in rows:
            if r.get('display_name') and not r.get('is_demo'):
                names[r['id']] = r['display_name'].strip()
                AVATARS[r['id']] = r.get('avatar_url')
    return names


def load_avatar(url, size):
    """Télécharge l'avatar et le découpe en rond (None si absent ou illisible)."""
    if not url:
        return None
    try:
        import io
        from PIL import Image, ImageDraw
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (classement-hebdo)'})
        with urllib.request.urlopen(req, timeout=20) as r:
            im = Image.open(io.BytesIO(r.read())).convert('RGB')
        w, h = im.size
        s = min(w, h)
        im = im.crop(((w - s) // 2, (h - s) // 2, (w + s) // 2, (h + s) // 2)).resize((size, size), Image.LANCZOS)
        big = 4  # masque suréchantillonné pour un bord lisse
        mask = Image.new('L', (size * big, size * big), 0)
        ImageDraw.Draw(mask).ellipse((0, 0, size * big - 1, size * big - 1), fill=255)
        mask = mask.resize((size, size), Image.LANCZOS)
        im = im.convert('RGBA')
        im.putalpha(mask)
        return im
    except Exception:
        return None


def cards_ranking(start, end):
    rows = api('cartes_manuelles', {'select': 'user_id,created_at', 'and': '(created_at.gte.%s,created_at.lt.%s)' % (iso(start), iso(end))})
    counts, last_ts = defaultdict(int), {}
    for r in rows:
        counts[r['user_id']] += 1
        t = parse_ts(r['created_at'])
        if r['user_id'] not in last_ts or t > last_ts[r['user_id']]:
            last_ts[r['user_id']] = t
    return counts, last_ts, len(rows)


def pronos_ranking(start, end):
    # Le versement peut arriver après le match : on lit une marge d'une semaine puis on filtre sur la date du match.
    rows = api('xp_events', {'select': 'user_id,meta,created_at', 'type': 'eq.pronos_win',
                             'and': '(created_at.gte.%s,created_at.lt.%s)' % (iso(start), iso(end + timedelta(days=7)))})
    counts, last_ts, total = defaultdict(int), {}, 0
    for r in rows:
        k = (r.get('meta') or {}).get('kickoff_at') or r['created_at']
        t = parse_ts(k)
        if not (start <= t < end):
            continue
        counts[r['user_id']] += 1
        total += 1
        if r['user_id'] not in last_ts or t > last_ts[r['user_id']]:
            last_ts[r['user_id']] = t
    return counts, last_ts, total


def top(counts, last_ts, names, n=TOP):
    # Plus de points d'abord ; à égalité, celui qui a atteint son score en premier (dernier gain le plus ancien).
    ranked = sorted((u for u in counts if u in names), key=lambda u: (-counts[u], last_ts[u]))
    return [(names[u], counts[u], AVATARS.get(u)) for u in ranked[:n]]


def new_members(start, end):
    rows = api('profiles', {'select': 'id,created_at', 'and': '(created_at.gte.%s,created_at.lt.%s)' % (iso(start), iso(end))})
    return len(rows)


# ── Visuels ────────────────────────────────────────────────────────────────
def find_bold_font():
    for path in ('C:/Windows/Fonts/segoeuib.ttf', '/usr/share/fonts/truetype/open-sans/OpenSans-Bold.ttf',
                 '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf'):
        if os.path.exists(path):
            return path
    sys.exit('Aucune police grasse trouvée')


def render(out_path, line1, line2, unit, cta, week_label, rows, fmt='story', dates=''):
    from PIL import Image, ImageDraw, ImageFont
    import numpy as np
    Image.MAX_IMAGE_PIXELS = None
    story = fmt == 'story'
    W, H = (1080, 1920) if story else (1080, 1350)
    P = os.path.join(ROOT, 'public') + os.sep
    SQ = lambda s: ImageFont.truetype(P + 'Surfquest-NoSlash.otf', s)
    BOLD = find_bold_font()
    BD = lambda s: ImageFont.truetype(BOLD, s)
    WHITE, BLUE, GOLD, GREY, LINE, NAVY = '#ffffff', '#5b8def', '#f5c451', '#b9c3e0', '#243063', '#06122e'
    cols = ['#f5c451', '#c9d1e6', '#d08a4f', '#5b8def', '#5b8def']
    X = 90
    ys, xs = np.mgrid[0:H, 0:W].astype(np.float32)
    tt = xs * 0.342 + ys * 0.940; tt = (tt - tt.min()) / (tt.max() - tt.min())
    stops = [(0.0, (5, 9, 18)), (0.55, (8, 21, 59)), (1.0, (10, 36, 104))]
    bg = np.zeros((H, W, 3), np.float32)
    for (a, ca), (b, cb) in zip(stops, stops[1:]):
        m = (tt >= a) & (tt <= b); u = ((tt - a) / (b - a))[m][:, None]
        bg[m] = np.array(ca) * (1 - u) + np.array(cb) * u
    bg += (np.clip(1 - np.hypot(xs - 900, ys - 420) / 700, 0, 1) ** 2 * 0.09)[..., None] * (np.array([91, 141, 239]) - bg)
    bg += np.random.default_rng(3).normal(0, 3, (H, W, 1))
    img = Image.fromarray(np.clip(bg, 0, 255).astype(np.uint8))
    lg = Image.open(P + 'Memorabiliuslogo.png'); lg = lg.crop(lg.getbbox())
    lw = 330 if story else 270
    lg = lg.resize((lw, int(lg.height * lw / lg.width)), Image.LANCZOS)
    wh = Image.new('RGBA', lg.size, (255, 255, 255, 255)); wh.putalpha(lg.getchannel('A'))
    img.paste(wh, (X, 235 if story else 60), wh)
    d = ImageDraw.Draw(img)

    bw = sum(d.textlength(c, font=BD(26)) + 5 for c in week_label) + 36
    bx, by = (W - X - bw, 244) if story else (W - X - bw, 64)
    d.rectangle((bx, by, bx + bw, by + 56), fill=WHITE)
    x = bx + 18
    for ch in week_label:
        d.text((x, by + 11), ch, font=BD(26), fill=NAVY); x += d.textlength(ch, font=BD(26)) + 5
    if dates:
        dfs = 25 if story else 22
        dw = d.textlength(dates, font=BD(dfs))
        d.text((W - X - dw, by + (76 if story else 66)), dates, font=BD(dfs), fill=GREY)
    d.text((X, 470 if story else 165), line1, font=SQ(138 if story else 112), fill=WHITE)
    d.text((X, 612 if story else 275), line2, font=SQ(104 if story else 84), fill=BLUE)

    step = 134 if story else 132
    y = 790 if story else 410
    for i in range(TOP):
        d.rectangle((X, y, W - X, y + 118), fill=(14, 21, 48), outline=LINE, width=3)
        d.rectangle((X, y, X + 10, y + 118), fill=cols[i])
        d.text((X + 38, y + 8), str(i + 1), font=SQ(88), fill=cols[i])
        if i < len(rows):
            name, n, avatar_url = rows[i]
            score = '%d %s' % (n, unit if n > 1 else unit.rstrip('s'))
            sw = d.textlength(score, font=BD(30))
            name = ''.join(ch for ch in name if ord(ch) < 0x250 or ch in '’‘“”–—…').strip().upper() or '—'
            # avatar rond (ou initiale sur fond bleu si le membre n'en a pas)
            AV = 84
            ax, ay = X + 124, y + (118 - AV) // 2
            av = load_avatar(avatar_url, AV)
            if av is not None:
                img.paste(av, (ax, ay), av)
                d.ellipse((ax - 2, ay - 2, ax + AV + 1, ay + AV + 1), outline=cols[i], width=3)
            else:
                d.ellipse((ax, ay, ax + AV, ay + AV), fill='#17214a', outline=cols[i], width=3)
                ini = name[:1]
                d.text((ax + AV / 2 - d.textlength(ini, font=SQ(52)) / 2, ay + 8), ini, font=SQ(52), fill=WHITE)
            tx = ax + AV + 26
            maxw = W - X - 26 - sw - 30 - tx
            while d.textlength(name, font=SQ(58)) > maxw and len(name) > 3:
                name = name[:-2] + '…'
            d.text((tx, y + 20), name, font=SQ(58), fill=WHITE)
            d.text((W - X - 26 - sw, y + 40), score, font=BD(30), fill=GREY)
        else:
            d.text((X + 130, y + 30), '—', font=SQ(58), fill=GREY)
        y += step
    d.text((X, y + (40 if story else 14)), cta, font=SQ(84 if story else 66), fill=GOLD)
    fy = 1700 if story else H - 70
    d.rectangle((0, fy, W, fy + 70), fill=WHITE)
    x = X
    for ch in 'MEMORABILIUS.FR':
        d.text((x, fy + 16), ch, font=BD(28), fill=NAVY); x += d.textlength(ch, font=BD(28)) + 6
    img.save(out_path, 'JPEG', quality=95, subsampling=0, optimize=True)


def x_post_text(cards_top, pronos_top):
    """Texte du post X (280 caractères max) : on réduit le détail tant que c'est trop long."""
    def compact(rows, n, with_count):
        return ' · '.join(('%d. %s (%d)' % (i + 1, nm, c)) if with_count else ('%d. %s' % (i + 1, nm))
                          for i, (nm, c, _) in enumerate(rows[:n]))
    for n, wc in ((3, True), (3, False), (2, False), (1, False)):
        body = 'Cartes ajoutées : %s' % compact(cards_top, n, wc)
        if pronos_top:  # semaine sans bon prono : on n'affiche pas une ligne vide
            body += '\nPronos : %s' % compact(pronos_top, n, wc)
        t = 'Classement de la semaine 🏆\n\n%s\n\nEt toi, t\'es où ? memorabilius.fr' % body
        if len(t) <= 260:  # marge : l'adresse compte pour 23 caractères et l'emoji pour 2
            return t
    return t


_PINGED = False


def post_discord(url, content, files):
    """Envoie un message avec images sur un webhook Discord (gratuit).
    Si DISCORD_USER_ID est défini, le PREMIER message de l'exécution cite l'utilisateur (une seule notification par envoi)."""
    global _PINGED
    payload = {'content': content}
    uid = ENV.get('DISCORD_USER_ID', '')
    if uid.isdigit() and not _PINGED:
        payload = {'content': '<@%s> %s' % (uid, content), 'allowed_mentions': {'users': [uid]}}
        _PINGED = True
    boundary = '----classement' + os.urandom(8).hex()
    parts = [('--%s\r\nContent-Disposition: form-data; name="payload_json"\r\nContent-Type: application/json\r\n\r\n%s\r\n'
              % (boundary, json.dumps(payload))).encode('utf-8')]
    for i, (name, path) in enumerate(files):
        with open(path, 'rb') as f:
            data = f.read()
        parts.append(('--%s\r\nContent-Disposition: form-data; name="files[%d]"; filename="%s"\r\nContent-Type: %s\r\n\r\n'
                      % (boundary, i, name, 'video/mp4' if name.endswith('.mp4') else 'image/jpeg')).encode('utf-8'))
        parts.append(data)
        parts.append(b'\r\n')
    parts.append(('--%s--\r\n' % boundary).encode('utf-8'))
    req = urllib.request.Request(url, data=b''.join(parts), headers={
        'Content-Type': 'multipart/form-data; boundary=' + boundary, 'User-Agent': 'classement-hebdo'})
    urllib.request.urlopen(req, timeout=60).read()


MOIS = ['JANV.', 'FÉVR.', 'MARS', 'AVR.', 'MAI', 'JUIN', 'JUIL.', 'AOÛT', 'SEPT.', 'OCT.', 'NOV.', 'DÉC.']


def date_range_label(monday_local):
    sunday = monday_local + timedelta(days=6)
    first = '1ER' if monday_local.day == 1 else str(monday_local.day)
    last_d = '1ER' if sunday.day == 1 else str(sunday.day)
    return 'DU %s %s AU %s %s' % (first, MOIS[monday_local.month - 1], last_d, MOIS[sunday.month - 1])


def main():
    last = '--last' in sys.argv
    now = datetime.now(timezone.utc)
    start, end, monday_local = paris_week_bounds(now, last)
    if not last:
        end = min(end, now)
    iso_year, iso_week, _ = monday_local.isocalendar()
    label = 'SEMAINE N° %02d' % iso_week
    dates = date_range_label(monday_local)
    out_dir = os.path.join(ROOT, 'docs', 'classements', '%d-S%02d%s' % (iso_year, iso_week, '' if last else '-en-cours'))
    os.makedirs(out_dir, exist_ok=True)

    c_counts, c_last, c_total = cards_ranking(start, end)
    p_counts, p_last, p_total = pronos_ranking(start, end)
    members = new_members(start, end)
    names = names_for(set(c_counts) | set(p_counts))
    cards_top, pronos_top = top(c_counts, c_last, names), top(p_counts, p_last, names)

    # Stories Instagram (1080x1920) et post X (1080x1350, 4:5, mieux adapté au fil)
    for fmt, prefix in (('story', ''), ('post', 'x-')):
        render(os.path.join(out_dir, prefix + 'cartes.jpg'), 'PODIUM', 'DES CARTES AJOUTÉES', 'cartes', 'Et toi, t’es où ?', label, cards_top, fmt, dates)
        render(os.path.join(out_dir, prefix + 'pronos.jpg'), 'CLASSEMENT', 'DES PRONOS', 'bons pronos', 'Tu fais mieux ?', label, pronos_top, fmt, dates)

    def lines(rows, unit):
        return '\n'.join('%d. %s — %d %s' % (i + 1, n, c, unit if c > 1 else unit.rstrip('s')) for i, (n, c, _) in enumerate(rows[:3])) or '(aucun résultat)'

    txt = (
        'Classement final de la semaine 🏆\n\n'
        'Le podium des cartes ajoutées :\n%s\n\n'
        'Le classement des pronos :\n%s\n\n'
        'Cette semaine : %d nouveaux membres, %d cartes ajoutées, %d bons pronos. Et toi, t\'es où ? memorabilius.fr\n'
    ) % (lines(cards_top, 'cartes'), lines(pronos_top, 'bons pronos'), members, c_total, p_total)
    with open(os.path.join(out_dir, 'textes.txt'), 'w', encoding='utf-8') as f:
        f.write(txt)

    x_txt = x_post_text(cards_top, pronos_top)
    with open(os.path.join(out_dir, 'post-x.txt'), 'w', encoding='utf-8') as f:
        f.write(x_txt)

    if '--discord' in sys.argv:
        hook = ENV.get('DISCORD_WEBHOOK_URL')
        if not hook:
            sys.exit('--discord demandé mais DISCORD_WEBHOOK_URL est absent')
        post_discord(hook, '📸 **Story Instagram** — classement de la semaine (2 images, à publier en stories)',
                     [('cartes.jpg', os.path.join(out_dir, 'cartes.jpg')), ('pronos.jpg', os.path.join(out_dir, 'pronos.jpg'))])
        post_discord(hook, '🐦 **Post X** — 2 images + texte à copier :\n```\n%s\n```' % x_txt,
                     [('x-cartes.jpg', os.path.join(out_dir, 'x-cartes.jpg')), ('x-pronos.jpg', os.path.join(out_dir, 'x-pronos.jpg'))])
        print('Envoyé sur Discord')

    print('Période (UTC) :', iso(start), '->', iso(end))
    if os.environ.get('GITHUB_ACTIONS'):
        # Les journaux d'un dépôt public sont publics : on n'y écrit aucun pseudo.
        print('Classements calculés : %d cartes, %d pronos' % (len(cards_top), len(pronos_top)))
    else:
        print('Podium cartes :', [(n, c) for n, c, _ in cards_top])
        print('Classement pronos :', [(n, c) for n, c, _ in pronos_top])
        print('Fichiers écrits dans', out_dir)


if __name__ == '__main__':
    main()
