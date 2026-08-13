#!/usr/bin/env python3
"""
Évaluation du modèle Qwen2-VL fine-tuné (identification de cartes).

Usage sur RunPod :
  python eval_identification.py
  python eval_identification.py --n 50 --checkpoint /workspace/qwen2vl_card_lora/checkpoint-826
  python eval_identification.py --n 50 --checkpoint GKNNN/qwen2vl-card-lora-v2
"""

import argparse, json, random, re
from pathlib import Path

FIELDS_TEXT = ['nom', 'equipe', 'annee', 'marque', 'collection', 'variation', 'num', 'card_number']
FIELDS_BOOL = ['rc', 'auto', 'patch']
ALL_FIELDS  = FIELDS_TEXT + FIELDS_BOOL


def extract_json(text: str) -> dict | None:
    text = text.strip()
    # 1. Parse direct
    try:
        return json.loads(text)
    except Exception:
        pass
    # 2. Bloc JSON dans le texte (markdown, prefixe, etc.)
    match = re.search(r'\{[\s\S]*\}', text)
    if match:
        try:
            return json.loads(match.group())
        except Exception:
            pass
    # 3. JSON tronqué — essayer de fermer les accolades ouvertes
    start = text.find('{')
    if start != -1:
        fragment = text[start:]
        # Compter les accolades pour savoir combien il en manque
        depth = sum(1 if c == '{' else -1 if c == '}' else 0 for c in fragment)
        for close in ['}' * depth, '"' + '}' * depth, '"}' + '}' * max(0, depth - 1)]:
            try:
                return json.loads(fragment + close)
            except Exception:
                pass
    return None


def normalize_val(val, is_bool: bool = False):
    if is_bool:
        if isinstance(val, bool):
            return val
        return str(val).lower() in ('true', '1', 'oui', 'yes')
    return str(val or '').strip().lower()


def compare_fields(pred: dict, truth: dict) -> dict:
    results = {}
    for f in FIELDS_TEXT:
        results[f] = normalize_val(pred.get(f)) == normalize_val(truth.get(f))
    for f in FIELDS_BOOL:
        results[f] = normalize_val(pred.get(f), True) == normalize_val(truth.get(f), True)
    return results


def remap_image_path(uri: str, image_dir: str) -> str:
    """file://C:\\Users\\...\\images\\xxx.jpg  →  /workspace/.../images/xxx.jpg"""
    path = uri.replace('file://', '').replace('\\', '/')
    basename = Path(path).name
    return str(Path(image_dir) / basename)


def load_model(checkpoint: str):
    from transformers import Qwen2VLForConditionalGeneration, AutoProcessor
    from peft import PeftModel
    import torch

    base = 'Qwen/Qwen2-VL-2B-Instruct'
    print(f'Chargement base model ({base})...')
    model = Qwen2VLForConditionalGeneration.from_pretrained(
        base, torch_dtype=torch.float16, device_map='auto'
    )
    print(f'Application adapter : {checkpoint}')
    model = PeftModel.from_pretrained(model, checkpoint)
    model = model.merge_and_unload()
    model.eval()
    processor = AutoProcessor.from_pretrained(base)
    print('Modèle chargé et prêt.\n')
    return model, processor


