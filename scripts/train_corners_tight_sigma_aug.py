"""
Meme sigma OKS resserre que train_corners_tight_sigma.py, combine cette fois
avec l'augmentation rotation/perspective/luminosite (testee separement dans
train-27, jamais combinee avec le sigma resserre) -- vise a la fois la
precision (sigma) et la robustesse sur les cas difficiles type sleeve/
toploader/reflet (augmentation), sur le dataset enrichi + sur-echantillonne
deja sur le disque (voir scripts/export_training_data.py).

Voir train_corners_tight_sigma.py pour le detail du patch de sigma.
"""
import numpy as np
import torch
from ultralytics import YOLO
from ultralytics.utils.loss import v8PoseLoss, KeypointLoss
from ultralytics.models.yolo.pose.val import PoseValidator

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

if __name__ == '__main__':
    model = YOLO('yolov8n-pose.pt')
    model.train(
        data='ml/dataset/corners/data.yaml',
        epochs=300,
        patience=30,
        imgsz=640,
        batch=-1,
        device=0,
        pose=20.0,
        degrees=12,
        perspective=0.0006,
        shear=3,
        hsv_v=0.5,
        hsv_s=0.8,
        name='train-30-tight-sigma-aug',
    )
