import { tokens } from '@/design-system'

// Moved from admin/shared/adminUI.tsx (audit M-12/Sprint 4: no shared Tabs
// component). Same markup, tokens instead of a local palette. Named `Tabs`
// per the audit's registry; kept the `TabDef` name for prop compatibility.
export interface TabDef { key: string; label: string; count?: number }

export function Tabs({ tabs, active, onChange }: { tabs: TabDef[]; active: string; onChange: (key: string) => void }) {
  return (
    <div className="flex items-center gap-0 overflow-x-auto mb-6" style={{ borderBottom: '0.5px solid #E2E8F0' }}>
      {tabs.map(tab => {
        const isActive = active === tab.key
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className="flex items-center gap-1.5 px-4 py-3 text-sm font-semibold whitespace-nowrap border-b-2 -mb-px transition-all"
            style={{
              borderBottomColor: isActive ? tokens.color.brand.navy : 'transparent',
              color: isActive ? tokens.color.brand.navy : '#64748B',
            }}
            onMouseOver={e => { if (!isActive) e.currentTarget.style.color = tokens.color.brand.ink }}
            onMouseOut={e => { if (!isActive) e.currentTarget.style.color = '#64748B' }}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span style={{
                padding: '1px 6px', borderRadius: 20, fontSize: 10, fontWeight: 700,
                background: isActive ? 'rgba(26,39,68,0.08)' : '#F1F5F9',
                color: isActive ? tokens.color.brand.navy : tokens.color.brand.muted,
              }}>
                {tab.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
