#!/usr/bin/env python3
"""
Export du dataset d'identification depuis Supabase pour fine-tuner Qwen2-VL-2B.
Génère un JSONL au format chat natif Qwen2-VL (compatible LLaMA-Factory).

Usage :
  pip install requests tqdm python-dotenv
  python scripts/export_identification_data.py
  python scripts/export_identification_data.py --out ml/dataset/identification --limit 2000
"""

from __future__ import annotations
import os, json, argparse, random
from pathlib import Path
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
        prompt_text = PROMPT + "\n\nImage 1 = recto, Image 2 = verso. Le verso fait autorité pour : collection, variation, num, rc, auto, patch, copyright année."
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

        examples.append(to_qwen_example(
            str(img_recto.resolve()),
            label,
            str(img_verso_path.resolve()) if img_verso_path else None,
        ))

    print(f'\n{len(examples)} exemples prêts  ({skipped} sans label, {failed} erreurs download)')
    print(f'   dont {n_with_verso} avec verso ({len(examples)-n_with_verso} recto seul)')

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
