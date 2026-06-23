export default function LegalShell({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: '32px 4px 48px' }}>
      <style>{`
        .legal-content { color:#333; line-height:1.7; font-size:15px; }
        .legal-content h2 { font-size:19px; font-weight:800; margin:28px 0 10px; color:#111; }
        .legal-content p { margin:10px 0; }
        .legal-content ul { margin:10px 0; padding-left:22px; }
        .legal-content li { margin:6px 0; }
        .legal-content a { color:#003DA6; }
        .legal-content strong { color:#111; }
        .legal-content table { border-collapse:collapse; width:100%; margin:14px 0; font-size:14px; }
        .legal-content th, .legal-content td { border:1px solid #e8e8e8; padding:8px 10px; text-align:left; vertical-align:top; }
        .legal-content th { background:#f7f9ff; font-weight:700; }
      `}</style>
      <h1 style={{ fontWeight: 900, fontSize: 30, marginBottom: 4 }}>{title}</h1>
      <p style={{ color: '#999', fontSize: 13, marginBottom: 24 }}>Dernière mise à jour : {updated}</p>
      <div className="legal-content">{children}</div>
    </div>
  )
}
