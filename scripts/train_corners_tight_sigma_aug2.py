"""
Meme base que train_corners_tight_sigma_aug.py (sigma OKS resserre + patch
epoch ceiling + patch persistance EarlyStopping), avec l'augmentation
rotation/perspective/shear/luminosite poussee encore plus loin -- vise les cas
difficiles reels : carte mal orientee dans un toploader/sleeve, angle de prise
de vue prononce, reflet.

Voir train_corners_tight_sigma.py pour le detail du patch de sigma et
train_corners_tight_sigma_aug.py pour le detail des patchs epoch/EarlyStopping.
"""
import csv
import os

import numpy as np
import torch
from ultralytics import YOLO
from ultralytics.engine.trainer import BaseTrainer
from ultralytics.models.yolo.pose.val import PoseValidator
from ultralytics.utils.loss import KeypointLoss, v8PoseLoss

CUSTOM_SIGMA = 0.04

_orig_loss_init = v8PoseLoss.__init__
def _patched_loss_init(self, model, tal_topk=10, tal_topk2=10):
    _orig_loss_init(self, model, tal_topk, tal_topk2)
    nkpt = self.kpt_shape[0]
    self.keypoint_loss = KeypointLoss(sigmas=torch.full((nkpt,), CUSTOM_SIGMA, device=self.device))
v8PoseLoss.__init__ = _patched_loss_init

_orig_val_init_metrics = PoseValidator.init_metrics
def _patched_init_metrics(self, model):
    _orig_val_init_metrics(self, model)
    nkpt = self.kpt_shape[0]
    self.sigma = np.full(nkpt, CUSTOM_SIGMA)
PoseValidator.init_metrics = _patched_init_metrics

RUN_DIR = 'runs/pose/train-31-tight-sigma-aug2'
LAST_CKPT = os.path.join(RUN_DIR, 'weights', 'last.pt')
RESULTS_CSV = os.path.join(RUN_DIR, 'results.csv')
MAX_EPOCHS = 500

_orig_check_resume = BaseTrainer.check_resume
def _patched_check_resume(self, overrides):
    _orig_check_resume(self, overrides)
    if self.resume:
        self.args.epochs = max(self.args.epochs, MAX_EPOCHS)
BaseTrainer.check_resume = _patched_check_resume

_orig_resume_training = BaseTrainer.resume_training
def _patched_resume_training(self, ckpt):
    _orig_resume_training(self, ckpt)
    if ckpt is not None and self.resume and os.path.exists(RESULTS_CSV):
        try:
            with open(RESULTS_CSV) as f:
                rows = list(csv.DictReader(f))
            best_ep, best_fit = 0, -1.0
            for row in rows:
                ep = int(float(row['epoch']))
                fit = float(row['metrics/mAP50-95(B)']) + float(row['metrics/mAP50-95(P)'])
                if fit > best_fit:
                    best_fit, best_ep = fit, ep
            self.stopper.best_epoch = best_ep
            self.stopper.best_fitness = best_fit
            print(f'[patience-fix] EarlyStopping restaure depuis results.csv : best_epoch={best_ep} best_fitness={best_fit:.5f}')
        except Exception as e:
            print(f'[patience-fix] echec restauration du stopper (patience repart a zero) : {e}')
BaseTrainer.resume_training = _patched_resume_training

if __name__ == '__main__':
    if os.path.exists(LAST_CKPT):
        print(f'Reprise depuis {LAST_CKPT}')
        model = YOLO(LAST_CKPT)
        model.train(resume=True)
    else:
        model = YOLO('yolov8n-pose.pt')
        model.train(
            data='ml/dataset/corners/data.yaml',
            epochs=MAX_EPOCHS,
            patience=30,
            imgsz=640,
            batch=-1,
            device=0,
            pose=20.0,
            degrees=25,       # 12 -> 25 : cartes plus franchement mal orientees
            perspective=0.0012,  # 0.0006 -> doublé : angle de prise de vue prononce
            shear=8,          # 3 -> 8
            translate=0.15,   # defaut 0.1 -> 0.15 : carte pas centree dans le cadre
            scale=0.6,        # defaut 0.5 -> 0.6 : toploader plus loin/plus pres
            hsv_v=0.6,        # 0.5 -> 0.6 : reflets/luminosite sleeve
            hsv_s=0.9,        # 0.8 -> 0.9
            name='train-31-tight-sigma-aug2',
        )
