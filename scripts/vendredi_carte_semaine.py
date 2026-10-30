"""
Rendez-vous du vendredi sur X : « ta carte de la semaine » (GitHub Actions -> Discord).

    python scripts/vendredi_carte_semaine.py [--discord]

Envoie sur Discord (avec la citation de l'utilisateur) :
  1. le texte du tweet d'appel, prêt à copier ;
  2. une carte d'exemple prise parmi celles ajoutées ces 7 derniers jours (autos, patchs et faibles tirages d'abord),
     avec son propriétaire et ses infos, pour lancer le fil.
Sans --discord : affiche le message et enregistre l'image dans docs/rdv/vendredi/ (essai local).
Les journaux GitHub sont publics : aucun pseudo ni nom de joueur n'est écrit dans la sortie.
"""
import importlib.util, io, os, random, sys, urllib.parse, urllib.request
from datetime import datetime, timedelta, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

_spec = importlib.util.spec_from_file_location('ch', os.path.join(ROOT, 'scripts', 'classement_hebdo.py'))
ch = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(ch)
_spec = importlib.util.spec_from_file_location('cm', os.path.join(ROOT, 'scripts', 'carte_mystere.py'))
cm = importlib.util.module_from_spec(_spec)
_argv, sys.argv = sys.argv, ['x']
_spec.loader.exec_module(cm)
sys.argv = _argv

TWEET = (
    "Qui dit Vendredi dit Carte de la Semaine 🔥\n\n"
    "Parmi toutes les pépites que t'as ajoutées à ta galerie cette semaine, laquelle te fait le plus kiffer ? "
    "Poste ton export (photo ou vidéo) en réponse et raconte-nous l'histoire de la carte 👀\n\n"
    "Les plus belles, je les repartage ! #sportscards #NBA"
)


def pick_card(since):
    rows = ch.api('cartes_manuelles', {
        'select': 'id,user_id,nom,equipe,annee,marque,collection,auto,patch,num,image_recto,image_recto_hd,created_at',
        'created_at': 'gte.' + ch.iso(since),
    })
    good = []
    for r in rows:
        img = r.get('image_recto_hd') or r.get('image_recto')
        if not img or 'placehold.co' in img or not r.get('nom'):
            continue
        pts, why = cm.score(r)
        r['_img'], r['_pts'], r['_why'] = img, pts, why
        good.append(r)
    good.sort(key=lambda r: -r['_pts'])
    # un tirage au sort parmi les 12 meilleures (autos, patchs, faibles tirages) : pas toujours la même carte
    head = good[:12]
    random.shuffle(head)
    return head + good[12:], len(rows)


def card_link(r):
    return 'https://www.memorabilius.fr/galerie/%s?card=%s' % (r['user_id'], urllib.parse.quote(r['image_recto'] or r['_img'], safe=''))


def export_photo(link, path):
    """Ouvre la carte sur le vrai site comme un visiteur, lance « Exporter en photo » et récupère l'image
    fabriquée par l'export (portrait, thème par défaut) : exactement ce que télécharge un membre."""
    import base64
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        browser = p.chromium.launch()
        try:
            page = browser.new_page(viewport={'width': 1280, 'height': 900}, locale='fr-FR')
            page.goto(link, wait_until='networkidle', timeout=60000)
            page.get_by_role('button', name='Exporter').first.click(timeout=30000)
            page.get_by_role('button', name='Exporter en photo').click(timeout=15000)
            page.get_by_role('button', name='Télécharger').wait_for(timeout=30000)
            page.wait_for_timeout(5000)  # le temps que l'export dessine la carte, les polices et le logo
            url = page.evaluate("() => { const c = [...document.querySelectorAll('canvas')].filter(c => c.width >= 800).pop();"
                                " return c ? c.toDataURL('image/jpeg', 0.95) : '' }")
        finally:
            browser.close()
    if not url.startswith('data:image/jpeg;base64,'):
        raise RuntimeError('export vide')
    with open(path, 'wb') as f:
        f.write(base64.b64decode(url.split(',', 1)[1]))


