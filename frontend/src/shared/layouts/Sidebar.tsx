import { useState, useCallback, useEffect, memo, type ReactNode } from 'react'
import { useIsMobile } from '@/shared/hooks/useIsMobile'
import { Menu, X, LogOut, ChevronDown, ChevronRight, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { colors } from '@/design-system/tokens'
import { type NavItem, type NavSection, type NavLeaf, isNavGroup } from '@/shared/config/navigation'

const NAVY = colors.brand.navy
const INK = colors.text.ink
const N06 = 'rgba(26,39,68,0.06)'
const N08 = colors.border.default
const N12 = colors.border.medium
const N40 = 'rgba(26,39,68,0.40)'
const N60 = 'rgba(26,39,68,0.60)'

function isLeafActive(item: NavLeaf, pathname: string, search: string): boolean {
  const [p, q] = item.path.split('?')
  if (q) return pathname === p && search === `?${q}`
  if (item.matchPrefix) return pathname.startsWith(item.matchPrefix)
  if (item.exact === false) return pathname.startsWith(p)
  return pathname === p
}

const NavLeafRow = memo(function NavLeafRow({ item, isActive, collapsed, indent, onClick }: {
  item: NavLeaf; isActive: boolean; collapsed: boolean; indent?: boolean; onClick: () => void
}) {
  const Icon = item.icon
  return (
    <button
      onClick={onClick}
      title={collapsed ? item.label : undefined}
      aria-current={isActive ? 'page' : undefined}
      style={{
        width: '100%', display: 'flex', alignItems: 'center',
        gap: 10, justifyContent: collapsed ? 'center' : 'flex-start',
        padding: indent ? '7px 10px' : '9px 12px',
        borderRadius: 10,
        marginBottom: 2,
        background: isActive ? N08 : 'transparent',
        color: isActive ? NAVY : N60,
        border: 'none',
        borderLeft: !collapsed && !indent ? (isActive ? `2px solid ${NAVY}` : '2px solid transparent') : 'none',
        cursor: 'pointer', textAlign: 'left' as const,
        fontSize: indent ? 12 : 13, fontWeight: isActive ? 700 : 500, transition: 'all 0.18s',
      }}
      onMouseOver={e => { if (!isActive) { e.currentTarget.style.background = N06; e.currentTarget.style.color = INK } }}
      onMouseOut={e => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = N60 } }}
    >
      <Icon size={indent ? 13 : 15} style={{ flexShrink: 0 }} />
      {!collapsed && <span style={{ flex: 1, marginLeft: 2 }}>{item.label}</span>}
      {!collapsed && item.badge != null && item.badge > 0 && (
        <span style={{
          background: N08, color: NAVY, fontSize: 10, fontWeight: 700,
          borderRadius: 99, padding: '1px 6px', minWidth: 18, textAlign: 'center',
        }}>{item.badge}</span>
      )}
    </button>
  )
})

