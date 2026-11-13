'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

// Sous un message REÇU : (896) un avertissement quand il ressemble à une arnaque classique, (895) un bouton « Traduire » vers la langue du membre.
const SCAM = [
  /paypal[^.\n]{0,40}(amis|friends|family|famille|freunde|familia|famiglia)/i,
  /(amis|friends|freunde|amigos|amici)\s*(et|and|&|und|y|e)\s*(famille|family|familie|familia|famiglia)/i,
  /(hors|en dehors)\s+(du\s+)?(site|plateforme)|outside\s+(of\s+)?(the\s+)?(site|platform|app)|au[ßs]erhalb/i,
  /western\s*union|moneygram|mandat\s*cash|bitcoin|crypto|gift\s*card|carte\s*cadeau|zelle|cash\s*app|wise\.com/i,
  /(whatsapp|telegram|signal)[^.\n]{0,30}(contacte|contact|écris|write|message|escribe|scrivi)|(contacte|contact|écris|write|message)[^.\n]{0,30}(whatsapp|telegram)/i,
  /(lien|link)\s+(de\s+)?(paiement|payment)|payment\s+link|pay\s*now\s*:/i,
]
export const looksLikeScam = (t: string) => SCAM.some(re => re.test(t))

const WARN: Record<string, string> = {
  fr: 'Attention : ce message propose un moyen de paiement ou de contact qui ne protège pas l’acheteur (PayPal « amis et famille », paiement hors du site…). Préfère un envoi suivi et un paiement protégé, et méfie-toi si on te presse.',
  en: 'Careful: this message suggests a payment or contact method that gives the buyer no protection (PayPal “friends and family”, paying outside the site…). Prefer tracked shipping and a protected payment, and be wary if you are rushed.',
  de: 'Vorsicht: Diese Nachricht schlägt eine Zahlungs- oder Kontaktart vor, die den Käufer nicht schützt (PayPal „Freunde und Familie“, Zahlung außerhalb der Seite…). Bevorzuge versicherten Versand und geschützte Zahlung.',
  es: 'Atención: este mensaje propone un medio de pago o contacto que no protege al comprador (PayPal «amigos y familiares», pago fuera del sitio…). Prefiere un envío con seguimiento y un pago protegido.',
  it: 'Attenzione: questo messaggio propone un metodo di pagamento o contatto che non protegge l’acquirente (PayPal «amici e familiari», pagamento fuori dal sito…). Preferisci una spedizione tracciata e un pagamento protetto.',
}
const BTN: Record<string, [string, string, string]> = {
  fr: ['🌐 Traduire', 'Traduction…', 'Voir l’original'], en: ['🌐 Translate', 'Translating…', 'Show original'], de: ['🌐 Übersetzen', 'Übersetze…', 'Original zeigen'],
  es: ['🌐 Traducir', 'Traduciendo…', 'Ver original'], it: ['🌐 Traduci', 'Traduzione…', 'Mostra originale'],
}

export default function MessageExtras({ text, lang, dark }: { text: string; lang: string; dark: boolean }) {
  const l = WARN[lang] ? lang : 'fr'
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle')
  const [out, setOut] = useState('')
  const scam = looksLikeScam(text)
  const worth = text.trim().length >= 6 && /[A-Za-zÀ-ÿ]{3}/.test(text)

  const translate = async () => {
    setState('busy')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const r = await fetch('/api/translate-message', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (session?.access_token || '') }, body: JSON.stringify({ text, target: l }) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok || !d.text) { setState('error'); return }
      setOut(String(d.text)); setState('done')
    } catch { setState('error') }
  }

  const c = dark ? '#cfe0ff' : '#003DA6'
  return (
    <>
      {scam && (
        <div role="note" style={{ marginTop: 8, padding: '7px 9px', background: dark ? 'rgba(224,165,38,.16)' : '#fff6dc', border: '1px solid #e0a526', color: dark ? '#ffd98a' : '#6b4b00', fontSize: 12, lineHeight: 1.4, display: 'flex', gap: 6 }}>
          <span aria-hidden="true">⚠️</span><span>{WARN[l]}</span>
        </div>
      )}
      {worth && state !== 'done' && (
        <button type="button" onClick={e => { e.stopPropagation(); translate() }} disabled={state === 'busy'}
          style={{ marginTop: 6, background: 'none', border: 0, padding: 0, color: c, font: '700 11px system-ui', cursor: 'pointer', textAlign: 'left' }}>
          {state === 'busy' ? BTN[l][1] : state === 'error' ? '⚠ ' + BTN[l][0] : BTN[l][0]}
        </button>
      )}
      {state === 'done' && (
        <div style={{ marginTop: 6, padding: '6px 8px', borderLeft: '3px solid ' + c, background: dark ? 'rgba(255,255,255,.07)' : 'rgba(0,61,166,.07)', fontSize: 13, lineHeight: 1.4, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
          {out}
          <button type="button" onClick={e => { e.stopPropagation(); setState('idle') }} style={{ display: 'block', marginTop: 4, background: 'none', border: 0, padding: 0, color: c, font: '700 11px system-ui', cursor: 'pointer' }}>{BTN[l][2]}</button>
        </div>
      )}
    </>
  )
}
