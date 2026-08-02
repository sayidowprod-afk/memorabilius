#!/usr/bin/env python3
"""
Export du dataset d'identification depuis Supabase pour fine-tuner Qwen2-VL-2B.
Génère un JSONL au format chat natif Qwen2-VL (compatible LLaMA-Factory).

Usage :
  pip install requests tqdm python-dotenv beautifulsoup4
  python scripts/export_identification_data.py
  python scripts/export_identification_data.py --out ml/dataset/identification --limit 2000
  python scripts/export_identification_data.py --tcdb   # enrichit card_number + variations via TCDB
"""

from __future__ import annotations
import os, json, argparse, random, re, time
from pathlib import Path
from difflib import SequenceMatcher
import requests
from tqdm import tqdm

try:
    from dotenv import load_dotenv
    load_dotenv('.env.local')
    load_dotenv('.env')
except ImportError:
    pass

SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL', '').rstrip('/')
SERVICE_KEY  = os.getenv('SUPABASE_SERVICE_ROLE_KEY', '')

if not SUPABASE_URL or not SERVICE_KEY:
    print('❌  NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis dans .env.local')
    raise SystemExit(1)

HEADERS = {'apikey': SERVICE_KEY, 'Authorization': f'Bearer {SERVICE_KEY}'}

PROMPT = """Tu es un expert mondial en cartes de collection sportives (NBA, NFL, MLB, NHL, soccer, WNBA) et TCG (Pokémon, Magic, Yu-Gi-Oh, One Piece, Dragon Ball, etc.).
Réponds UNIQUEMENT avec un objet JSON valide, sans markdown ni explication.

{
  "nom": "Joueur/personnage. Multi-joueurs: séparés par ' / '. Carte équipe: nom de l'équipe.",
  "equipe": "Sports US: ville+surnom (ex: Los Angeles Lakers). Soccer: club (ex: Real Madrid). Vide si TCG.",
  "annee": "Année ou saison (ex: 2023-24, 2023)",
  "marque": "Fabricant (ex: Panini, Topps, Upper Deck, Pokémon, Konami)",
  "collection": "SET sans la marque (ex: Prizm, Chrome, Mosaic, Optic, Select)",
  "variation": "Parallèle ou variante EXACTE. Vide si base standard.",
  "num": "Tirage sériel imprimé: '/Y' ou 'X/Y' (ex: '48/99', '/10', '1/1'). Vide sinon.",
  "card_number": "Numéro set au verso, sans '#' (ex: '48', 'HTR-IFS'). Vide si absent.",
  "grade": "Raw",
  "rc": false,
  "auto": false,
  "patch": false
}"""


def fetch_rows(limit: int) -> list[dict]:
    rows, offset, batch = [], 0, 1000
    while len(rows) < limit:
        r = requests.get(
            f'{SUPABASE_URL}/rest/v1/training_data',
            headers={**HEADERS, 'Range-Unit': 'items', 'Range': f'{offset}-{offset+batch-1}'},
            params={
                'select': 'id,image_recto,image_verso,gemini_output,final_output,corrected',
                'gemini_output': 'not.is.null',
                'image_recto': 'not.is.null',
                'order': 'created_at.asc',
            },
        )
        r.raise_for_status()
        chunk = r.json()
        if not chunk:
            break
        rows.extend(chunk)
        offset += len(chunk)
        if len(chunk) < batch:
            break
    return rows[:limit]


# ── TCDB enrichment ───────────────────────────────────────────────────────────

_TCDB_HEADERS = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
_tcdb_set_cache: dict[str, dict] = {}  # cache par (marque, collection, annee)


def _sim(a: str, b: str) -> float:
    return SequenceMatcher(None, a.lower().strip(), b.lower().strip()).ratio()


