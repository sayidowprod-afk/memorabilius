#!/usr/bin/env python3
"""
Entraînement du classifieur multi-label de cartes sportives.
Labels : auto, patch, rc, printing_plate (4 sorties binaires indépendantes).

Architecture : EfficientNet-B0 pretrained ImageNet → 4 sorties sigmoid
Export final : ONNX → public/models/card_classifier.onnx (inférence navigateur)

Usage :
  pip install torch torchvision tqdm pillow
  python scripts/train_classification.py
  python scripts/train_classification.py --data ml/dataset/classification --epochs 15 --batch 32
"""

from __future__ import annotations
import argparse, csv, random, time
from pathlib import Path

import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader, WeightedRandomSampler
from torchvision import models, transforms
from PIL import Image
from tqdm import tqdm

LABELS    = ['auto', 'patch', 'rc']   # printing_plate exclu (6 exemples seulement)
IMG_SIZE  = 128   # 224→128 : 3x moins de pixels, 3x plus rapide sur CPU
DEVICE    = 'cuda' if torch.cuda.is_available() else 'cpu'


# ── Dataset ───────────────────────────────────────────────────────────────────

class CardDataset(Dataset):
    def __init__(self, rows: list[dict], img_dir: Path, transform=None):
        self.rows      = rows
        self.img_dir   = img_dir
        self.transform = transform

    def __len__(self):
        return len(self.rows)

    def __getitem__(self, idx):
        row = self.rows[idx]
        img = Image.open(self.img_dir / row['filename']).convert('RGB')
        if self.transform:
            img = self.transform(img)
        label = torch.tensor([float(row[l]) for l in LABELS], dtype=torch.float32)
        return img, label


def load_csv(csv_path: Path) -> list[dict]:
    with open(csv_path, newline='', encoding='utf-8') as f:
        return list(csv.DictReader(f))


def split(rows: list[dict], val_ratio=0.15, seed=42):
    rows = list(rows)
    random.seed(seed)
    random.shuffle(rows)
    n = max(1, int(len(rows) * val_ratio))
    return rows[n:], rows[:n]   # train, val


# ── Modèle ────────────────────────────────────────────────────────────────────

def build_model(num_labels: int = 4) -> nn.Module:
    # MobileNetV3-Small : 2x plus rapide qu'EfficientNet-B0 sur CPU, précision similaire
    m = models.mobilenet_v3_small(weights=models.MobileNet_V3_Small_Weights.IMAGENET1K_V1)
    in_features = m.classifier[3].in_features
    m.classifier[3] = nn.Linear(in_features, num_labels)
    return m


# ── Entraînement ──────────────────────────────────────────────────────────────

def train_epoch(model, loader, optimizer, criterion, epoch, total_epochs):
    model.train()
    total_loss = 0.0
    bar = tqdm(loader, desc=f'Epoch {epoch}/{total_epochs} train', leave=False)
    for imgs, labels in bar:
        imgs, labels = imgs.to(DEVICE), labels.to(DEVICE)
        optimizer.zero_grad()
        loss = criterion(model(imgs), labels)
        loss.backward()
        optimizer.step()
        total_loss += loss.item() * len(imgs)
        bar.set_postfix(loss=f'{loss.item():.4f}')
    return total_loss / len(loader.dataset)


@torch.no_grad()
def eval_epoch(model, loader, criterion):
    model.eval()
    total_loss, correct, total = 0.0, [0]*len(LABELS), 0
    for imgs, labels in tqdm(loader, desc='val', leave=False):
        imgs, labels = imgs.to(DEVICE), labels.to(DEVICE)
        logits = model(imgs)
        total_loss += criterion(logits, labels).item() * len(imgs)
        preds = (torch.sigmoid(logits) > 0.5).float()
        for i in range(len(LABELS)):
            correct[i] += (preds[:, i] == labels[:, i]).sum().item()
        total += len(imgs)
    accs = {LABELS[i]: correct[i]/total for i in range(len(LABELS))}
    return total_loss / total, accs


# ── Export ONNX ───────────────────────────────────────────────────────────────

