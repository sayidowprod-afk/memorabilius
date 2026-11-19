// Génère des visuels de pack de cartes (ComfyUI / Z-Image Turbo) dans E:/bobble-work/pack : plusieurs graines pour choisir le meilleur.
import fs from 'node:fs'
const HOST = process.env.COMFY_HOST || 'http://127.0.0.1:8188'
const OUT = process.env.PACK_OUT || 'E:/bobble-work/pack'
fs.mkdirSync(OUT, { recursive: true })
const PROMPTS = {
  closed: 'Product photo of a sealed trading card booster pack, front view, flat vertical rectangle, crinkled shiny aluminium foil wrapper in deep royal blue with metallic silver crimped serrated edges at the very top and bottom, bold white block letters PACK with golden yellow shadow in the middle, a golden banner under it, small text MEMORABILIUS at the top, subtle sunburst rays behind the letters, glossy highlights and foil wrinkles, studio lighting, pure plain white background, centered, sharp, high detail',
  torn: 'Product photo of a trading card booster pack that has been torn open at the top, front view, flat vertical rectangle, crinkled shiny royal blue aluminium foil wrapper, bold white block letters PACK with golden shadow in the middle, the top part is ripped off with an irregular jagged torn foil edge showing the crumpled silver inside, a few trading cards peeking out of the opening, studio lighting, pure plain white background, centered, sharp, high detail',
  strip: 'Product photo of a thin torn strip of royal blue shiny aluminium foil with silver crimped serrated edge on one side and a jagged ripped edge on the other side, horizontal, crumpled foil texture, studio lighting, pure plain white background, centered, sharp, high detail',
}
async function gen(kind, seed, w, h) {
  const g = {
    1: { class_type: 'UNETLoader', inputs: { unet_name: 'z_image_turbo_int8_convrot.safetensors', weight_dtype: 'default' } },
    2: { class_type: 'ModelSamplingAuraFlow', inputs: { model: ['1', 0], shift: 3 } },
    3: { class_type: 'CLIPLoader', inputs: { clip_name: 'qwen_3_4b_fp8_mixed.safetensors', type: 'lumina2', device: 'default' } },
    4: { class_type: 'CLIPTextEncode', inputs: { text: PROMPTS[kind], clip: ['3', 0] } },
    5: { class_type: 'ConditioningZeroOut', inputs: { conditioning: ['4', 0] } },
    6: { class_type: 'EmptySD3LatentImage', inputs: { width: w, height: h, batch_size: 1 } },
    7: { class_type: 'KSampler', inputs: { model: ['2', 0], positive: ['4', 0], negative: ['5', 0], latent_image: ['6', 0], seed, steps: 8, cfg: 1, sampler_name: 'res_multistep', scheduler: 'simple', denoise: 1 } },
    8: { class_type: 'VAELoader', inputs: { vae_name: 'ae.safetensors' } },
    9: { class_type: 'VAEDecode', inputs: { samples: ['7', 0], vae: ['8', 0] } },
    10: { class_type: 'SaveImage', inputs: { images: ['9', 0], filename_prefix: `pk_${kind}` } },
  }
  const r = await fetch(`${HOST}/prompt`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: g }) })
  const j = await r.json(); if (!r.ok) throw new Error(JSON.stringify(j).slice(0, 300))
  for (let i = 0; i < 300; i++) {
    await new Promise(res => setTimeout(res, 1000))
    const h2 = await (await fetch(`${HOST}/history/${j.prompt_id}`)).json()
    const out = h2[j.prompt_id]?.outputs?.[10]?.images?.[0]
    if (out) {
      const img = await fetch(`${HOST}/view?filename=${encodeURIComponent(out.filename)}&subfolder=${encodeURIComponent(out.subfolder || '')}&type=${out.type}`)
      const f = `${OUT}/${kind}-${seed}.png`; fs.writeFileSync(f, Buffer.from(await img.arrayBuffer())); return f
    }
  }
  throw new Error('délai')
}
for (const seed of [11, 22, 33, 44]) {
  for (const [kind, w, h] of [['closed', 768, 1152], ['torn', 768, 1152], ['strip', 1152, 384]]) {
    try { console.log(await gen(kind, seed, w, h)) } catch (e) { console.log('échec', kind, seed, e.message) }
  }
}
console.log('fini')