def run_inference(model, processor, messages: list, max_new_tokens: int = 512) -> str:
    from qwen_vl_utils import process_vision_info
    import torch

    text = processor.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    image_inputs, video_inputs = process_vision_info(messages)
    inputs = processor(
        text=[text],
        images=image_inputs,
        videos=video_inputs,
        padding=True,
        return_tensors='pt',
    ).to(model.device)

    with torch.no_grad():
        out = model.generate(
            **inputs,
            max_new_tokens=max_new_tokens,
            temperature=0.1,
            do_sample=False,
        )
    generated = out[0][inputs['input_ids'].shape[1]:]
    return processor.decode(generated, skip_special_tokens=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--n',          type=int,   default=50,
                        help='Nombre de cartes à évaluer')
    parser.add_argument('--val-jsonl',  default='/workspace/identification/val.jsonl',
                        help='Chemin vers val.jsonl')
    parser.add_argument('--checkpoint', default='GKNNN/qwen2vl-card-lora-v2',
                        help='Repo HF ou chemin local du checkpoint LoRA')
    parser.add_argument('--image-dir',  default='/workspace/identification/images',
                        help='Dossier contenant les images')
    parser.add_argument('--max-tokens', type=int,   default=512,
                        help='max_new_tokens pour la génération')
    parser.add_argument('--seed',       type=int,   default=42)
    args = parser.parse_args()

    random.seed(args.seed)

    # Charger val.jsonl
    val_path = Path(args.val_jsonl)
    if not val_path.exists():
        print(f'❌ {val_path} introuvable')
        return

    with open(val_path) as f:
        rows = [json.loads(l) for l in f if l.strip()]
    print(f'{len(rows)} exemples dans {val_path.name}')

    sample = random.sample(rows, min(args.n, len(rows)))
    print(f'Évaluation sur {len(sample)} cartes...\n')

    model, processor = load_model(args.checkpoint)

    correct_counts = {f: 0 for f in ALL_FIELDS}
    parse_errors   = 0
    infer_errors   = 0
    total          = 0

    for i, row in enumerate(sample):
        msgs     = row['messages']
        # Ground truth
        asst_content = msgs[1]['content']
        truth_text   = asst_content[0]['text'] if isinstance(asst_content, list) else asst_content
        truth        = extract_json(truth_text) or {}

        # Remap images vers le dossier local RunPod
        user_content = []
        for item in msgs[0]['content']:
            if item['type'] == 'image':
                local = remap_image_path(item['image'], args.image_dir)
                if not Path(local).exists():
                    user_content = None
                    break
                user_content.append({'type': 'image', 'image': local})
            else:
                user_content.append(item)

        if user_content is None:
            print(f'[{i+1:3d}] SKIP — image manquante')
            continue

        # Inférence
        try:
            output = run_inference(model, processor, [{'role': 'user', 'content': user_content}], args.max_tokens)
        except Exception as e:
            print(f'[{i+1:3d}] ERREUR inférence : {e}')
            infer_errors += 1
            continue

        # Parse JSON
        pred = extract_json(output)
        if pred is None:
            print(f'[{i+1:3d}] PARSE ERROR  output={output[:150]!r}')
            parse_errors += 1
            continue

        cmp   = compare_fields(pred, truth)
        total += 1
        for f in ALL_FIELDS:
            if cmp[f]:
                correct_counts[f] += 1

        # Affichage compact
        bad = [f for f in ALL_FIELDS if not cmp[f]]
        status = '✓' if not bad else '✗'
        nom_info = f"{truth.get('nom','?')} | {truth.get('annee','?')} {truth.get('marque','?')} {truth.get('collection','')}"
        print(f'[{i+1:3d}] {status}  {nom_info}')
        for f in bad:
            p = pred.get(f, '')
            t = truth.get(f, '')
            print(f'        ✗ {f:15s}  prédit={str(p)!r:30s}  vrai={str(t)!r}')

    # ── Résumé ────────────────────────────────────────────────
    print(f'\n{"="*60}')
    print(f'RÉSULTATS  {total}/{len(sample)} parsés   {parse_errors} parse_err   {infer_errors} infer_err')
    print(f'{"="*60}')
    if total:
        print(f'  {"champ":15s}  {"ok":>4s}/{total:<4d}  {"pct":>6s}  barre')
        print(f'  {"-"*55}')
        for f in ALL_FIELDS:
            n   = correct_counts[f]
            pct = n / total * 100
            bar = '█' * int(pct / 5) + '░' * (20 - int(pct / 5))
            print(f'  {f:15s}  {n:>4d}/{total:<4d}  {pct:5.1f}%  {bar}')
    print()


if __name__ == '__main__':
    main()
