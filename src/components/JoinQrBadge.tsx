'use client'
import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { FDLC_NAVY_DEEP, FDLC_RED } from '@/lib/fdlcBranding'

const SITE_URL = 'https://www.memorabilius.fr'

// QR + code en coin permanent sur l'overlay, pour que les spectateurs du
// stream puissent rejoindre a tout moment (pas seulement pendant le lobby).
// `hero` : version grande, centree, verticale -- affichee en gros avant la
// toute premiere question (voir les pages overlay, "beforeFirstQuestion").
export default function JoinQrBadge({ code, size = 74, hero }: { code: string; size?: number; hero?: boolean }) {
  const [qrDataUrl, setQrDataUrl] = useState('')

  useEffect(() => {
    QRCode.toDataURL(`${SITE_URL}/quiz/${code}`, { width: size * 3, margin: 1 }).then(setQrDataUrl).catch(() => {})
  }, [code, size])

  if (hero) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
        {qrDataUrl && <img src={qrDataUrl} alt="QR" style={{ width: size, height: size, borderRadius: 14, boxShadow: '0 12px 30px rgba(0,0,0,0.5)' }} />}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4 }}>Rejoins le quiz</div>
          <div style={{ fontSize: 30, fontWeight: 900, letterSpacing: 2, color: 'white' }}>{code}</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>{SITE_URL.replace('https://', '')}/quiz/{code}</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', borderRadius: 14,
      background: `${FDLC_NAVY_DEEP}e6`, backdropFilter: 'blur(6px)', border: `1px solid ${FDLC_RED}55`,
      boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
    }}>
      {qrDataUrl && <img src={qrDataUrl} alt="QR" style={{ width: size, height: size, borderRadius: 6, flexShrink: 0 }} />}
      <div>
        <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: 1 }}>Rejoins le quiz</div>
        <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: 1.5, color: 'white' }}>{code}</div>
      </div>
    </div>
  )
}
