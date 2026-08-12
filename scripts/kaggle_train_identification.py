# ============================================================
# NOTEBOOK KAGGLE — Fine-tune Qwen2-VL-2B pour identification cartes
# GPU : T4 x2  |  Durée : ~2-3h  |  Coût : 0€
#
# AVANT DE LANCER :
#   1. Settings → Accelerator → GPU T4 x2
#   2. Settings → Internet → ON
#   3. Add Dataset → ton dataset "card-identification"
# ============================================================

# ── CELL 1 : Installation ───────────────────────────────────
import subprocess, sys

subprocess.run([sys.executable, '-m', 'pip', 'install', '-q',
    'git+https://github.com/hiyouga/LLaMA-Factory.git',
    'bitsandbytes', 'deepspeed', 'wandb',
], check=True)

print('✅ LLaMA-Factory installé')


# ── CELL 2 : Trouver le dataset ─────────────────────────────
import glob, os, shutil, json
from pathlib import Path

# Cherche les fichiers JSONL uploadés
found = glob.glob('/kaggle/input/**/*.jsonl', recursive=True)
print('Fichiers JSONL trouvés :', found)

# Copie dans /kaggle/working/data/
DATA_DIR = '/kaggle/working/data'
os.makedirs(DATA_DIR, exist_ok=True)

train_src = next((f for f in found if 'train' in f), None)
val_src   = next((f for f in found if 'val'   in f), None)

if not train_src:
    raise RuntimeError('train.jsonl introuvable — vérifie le dataset Kaggle')

shutil.copy(train_src, f'{DATA_DIR}/train.jsonl')
shutil.copy(val_src,   f'{DATA_DIR}/val.jsonl')

# Compte les exemples
n_train = sum(1 for _ in open(f'{DATA_DIR}/train.jsonl'))
n_val   = sum(1 for _ in open(f'{DATA_DIR}/val.jsonl'))
print(f'Train : {n_train} exemples  |  Val : {n_val} exemples')


# ── CELL 3 : Convertir au format LLaMA-Factory ──────────────
# Notre format : messages avec content=[{type:image,...},{type:text,...}]
# LLaMA-Factory attend : messages avec <image> token + champ "images" séparé

def convert_to_llamafactory(src_path, dst_path):
    converted = []
    with open(src_path, encoding='utf-8') as f:
        for line in f:
            ex = json.loads(line)
            msgs = ex.get('messages', [])
            images = []
            new_msgs = []
            for msg in msgs:
                role    = msg['role']
                content = msg['content']
                if isinstance(content, list):
                    text_parts = []
                    for part in content:
                        if part['type'] == 'image':
                            img = part['image'].replace('file://', '')
                            images.append(img)
                            text_parts.append('<image>')
                        elif part['type'] == 'text':
                            text_parts.append(part['text'])
                    new_msgs.append({'role': role, 'content': '\n'.join(text_parts)})
                else:
                    new_msgs.append({'role': role, 'content': content})
            converted.append({'messages': new_msgs, 'images': images})

    with open(dst_path, 'w', encoding='utf-8') as f:
        for ex in converted:
            f.write(json.dumps(ex, ensure_ascii=False) + '\n')
    print(f'✅ Converti {len(converted)} exemples → {dst_path}')

convert_to_llamafactory(f'{DATA_DIR}/train.jsonl', f'{DATA_DIR}/train_lf.jsonl')
convert_to_llamafactory(f'{DATA_DIR}/val.jsonl',   f'{DATA_DIR}/val_lf.jsonl')


# ── CELL 4 : Enregistrer le dataset dans LLaMA-Factory ──────
import importlib, llamafactory
lf_path = Path(llamafactory.__file__).parent

dataset_info = {
    "card_id_train": {
        "file_name": f"{DATA_DIR}/train_lf.jsonl",
        "formatting": "sharegpt",
        "columns": {"messages": "messages", "images": "images"},
    },
    "card_id_val": {
        "file_name": f"{DATA_DIR}/val_lf.jsonl",
        "formatting": "sharegpt",
        "columns": {"messages": "messages", "images": "images"},
    },
}

