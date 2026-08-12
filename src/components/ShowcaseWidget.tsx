'use client'
import { useState } from 'react'

export default function ShowcaseWidget({ userId }: { userId: string }) {
  const [copied, setCopied] = useState<'link' | 'img' | 'html' | 'bbcode' | null>(null)
  const base = 'https://www.memorabilius.fr'
  const imgUrl = `${base}/api/showcase/${userId}`
  const profileUrl = `${base}/galerie/${userId}`
  const html = `<a href="${profileUrl}"><img src="${imgUrl}" alt="Ma collection sur Memorabilius" width="400" height="100"></a>`
  const bbcode = `[url=${profileUrl}][img]${imgUrl}[/img][/url]`

  const copy = (text: string, which: 'link' | 'img' | 'html' | 'bbcode') => {
    navigator.clipboard.writeText(text)
    setCopied(which)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div style={{ background: 'white', borderRadius: 16, padding: 30, boxShadow: '0 4px 20px rgba(0,0,0,0.08)', marginBottom: 20 }}>
      <h3 style={{ fontWeight: 800, marginBottom: 8 }}>🖼️ Bannière Showcase</h3>
      <p style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>
        Affichez votre collection sur Discord, un forum, un blog ou en signature — la bannière se met à jour automatiquement avec vos dernières cartes.
      </p>
      <div style={{ borderRadius: 10, overflow: 'hidden', marginBottom: 16, border: '1px solid #eee', maxWidth: 400 }}>
        <img src={imgUrl} alt="Aperçu de la bannière" style={{ width: '100%', display: 'block' }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 800, color: '#888', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
            Discord / Twitter / Slack — collez juste le lien
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input readOnly value={profileUrl} onClick={e => (e.target as HTMLInputElement).select()} style={{ flex: 1, fontSize: 11, fontFamily: 'monospace' }} />
            <button onClick={() => copy(profileUrl, 'link')} style={{ background: copied === 'link' ? '#2ecc71' : '#003DA6', color: 'white', border: 'none', borderRadius: 8, padding: '8px 14px', fontWeight: 700, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {copied === 'link' ? '✓ Copié' : 'Copier'}
            </button>
          </div>
          <p style={{ fontSize: 11, color: '#999', marginTop: 4, marginBottom: 0 }}>
            Ces apps n'acceptent pas de code : collé tel quel, ce lien s'affiche automatiquement en aperçu enrichi (image + titre).
          </p>
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 800, color: '#888', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
            Image seule (à coller aussi telle quelle sur Discord)
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input readOnly value={imgUrl} onClick={e => (e.target as HTMLInputElement).select()} style={{ flex: 1, fontSize: 11, fontFamily: 'monospace' }} />
            <button onClick={() => copy(imgUrl, 'img')} style={{ background: copied === 'img' ? '#2ecc71' : '#003DA6', color: 'white', border: 'none', borderRadius: 8, padding: '8px 14px', fontWeight: 700, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {copied === 'img' ? '✓ Copié' : 'Copier'}
            </button>
          </div>
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 800, color: '#888', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Code HTML (blogs, sites)</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input readOnly value={html} onClick={e => (e.target as HTMLInputElement).select()} style={{ flex: 1, fontSize: 11, fontFamily: 'monospace' }} />
            <button onClick={() => copy(html, 'html')} style={{ background: copied === 'html' ? '#2ecc71' : '#003DA6', color: 'white', border: 'none', borderRadius: 8, padding: '8px 14px', fontWeight: 700, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {copied === 'html' ? '✓ Copié' : 'Copier'}
            </button>
          </div>
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 800, color: '#888', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Code BBCode (forums)</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input readOnly value={bbcode} onClick={e => (e.target as HTMLInputElement).select()} style={{ flex: 1, fontSize: 11, fontFamily: 'monospace' }} />
            <button onClick={() => copy(bbcode, 'bbcode')} style={{ background: copied === 'bbcode' ? '#2ecc71' : '#003DA6', color: 'white', border: 'none', borderRadius: 8, padding: '8px 14px', fontWeight: 700, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {copied === 'bbcode' ? '✓ Copié' : 'Copier'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