function NavGroupRow({ group, pathname, search, collapsed, onNavigate }: {
  group: { label: string; icon: NavLeaf['icon']; basePath: string; children: NavLeaf[] }
  pathname: string; search: string; collapsed: boolean; onNavigate: (path: string) => void
}) {
  const isActive = pathname.startsWith(group.basePath)
  const [expanded, setExpanded] = useState(isActive)
  const Icon = group.icon

  if (collapsed) {
    return (
      <button
        onClick={() => onNavigate(group.basePath)}
        title={group.label}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '9px 12px', borderRadius: 10, marginBottom: 2, border: 'none', cursor: 'pointer',
          background: isActive ? N08 : 'transparent', color: isActive ? NAVY : N60,
        }}
      >
        <Icon size={15} />
      </button>
    )
  }

  return (
    <div>
      <button
        onClick={() => setExpanded(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          padding: '9px 12px', borderRadius: 10, marginBottom: 2, border: 'none', cursor: 'pointer',
          background: isActive && !expanded ? N08 : 'transparent',
          color: isActive && !expanded ? NAVY : N60,
          fontSize: 13, fontWeight: isActive && !expanded ? 700 : 500, transition: 'all 0.18s',
        }}
        onMouseOver={e => { if (!(isActive && !expanded)) { e.currentTarget.style.background = N06; e.currentTarget.style.color = INK } }}
        onMouseOut={e => { if (!(isActive && !expanded)) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = N60 } }}
      >
        <Icon size={15} style={{ flexShrink: 0 }} />
        <span style={{ flex: 1, textAlign: 'left', marginLeft: 2 }}>{group.label}</span>
        {expanded ? <ChevronDown size={13} style={{ color: N40 }} /> : <ChevronRight size={13} style={{ color: N40 }} />}
      </button>
      {expanded && (
        <div style={{ marginLeft: 14, paddingLeft: 10, borderLeft: `1px solid ${N08}`, marginBottom: 2 }}>
          {group.children.map(child => (
            <NavLeafRow
              key={child.path}
              item={child}
              indent
              collapsed={false}
              isActive={isLeafActive(child, pathname, search)}
              onClick={() => onNavigate(child.path)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function renderItem(item: NavItem, pathname: string, search: string, collapsed: boolean, onNavigate: (path: string) => void) {
  if (isNavGroup(item)) {
    return <NavGroupRow key={item.basePath} group={item} pathname={pathname} search={search} collapsed={collapsed} onNavigate={onNavigate} />
  }
  return (
    <NavLeafRow
      key={item.path}
      item={item}
      collapsed={collapsed}
      isActive={isLeafActive(item, pathname, search)}
      onClick={() => onNavigate(item.path)}
    />
  )
}

export interface SidebarProps {
  brand?: string
  brandBadge?: string
  identity?: ReactNode
  sections: NavSection[]
  pathname: string
  search?: string
  onNavigate: (path: string) => void
  onLogout: () => void
  collapsed?: boolean
  onToggleCollapse?: () => void
}

export default function Sidebar({
  brand = 'BeginableAI', brandBadge, identity, sections, pathname, search = '',
  onNavigate, onLogout, collapsed = false, onToggleCollapse,
}: SidebarProps) {
  const isMobile = useIsMobile()
  const [mobileOpen, setMobileOpen] = useState(false)

  const go = useCallback((path: string) => {
    onNavigate(path)
    setMobileOpen(false)
  }, [onNavigate])

  useEffect(() => { setMobileOpen(false) }, [pathname])

  const railCollapsed = collapsed && !isMobile

  const body = (
    <aside style={{
      width: isMobile ? 260 : (railCollapsed ? 64 : 260),
      background: '#FFFFFF',
      display: 'flex', flexDirection: 'column',
      height: '100vh', overflowY: 'auto', overflowX: 'hidden',
      borderRight: `1px solid ${N08}`,
      boxShadow: '4px 0 16px rgba(26,39,68,0.06)',
      flexShrink: 0,
      transition: 'width 0.2s',
    }}>
      {/* Logo row */}
      <div style={{ padding: railCollapsed ? '20px 12px' : '20px 20px', borderBottom: `1px solid ${N08}`, display: 'flex', alignItems: 'center', justifyContent: railCollapsed ? 'center' : 'space-between', gap: 8 }}>
        {railCollapsed ? (
          <div style={{ width: 32, height: 32, borderRadius: 8, background: N08, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: NAVY, fontWeight: 800, fontSize: 14 }}>{brand.charAt(0)}</span>
          </div>
        ) : (
          <>
            <div style={{ minWidth: 0 }}>
              <span style={{ fontSize: 18, fontWeight: 800, color: NAVY, letterSpacing: '-0.4px' }}>{brand}</span>
              {brandBadge && (
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: N40, marginTop: 1 }}>{brandBadge}</div>
              )}
            </div>
            {isMobile && (
              <button
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
                style={{ width: 28, height: 28, borderRadius: 8, background: N06, border: `1px solid ${N08}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: N60, flexShrink: 0 }}
              >
                <X size={14} />
              </button>
            )}
          </>
        )}
      </div>

      {/* Identity slot */}
      {identity && !railCollapsed && (
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${N08}` }}>{identity}</div>
      )}

      {/* Nav */}
      <nav style={{ padding: railCollapsed ? '12px 8px' : '12px 12px', flex: 1, overflowY: 'auto' }}>
        {sections.map((section, si) => (
          <div key={si}>
            {section.label && !railCollapsed && (
              <p style={{ fontSize: 10, fontWeight: 700, color: N40, textTransform: 'uppercase', letterSpacing: '0.8px', padding: si === 0 ? '0 8px' : '12px 8px 6px', marginTop: si === 0 ? 0 : 4, marginBottom: 6, borderTop: si === 0 ? 'none' : `1px solid ${N08}` }}>
                {section.label}
              </p>
            )}
            {!section.label && si > 0 && <div style={{ height: 1, background: N08, margin: '8px 0' }} />}
            {section.items.map(item => renderItem(item, pathname, search, railCollapsed, go))}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div style={{ padding: railCollapsed ? '8px' : '8px 20px 16px', borderTop: `1px solid ${N08}`, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {onToggleCollapse && !isMobile && (
          <button
            onClick={onToggleCollapse}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: railCollapsed ? 'center' : 'flex-start', width: '100%', padding: '9px 12px', borderRadius: 10, background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: N60 }}
            onMouseOver={e => { e.currentTarget.style.background = N06; e.currentTarget.style.color = NAVY }}
            onMouseOut={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = N60 }}
          >
            {collapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
            {!railCollapsed && <span>Collapse</span>}
          </button>
        )}
        <button
          onClick={onLogout}
          title={railCollapsed ? 'Log out' : undefined}
          style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: railCollapsed ? 'center' : 'flex-start', width: '100%', padding: '10px 12px', borderRadius: 10, background: 'transparent', border: `1px solid ${N12}`, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: N60, transition: 'all 0.2s' }}
          onMouseOver={e => { e.currentTarget.style.background = N06; e.currentTarget.style.color = NAVY }}
          onMouseOut={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = N60 }}
        >
          <LogOut size={14} />
          {!railCollapsed && <span>Log out</span>}
        </button>
      </div>
    </aside>
  )

  if (isMobile) {
    return (
      <>
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
          style={{
            position: 'fixed', top: 14, left: 14, zIndex: 1100,
            width: 42, height: 42, borderRadius: 12,
            background: 'white', border: `1px solid ${N12}`, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(26,39,68,0.12)',
            opacity: mobileOpen ? 0 : 1,
            pointerEvents: mobileOpen ? 'none' : 'auto',
            transition: 'opacity 0.2s',
          }}
        >
          <Menu size={18} color={NAVY} />
        </button>

        {mobileOpen && (
          <div onClick={() => setMobileOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 1099, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)' }} />
        )}

        <div style={{ position: 'fixed', top: 0, left: 0, zIndex: 1100, height: '100vh', transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)', transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)' }}>
          {body}
        </div>
      </>
    )
  }

  return (
    <div style={{ position: 'sticky', top: 0, height: '100vh', flexShrink: 0 }}>
      {body}
    </div>
  )
}
