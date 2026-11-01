'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { peekStagedShare, type PendingShare } from '@/lib/shareBridge'

// Image reçue depuis une autre appli (Partager -> Memorabilius) : que veut-on en faire ?
export default function Partage() {
  const router = useRouter()
  const [share, setShare] = useState<PendingShare | null>(null)
  useEffect(() => {
    const s = peekStagedShare()
    if (!s) { router.replace('/'); return }
    setShare(s)
  }, [router])
  if (!share) return null
  return (
    <div style={{ maxWidth: 480, margin: '40px auto', padding: '0 16px', textAlign: 'center' }}>
      <h1 style={{ fontSize: 30, margin: '0 0 16px' }}>Que faire de cette image ?</h1>
      {share.imagePath && /* eslint-disable-next-line @next/next/no-img-element */ <img src={share.imagePath} alt="" style={{ maxWidth: '100%', maxHeight: 260, objectFit: 'contain', marginBottom: 18, border: '3px solid var(--border)' }} />}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button className="btn-main" style={{ padding: '14px 18px' }} onClick={() => router.push('/mes-achats?partage=1')}>🛒 Ajouter un achat (capture de commande)</button>
        <button className="btn-main" style={{ padding: '14px 18px' }} onClick={() => router.push('/messages')}>💬 L’envoyer dans une conversation</button>
      </div>
    </div>
  )
}
