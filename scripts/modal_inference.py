import modal, base64, io, json, re

image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "torch",
        "torchvision",
        extra_index_url="https://download.pytorch.org/whl/cu124",
    )
    .pip_install(
        "transformers>=4.45.0",
        "accelerate",
        "qwen-vl-utils",
        "Pillow",
        "huggingface_hub",
        "fastapi[standard]",
        "easyocr",
    )
)

vol = modal.Volume.from_name("qwen2vl-model-cache", create_if_missing=True)
app = modal.App("qwen2vl-cards")

HF_MODEL = "GKNNN/qwen2vl-card-v4-merged"
MODEL_DIR = "/model"

PROMPT = """Analyse cette carte de collection sportive ou TCG. Retourne UNIQUEMENT un objet JSON valide, sans markdown.

{
  "nom": "Joueur/personnage. Multi: séparés par ' / '. Carte équipe: nom équipe.",
  "equipe": "Sports: ville+surnom (ex: Los Angeles Lakers). Soccer: club. Vide si TCG.",
  "annee": "Année ou saison exacte (ex: 2023-24, 2023). Lis sur la carte.",
  "marque": "Fabricant (ex: Panini, Topps, Upper Deck, Pokémon)",
  "collection": "Set sans la marque (ex: Prizm, Chrome, Mosaic)",
  "variation": "Parallèle/variante exacte imprimée sur la carte. Vide si base standard.",
  "num": "Tirage sériel imprimé: '/Y' ou 'X/Y'. Vide sinon.",
  "card_number": "Numéro du set au verso, sans '#'. Vide si absent.",
  "grade": "Raw",
  "rc": false,
  "auto": false,
  "patch": false
}

Si verso présent: image 1=recto, image 2=verso. Le verso fait autorité pour collection, variation, num, card_number, année (copyright)."""


@app.cls(
    image=image,
    gpu="A10G",
    volumes={MODEL_DIR: vol},
    timeout=600,
    scaledown_window=1800,
    secrets=[modal.Secret.from_name("huggingface")],
)
class Model:
    @modal.enter()
    def load(self):
        import os
        from pathlib import Path
        from transformers import Qwen2VLForConditionalGeneration, AutoProcessor
        import torch
        import easyocr

        if not Path(f"{MODEL_DIR}/config.json").exists():
            from huggingface_hub import snapshot_download
            print("Téléchargement du modèle depuis HuggingFace...")
            snapshot_download(HF_MODEL, local_dir=MODEL_DIR, token=os.environ["HF_TOKEN"])
            vol.commit()

        self.model = Qwen2VLForConditionalGeneration.from_pretrained(
            MODEL_DIR, torch_dtype=torch.float16, device_map="auto"
        )
        self.processor = AutoProcessor.from_pretrained(
            MODEL_DIR,
            min_pixels=128 * 28 * 28,
            max_pixels=560 * 28 * 28,
        )
        self.model.eval()
        self.ocr = easyocr.Reader(['en'], gpu=True, verbose=False)
        print("Modèle + OCR chargés.")

    @modal.fastapi_endpoint(method="GET")
    def warmup(self):
        return {"status": "warm"}

    def _ocr_card_number(self, img) -> str:
        import numpy as np
        w, h = img.size
        # Crop : bandes basse et haute du verso où le card_number apparaît
        crops = [
            img.crop((0, int(h * 0.85), w, h)),   # bas
            img.crop((0, 0, w, int(h * 0.15))),    # haut
        ]
        candidates = []
        for crop in crops:
            results = self.ocr.readtext(
                np.array(crop), detail=1,
                allowlist='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-',
            )
            for (_, text, conf) in results:
                text = text.strip().lstrip('#').strip()
                if conf < 0.4 or not text:
                    continue
                # Pattern card_number : digits seuls, ou alphanum avec tiret
                if re.fullmatch(r'\d{1,4}', text):
                    candidates.append((conf, text))
                elif re.fullmatch(r'[A-Z0-9]{1,4}-[A-Z0-9]{1,6}', text):
                    candidates.append((conf, text))
        if candidates:
            candidates.sort(reverse=True)
            return candidates[0][1]
        return ""

    def _infer(self, messages: list, max_new_tokens: int = 300) -> str:
        from qwen_vl_utils import process_vision_info
        import torch

        text = self.processor.apply_chat_template(
            messages, tokenize=False, add_generation_prompt=True
        )
        image_inputs, _ = process_vision_info(messages)
        inputs = self.processor(
            text=[text], images=image_inputs, return_tensors="pt"
        ).to("cuda")
        with torch.no_grad():
            out = self.model.generate(**inputs, max_new_tokens=max_new_tokens, do_sample=False)
        return self.processor.decode(out[0][inputs["input_ids"].shape[1]:], skip_special_tokens=True)

    @modal.fastapi_endpoint(method="POST")
    def predict(self, body: dict):
        from PIL import Image

        def load_img(b64: str):
            img = Image.open(io.BytesIO(base64.b64decode(b64))).convert("RGB")
            img.thumbnail((700, 700), Image.LANCZOS)
            return img

        images = {}
        for key in ["recto", "verso"]:
            b64 = body.get(key)
            if b64:
                images[key] = load_img(b64)

        if not images:
            return {"error": "Aucune image fournie"}

        # Pass 1 — identification complète
        content = [{"type": "image", "image": img} for img in images.values()]
        content.append({"type": "text", "text": PROMPT})
        raw = self._infer([{"role": "user", "content": content}])

        card = {}
        match = re.search(r"\{[\s\S]*\}", raw)
        if match:
            try:
                card = json.loads(match.group())
            except Exception:
                pass

        # Pass 2 — EasyOCR sur le verso si card_number vide
        if not card.get("card_number") and "verso" in images:
            card["card_number"] = self._ocr_card_number(images["verso"])

        if card:
            return card
        return {"error": "parse_failed", "raw": raw[:500]}
