import { Link } from 'react-router-dom'

// Fill these in before launch — shown on both legal pages.
export const LEGAL_ENTITY = '[Company legal name — to be added]'
export const CONTACT_EMAIL = '[contact email — to be added]'
export const LAST_UPDATED = '9 October 2026'

export interface LegalSection {
  title: string
  body: (string | string[])[]  // string = paragraph, string[] = bullet list
}

const T = { text: '#1F2937', muted: '#6B7280', line: '#E5E7EB', link: '#1A2744' }

export default function LegalLayout({ title, intro, sections }: { title: string; intro: string; sections: LegalSection[] }) {
  return (
    <div style={{ minHeight: '100vh', background: '#fff', color: T.text }}>
      <header style={{ borderBottom: `1px solid ${T.line}` }}>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '14px 24px' }}>
          <Link to="/" style={{ color: T.link, fontSize: 16, fontWeight: 700, textDecoration: 'none' }}>BeginablAI</Link>
        </div>
      </header>

      <main style={{ maxWidth: 760, margin: '0 auto', padding: '32px 24px 56px', fontSize: 14, lineHeight: 1.7 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>{title}</h1>
        <p style={{ fontSize: 12, color: T.muted, margin: '4px 0 16px' }}>Last updated {LAST_UPDATED}</p>
        <p style={{ margin: 0 }}>{intro}</p>

        {sections.map(s => (
          <div key={s.title} style={{ marginTop: 16 }}>
            {Array.isArray(s.body[0]) && <p style={{ margin: '0 0 6px' }}><strong style={{ fontWeight: 600 }}>{s.title}.</strong></p>}
            {s.body.map((b, j) =>
              Array.isArray(b) ? (
                <ul key={j} style={{ margin: '0 0 8px', paddingLeft: 20, listStyle: 'disc' }}>
                  {b.map(li => <li key={li}>{li}</li>)}
                </ul>
              ) : (
                <p key={j} style={{ margin: '0 0 8px' }}>
                  {j === 0 && <strong style={{ fontWeight: 600 }}>{s.title}. </strong>}
                  {b}
                </p>
              )
            )}
          </div>
        ))}
      </main>

      <footer style={{ borderTop: `1px solid ${T.line}` }}>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '16px 24px', fontSize: 12, color: T.muted, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <span>© {new Date().getFullYear()} BeginablAI</span>
          <Link to="/terms" style={{ color: T.muted }}>Terms &amp; Conditions</Link>
          <Link to="/privacy" style={{ color: T.muted }}>Privacy Policy</Link>
        </div>
      </footer>
    </div>
  )
}
