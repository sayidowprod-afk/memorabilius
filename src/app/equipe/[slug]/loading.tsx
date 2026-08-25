export default function Loading() {
  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '32px 16px', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 32, flexWrap: 'wrap' }}>
        <div style={{ width: 80, height: 80, borderRadius: 12, background: '#e8eaf0', animation: 'pulse 1.5s ease-in-out infinite' }} />
        <div>
          <div style={{ width: 90, height: 12, background: '#e8eaf0', borderRadius: 6, marginBottom: 8, animation: 'pulse 1.5s ease-in-out infinite' }} />
          <div style={{ width: 220, height: 30, background: '#e8eaf0', borderRadius: 8, animation: 'pulse 1.5s ease-in-out infinite' }} />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 16 }}>
        {[...Array(10)].map((_, i) => (
          <div key={i} style={{ aspectRatio: '2.5/3.5', background: '#e8eaf0', borderRadius: 12, animation: 'pulse 1.5s ease-in-out infinite', animationDelay: `${i * 0.06}s` }} />
        ))}
      </div>
      <style>{`@keyframes pulse { 0%,100%{opacity:1}50%{opacity:.5} }`}</style>
    </div>
  )
}