def tcdb_lookup_set(marque: str, collection: str, annee: str) -> dict:
    """
    Cherche le set sur TCDB, retourne {'sid': str, 'variations': [str]}.
    Résultat mis en cache pour éviter les doublons.
    """
    year = (annee or '').split('-')[0].strip()
    cache_key = f"{year}|{marque}|{collection}".lower()
    if cache_key in _tcdb_set_cache:
        return _tcdb_set_cache[cache_key]

    result: dict = {}
    try:
        from bs4 import BeautifulSoup
        query = ' '.join(filter(None, [year, marque, collection]))
        r = requests.get('https://www.tcdb.com/Search.cfm',
                         params={'s': query, 'T': 'S'},  # T=S = sets only
                         headers=_TCDB_HEADERS, timeout=15)
        soup = BeautifulSoup(r.text, 'html.parser')

        # Cherche le premier set dont le nom ressemble à marque+collection
        best_score, best_sid = 0.0, None
        for a in soup.select('a[href*="ViewSet.cfm"]'):
            href = a.get('href', '')
            text = a.get_text(strip=True)
            sid_match = re.search(r'sid[=/](\d+)', href, re.I)
            if not sid_match:
                continue
            score = max(_sim(collection, text), _sim(f"{marque} {collection}", text))
            if score > best_score:
                best_score = score
                best_sid = sid_match.group(1)

        if best_sid and best_score > 0.4:
            result['sid'] = best_sid
            # Récupère les variantes/parallèles du set
            time.sleep(0.4)
            rs = requests.get(f'https://www.tcdb.com/Checklist.cfm/sid/{best_sid}',
                              headers=_TCDB_HEADERS, timeout=15)
            ss = BeautifulSoup(rs.text, 'html.parser')
            # Les parallèles sont souvent listés dans un select ou une table de sous-sets
            variations = set()
            for opt in ss.select('select option, .parallel-name, td.var'):
                v = opt.get_text(strip=True)
                if v and len(v) > 2 and v.lower() not in ('base', 'regular', 'standard'):
                    variations.add(v)
            result['variations'] = sorted(variations)

        time.sleep(0.4)
    except Exception as e:
        pass

    _tcdb_set_cache[cache_key] = result
    return result


def tcdb_lookup_card(nom: str, marque: str, collection: str, annee: str) -> dict:
    """
    Cherche une carte spécifique sur TCDB, retourne {'card_number': str, 'variation': str}.
    """
    year = (annee or '').split('-')[0].strip()
    try:
        from bs4 import BeautifulSoup
        query = ' '.join(filter(None, [year, marque, collection, nom]))
        r = requests.get('https://www.tcdb.com/Search.cfm',
                         params={'s': query},
                         headers=_TCDB_HEADERS, timeout=15)
        soup = BeautifulSoup(r.text, 'html.parser')

        best_score, best_num = 0.0, ''
        for row in soup.select('tr, .search-result-item'):
            text = row.get_text(' ', strip=True)
            if not text:
                continue
            score = _sim(nom, text)
            # Cherche un numéro de carte dans le texte (#48, 48, HTR-IFS...)
            num_match = re.search(r'#([A-Za-z0-9\-]+)', text) or re.search(r'\b(\d+[A-Za-z\-]*)\b', text)
            if score > best_score and num_match:
                best_score = score
                best_num = num_match.group(1)

        if best_num and best_score > 0.4:
            return {'card_number': best_num}
        time.sleep(0.4)
    except Exception:
        pass
    return {}


def enrich_label_tcdb(label: dict) -> dict:
    """
    Enrichit un label avec card_number et liste des variations via TCDB.
    Ne modifie que les champs absents/vides.
    """
    nom        = label.get('nom', '')
    marque     = label.get('marque', '')
    collection = label.get('collection', '')
    annee      = label.get('annee', '')

    if not (marque and collection and annee):
        return label

    enriched = dict(label)

    # card_number manquant → cherche sur TCDB
    if not enriched.get('card_number'):
        info = tcdb_lookup_card(nom, marque, collection, annee)
        if info.get('card_number'):
            enriched['card_number'] = info['card_number']
            print(f"    TCDB card_number: {info['card_number']} ({nom})")

    # Récupère les variations du set pour méta-données futures
    set_info = tcdb_lookup_set(marque, collection, annee)
    if set_info.get('variations'):
        enriched['_tcdb_variations'] = set_info['variations']

    return enriched


# ── label helpers ──────────────────────────────────────────────────────────────

def best_label(row: dict) -> dict | None:
    """Utilise final_output si dispo (corrigé par l'utilisateur), sinon gemini_output."""
    label = row.get('final_output') or row.get('gemini_output')
    if not label:
        return None
    if isinstance(label, str):
        try:
            label = json.loads(label)
        except Exception:
            return None
    return label


def download(url: str) -> bytes | None:
    try:
        r = requests.get(url, timeout=30)
        return r.content if r.status_code == 200 else None
    except Exception:
        return None