def export_video(link, path_mp4):
    """Même principe que export_photo, avec « Exporter en vidéo » : l'export enregistre l'animation (une dizaine de
    secondes) puis on récupère le fichier qu'il télécharge, converti en mp4 (le format accepté par X et Instagram)."""
    import re, subprocess, tempfile
    from playwright.sync_api import sync_playwright
    raw = os.path.join(tempfile.mkdtemp(), 'export')
    with sync_playwright() as p:
        browser = p.chromium.launch()
        try:
            page = browser.new_page(viewport={'width': 1280, 'height': 900}, locale='fr-FR', accept_downloads=True)
            page.goto(link, wait_until='networkidle', timeout=60000)
            page.get_by_role('button', name='Exporter').first.click(timeout=30000)
            page.get_by_role('button', name='Exporter en vidéo').click(timeout=15000)
            page.get_by_role('button', name='Générer').click(timeout=30000)
            with page.expect_download(timeout=120000) as dl:
                page.get_by_role('button', name=re.compile('Télécharger')).click(timeout=120000)
            dl.value.save_as(raw)
        finally:
            browser.close()
    for crf in ('22', '28', '34'):  # plus compressé si le fichier dépasse la limite d'envoi de Discord
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', raw, '-c:v', 'libx264', '-preset', 'medium', '-crf', crf,
                        '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', path_mp4], check=True)
        if os.path.getsize(path_mp4) < 20 * 1024 * 1024:
            return
    raise RuntimeError('vidéo trop lourde')


def to_jpeg(data, path):
    from PIL import Image
    im = Image.open(io.BytesIO(data)).convert('RGB')
    im.thumbnail((2000, 2000))  # reste très net, sous la limite d'envoi de Discord
    im.save(path, 'JPEG', quality=92)


def main():
    discord = '--discord' in sys.argv
    since = datetime.now(timezone.utc) - timedelta(days=7)
    cards, total = pick_card(since)
    print('Cartes ajoutées sur 7 jours :', total)

    out_dir = os.path.join(ROOT, 'docs', 'rdv', 'vendredi')
    os.makedirs(out_dir, exist_ok=True)
    path, card, exported = os.path.join(out_dir, 'carte-exemple.jpg'), None, ''
    video_path = os.path.join(out_dir, 'carte-exemple.mp4')
    # 1) l'export vidéo Memorabilius, tel qu'un membre le télécharge (navigateur sans affichage sur le vrai site)
    for r in cards[:3]:
        try:
            export_video(card_link(r), video_path)
            card, exported, path = r, 'video', video_path
            break
        except Exception as e:
            print('Export vidéo impossible :', type(e).__name__, str(e).splitlines()[0][:160] if str(e) else '')
    # 2) sinon l'export photo
    if not card:
        for r in cards[:3]:
            try:
                export_photo(card_link(r), path)
                card, exported = r, 'photo'
                break
            except Exception as e:
                print('Export photo impossible :', type(e).__name__, str(e).splitlines()[0][:160] if str(e) else '')
    # 3) secours : la photo brute de la carte
    if not card:
        for r in cards[:30]:
            try:
                req = urllib.request.Request(r['_img'], headers={'User-Agent': 'Mozilla/5.0 (vendredi)'})
                with urllib.request.urlopen(req, timeout=40) as resp:
                    to_jpeg(resp.read(), path)
                card = r
                break
            except Exception as e:
                print('Carte ignorée :', e)

    msg1 = ("**Vendredi : « ta carte de la semaine »** — à publier sur X vers 18 h.\n"
            "Texte du tweet à copier :\n```\n%s\n```" % TWEET)
    if not card:
        msg1 += "\n(Aucune carte ajoutée cette semaine pour servir d'exemple.)"
        print('Aucune carte exemple.')
        if discord:
            ch.post_discord(ch.ENV['DISCORD_WEBHOOK_URL'], msg1, [])
        else:
            print(msg1)
        return

    names = ch.names_for({card['user_id']})
    owner = names.get(card['user_id'], 'un membre')
    infos = ' · '.join(str(x) for x in (card.get('nom'), card.get('annee'), card.get('marque'), card.get('collection'), card.get('num')) if x)
    tags = ' / '.join(card['_why']) if card['_why'] else 'carte'
    how = {'video': "L'export vidéo est déjà fait, tu peux le poster tel quel. Pour une photo, ouvre la carte ici et clique sur Exporter :",
           'photo': "L'export photo est déjà fait, tu peux le poster tel quel. Pour une vidéo, ouvre la carte ici et clique sur Exporter :"}.get(
        exported, "Photo brute (l'export n'a pas pu être généré). Ouvre la carte ici et clique sur Exporter (photo ou vidéo) :")
    msg2 = ("**Carte d'exemple pour lancer le fil** (%s) — ajoutée par **%s** cette semaine.\n%s\n"
            "%s\n<%s>\n"
            "Pense à citer le membre (et à lui demander son accord)."
            % (tags, owner, infos, how, card_link(card)))
    if discord:
        ch.post_discord(ch.ENV['DISCORD_WEBHOOK_URL'], msg1, [])
        ch.post_discord(ch.ENV['DISCORD_WEBHOOK_URL'], msg2, [(os.path.basename(path), path)])
        print('Envoyé sur Discord.')
    else:
        print(msg1); print(msg2); print('Image :', path)


if __name__ == '__main__':
    main()