info_path = lf_path / 'data' / 'dataset_info.json'
with open(info_path) as f:
    existing = json.load(f)
existing.update(dataset_info)
with open(info_path, 'w') as f:
    json.dump(existing, f, indent=2)

print('✅ Dataset enregistré dans LLaMA-Factory')


# ── CELL 5 : Lancer l'entraînement ──────────────────────────
# QLoRA sur Qwen2-VL-2B, ~2h sur T4 x2

train_args = dict(
    stage                 = 'sft',
    do_train              = True,
    model_name_or_path    = 'Qwen/Qwen2-VL-2B-Instruct',
    dataset               = 'card_id_train',
    eval_dataset          = 'card_id_val',
    template              = 'qwen2_vl',
    finetuning_type       = 'lora',
    lora_rank             = 16,
    lora_alpha            = 32,
    lora_target           = 'all',
    quantization_bit      = 4,
    output_dir            = '/kaggle/working/qwen2vl_card_lora',
    overwrite_output_dir  = True,
    per_device_train_batch_size = 2,
    gradient_accumulation_steps = 8,
    learning_rate         = 2e-4,
    num_train_epochs      = 3,
    lr_scheduler_type     = 'cosine',
    warmup_ratio          = 0.1,
    bf16                  = True,
    evaluation_strategy   = 'epoch',
    save_strategy         = 'epoch',
    load_best_model_at_end = True,
    logging_steps         = 10,
    report_to             = 'none',
    image_max_pixels      = 512 * 512,
    image_min_pixels      = 56 * 56,
)

# Écrire la config YAML
import yaml
config_path = '/kaggle/working/train_config.yaml'
with open(config_path, 'w') as f:
    yaml.dump(train_args, f)

print('Config entraînement :')
for k, v in train_args.items():
    print(f'  {k}: {v}')

subprocess.run(['llamafactory-cli', 'train', config_path], check=True)
print('✅ Entraînement terminé')


# ── CELL 6 : Tester le modèle ───────────────────────────────
import torch
from transformers import Qwen2VLForConditionalGeneration, AutoProcessor
from peft import PeftModel
from PIL import Image
import base64, io

base_model = Qwen2VLForConditionalGeneration.from_pretrained(
    'Qwen/Qwen2-VL-2B-Instruct',
    torch_dtype=torch.bfloat16,
    device_map='auto',
)
model = PeftModel.from_pretrained(base_model, '/kaggle/working/qwen2vl_card_lora/checkpoint-best')
processor = AutoProcessor.from_pretrained('Qwen/Qwen2-VL-2B-Instruct')

# Test sur le premier exemple du val
with open(f'{DATA_DIR}/val_lf.jsonl') as f:
    test_ex = json.loads(f.readline())

img_path = test_ex['images'][0]
if os.path.exists(img_path):
    image = Image.open(img_path)
    prompt = test_ex['messages'][0]['content'].replace('<image>\n', '')

    messages = [{'role': 'user', 'content': [
        {'type': 'image', 'image': image},
        {'type': 'text',  'text': prompt},
    ]}]

    from qwen_vl_utils import process_vision_info
    text = processor.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    image_inputs, _ = process_vision_info(messages)
    inputs = processor(text=[text], images=image_inputs, return_tensors='pt').to('cuda')

    with torch.no_grad():
        out = model.generate(**inputs, max_new_tokens=512, temperature=0)
    result = processor.decode(out[0][inputs['input_ids'].shape[1]:], skip_special_tokens=True)

    print('Résultat modèle :', result)
    print('\nVrai label :', test_ex['messages'][1]['content'])
else:
    print('Image test introuvable, skip')


# ── CELL 7 : Export zip ─────────────────────────────────────
shutil.make_archive('/kaggle/working/lora_adapters', 'zip',
                    '/kaggle/working/qwen2vl_card_lora')
print('✅ Adapters LoRA → /kaggle/working/lora_adapters.zip')
print('   Télécharge-le depuis Output → lora_adapters.zip')
print()
print('Taille estimée : ~50-100 MB')
print('Ces poids suffisent pour déployer sur RunPod ou HuggingFace Inference.')
