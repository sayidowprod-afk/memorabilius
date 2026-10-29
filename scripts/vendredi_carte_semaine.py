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
    random.shuffle(good)
    good.sort(key=lambda r: -r['_pts'])
    return good, len(rows)


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
    path, card = os.path.join(out_dir, 'carte-exemple.jpg'), None
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
    link = 'https://www.memorabilius.fr/galerie/%s?card=%s' % (card['user_id'], urllib.parse.quote(card['image_recto'] or card['_img'], safe=''))
    msg2 = ("**Carte d'exemple pour lancer le fil** (%s) — ajoutée par **%s** cette semaine.\n%s\n"
            "Ouvre-la ici, clique sur Exporter (photo ou vidéo) et poste l'export en premier :\n<%s>\n"
            "Pense à citer le membre (et à lui demander son accord)."
            % (tags, owner, infos, link))
    if discord:
        ch.post_discord(ch.ENV['DISCORD_WEBHOOK_URL'], msg1, [])
        ch.post_discord(ch.ENV['DISCORD_WEBHOOK_URL'], msg2, [('carte-exemple.jpg', path)])
        print('Envoyé sur Discord.')
    else:
        print(msg1); print(msg2); print('Image :', path)


if __name__ == '__main__':
    main()
