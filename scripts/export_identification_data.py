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
import os, json, argparse, random, re
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


# ── TCDB local enrichment (uses scripts/year-data/ scraped files) ─────────────

_LOCAL_YEAR_DATA = Path(__file__).parent / 'year-data'
_NAME_INDEX_PATH = Path(__file__).parent / 'tcdb_name_index.json'
_tcdb_name_index: dict | None = None   # tcdb_id (str) → set_name (str)
_tcdb_set_cache:  dict        = {}     # cache par "annee|marque|collection"


def _sim(a: str, b: str) -> float:
    return SequenceMatcher(None, a.lower().strip(), b.lower().strip()).ratio()


def _load_name_index() -> dict:
    """
    Index : tcdb_id (str) → {'name': str, 'file': str}
    Construit une seule fois depuis scripts/year-data/, puis mis en cache sur disque.
    """
    global _tcdb_name_index
    if _tcdb_name_index is not None:
        return _tcdb_name_index

    if _NAME_INDEX_PATH.exists():
        with open(_NAME_INDEX_PATH, 'r', encoding='utf-8') as f:
            _tcdb_name_index = json.load(f)
        # Rétrocompatibilité : ancien format {sid: name_str}
        first_val = next(iter(_tcdb_name_index.values()), None)
        if isinstance(first_val, str):
            _tcdb_name_index = None  # force rebuild
        else:
            print(f'  TCDB index chargé : {len(_tcdb_name_index)} sets')
            return _tcdb_name_index

    print('  Construction de l\'index TCDB local (une seule fois)...')
    index: dict = {}
    files = list(_LOCAL_YEAR_DATA.glob('scraped-*.json'))
    for fpath in tqdm(files, desc='Index TCDB'):
        try:
            with open(fpath, 'r', encoding='utf-8') as f:
                data = json.load(f)
            for s in data.get('sets', []):
                sid  = str(s['set']['tcdb_id'])
                index[sid] = {'name': s['set']['name'], 'file': fpath.name}
        except Exception:
            pass

    with open(_NAME_INDEX_PATH, 'w', encoding='utf-8') as f:
        json.dump(index, f, ensure_ascii=False)
    print(f'  Index TCDB construit : {len(index)} sets → {_NAME_INDEX_PATH}')
    _tcdb_name_index = index
    return index


def _find_set_id(marque: str, collection: str, annee: str) -> str | None:
    """Retourne le tcdb_id local dont le nom ressemble le mieux à marque+collection+annee."""
    index = _load_name_index()
    if not index:
        return None

    year  = (annee or '').split('-')[0].strip()
    query = ' '.join(filter(None, [year, marque, collection])).lower()

    best_score, best_sid = 0.0, None
    for sid, entry in index.items():
        name  = entry['name'] if isinstance(entry, dict) else entry
        score = _sim(query, name)
        if year and year in name:
            score = min(1.0, score + 0.1)
        if score > best_score:
            best_score = score
            best_sid   = sid

    return best_sid if best_score > 0.35 else None


def _load_set_cards(tcdb_id: str) -> list[dict]:
    """Charge les cartes du set tcdb_id depuis le fichier scraped approprié."""
    index = _load_name_index()
    entry = index.get(tcdb_id)
    if not entry:
        return []

    fname = entry['file'] if isinstance(entry, dict) else f'scraped-{tcdb_id}.json'
    fpath = _LOCAL_YEAR_DATA / fname
    if not fpath.exists():
        return []

    try:
        with open(fpath, 'r', encoding='utf-8') as f:
            data = json.load(f)
        tid = int(tcdb_id)
        for s in data.get('sets', []):
            if s['set']['tcdb_id'] == tid:
                return s.get('unique', [])
        return []
    except Exception:
        return []


def enrich_label_tcdb(label: dict) -> dict:
    """Enrichit card_number et variations via les fichiers TCDB locaux (pas de réseau)."""
    nom        = label.get('nom', '')
    marque     = label.get('marque', '')
    collection = label.get('collection', '')
    annee      = label.get('annee', '')

    if not (marque and collection and annee):
        return label

    cache_key = f"{annee}|{marque}|{collection}".lower()
    if cache_key not in _tcdb_set_cache:
        sid = _find_set_id(marque, collection, annee)
        if sid:
            cards      = _load_set_cards(sid)
            variations = sorted({c['variation'] for c in cards if c.get('variation')})
            _tcdb_set_cache[cache_key] = {'sid': sid, 'cards': cards, 'variations': variations}
        else:
            _tcdb_set_cache[cache_key] = {}

    set_info = _tcdb_set_cache.get(cache_key, {})
    if not set_info:
        return label

    enriched = dict(label)

    if set_info.get('variations'):
        enriched['_tcdb_variations'] = set_info['variations']

    if not enriched.get('card_number') and nom and set_info.get('cards'):
        best_score, best_card = 0.0, None
        for card in set_info['cards']:
            score = _sim(nom, card.get('player_name', ''))
            if score > best_score:
                best_score = score
                best_card  = card

        if best_score > 0.6 and best_card:
            enriched['card_number'] = best_card['card_number']
            if best_card.get('variation') and not enriched.get('variation'):
                enriched['variation'] = best_card['variation']
            print(f'    TCDB local : #{best_card["card_number"]} {nom} (score={best_score:.2f})')

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
