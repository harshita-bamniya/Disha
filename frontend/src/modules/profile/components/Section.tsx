import { Pencil, Check, ChevronUp, User, GraduationCap, ClipboardList, Briefcase, Zap, Target, Brain, FileText, type LucideIcon } from 'lucide-react'

// Extracted from ProfilePage.tsx (audit L-07/Sprint 6: split the
// god-component). Same markup.
const SECTION_META: Record<string, { Icon: LucideIcon; color: string; bg: string }> = {
  'Personal Info':       { Icon: User,           color: '#1A2744', bg: 'rgba(26,39,68,0.07)' },
  'Education':           { Icon: GraduationCap,  color: '#1A2744', bg: 'rgba(26,39,68,0.07)' },
  'UPSC Journey':        { Icon: ClipboardList,  color: '#1A2744', bg: 'rgba(26,39,68,0.07)' },
  'Work Experience':     { Icon: Briefcase,      color: '#1A2744', bg: 'rgba(26,39,68,0.07)' },
  'Skills':              { Icon: Zap,            color: '#1A2744', bg: 'rgba(26,39,68,0.07)' },
  'Preferences':         { Icon: Target,         color: '#1A2744', bg: 'rgba(26,39,68,0.07)' },
  'Mindset Assessment':  { Icon: Brain,          color: '#1A2744', bg: 'rgba(26,39,68,0.07)' },
}

export function Section({
  title, summary, isOpen, onToggle, children, saving, saved,
}: {
  title: string
  summary: string
  isOpen: boolean
  onToggle: () => void
  children: React.ReactNode
  saving?: boolean
  saved?: boolean
}) {
  const meta = SECTION_META[title] ?? { Icon: FileText, color: '#3B82F6', bg: 'rgba(59,130,246,0.08)' }

  return (
    <div style={{
      background: 'white',
      borderRadius: 20,
      border: isOpen ? '1.5px solid rgba(26,39,68,0.18)' : '1px solid #E2E8F0',
      boxShadow: isOpen
        ? '0 12px 36px rgba(15,23,42,0.10)'
        : '0 2px 10px rgba(15,23,42,0.04)',
      overflow: 'hidden',
      transition: 'all 0.3s ease',
    }}>
      {/* Top accent strip when open */}
      {isOpen && (
        <div style={{
          height: 3,
          background: '#1A2744',
        }} />
      )}

      <button
        type="button"
        onClick={onToggle}
        style={{
          width: '100%', padding: '18px 22px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
          transition: 'background 0.2s',
        }}
        onMouseOver={e => { if (!isOpen) e.currentTarget.style.background = 'rgba(26,39,68,0.02)' }}
        onMouseOut={e => { e.currentTarget.style.background = 'none' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 0 }}>
          {/* Icon */}
          <div style={{
            width: 40, height: 40, borderRadius: 12, flexShrink: 0,
            background: meta.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <meta.Icon size={18} color={meta.color} strokeWidth={1.8} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>
                {title}
              </span>
              {saved && (
                <span style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  fontSize: 11, fontWeight: 700, color: '#059669',
                  background: 'rgba(5,150,105,0.08)', padding: '2px 8px', borderRadius: 20,
                  border: '1px solid rgba(5,150,105,0.2)',
                }}>
                  <Check size={10} /> Saved
                </span>
              )}
              {saving && (
                <span style={{ fontSize: 11, color: '#9CA3AF', fontStyle: 'italic' }}>Saving…</span>
              )}
            </div>
            {!isOpen && (
              <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {summary}
              </p>
            )}
          </div>
        </div>
        <div style={{
          width: 30, height: 30, borderRadius: 8, flexShrink: 0,
          background: isOpen ? 'rgba(26,39,68,0.08)' : 'rgba(0,0,0,0.04)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: isOpen ? '#1A2744' : '#9CA3AF',
          transition: 'all 0.2s',
        }}>
          {isOpen ? <ChevronUp size={14} /> : <Pencil size={14} />}
        </div>
      </button>

      {isOpen && (
        <div style={{
          padding: '0 22px 24px',
          borderTop: '1px solid rgba(59,130,246,0.06)',
        }}>
          <div style={{ paddingTop: 20 }}>{children}</div>
        </div>
      )}
    </div>
  )
}
