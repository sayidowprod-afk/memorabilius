'use client'
import { useState } from 'react'
import { useLang } from '@/lib/LangContext'

export default function ShowcaseWidget({ userId }: { userId: string }) {
  const { t } = useLang()
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
      <h3 style={{ fontWeight: 800, marginBottom: 8 }}>{t('showcase_title')}</h3>
      <p style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>
        {t('showcase_desc')}
      </p>
      <div style={{ borderRadius: 10, overflow: 'hidden', marginBottom: 16, border: '1px solid #eee', maxWidth: 400 }}>
        <img src={imgUrl} alt={t('showcase_preview_alt')} style={{ width: '100%', display: 'block' }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 800, color: '#888', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
            {t('showcase_label_link')}
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input readOnly value={profileUrl} onClick={e => (e.target as HTMLInputElement).select()} style={{ flex: 1, fontSize: 11, fontFamily: 'monospace' }} />
            <button onClick={() => copy(profileUrl, 'link')} style={{ background: copied === 'link' ? '#2ecc71' : '#003DA6', color: 'white', border: 'none', borderRadius: 8, padding: '8px 14px', fontWeight: 700, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {copied === 'link' ? t('showcase_copied') : t('showcase_copy')}
            </button>
          </div>
          <p style={{ fontSize: 11, color: '#999', marginTop: 4, marginBottom: 0 }}>
            {t('showcase_link_hint')}
          </p>
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 800, color: '#888', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
            {t('showcase_label_img')}
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input readOnly value={imgUrl} onClick={e => (e.target as HTMLInputElement).select()} style={{ flex: 1, fontSize: 11, fontFamily: 'monospace' }} />
            <button onClick={() => copy(imgUrl, 'img')} style={{ background: copied === 'img' ? '#2ecc71' : '#003DA6', color: 'white', border: 'none', borderRadius: 8, padding: '8px 14px', fontWeight: 700, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {copied === 'img' ? t('showcase_copied') : t('showcase_copy')}
            </button>
          </div>
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 800, color: '#888', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>{t('showcase_label_html')}</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input readOnly value={html} onClick={e => (e.target as HTMLInputElement).select()} style={{ flex: 1, fontSize: 11, fontFamily: 'monospace' }} />
            <button onClick={() => copy(html, 'html')} style={{ background: copied === 'html' ? '#2ecc71' : '#003DA6', color: 'white', border: 'none', borderRadius: 8, padding: '8px 14px', fontWeight: 700, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {copied === 'html' ? t('showcase_copied') : t('showcase_copy')}
            </button>
          </div>
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 800, color: '#888', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>{t('showcase_label_bbcode')}</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input readOnly value={bbcode} onClick={e => (e.target as HTMLInputElement).select()} style={{ flex: 1, fontSize: 11, fontFamily: 'monospace' }} />
            <button onClick={() => copy(bbcode, 'bbcode')} style={{ background: copied === 'bbcode' ? '#2ecc71' : '#003DA6', color: 'white', border: 'none', borderRadius: 8, padding: '8px 14px', fontWeight: 700, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {copied === 'bbcode' ? t('showcase_copied') : t('showcase_copy')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
