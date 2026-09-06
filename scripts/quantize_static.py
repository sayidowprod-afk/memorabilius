"""
Quantification INT8 "statique" calibree, au lieu de "dynamique".

La quantification dynamique (quantize_dynamic, deja utilisee jusqu'ici) choisit
les echelles de quantification a la volee, par tenseur, sans rien connaitre des
donnees reelles -- simple et rapide a produire, mais moins precise. La
quantification statique calibre ces echelles sur un vrai echantillon d'images
(le meme pretraitement que production : letterbox 640x640, RGB, /255) avant de
figer les poids -- generalement plus precise a vitesse egale voire meilleure
(moins d'operations de dequant/requant a l'execution).

Usage :
  python scripts/quantize_static.py model.onnx --images ml/dataset/corners/images/val --out model-int8-static.onnx --n 200
"""
from __future__ import annotations
import argparse
import glob
import os
import random

import numpy as np
from PIL import Image
from onnxruntime.quantization import quantize_static, QuantType, QuantFormat, CalibrationDataReader

IMGSZ = 640


def letterbox(img: Image.Image) -> np.ndarray:
    w, h = img.size
    scale = min(IMGSZ / w, IMGSZ / h)
    nw, nh = round(w * scale), round(h * scale)
    padx, pady = (IMGSZ - nw) // 2, (IMGSZ - nh) // 2
    canvas = Image.new('RGB', (IMGSZ, IMGSZ), (114, 114, 114))
    canvas.paste(img.resize((nw, nh)), (padx, pady))
    arr = np.asarray(canvas).astype(np.float32) / 255.0
    return arr.transpose(2, 0, 1)  # HWC -> CHW


class ImageCalibrationReader(CalibrationDataReader):
    def __init__(self, image_paths: list[str], input_name: str):
        self.input_name = input_name
        self.paths = iter(image_paths)

    def get_next(self):
        path = next(self.paths, None)
        if path is None:
            return None
        try:
            img = Image.open(path).convert('RGB')
        except Exception:
            return self.get_next()
        tensor = letterbox(img)[None, ...]  # add batch dim
        return {self.input_name: tensor}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('model', help='Modele ONNX fp32 en entree (pas encore quantifie)')
    ap.add_argument('--images', required=True, help='Dossier d\'images reelles pour la calibration')
    ap.add_argument('--out', required=True)
    ap.add_argument('--n', type=int, default=200, help='Nombre d\'images de calibration')
    args = ap.parse_args()

    all_images = glob.glob(os.path.join(args.images, '*.jpg')) + glob.glob(os.path.join(args.images, '*.jpeg')) + glob.glob(os.path.join(args.images, '*.png'))
    random.seed(42)
    random.shuffle(all_images)
    calib_images = all_images[:args.n]
    print(f'{len(calib_images)} images de calibration (sur {len(all_images)} disponibles)')

    import onnx
    input_name = onnx.load(args.model).graph.input[0].name

    reader = ImageCalibrationReader(calib_images, input_name)
    quantize_static(
        args.model, args.out, reader,
        quant_format=QuantFormat.QDQ,
        activation_type=QuantType.QInt8,
        weight_type=QuantType.QInt8,
        # Sans per_channel, l'echelle est calculee sur tout le tenseur de sortie
        # de la tete pose -- qui empaquette bbox + objectness + 4 keypoints avec
        # des amplitudes tres differentes. Ca ecrase les canaux a faible
        # amplitude (souvent la confiance) a zero apres dequant : c'est ce qui
        # a rendu train-30-static totalement muet (conf 0.000 partout).
        per_channel=True,
    )
    print(f'Sauvegarde : {args.out}')


if __name__ == '__main__':
    main()
