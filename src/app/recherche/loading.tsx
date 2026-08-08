export default function Loading() {
  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 12px', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ textAlign: 'center', padding: '40px 20px 28px' }}>
        <div style={{ width: 220, height: 28, background: '#e8eaf0', borderRadius: 8, margin: '0 auto 12px', animation: 'pulse 1.5s ease-in-out infinite' }} />
        <div style={{ width: 320, height: 18, background: '#e8eaf0', borderRadius: 6, margin: '0 auto 26px', animation: 'pulse 1.5s ease-in-out infinite' }} />
        <div style={{ width: '100%', maxWidth: 620, height: 52, background: '#e8eaf0', borderRadius: 50, margin: '0 auto', animation: 'pulse 1.5s ease-in-out infinite' }} />
      </div>
      <style>{`@keyframes pulse { 0%,100%{opacity:1}50%{opacity:.5} }`}</style>
    </div>
  )
}