def export_onnx(model: nn.Module, out_path: Path):
    model.eval()
    dummy = torch.zeros(1, 3, IMG_SIZE, IMG_SIZE).to(DEVICE)
    torch.onnx.export(
        model, dummy, str(out_path),
        input_names=['image'],
        output_names=['logits'],
        dynamic_axes={'image': {0: 'batch'}, 'logits': {0: 'batch'}},
        opset_version=12,
    )
    print(f'ONNX exporté → {out_path}  ({out_path.stat().st_size / 1e6:.1f} MB)')


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--data',   default='ml/dataset/classification')
    parser.add_argument('--out',    default='ml/models')
    parser.add_argument('--epochs', type=int,   default=12)
    parser.add_argument('--batch',  type=int,   default=32)
    parser.add_argument('--lr',     type=float, default=1e-4)
    args = parser.parse_args()

    data_dir = Path(args.data)
    img_dir  = data_dir / 'images'
    out_dir  = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    print(f'Device : {DEVICE}')
    all_rows = load_csv(data_dir / 'labels.csv')
    print(f'{len(all_rows)} exemples chargés')

    train_rows, val_rows = split(all_rows)
    print(f'  train={len(train_rows)}  val={len(val_rows)}')

    tf_train = transforms.Compose([
        transforms.Resize((IMG_SIZE + 32, IMG_SIZE + 32)),
        transforms.RandomCrop(IMG_SIZE),
        transforms.RandomHorizontalFlip(),
        transforms.ColorJitter(brightness=0.3, contrast=0.3, saturation=0.2),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
    ])
    tf_val = transforms.Compose([
        transforms.Resize((IMG_SIZE, IMG_SIZE)),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
    ])

    ds_train = CardDataset(train_rows, img_dir, tf_train)
    ds_val   = CardDataset(val_rows,   img_dir, tf_val)

    # WeightedRandomSampler : compense le déséquilibre auto/patch/plate
    # On pondère chaque exemple par la rareté de ses labels actifs
    label_counts = [sum(int(r[l]) for r in train_rows) for l in LABELS]
    label_weights = [len(train_rows) / (c + 1) for c in label_counts]
    sample_weights = []
    for r in train_rows:
        active = [label_weights[i] for i, l in enumerate(LABELS) if int(r[l])]
        sample_weights.append(max(active) if active else 1.0)
    sampler = WeightedRandomSampler(sample_weights, len(sample_weights))

    dl_train = DataLoader(ds_train, batch_size=args.batch, sampler=sampler,  num_workers=0)
    dl_val   = DataLoader(ds_val,   batch_size=args.batch, shuffle=False, num_workers=0)

    model     = build_model(len(LABELS)).to(DEVICE)
    criterion = nn.BCEWithLogitsLoss()
    optimizer = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=args.epochs)

    best_val_loss = float('inf')
    best_path = out_dir / 'card_classifier_best.pt'

    for epoch in range(1, args.epochs + 1):
        t0 = time.time()
        train_loss = train_epoch(model, dl_train, optimizer, criterion, epoch, args.epochs)
        val_loss, accs = eval_epoch(model, dl_val, criterion)
        scheduler.step()

        acc_str = '  '.join(f'{l}={accs[l]:.3f}' for l in LABELS)
        print(f'Epoch {epoch:02d}/{args.epochs}  train={train_loss:.4f}  val={val_loss:.4f}  [{acc_str}]  {time.time()-t0:.0f}s')

        if val_loss < best_val_loss:
            best_val_loss = val_loss
            torch.save(model.state_dict(), best_path)
            print(f'  → meilleur modèle sauvegardé ({best_path})')

    # Charger le meilleur modèle et exporter en ONNX
    model.load_state_dict(torch.load(best_path, map_location=DEVICE))
    onnx_path = out_dir / 'card_classifier.onnx'
    export_onnx(model, onnx_path)

    print()
    print('✅  Entraînement terminé !')
    print(f'   Modèle PyTorch → {best_path}')
    print(f'   Modèle ONNX    → {onnx_path}')
    print()
    print('Déploiement :')
    print(f'  copy {onnx_path} public/models/card_classifier.onnx')
    print('  git add public/models/card_classifier.onnx && git commit -m "feat(ml): classifieur auto/patch/rc v1" && git push')


if __name__ == '__main__':
    main()