def to_qwen_example(image_recto: str, label: dict, image_verso: str | None = None) -> dict:
    """Génère un exemple au format chat Qwen2-VL (compatible LLaMA-Factory).
    Si le verso est disponible, il est inclus comme deuxième image avec instruction."""
    content: list[dict] = [{"type": "image", "image": f"file://{image_recto}"}]
    if image_verso:
        content.append({"type": "image", "image": f"file://{image_verso}"})
        prompt_text = PROMPT + "\n\n⚠️ RÈGLE ABSOLUE : Image 1 = recto, Image 2 = verso.\n- 'annee' : lis UNIQUEMENT le verso (copyright ou saison imprimés au dos). N'invente jamais une année depuis le recto.\n- 'collection' : lis UNIQUEMENT le verso (nom du set imprimé au dos). Ex: 'Prizm', 'Mosaic', 'Totally Certified'.\n- 'variation' : combine recto (couleur/texture du bord) + verso (nom exact du parallèle).\n- 'num' : lis UNIQUEMENT le verso (tirage sérigraphié ou imprimé au dos).\nSi le verso ne confirme pas un champ, mets une chaîne vide."
    else:
        prompt_text = PROMPT
    content.append({"type": "text", "text": prompt_text})
    return {
        "messages": [
            {"role": "user", "content": content},
            {
                "role": "assistant",
                "content": [{"type": "text", "text": json.dumps(label, ensure_ascii=False)}],
            },
        ]
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--out',   default='ml/dataset/identification')
    parser.add_argument('--limit', type=int, default=5000)
    parser.add_argument('--val-ratio', type=float, default=0.1,
                        help='Fraction pour la validation (défaut: 0.1 = 10%%)')
    parser.add_argument('--tcdb', action='store_true',
                        help='Enrichit card_number + variations via TCDB (lent, ~0.8s/carte)')
    args = parser.parse_args()

    out     = Path(args.out)
    img_dir = out / 'images'
    img_dir.mkdir(parents=True, exist_ok=True)

    print('Récupération des données depuis Supabase...')
    rows = fetch_rows(args.limit)
    print(f'{len(rows)} exemples trouvés')

    examples, skipped, failed = [], 0, 0

    n_with_verso = 0

    for row in tqdm(rows, desc='Téléchargement'):
        label = best_label(row)
        if not label:
            skipped += 1
            continue

        if args.tcdb:
            label = enrich_label_tcdb(label)

        img_recto = img_dir / f"{row['id']}_recto.jpg"
        if not img_recto.exists():
            data = download(row['image_recto'])
            if not data:
                failed += 1
                continue
            img_recto.write_bytes(data)

        img_verso_path: Path | None = None
        if row.get('image_verso'):
            img_verso = img_dir / f"{row['id']}_verso.jpg"
            if not img_verso.exists():
                data = download(row['image_verso'])
                if data:
                    img_verso.write_bytes(data)
                    img_verso_path = img_verso
            else:
                img_verso_path = img_verso
            if img_verso_path:
                n_with_verso += 1

        # Sépare les méta-données TCDB du label réel
        clean_label = {k: v for k, v in label.items() if not k.startswith('_')}
        examples.append(to_qwen_example(
            str(img_recto.resolve()),
            clean_label,
            str(img_verso_path.resolve()) if img_verso_path else None,
        ))

    print(f'\n{len(examples)} exemples prêts  ({skipped} sans label, {failed} erreurs download)')
    print(f'   dont {n_with_verso} avec verso ({len(examples)-n_with_verso} recto seul)')

    # Sauvegarde le cache TCDB (variations par set) pour usage à l'inférence
    if args.tcdb and _tcdb_set_cache:
        tcdb_path = out / 'tcdb_variations.json'
        with open(tcdb_path, 'w', encoding='utf-8') as f:
            json.dump(_tcdb_set_cache, f, ensure_ascii=False, indent=2)
        n_sets = sum(1 for v in _tcdb_set_cache.values() if v.get('variations'))
        print(f'   TCDB : {n_sets} sets avec variations → {tcdb_path}')

    # Shuffle + split train/val
    random.shuffle(examples)
    n_val   = max(1, int(len(examples) * args.val_ratio))
    val     = examples[:n_val]
    train   = examples[n_val:]

    train_path = out / 'train.jsonl'
    val_path   = out / 'val.jsonl'

    with open(train_path, 'w', encoding='utf-8') as f:
        for ex in train:
            f.write(json.dumps(ex, ensure_ascii=False) + '\n')

    with open(val_path, 'w', encoding='utf-8') as f:
        for ex in val:
            f.write(json.dumps(ex, ensure_ascii=False) + '\n')

    print(f'   Train : {len(train)} exemples → {train_path}')
    print(f'   Val   : {len(val)} exemples  → {val_path}')
    print()
    print('Prochaine étape :')
    print('  Zippe ml/dataset/identification/ et upload sur Kaggle Datasets')
    print('  Puis lance le notebook de fine-tuning Qwen2-VL')


if __name__ == '__main__':
    main()
