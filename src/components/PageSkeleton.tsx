// Écran de chargement instantané affiché pendant qu'une page se prépare (utilisé par les loading.tsx).
// Composant sans état : il s'affiche tout de suite au clic sur un lien, avant même que le code de la page soit arrivé.
const bar = (w: number | string, h: number, extra?: React.CSSProperties): React.CSSProperties => ({
  width: w, height: h, maxWidth: '100%', background: 'var(--bg3, #e8eaf0)', animation: 'sk-pulse 1.5s ease-in-out infinite', ...extra,
})

export default function PageSkeleton({ variant = 'list' }: { variant?: 'list' | 'grid' }) {
  return (
    <div role="status" aria-busy="true" aria-label="Chargement" style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px' }}>
      <div style={bar(240, 30, { marginBottom: 10 })} />
      <div style={bar(360, 16, { marginBottom: 22 })} />
      {variant === 'grid' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 12 }}>
          {Array.from({ length: 12 }, (_, i) => <div key={i} style={bar('100%', 0, { aspectRatio: '2.5/3.5', height: 'auto' })} />)}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {Array.from({ length: 5 }, (_, i) => <div key={i} style={bar('100%', 84)} />)}
        </div>
      )}
      <style>{`@keyframes sk-pulse { 0%,100%{opacity:1} 50%{opacity:.5} } @media (prefers-reduced-motion: reduce) { [aria-busy="true"] div { animation: none !important } }`}</style>
    </div>
  )
}
