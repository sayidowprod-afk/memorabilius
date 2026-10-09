// Bande a chevrons animee : separateur entre les grandes sections d'une page (annonce de match). Decoratif.
export default function ChevronBand({ words, blue = false }: { words: string[]; blue?: boolean }) {
  const line = words.map(w => `»» ${w} `).join('')
  return (
    <div className={`chev-band${blue ? ' blue' : ''}`} aria-hidden="true">
      <div>{line.repeat(4)}</div>
    </div>
  )
}
