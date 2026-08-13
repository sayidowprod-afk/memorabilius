#!/usr/bin/env python3
"""
Test rapide OCR sur quelques cartes du dataset.
Montre ce qu'EasyOCR extrait de chaque image.

Usage :
  pip install easyocr
  python scripts/test_ocr.py
  python scripts/test_ocr.py --n 20 --dir ml/dataset/classification/images
"""

import argparse, random
from pathlib import Path
import easyocr

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--dir', default='ml/dataset/classification/images')
    parser.add_argument('--n',   type=int, default=10)
    args = parser.parse_args()

    images = list(Path(args.dir).glob('*.jpg'))
    if not images:
        print(f'Aucune image trouvée dans {args.dir}')
        return

    sample = random.sample(images, min(args.n, len(images)))

    print('Chargement EasyOCR (première fois = télécharge ~100MB)...')
    reader = easyocr.Reader(['en', 'fr'], gpu=False)
    print()

    for img_path in sample:
        results = reader.readtext(str(img_path), detail=1)
        texts = [(text.strip(), round(conf, 2)) for (_, text, conf) in results if conf > 0.3 and text.strip()]
        print(f'── {img_path.name}')
        if texts:
            for text, conf in texts:
                print(f'   {conf:.2f}  "{text}"')
        else:
            print('   (rien détecté)')
        print()

if __name__ == '__main__':
    main()
