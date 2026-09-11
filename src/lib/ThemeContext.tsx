'use client'
import { createContext, useContext, useEffect, useState } from 'react'

const ThemeContext = createContext({ dark: false, toggle: () => {} })

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // SSR renders with dark=false. The inline <script> in layout.tsx already sets
  // data-theme on <html> before React hydrates, so CSS is visually correct.
  // After mount we sync React state from the attribute — no hydration mismatch.
  const [dark, setDark] = useState(false)

  useEffect(() => {
    if (document.documentElement.getAttribute('data-theme') === 'dark') {
      setDark(true)
      return
    }
    // Le script inline du <head> lit localStorage AVANT que le stockage natif
    // de la WebView Android soit forcement pret (course connue au cold start /
    // reload complet, voir commentaire plus bas) -- si cette lecture rate,
    // data-theme reste "light" pour toute la session meme si la preference
    // stockee est bien "dark". Deuxieme essai ici, une fois React monte (le
    // stockage a eu le temps d'etre pret) : signale par l'utilisateur comme
    // persistant meme apres un simple refresh, donc la premiere lecture seule
    // ne suffisait pas.
    try {
      if (localStorage.getItem('theme') === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark')
        setDark(true)
        return
      }
    } catch {}
    setDark(false)
  }, [])

  // N'ecrit dans le DOM que -- jamais dans localStorage ici. Cet effet
  // tourne aussi bien pour un vrai toggle utilisateur que pour la
  // synchronisation initiale ci-dessus (React ne distingue pas la cause d'un
  // changement de state) : y ecrire localStorage inconditionnellement
  // recopiait la valeur lue au demarrage, meme si cette lecture etait fausse
  // (cold start Android ou le stockage natif de la WebView n'est pas encore
  // pret quand le script inline du <head> lit localStorage avant hydratation)
  // -- ecrasant alors "dark" par "light" de facon PERMANENTE, cassant la
  // preference a chaque relance suivante. Seul toggle() ci-dessous persiste
  // desormais, sur une action explicite de l'utilisateur uniquement.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
  }, [dark])

  const toggle = () => {
    setDark(d => {
      const next = !d
      try { localStorage.setItem('theme', next ? 'dark' : 'light') } catch {}
      return next
    })
  }

  return (
    <ThemeContext.Provider value={{ dark, toggle }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
