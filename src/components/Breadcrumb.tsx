import Link from 'next/link'

// Fil d'Ariane commun : le dernier élément est la page en cours (sans lien).
// Les libellés sont passés par la page (traduits côté client avec t(), en français côté serveur).
// onDark : sur un bandeau sombre ou coloré (texte clair dans les deux thèmes).
export type Crumb = { label: string; href?: string }

export default function Breadcrumb({ items, onDark }: { items: Crumb[]; onDark?: boolean }) {
  return (
    <nav className="bc-wrap" aria-label="Fil d'Ariane">
      <ol className={onDark ? 'bc on-dark' : 'bc'}>
        {items.map((c, i) => {
          const last = i === items.length - 1
          return (
            <li key={i}>
              {last || !c.href
                ? <span aria-current={last ? 'page' : undefined}>{c.label}</span>
                : <Link href={c.href}>{c.label}</Link>}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
