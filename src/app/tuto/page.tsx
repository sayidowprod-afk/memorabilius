'use client'
import Link from 'next/link'
import { useLang } from '@/lib/LangContext'

export default function Tuto() {
  const { t } = useLang()
  return (
    <div style={{ maxWidth: 800, margin: '0 auto', fontFamily: 'Inter, sans-serif', padding: '0 16px', boxSizing: 'border-box' }}>

      <h1 style={{ fontWeight: 900, fontSize: 32, marginBottom: 8 }}>{t('tuto_title')}</h1>
      <p style={{ color: 'var(--text2, #666)', marginBottom: 24, fontSize: 16 }}>{t('tuto_sub')}</p>

      {/* Étape 1 — commune */}
      <div style={{ background: 'var(--card-bg, #fff)', borderRadius: 16, padding: 32, marginBottom: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.06)', borderLeft: '4px solid #003DA6' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
          <div style={{ background: '#003DA6', color: 'white', width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 20, flexShrink: 0 }}>1</div>
          <h2 style={{ fontWeight: 900, fontSize: 20, margin: 0 }}>{t('tuto_step1_h2')}</h2>
        </div>
        <p style={{ color: 'var(--text2, #555)', lineHeight: 1.7, marginBottom: 16 }}>{t('tuto_step1_p')}</p>
        <div style={{ borderRadius: 12, overflow: 'hidden', marginBottom: 16, border: '1px solid var(--border, #eee)' }}>
          <img src="/tuto/tuto5.png" alt={t('tuto_step1_alt')} style={{ width: '100%', height: 'auto', display: 'block' }} />
        </div>
        <Link href="/sinscrire" style={{ display: 'inline-block', background: '#003DA6', color: 'white', padding: '10px 20px', borderRadius: 8, fontWeight: 700, fontSize: 14 }}>
          {t('tuto_create_account')}
        </Link>
      </div>

      {/* Choix de la méthode */}
      <div style={{ background: '#f0f4ff', border: '1px solid #d6e0f5', borderRadius: 16, padding: '20px 24px', marginBottom: 32 }}>
        <h2 style={{ fontWeight: 900, fontSize: 18, margin: '0 0 8px' }}>{t('tuto_two_ways_h2')}</h2>
        <p style={{ color: 'var(--text2, #555)', lineHeight: 1.6, margin: 0, fontSize: 15 }}>
          {t('tuto_way1_p')}<br />
          {t('tuto_way2_p')}
        </p>
      </div>

      {/* ── MÉTHODE 1 : IMPORT MANUEL ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <span style={{ fontSize: 22 }}>🃏</span>
        <h2 style={{ fontWeight: 900, fontSize: 24, margin: 0 }}>{t('tuto_method1_h2')}</h2>
      </div>

      <div style={{ background: 'var(--card-bg, #fff)', borderRadius: 16, padding: 32, marginBottom: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.06)', borderLeft: '4px solid #2ecc71' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
          <div style={{ background: '#2ecc71', color: 'white', width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 20, flexShrink: 0 }}>A</div>
          <h2 style={{ fontWeight: 900, fontSize: 20, margin: 0 }}>{t('tuto_m1a_h2')}</h2>
        </div>
        <p style={{ color: 'var(--text2, #555)', lineHeight: 1.7, marginBottom: 16 }}>
          {t('tuto_m1a_p')}
        </p>
        <Link href="/profil" style={{ display: 'inline-block', background: '#2ecc71', color: 'white', padding: '10px 20px', borderRadius: 8, fontWeight: 700, fontSize: 14 }}>
          {t('tuto_go_gallery')}
        </Link>
      </div>

      <div style={{ background: 'var(--card-bg, #fff)', borderRadius: 16, padding: 32, marginBottom: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.06)', borderLeft: '4px solid #2ecc71' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
          <div style={{ background: '#2ecc71', color: 'white', width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 20, flexShrink: 0 }}>B</div>
          <h2 style={{ fontWeight: 900, fontSize: 20, margin: 0 }}>{t('tuto_m1b_h2')}</h2>
        </div>
        <p style={{ color: 'var(--text2, #555)', lineHeight: 1.7, marginBottom: 12 }}>
          {t('tuto_m1b_p')}
        </p>
        <div style={{ background: '#fffbf0', border: '1px solid #ffe082', borderRadius: 8, padding: 12, fontSize: 13, color: '#7a6000' }}>
          {t('tuto_m1b_tip')}
        </div>
      </div>

      <div style={{ background: 'var(--card-bg, #fff)', borderRadius: 16, padding: 32, marginBottom: 40, boxShadow: '0 4px 20px rgba(0,0,0,0.06)', borderLeft: '4px solid #2ecc71' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
          <div style={{ background: '#2ecc71', color: 'white', width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 20, flexShrink: 0 }}>C</div>
          <h2 style={{ fontWeight: 900, fontSize: 20, margin: 0 }}>{t('tuto_m1c_h2')}</h2>
        </div>
        <p style={{ color: 'var(--text2, #555)', lineHeight: 1.7, marginBottom: 12 }}>
          {t('tuto_m1c_p1')}
        </p>
        <p style={{ color: 'var(--text2, #555)', lineHeight: 1.7, margin: 0 }}>
          {t('tuto_m1c_p2')}
        </p>
      </div>

      {/* ── MÉTHODE 2 : IMPORT CSV ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <span style={{ fontSize: 22 }}>📄</span>
        <h2 style={{ fontWeight: 900, fontSize: 24, margin: 0 }}>{t('tuto_method2_h2')}</h2>
      </div>

      {/* Étape 2 */}
      <div style={{ background: 'var(--card-bg, #fff)', borderRadius: 16, padding: 32, marginBottom: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.06)', borderLeft: '4px solid #003DA6' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
          <div style={{ background: '#003DA6', color: 'white', width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 20, flexShrink: 0 }}>2</div>
          <h2 style={{ fontWeight: 900, fontSize: 20, margin: 0 }}>{t('tuto_m2a_h2')}</h2>
        </div>
        <p style={{ color: 'var(--text2, #555)', lineHeight: 1.7, marginBottom: 12 }}>{t('tuto_m2a_p')}</p>
        <div style={{ background: '#fffbf0', border: '1px solid #ffe082', borderRadius: 8, padding: 12, fontSize: 13, color: '#7a6000', marginBottom: 16 }}>
          {t('tuto_m2a_tip')}
        </div>
        <div style={{ borderRadius: 12, overflow: 'hidden', marginBottom: 16, border: '1px solid var(--border, #eee)' }}>
          <img src="/tuto/tuto2.png" alt={t('tuto_m2a_alt')} style={{ width: '100%', height: 'auto', display: 'block' }} />
        </div>
        <a href="https://docs.google.com/spreadsheets/d/1_3HVVrWiKq8IVO0x2_AIrhkiJBY3p-wAuAxXO7Eb8N8/copy" target="_blank" style={{ display: 'inline-block', background: '#003DA6', color: 'white', padding: '10px 20px', borderRadius: 8, fontWeight: 700, fontSize: 14, marginBottom: 12 }}>
          {t('tuto_get_sheet')}
        </a>
        <div>
          <a href="https://drive.google.com/file/d/1bJklGgu2n-seeWdWixOy-FaGmSPwRx1W/view?usp=sharing" style={{ display: 'inline-block', background: 'var(--bg3, #f0f0f0)', color: 'var(--text2, #333)', padding: '10px 20px', borderRadius: 8, fontWeight: 700, fontSize: 13 }}>
            {t('tuto_download_tool')}
          </a>
        </div>
      </div>

      {/* Étape 3 */}
      <div style={{ background: 'var(--card-bg, #fff)', borderRadius: 16, padding: 32, marginBottom: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.06)', borderLeft: '4px solid #003DA6' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
          <div style={{ background: '#003DA6', color: 'white', width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 20, flexShrink: 0 }}>3</div>
          <h2 style={{ fontWeight: 900, fontSize: 20, margin: 0 }}>{t('tuto_m2b_h2')}</h2>
        </div>
        <p style={{ color: 'var(--text2, #555)', lineHeight: 1.7, marginBottom: 16 }}>{t('tuto_m2b_p')}</p>
        <div style={{ display: 'flex', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border, #eee)' }}>
            <img src="/tuto/tuto3.png" alt={t('tuto_m2b_alt1')} style={{ width: '100%', height: 'auto', display: 'block' }} />
          </div>
          <div style={{ flex: 1, minWidth: 200, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border, #eee)' }}>
            <img src="/tuto/tuto4.png" alt={t('tuto_m2b_alt2')} style={{ width: '100%', height: 'auto', display: 'block' }} />
          </div>
        </div>
      </div>

      {/* Étape 4 */}
      <div style={{ background: 'var(--card-bg, #fff)', borderRadius: 16, padding: 32, marginBottom: 40, boxShadow: '0 4px 20px rgba(0,0,0,0.06)', borderLeft: '4px solid #003DA6' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
          <div style={{ background: '#003DA6', color: 'white', width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 20, flexShrink: 0 }}>4</div>
          <h2 style={{ fontWeight: 900, fontSize: 20, margin: 0 }}>{t('tuto_m2c_h2')}</h2>
        </div>
        <p style={{ color: 'var(--text2, #555)', lineHeight: 1.7, marginBottom: 16 }}>{t('tuto_m2c_p')}</p>
        <div style={{ borderRadius: 12, overflow: 'hidden', marginBottom: 16, border: '1px solid var(--border, #eee)' }}>
          <img src="/tuto/tuto1.png" alt={t('tuto_m2c_alt')} style={{ width: '100%', height: 'auto', display: 'block' }} />
        </div>
        <Link href="/profil" style={{ display: 'inline-block', background: '#003DA6', color: 'white', padding: '10px 20px', borderRadius: 8, fontWeight: 700, fontSize: 14 }}>
          {t('tuto_go_profile')}
        </Link>
      </div>
    </div>
  )
}
