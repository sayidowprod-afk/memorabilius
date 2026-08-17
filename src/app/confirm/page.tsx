import Link from 'next/link'
import { headers } from 'next/headers'
import ResendConfirmButton from '@/components/ResendConfirmButton'
import { translations } from '@/lib/LangContext'

export default async function Confirm({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const headersList = await headers()
  const acceptLang = headersList.get('accept-language')?.toLowerCase() || ''
  const lang = acceptLang.startsWith('en') ? 'en' : acceptLang.startsWith('de') ? 'de' : 'fr'
  const t = (key: keyof typeof translations.fr) => translations[lang][key] || translations.fr[key]
  const { email } = await searchParams

  return (
    <div style={{ maxWidth: 480, margin: '80px auto', textAlign: 'center' }}>
      <div style={{ fontSize: 64, marginBottom: 24 }}>📬</div>
      <h1 style={{ fontWeight: 900, fontSize: 28, marginBottom: 12 }}>
        {t('confirm_check_email_title')}
      </h1>
      <p style={{ color: '#666', fontSize: 16, lineHeight: 1.6, marginBottom: 32 }}>
        {t('confirm_link_sent')}
      </p>
      <div style={{ background: '#fffbf0', border: '1px solid #ffe082', borderRadius: 12, padding: 16, marginBottom: 32, fontSize: 14, color: '#7a6000' }}>
        💡 {t('confirm_check_spam')}
      </div>
      <Link href="/connexion" className="btn-main btn-primary">
        {t('login_btn')}
      </Link>
      {email && <ResendConfirmButton email={email} />}
    </div>
  )
}
