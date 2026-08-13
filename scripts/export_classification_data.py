#!/usr/bin/env python3
"""
Export du dataset de classification depuis Supabase.
Télécharge image_recto de chaque carte + labels (auto, patch, rc, printing_plate).
Export incrémental : ignore les images déjà présentes.

Usage :
  pip install requests tqdm python-dotenv
  python scripts/export_classification_data.py
  python scripts/export_classification_data.py --out ml/dataset/classification --limit 50000
"""

from __future__ import annotations
import os, csv, argparse
from pathlib import Path
import random
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


def fetch_cards(limit: int = 50_000) -> list[dict]:
    rows, offset, batch = [], 0, 1000
    while len(rows) < limit:
        r = requests.get(
            f'{SUPABASE_URL}/rest/v1/cartes_manuelles',
            headers={**HEADERS, 'Range-Unit': 'items', 'Range': f'{offset}-{offset+batch-1}'},
            params={
                'select': 'id,image_recto,auto,patch,rc,printing_plate',
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
    return [c for c in rows[:limit] if c.get('image_recto')]


def is_positive(card: dict) -> bool:
    return any(card.get(l) for l in ['auto', 'patch', 'rc', 'printing_plate'])


def smart_sample(cards: list[dict], max_negatives: int) -> list[dict]:
    """Garde tous les positifs + un échantillon aléatoire de négatifs."""
    positives = [c for c in cards if is_positive(c)]
    negatives = [c for c in cards if not is_positive(c)]
    random.shuffle(negatives)
    sampled_neg = negatives[:max_negatives]
    print(f'  {len(positives)} positifs  +  {len(sampled_neg)} négatifs  '
          f'(/{len(negatives)} dispo, limité à {max_negatives})')
    return positives + sampled_neg


def download(url: str) -> bytes | None:
    try:
        r = requests.get(url, timeout=30)
        return r.content if r.status_code == 200 else None
    except Exception:
        return None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--out',          default='ml/dataset/classification')
    parser.add_argument('--limit',        type=int, default=50_000)
    parser.add_argument('--max-negatives',type=int, default=8_000,
                        help='Max cartes sans aucun label positif (défaut: 8000)')
    args = parser.parse_args()

    out     = Path(args.out)
    img_dir = out / 'images'
    img_dir.mkdir(parents=True, exist_ok=True)

    print('Récupération des cartes depuis Supabase...')
    all_cards = fetch_cards(args.limit)
    print(f'{len(all_cards)} cartes avec photos au total')
    cards = smart_sample(all_cards, args.max_negatives)

    n_auto  = sum(1 for c in cards if c.get('auto'))
    n_patch = sum(1 for c in cards if c.get('patch'))
    n_rc    = sum(1 for c in cards if c.get('rc'))
    n_plate = sum(1 for c in cards if c.get('printing_plate'))
    print(f'  auto={n_auto}  patch={n_patch}  rc={n_rc}  printing_plate={n_plate}')

    rows, skipped, failed = [], 0, 0

    for card in tqdm(cards, desc='Téléchargement'):
        img_path = img_dir / f"{card['id']}.jpg"

        if img_path.exists():
            skipped += 1
        else:
            data = download(card['image_recto'])
            if not data:
                failed += 1
                continue
            img_path.write_bytes(data)

        rows.append({
            'filename':       img_path.name,
            'auto':           int(bool(card.get('auto'))),
            'patch':          int(bool(card.get('patch'))),
            'rc':             int(bool(card.get('rc'))),
            'printing_plate': int(bool(card.get('printing_plate'))),
        })

    csv_path = out / 'labels.csv'
    with open(csv_path, 'w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, fieldnames=['filename', 'auto', 'patch', 'rc', 'printing_plate'])
        w.writeheader()
        w.writerows(rows)

    print(f'\n✅  {len(rows)} images exportées  ({skipped} en cache, {failed} erreurs)')
    print(f'   Labels → {csv_path}')
    print(f'   Images → {img_dir}/')
    print()
    print('Prochaine étape :')
    print('  python scripts/train_classification.py')


if __name__ == '__main__':
    main()
