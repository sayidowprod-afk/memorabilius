"""
Reentrainement des coins avec un sigma OKS resserre.

Contexte : Ultralytics calcule la loss et le mAP des keypoints via une
tolerance OKS (sigma) par point. Pour un vrai modele de pose humaine
(kpt_shape == [17, 3]), il utilise des sigmas fins calibres par point.
Mais notre modele n'a que 4 keypoints (les coins de la carte), donc
Ultralytics tombe sur son cas par defaut :

    sigmas = torch.ones(nkpt) / nkpt   # -> 0.25 uniforme pour nkpt=4

(voir ultralytics/utils/loss.py:647 et ultralytics/models/yolo/pose/val.py:105)

0.25 est tres large : le modele est deja "recompense" par la loss/le
mAP quand un coin est a peu pres bon, meme si sa position reelle est
encore a plusieurs dizaines de pixels de la verite terrain. Resultat :
mAP proche de 0.99 des l'entrainement precedent, mais des coins pas
assez precis visuellement (confirme sur cartes reelles).

Ce script patche ce sigma (loss d'entrainement ET metrique de
validation, pour que le mAP rapporte reflete la vraie precision) avec
une valeur beaucoup plus stricte, et augmente le poids de la loss pose
pour renforcer le signal.
"""
import numpy as np
import torch
from ultralytics import YOLO
from ultralytics.utils.loss import v8PoseLoss, KeypointLoss
from ultralytics.models.yolo.pose.val import PoseValidator

CUSTOM_SIGMA = 0.04  # contre 0.25 par defaut -- exige une localisation bien plus precise

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

import os

RUN_DIR = 'runs/pose/train-28-tight-sigma-2'
LAST_CKPT = os.path.join(RUN_DIR, 'weights', 'last.pt')
MAX_EPOCHS = 500  # plafond haut -- patience=30 decide seul quand ca s'arrete vraiment,
                   # jamais coupe artificiellement si le modele s'ameliore encore a 300

# Ultralytics ignore le kwarg epochs quand resume=True (check_resume ne reprend
# que quelques champs whitelistes depuis le checkpoint, epochs n'en fait pas
# partie) -- sans ce patch, une reprise resterait bloquee au plafond d'origine
# (300) meme si le modele progresse encore.
from ultralytics.engine.trainer import BaseTrainer
_orig_check_resume = BaseTrainer.check_resume
def _patched_check_resume(self, overrides):
    _orig_check_resume(self, overrides)
    if self.resume:
        self.args.epochs = max(self.args.epochs, MAX_EPOCHS)
BaseTrainer.check_resume = _patched_check_resume

if __name__ == '__main__':
    if os.path.exists(LAST_CKPT):
        # Reprend exactement ou l'entrainement s'est arrete (epoch, optimiseur,
        # LR schedule) au lieu de tout refaire depuis yolov8n-pose.pt --
        # utile apres un crash/coupure de courant.
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
            pose=20.0,   # 12.0 par defaut -- renforce le signal sur les keypoints
            name='train-28-tight-sigma',
        )
