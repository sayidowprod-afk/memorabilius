'use client'

export default function ClearableInput({
  value, onChange, placeholder, style, containerStyle,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  style?: React.CSSProperties
  containerStyle?: React.CSSProperties
}) {
  return (
    <div style={{ position: 'relative', width: '100%', ...containerStyle }}>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ ...style, paddingRight: 34, width: '100%', boxSizing: 'border-box' }}
      />
      <button
        type="button"
        onClick={() => onChange('')}
        aria-label="Effacer"
        className="clearable-input-x"
        style={{
          position: 'absolute', top: '50%', right: 8, transform: 'translateY(-50%)',
          width: 20, height: 20, borderRadius: '50%', border: 'none', cursor: 'pointer',
          background: 'var(--bg3, #eee)', color: 'var(--text3, #888)', fontSize: 12, lineHeight: 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: value ? 1 : 0, pointerEvents: value ? 'auto' : 'none',
          transition: 'opacity 0.15s ease',
        }}
      >✕</button>
    </div>
  )
}
