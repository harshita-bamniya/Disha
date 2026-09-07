/**
 * Global ⌘K command bar for the employer portal.
 * Press Cmd+K (or Ctrl+K) to open. Fuzzy-searches nav items and quick actions.
 */
import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search, LayoutDashboard, Building2, Users2, Star, CalendarDays,
  BarChart3, CreditCard, ShieldCheck, Briefcase, Plus, X,
} from 'lucide-react'
import { colors, radius } from '@/design-system/tokens'
import { useIsMobile } from '@/shared/hooks/useIsMobile'

interface CommandItem {
  id: string
  label: string
  description?: string
  icon: React.ElementType
  color: string
  action: () => void
  keywords?: string
}

export function CommandBar({ onPostJob }: { onPostJob?: () => void }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const isMobile = useIsMobile()

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(o => !o)
        setQuery('')
        setSelected(0)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', down)
    return () => window.removeEventListener('keydown', down)
  }, [])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
  }, [open])

  const items: CommandItem[] = useMemo(() => [
    { id: 'dashboard',    label: 'Dashboard',       icon: LayoutDashboard, color: '#3B82F6', action: () => navigate('/app/employer/dashboard'),   keywords: 'home overview' },
    { id: 'post-job',     label: 'Post a Job',       icon: Plus,            color: '#059669', action: () => { onPostJob?.(); setOpen(false) },      keywords: 'create new job posting' },
    { id: 'departments',  label: 'Departments',      icon: Building2,       color: '#1E3A5F', action: () => navigate('/app/employer/departments'),   keywords: 'org team structure' },
    { id: 'team',         label: 'Company & Team',   icon: Users2,          color: '#3B82F6', action: () => navigate('/app/employer/company'),       keywords: 'members invite colleagues' },
    { id: 'talent-pool',  label: 'Talent Pool',      icon: Star,            color: '#D97706', action: () => navigate('/app/employer/talent-pool'),   keywords: 'saved candidates bookmarks' },
    { id: 'calendar',     label: 'Calendar',         icon: CalendarDays,    color: '#7C3AED', action: () => navigate('/app/employer/calendar'),      keywords: 'interviews schedule' },
    { id: 'analytics',    label: 'Analytics',        icon: BarChart3,       color: '#0EA5E9', action: () => navigate('/app/employer/analytics'),     keywords: 'stats reports funnel kpis performance' },
    { id: 'subscription', label: 'Subscription',     icon: CreditCard,      color: '#D97706', action: () => navigate('/app/employer/subscription'),  keywords: 'plan billing upgrade' },
    { id: 'verification', label: 'Verification',     icon: ShieldCheck,     color: '#059669', action: () => navigate('/app/employer/verification'),  keywords: 'kyc documents approval' },
    { id: 'jobs',         label: 'Manage Jobs',      icon: Briefcase,       color: '#6366F1', action: () => navigate('/app/employer/dashboard'),     keywords: 'postings listings draft published' },
    { id: 'templates',   label: 'Job Templates',    icon: Briefcase,       color: '#059669', action: () => navigate('/app/employer/templates'),     keywords: 'reusable spec saved template' },
    { id: 'referrals',  label: 'Referrals',        icon: Briefcase,       color: '#7C3AED', action: () => navigate('/app/employer/referrals'),     keywords: 'refer employee bonus link partner' },
  ], [navigate, onPostJob])

  const filtered = useMemo(() => {
    if (!query.trim()) return items
    const q = query.toLowerCase()
    return items.filter(item =>
      item.label.toLowerCase().includes(q) ||
      (item.description ?? '').toLowerCase().includes(q) ||
      (item.keywords ?? '').toLowerCase().includes(q)
    )
  }, [query, items])

  useEffect(() => { setSelected(0) }, [query])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, filtered.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)) }
    if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered[selected]) { filtered[selected].action(); setOpen(false) }
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => { setOpen(true); setQuery(''); setSelected(0) }}
        title="Quick navigation (⌘K)"
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          height: 34, padding: isMobile ? 0 : '0 12px', borderRadius: 9,
          width: isMobile ? 34 : undefined, justifyContent: 'center',
          border: `1px solid ${colors.border.default}`, background: colors.surface.elevated,
          color: colors.text.muted, fontSize: 13, cursor: 'pointer', flexShrink: 0,
        }}
      >
        <Search size={13} />
        {!isMobile && (
          <>
            <span style={{ fontSize: 12 }}>Search…</span>
            <kbd style={{ fontSize: 10, fontWeight: 700, color: colors.text.muted, background: colors.surface.card, border: `1px solid ${colors.border.default}`, borderRadius: 4, padding: '1px 5px', marginLeft: 4 }}>⌘K</kbd>
          </>
        )}
      </button>
    )
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(6px)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 120 }}
      onClick={() => setOpen(false)}
    >
      <div
        style={{ width: '100%', maxWidth: 560, background: colors.surface.card, borderRadius: radius.xl, boxShadow: '0 24px 80px rgba(0,0,0,0.2)', overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: `1px solid ${colors.border.default}` }}>
          <Search size={16} color={colors.text.muted} />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search pages, actions…"
            style={{ flex: 1, border: 'none', outline: 'none', fontSize: 15, color: colors.text.ink, background: 'transparent' }}
          />
          {query && (
            <button onClick={() => setQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.text.muted, display: 'flex' }}>
              <X size={14} />
            </button>
          )}
          <kbd style={{ fontSize: 11, fontWeight: 700, color: colors.text.muted, background: colors.surface.elevated, border: `1px solid ${colors.border.default}`, borderRadius: 5, padding: '2px 6px' }}>Esc</kbd>
        </div>

        {/* Results */}
        <div style={{ maxHeight: 360, overflowY: 'auto', padding: '8px 8px' }}>
          {filtered.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '24px 0', fontSize: 13, color: colors.text.muted }}>No results for "{query}"</p>
          ) : (
            filtered.map((item, i) => (
              <button
                key={item.id}
                onClick={() => { item.action(); setOpen(false) }}
                onMouseEnter={() => setSelected(i)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                  padding: '10px 12px', borderRadius: 12, border: 'none',
                  background: i === selected ? colors.surface.elevated : 'transparent',
                  cursor: 'pointer', textAlign: 'left', transition: 'background 0.1s',
                }}
              >
                <div style={{ width: 34, height: 34, borderRadius: 9, background: `${item.color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <item.icon size={15} color={item.color} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: colors.text.ink, margin: 0 }}>{item.label}</p>
                  {item.description && <p style={{ fontSize: 11, color: colors.text.muted, margin: '1px 0 0' }}>{item.description}</p>}
                </div>
                {i === selected && (
                  <kbd style={{ fontSize: 10, fontWeight: 700, color: colors.text.muted, background: colors.surface.elevated, border: `1px solid ${colors.border.default}`, borderRadius: 4, padding: '2px 6px', flexShrink: 0 }}>↵</kbd>
                )}
              </button>
            ))
          )}
        </div>

        <div style={{ padding: '8px 16px', borderTop: `1px solid ${colors.border.default}`, display: 'flex', gap: 16 }}>
          {[['↑↓', 'Navigate'], ['↵', 'Open'], ['Esc', 'Close']].map(([k, l]) => (
            <span key={k} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: colors.text.muted }}>
              <kbd style={{ fontSize: 10, fontWeight: 700, background: colors.surface.elevated, border: `1px solid ${colors.border.default}`, borderRadius: 4, padding: '1px 5px', color: colors.text.inkSoft }}>{k}</kbd>{l}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
