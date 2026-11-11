'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/lib/supabase'
import { fr } from '@/lib/translations.fr'

export type Lang = 'fr' | 'en' | 'de' | 'es' | 'it'

export function localeFor(lang: Lang): string {
  switch (lang) {
    case 'en': return 'en-US'
    case 'de': return 'de-DE'
    case 'es': return 'es-ES'
    case 'it': return 'it-IT'
    default: return 'fr-FR'
  }
}



const LOADERS: Record<Exclude<Lang, 'fr'>, () => Promise<Record<string, string>>> = {
  en: () => import('@/lib/translations.en').then(m => m.en),
  de: () => import('@/lib/translations.de').then(m => m.de),
  es: () => import('@/lib/translations.es').then(m => m.es),
  it: () => import('@/lib/translations.it').then(m => m.it),
}

export type TranslationKey = keyof typeof fr

const LangContext = createContext<{
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: TranslationKey) => string
}>({ lang: 'fr', setLang: () => {}, t: (k) => k })

export function LangProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [lang, setLangState] = useState<Lang>('fr')

  useEffect(() => {
    let saved: Lang | null = null
    try { saved = localStorage.getItem('lang') as Lang } catch {}
    const geo = document.cookie.split(';').find(c => c.trim().startsWith('geo-lang='))?.split('=')?.[1]?.trim() as Lang | undefined
    const VALID_LANGS: Lang[] = ['fr', 'en', 'de', 'es', 'it']
    const resolved: Lang =
      (saved && VALID_LANGS.includes(saved)) ? saved
      : (geo && VALID_LANGS.includes(geo)) ? geo
      : navigator.language.startsWith('en') ? 'en'
      : navigator.language.startsWith('de') ? 'de'
      : navigator.language.startsWith('es') ? 'es'
      : navigator.language.startsWith('it') ? 'it'
      : 'fr'
    setLangState(resolved)
    // Resynchronise le cookie à CHAQUE chargement, pas seulement au clic explicite sur
    // le sélecteur — un visiteur qui avait déjà "en"/"de" en localStorage AVANT ce
    // correctif ne repassait jamais par setLang(), donc le cookie geo-lang restait
    // périmé indéfiniment et la redirection vers les guides traduits ne se déclenchait
    // jamais pour lui malgré un site bien affiché en anglais/allemand.
    if (resolved !== geo) document.cookie = `geo-lang=${resolved}; path=/; max-age=31536000; samesite=lax`
  }, [])

  // Synchronise sur le profil pour que le serveur (crons, notifications push)
  // puisse écrire dans la bonne langue — localStorage seul n'est lisible que
  // côté client, le serveur n'y a jamais accès.
  useEffect(() => {
    if (!user) return
    supabase.from('profiles').update({ preferred_lang: lang }).eq('id', user.id).then(() => {})
  }, [user, lang])

  const setLang = (l: Lang) => {
    setLangState(l)
    try { localStorage.setItem('lang', l) } catch {}
    // Garde le cookie geo-lang synchronisé sur le choix explicite — sans ça, ce
    // cookie ne reflétait que la détection géo initiale, jamais un changement
    // manuel via le sélecteur, donc les pages rendues côté serveur (ex: guides
    // traduits sur /[lang]/guides/[slug]) ne voyaient jamais ce choix et
    // continuaient de servir le français malgré un site passé en EN/DE.
    document.cookie = `geo-lang=${l}; path=/; max-age=31536000; samesite=lax`
  }

  // Dictionnaire de la langue choisie, chargé à la demande (le français s'affiche en attendant, comme avant le changement de langue)
  const [dict, setDict] = useState<{ lang: Lang; d: Record<string, string> } | null>(null)
  useEffect(() => {
    if (lang === 'fr') return
    let dead = false
    LOADERS[lang]().then(d => { if (!dead) setDict({ lang, d }) }).catch(() => { /* repli : le français */ })
    return () => { dead = true }
  }, [lang])

  const t = (key: TranslationKey): string => (dict && dict.lang === lang ? dict.d[key] : undefined) || fr[key] || key

  return (
    <LangContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LangContext.Provider>
  )
}

export const useLang = () => useContext(LangContext)
