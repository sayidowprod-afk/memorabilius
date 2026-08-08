export default function Loading() {
  return (
    <div style={{ fontFamily: 'Inter, sans-serif' }}>
      {/* Hero skeleton */}
      <div style={{ height: 340, background: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 100%)', display: 'flex', alignItems: 'flex-end', padding: '0 24px 32px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 24, maxWidth: 1100, width: '100%', margin: '0 auto' }}>
          <div style={{ width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.12)', flexShrink: 0, animation: 'pulse 1.5s ease-in-out infinite' }} />
          <div>
            <div style={{ width: 260, height: 36, background: 'rgba(255,255,255,0.15)', borderRadius: 8, marginBottom: 10, animation: 'pulse 1.5s ease-in-out infinite' }} />
            <div style={{ width: 160, height: 20, background: 'rgba(255,255,255,0.1)', borderRadius: 6, animation: 'pulse 1.5s ease-in-out infinite' }} />
          </div>
        </div>
      </div>
      {/* Content skeleton */}
      <div style={{ maxWidth: 1100, margin: '32px auto', padding: '0 24px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16 }}>
        {[...Array(8)].map((_, i) => (
          <div key={i} style={{ aspectRatio: '2.5/3.5', background: '#e8eaf0', borderRadius: 12, animation: 'pulse 1.5s ease-in-out infinite', animationDelay: `${i * 0.08}s` }} />
        ))}
      </div>
      <style>{`@keyframes pulse { 0%,100%{opacity:1}50%{opacity:.5} }`}</style>
    </div>
  )
}
