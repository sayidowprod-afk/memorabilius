// Jeu d'icônes unique au trait fin : même rendu sur tous les téléphones (contrairement aux emojis) et couleur du texte (currentColor).
import type { ReactNode } from 'react'

const P: Record<string, ReactNode> = {
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.5 3-5.5 6.5-5.5s6.5 2 6.5 5.5" /><path d="M16 4.8a3.5 3.5 0 010 6.4M18 14.8c2 .6 3.5 2.2 3.5 5.2" /></>,
  trophy: <path d="M7 4h10v5a5 5 0 01-10 0zM7 6H4v2a3 3 0 003 3M17 6h3v2a3 3 0 01-3 3M12 14v4M8 21h8M9 18h6" />,
  swap: <path d="M4 8h14l-3-3M20 16H6l3 3" />,
  calendar: <><rect x="3.5" y="5" width="17" height="15" rx="1" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>,
  news: <path d="M5 4h11v16H5zM16 8h3v10a2 2 0 01-2 2M8 8h5M8 12h5M8 16h5" />,
  camera: <><path d="M3 8h4l2-3h6l2 3h4v12H3z" /><circle cx="12" cy="13" r="4" /></>,
  cart: <><path d="M3 4h2l2.5 11h10L20 7H6.5" /><circle cx="9" cy="19" r="1.4" /><circle cx="17" cy="19" r="1.4" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></>,
  list: <><rect x="5" y="3.5" width="14" height="17" rx="1" /><path d="M9 3v3h6V3M9 11h6M9 15h6" /></>,
  book: <path d="M4 5c3-1 6-1 8 1 2-2 5-2 8-1v14c-3-1-6-1-8 1-2-2-5-2-8-1zM12 6v14" />,
  cap: <path d="M2 9l10-5 10 5-10 5zM6 11.5v4c0 1.5 3 3 6 3s6-1.5 6-3v-4" />,
  tool: <path d="M14.5 6.5a4 4 0 01-5 5L4 17l3 3 5.5-5.5a4 4 0 005-5l-3 3-2.5-.5-.5-2.5z" />,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></>,
  sparkle: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z" />,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" /></>,
  key: <><circle cx="8" cy="15" r="4" /><path d="M11 12l9-9M16 7l3 3M14 9l2 2" /></>,
  bell: <path d="M6 16V11a6 6 0 0112 0v5l2 2H4zM10 20a2 2 0 004 0" />,
}

export type IconName = keyof typeof P

export default function Icon({ name }: { name: IconName }) {
  return (
    <svg viewBox="0 0 24 24" width="1.15em" height="1.15em" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
      style={{ verticalAlign: '-0.2em', marginRight: 2, flex: 'none' }}>{P[name]}</svg>
  )
}
