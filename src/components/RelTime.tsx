'use client'
import { useLang, localeFor } from '@/lib/LangContext'
import { relTime, exactDate } from '@/lib/relativeTime'

// Date relative cohérente sur tout le site ; la date exacte s'affiche au survol / à l'appui long.
export default function RelTime({ iso, className, style }: { iso: string; className?: string; style?: React.CSSProperties }) {
  const { lang } = useLang()
  const locale = localeFor(lang)
  return <time dateTime={iso} title={exactDate(iso, locale)} className={className} style={style} suppressHydrationWarning>{relTime(iso, locale)}</time>
}
