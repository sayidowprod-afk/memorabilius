'use client'
import { useEffect } from 'react'
import { useLang } from '@/lib/LangContext'

const TXT: Record<string, { attention: string; title: string; body: string; del: string; cancel: string }> = {
  fr: { attention: 'Attention', title: 'Supprimer', body: 'La carte et ses photos seront effacées. Action définitive.', del: 'Supprimer', cancel: 'Annuler' },
  en: { attention: 'Warning', title: 'Delete', body: 'The card and its photos will be erased. This cannot be undone.', del: 'Delete', cancel: 'Cancel' },
  de: { attention: 'Achtung', title: 'Löschen', body: 'Die Karte und ihre Fotos werden gelöscht. Endgültig.', del: 'Löschen', cancel: 'Abbrechen' },
  es: { attention: 'Atención', title: 'Eliminar', body: 'La carta y sus fotos se borrarán. Acción definitiva.', del: 'Eliminar', cancel: 'Cancelar' },
  it: { attention: 'Attenzione', title: 'Elimina', body: 'La carta e le sue foto verranno cancellate. Azione definitiva.', del: 'Elimina', cancel: 'Annulla' },
}

// Confirmation de suppression qui montre la carte concernee (cadre rouge, carte en gris)
export default function ConfirmDeleteCard({ image, name, onConfirm, onCancel }: { image?: string; name: string; onConfirm: () => void; onCancel: () => void }) {
  const { lang } = useLang()
  const T = TXT[lang] || TXT.fr
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onCancel])
  return (
    <div className="cdel-back" role="alertdialog" aria-modal="true" aria-label={`${T.title} ${name}`} onClick={e => { e.stopPropagation(); onCancel() }}>
      <div className="cdel" onClick={e => e.stopPropagation()}>
        <div className="cdel-h">{T.attention}</div>
        <div className="cdel-b">
          {image && (/* eslint-disable-next-line @next/next/no-img-element */ <img src={image} alt="" />)}
          <div>
            <h4 className="da-display">{T.title} {name} ?</h4>
            <p>{T.body}</p>
            <div className="cdel-ac">
              <button type="button" className="cdel-del" onClick={e => { e.stopPropagation(); onConfirm() }}>{T.del}</button>
              <button type="button" className="cdel-no" onClick={e => { e.stopPropagation(); onCancel() }}>{T.cancel}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
