#!/usr/bin/env python3
"""
Export du dataset ML depuis Supabase → deux datasets :
  • corners/        : YOLO-pose (détection des 4 coins de la carte)
  • identification/ : JSONL (identification nom/équipe/année/marque…)

Usage :
  pip install requests tqdm pillow python-dotenv
  python scripts/export_training_data.py

  # Options
  python scripts/export_training_data.py --out ml/dataset --limit 5000
  python scripts/export_training_data.py --corners-only   # coins uniquement
  python scripts/export_training_data.py --id-only        # identification uniquement
"""

import os
import json
import math
import random
import argparse
from pathlib import Path
from typing import Optional

import requests
from tqdm import tqdm

try:
    from dotenv import load_dotenv
    _has_dotenv = True
except ImportError:
    _has_dotenv = False

# ── Paramètres ────────────────────────────────────────────────────────────────

VAL_RATIO   = 0.15   # 15% validation, 85% entraînement
RANDOM_SEED = 42


# ── Client Supabase (REST pur, sans SDK) ──────────────────────────────────────

class SupabaseClient:
    def __init__(self, url: str, service_key: str):
        self.url = url.rstrip('/')
        self.headers = {
            'apikey': service_key,
            'Authorization': f'Bearer {service_key}',
        }

    def fetch_all(self, table: str, select: str, limit: int = 50_000) -> list[dict]:
        rows, offset, batch = [], 0, 1000
        while len(rows) < limit:
            r = requests.get(
                f'{self.url}/rest/v1/{table}',
                headers={**self.headers, 'Range-Unit': 'items', 'Range': f'{offset}-{offset+batch-1}'},
                params={'select': select, 'order': 'created_at.asc'},
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

    def download_public_url(self, url: str) -> Optional[bytes]:
        """Télécharge une image publique (image_recto = URL publique complète)."""
        try:
            r = requests.get(url, timeout=30)
            return r.content if r.status_code == 200 else None
        except Exception:
            return None

    def download_storage(self, bucket: str, path: str) -> Optional[bytes]:
        """Télécharge un fichier privé depuis Supabase Storage."""
        if not path:
            return None
        clean = path.lstrip('/')
        if clean.startswith(f'{bucket}/'):
            clean = clean[len(bucket)+1:]
        try:
            r = requests.get(
                f'{self.url}/storage/v1/object/{bucket}/{clean}',
                headers=self.headers,
                timeout=30,
            )
            return r.content if r.status_code == 200 else None
        except Exception:
            return None


# ── Helpers ───────────────────────────────────────────────────────────────────

def corners_to_yolo(corners: list[dict]) -> str:
    """
    Convertit 4 coins (fractions 0-1, ordre tl/tr/br/bl) en ligne YOLO-pose.
    Format : class cx cy bw bh  kp0x kp0y kp0v  kp1x kp1y kp1v  ...
    Visibilité 2 = labellisé et visible.
    """
    pts = [(c['x'], c['y']) for c in corners]
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    cx = sum(xs) / 4
    cy = sum(ys) / 4
    bw = max(xs) - min(xs)
    bh = max(ys) - min(ys)
    kps = '  '.join(f'{x:.6f} {y:.6f} 2' for x, y in pts)
    return f'0 {cx:.6f} {cy:.6f} {bw:.6f} {bh:.6f}  {kps}\n'


def split_rows(rows: list[dict], val_ratio: float, seed: int):
    rows = list(rows)
    random.seed(seed)
    random.shuffle(rows)
    n_val = max(1, math.floor(len(rows) * val_ratio))
    return {'val': rows[:n_val], 'train': rows[n_val:]}


# ── Export coins (YOLO-pose) ──────────────────────────────────────────────────

def export_corners(rows: list[dict], client: SupabaseClient, out: Path):
    valid = [r for r in rows if r.get('final_corners') and r.get('image_original')]
    print(f'  {len(valid)} lignes avec coins + image_original', end='')

    if not valid:
        print()
        print('  ⚠️  Aucune donnée de coins.')
        print('     Les cartes ajoutées après le déploiement ML auront image_original.')
        return

    already = [r for r in rows if r.get('final_corners') and not r.get('image_original')]
    if already:
        print(f'  (+ {len(already)} sans image_original — avant le déploiement)')
    else:
        print()

    splits = split_rows(valid, VAL_RATIO, RANDOM_SEED)

    for split, split_rows_ in splits.items():
        img_dir = out / 'images' / split
        lbl_dir = out / 'labels' / split
        img_dir.mkdir(parents=True, exist_ok=True)
        lbl_dir.mkdir(parents=True, exist_ok=True)

        ok = skipped = 0
        for row in tqdm(split_rows_, desc=f'  coins/{split}', unit='img'):
            img_bytes = client.download_storage('training-originals', row['image_original'])
            if not img_bytes:
                skipped += 1
                continue
            row_id = row['id']
            (img_dir / f'{row_id}.jpg').write_bytes(img_bytes)
            (lbl_dir / f'{row_id}.txt').write_text(corners_to_yolo(row['final_corners']))
            ok += 1

        print(f'    {split}: {ok} images, {skipped} ignorées')

    # data.yaml pour YOLOv8
    (out / 'data.yaml').write_text(
        f'path: {out.resolve()}\n'
        'train: images/train\n'
        'val:   images/val\n'
        '\n'
        'nc: 1\n'
        "names: ['card']\n"
        '\n'
        '# 4 keypoints : tl, tr, br, bl\n'
        'kpt_shape: [4, 3]\n'
        '# flip horizontal : tl↔tr (0↔1), bl↔br (3↔2)\n'
        'flip_idx: [1, 0, 3, 2]\n'
    )
    print(f'  ✓ {out}/data.yaml')
    print()
    print('  Entraînement :')
    print(f'    yolo train model=yolov8n-pose.pt data={out}/data.yaml epochs=100 imgsz=640')


# ── Export identification (JSONL) ─────────────────────────────────────────────

def export_identification(rows: list[dict], client: SupabaseClient, out: Path):
    valid = [r for r in rows if r.get('final_output') and r.get('image_recto')]
    print(f'  {len(valid)} lignes avec identification + image_recto')

    if not valid:
        print('  ⚠️  Aucune donnée.')
        return

    img_dir = out / 'images'
    img_dir.mkdir(parents=True, exist_ok=True)

    splits = split_rows(valid, VAL_RATIO, RANDOM_SEED)

    for split, split_rows_ in splits.items():
        jsonl_path = out / f'{split}.jsonl'
        ok = skipped = 0

        with open(jsonl_path, 'w', encoding='utf-8') as f:
            for row in tqdm(split_rows_, desc=f'  identification/{split}', unit='img'):
                img_bytes = client.download_public_url(row['image_recto'])
                if not img_bytes:
                    skipped += 1
                    continue

                row_id = row['id']
                rel_path = f'images/{row_id}.jpg'
                (img_dir / f'{row_id}.jpg').write_bytes(img_bytes)

                f.write(json.dumps({
                    'id':               row_id,
                    'image':            rel_path,
                    'label':            row['final_output'],
                    'gemini':           row['gemini_output'],
                    'corrected':        row.get('corrected', False),
                    'corrected_fields': row.get('corrected_fields') or [],
                }, ensure_ascii=False) + '\n')
                ok += 1

        print(f'    {split}: {ok} exemples, {skipped} ignorés')

    print(f'  ✓ {out}/train.jsonl  ({splits["train"].__len__()} lignes)')
    print(f'  ✓ {out}/val.jsonl    ({splits["val"].__len__()} lignes)')
    print()
    print('  Fine-tuning Qwen2-VL (exemple) :')
    print('    Voir ml/notebooks/finetune_qwen2vl.ipynb')


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description='Export dataset ML depuis Supabase')
    parser.add_argument('--env',          default='.env.local', help='Fichier .env')
    parser.add_argument('--out',          default='ml/dataset',  help='Dossier de sortie')
    parser.add_argument('--limit',        type=int, default=50_000)
    parser.add_argument('--corners-only', action='store_true')
    parser.add_argument('--id-only',      action='store_true')
    args = parser.parse_args()

    # Charge les variables d'environnement
    if _has_dotenv and Path(args.env).exists():
        load_dotenv(args.env)
        print(f'📄  Env chargé depuis {args.env}')

    url = os.environ.get('NEXT_PUBLIC_SUPABASE_URL') or os.environ.get('SUPABASE_URL', '')
    key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY') or os.environ.get('SUPABASE_SERVICE_KEY', '')

    if not url or not key:
        print('❌  Variables manquantes.')
        print('    Requis : NEXT_PUBLIC_SUPABASE_URL  +  SUPABASE_SERVICE_ROLE_KEY')
        print('    Dans .env.local ou exportées dans le shell.')
        raise SystemExit(1)

    client = SupabaseClient(url, key)
    out    = Path(args.out)

    print(f'\n📥  Récupération training_data...')
    rows = client.fetch_all(
        'training_data',
        'id,created_at,image_recto,image_original,'
        'gemini_corners,final_corners,corners_adjusted,'
        'gemini_output,final_output,corrected,corrected_fields',
        limit=args.limit,
    )
    print(f'    {len(rows)} lignes')

    if not rows:
        print('\n  Aucune donnée. Ajoute des cartes via le site, puis relance.')
        return

    if not args.id_only:
        print(f'\n🔲  Dataset coins → {out}/corners/')
        export_corners(rows, client, out / 'corners')

    if not args.corners_only:
        print(f'\n🃏  Dataset identification → {out}/identification/')
        export_identification(rows, client, out / 'identification')

    print(f'\n✅  Export terminé → {out.resolve()}')


if __name__ == '__main__':
    main()
