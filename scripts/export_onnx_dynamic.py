"""
Export d'un checkpoint YOLO-pose (.pt) vers ONNX fp32 puis quantification
dynamique int8 -- meme pipeline que train-29/30/32 (voir quantize_static.py
pour le detail de pourquoi la statique reste abandonnee sur cette
architecture : bug de confidence a 0.000).

Usage :
  python scripts/export_onnx_dynamic.py runs/pose/train-33-zero-aug-x5/weights/best.pt --out public/models/corners-train33-dynamic.onnx
"""
from __future__ import annotations
import argparse
import os


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('checkpoint', help='Checkpoint .pt en entree')
    ap.add_argument('--out', required=True, help='Chemin du .onnx quantifie en sortie')
    ap.add_argument('--imgsz', type=int, default=640)
    args = ap.parse_args()

    from ultralytics import YOLO
    model = YOLO(args.checkpoint)
    fp32_path = model.export(format='onnx', imgsz=args.imgsz, simplify=True, opset=12)
    print(f'Export fp32 : {fp32_path}')

    from onnxruntime.quantization import quantize_dynamic, QuantType
    quantize_dynamic(fp32_path, args.out, weight_type=QuantType.QUInt8)
    print(f'Quantifie (dynamique) : {args.out}')

    os.remove(fp32_path)


if __name__ == '__main__':
    main()
