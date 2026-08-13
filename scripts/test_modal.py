import base64, json, urllib.request, time

RECTO_PATH = r'C:\Users\killi\Pictures\ControlCenter4\Cards_Final\fini\34r.jpg'
VERSO_PATH = r'C:\Users\killi\Pictures\ControlCenter4\Cards_Final\fini\34v.jpg'  # adapte le nom
MODAL_URL = 'https://sayidowprod--qwen2vl-cards-model-predict.modal.run'

from PIL import Image

def compress(path, max_size=800, quality=85):
    img = Image.open(path).convert('RGB')
    img.thumbnail((max_size, max_size), Image.LANCZOS)
    buf = __import__('io').BytesIO()
    img.save(buf, 'JPEG', quality=quality)
    return base64.b64encode(buf.getvalue()).decode()

body = {}
body['recto'] = compress(RECTO_PATH)
print(f'Recto compressé : {len(body["recto"])//1024}KB')

try:
    body['verso'] = compress(VERSO_PATH)
    print(f'Verso compressé : {len(body["verso"])//1024}KB')
    print('Recto + verso envoyés vers Modal...')
except FileNotFoundError:
    print('Verso non trouvé, envoi recto seulement...')

req = urllib.request.Request(
    MODAL_URL,
    data=json.dumps(body).encode(),
    headers={'Content-Type': 'application/json'},
    method='POST'
)

t0 = time.time()
with urllib.request.urlopen(req, timeout=300) as r:
    result = json.loads(r.read())
print(f'Temps : {time.time()-t0:.1f}s')
print(json.dumps(result, indent=2, ensure_ascii=False))
