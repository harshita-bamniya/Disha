import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell, BellOff, CheckCheck } from 'lucide-react'
import { inboxApi, aspirantInboxApi } from '@/api/inbox'
import { colors } from '@/design-system/tokens'

const NAVY   = colors.brand.navy
const N06    = 'rgba(26,39,68,0.06)'
const N08    = colors.border.default
const BORDER = colors.border.default

// ── Dropdown rendered into <body> via portal so overflow:hidden on the
//    sidebar never clips it. Coordinates are tracked via getBoundingClientRect.

const PANEL_W = 360

interface DropdownProps {
  anchorRef: React.RefObject<HTMLButtonElement | null>
  onClose: () => void
  children: React.ReactNode
}

function FloatingDropdown({ anchorRef, onClose, children }: DropdownProps) {
  const [coords, setCoords] = useState({ top: 0, left: 0 })
  const dropRef = useRef<HTMLDivElement>(null)

  const reposition = useCallback(() => {
    if (!anchorRef.current) return
    const r = anchorRef.current.getBoundingClientRect()
    // Open below the bell; clamp left so panel doesn't bleed off the right edge
    const idealLeft = r.left
    const left = Math.min(idealLeft, window.innerWidth - PANEL_W - 8)
    setCoords({ top: r.bottom + 8, left: Math.max(left, 8) })
  }, [anchorRef])

  useEffect(() => {
    reposition()
    window.addEventListener('resize', reposition)
    window.addEventListener('scroll', reposition, true)
    return () => {
      window.removeEventListener('resize', reposition)
      window.removeEventListener('scroll', reposition, true)
    }
  }, [reposition])

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node) &&
          anchorRef.current && !anchorRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [onClose, anchorRef])

  // Close on Escape
  useEffect(() => {
    function handle(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handle)
    return () => document.removeEventListener('keydown', handle)
  }, [onClose])

  return createPortal(
    <div
      ref={dropRef}
      role="dialog"
      aria-label="Notifications"
      style={{
        position: 'fixed',
        top: coords.top,
        left: coords.left,
        width: PANEL_W,
        maxHeight: 460,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        background: '#fff',
        borderRadius: 16,
        border: `1px solid ${BORDER}`,
        boxShadow: '0 16px 48px rgba(15,23,42,0.14), 0 4px 12px rgba(15,23,42,0.06)',
        overflow: 'hidden',
        animation: 'notif-drop-in 0.16s cubic-bezier(0.2,0,0,1)',
      }}
    >
      {children}
    </div>,
    document.body,
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function NotificationBell({ audience = 'employer' }: { audience?: 'employer' | 'aspirant' }) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const navigate = useNavigate()
  const qc = useQueryClient()
  const api = audience === 'aspirant' ? aspirantInboxApi : inboxApi
  const queryKey = [audience, 'notifications']

  const { data } = useQuery({
    queryKey,
    queryFn: () => api.listNotifications(20),
    refetchInterval: 30_000,
  })

  const markRead = useMutation({
    mutationFn: (id: string) => api.markNotificationRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  })
  const markAllRead = useMutation({
    mutationFn: () => api.markAllRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  })

  const unread = data?.unread_count ?? 0
  const notifications = data?.notifications ?? []

  const handleNotifClick = (id: string, isRead: boolean, linkUrl?: string) => {
    if (!isRead) markRead.mutate(id)
    if (linkUrl) navigate(linkUrl)
    setOpen(false)
  }

  // Inject keyframe once
  useEffect(() => {
    if (document.getElementById('notif-bell-style')) return
    const s = document.createElement('style')
    s.id = 'notif-bell-style'
    s.textContent = `
      @keyframes notif-drop-in {
        from { opacity: 0; transform: translateY(-6px) scale(0.97); }
        to   { opacity: 1; transform: translateY(0)   scale(1); }
      }
    `
    document.head.appendChild(s)
  }, [])

  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <button
        ref={btnRef}
        onClick={() => setOpen(v => !v)}
        aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ''}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        style={{
          position: 'relative',
          width: 34, height: 34, borderRadius: 9,
          background: open ? N06 : 'transparent',
          border: `1px solid ${open ? N08 : 'transparent'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', transition: 'background 0.15s, border-color 0.15s',
          flexShrink: 0,
        }}
        onMouseOver={e => { if (!open) e.currentTarget.style.background = N06 }}
        onMouseOut={e => { if (!open) e.currentTarget.style.background = 'transparent' }}
      >
        <Bell size={15} color={open ? NAVY : 'rgba(26,39,68,0.55)'} strokeWidth={1.9} />
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: -3, right: -3,
            minWidth: 15, height: 15, padding: '0 3px',
            borderRadius: 20, background: '#DC2626', color: '#fff',
            fontSize: 9, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid #fff',
          }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <FloatingDropdown anchorRef={btnRef} onClose={() => setOpen(false)}>
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 16px 12px',
            borderBottom: `1px solid ${BORDER}`,
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <Bell size={14} color={NAVY} strokeWidth={2} />
              <span style={{ fontSize: 13, fontWeight: 800, color: '#0F172A' }}>Notifications</span>
              {unread > 0 && (
                <span style={{
                  background: NAVY, color: '#fff',
                  fontSize: 10, fontWeight: 700, borderRadius: 99,
                  padding: '1px 6px',
                }}>
                  {unread} new
                </span>
              )}
            </div>
            {unread > 0 && (
              <button
                onClick={() => markAllRead.mutate()}
                disabled={markAllRead.isPending}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  fontSize: 11, fontWeight: 700,
                  color: NAVY, background: N06,
                  border: `1px solid ${N08}`, borderRadius: 8,
                  padding: '4px 8px', cursor: 'pointer',
                  opacity: markAllRead.isPending ? 0.5 : 1,
                  transition: 'background 0.12s',
                }}
                onMouseOver={e => e.currentTarget.style.background = N08}
                onMouseOut={e => e.currentTarget.style.background = N06}
              >
                <CheckCheck size={11} />
                Mark all read
              </button>
            )}
          </div>

          {/* Body */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {notifications.length === 0 ? (
              <div style={{
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                padding: '40px 24px', gap: 12,
              }}>
                <div style={{
                  width: 52, height: 52, borderRadius: '50%',
                  background: N06, border: `1px solid ${N08}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <BellOff size={22} color="rgba(26,39,68,0.35)" strokeWidth={1.5} />
                </div>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#1E293B', margin: 0 }}>All caught up</p>
                  <p style={{ fontSize: 12, color: '#94A3B8', margin: '4px 0 0', lineHeight: 1.5 }}>
                    No notifications yet. We'll let you know<br />when something needs your attention.
                  </p>
                </div>
              </div>
            ) : (
              notifications.map((n, idx) => (
                <div
                  key={n.id}
                  onClick={() => handleNotifClick(n.id, n.is_read, n.link_url)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => e.key === 'Enter' && handleNotifClick(n.id, n.is_read, n.link_url)}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                    padding: '11px 16px',
                    borderBottom: idx < notifications.length - 1 ? `1px solid ${BORDER}` : 'none',
                    background: n.is_read ? '#fff' : 'rgba(26,39,68,0.025)',
                    cursor: n.link_url ? 'pointer' : 'default',
                    transition: 'background 0.1s',
                  }}
                  onMouseOver={e => { if (n.link_url) e.currentTarget.style.background = N06 }}
                  onMouseOut={e => { e.currentTarget.style.background = n.is_read ? '#fff' : 'rgba(26,39,68,0.025)' }}
                >
                  {/* Unread dot */}
                  <div style={{ paddingTop: 5, flexShrink: 0, width: 8 }}>
                    {!n.is_read && (
                      <span style={{ display: 'block', width: 6, height: 6, borderRadius: '50%', background: NAVY }} />
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      fontSize: 12, fontWeight: n.is_read ? 500 : 700,
                      color: n.is_read ? '#475569' : '#0F172A',
                      margin: 0, lineHeight: 1.4,
                    }}>
                      {n.title}
                    </p>
                    {n.body && (
                      <p style={{
                        fontSize: 11, color: '#64748B', margin: '3px 0 0',
                        lineHeight: 1.5,
                        display: '-webkit-box', WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical', overflow: 'hidden',
                      }}>
                        {n.body}
                      </p>
                    )}
                    <p style={{ fontSize: 10, color: '#94A3B8', margin: '4px 0 0', fontWeight: 500 }}>
                      {new Date(n.created_at).toLocaleString('en-IN', {
                        day: 'numeric', month: 'short',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </FloatingDropdown>
      )}
    </div>
  )
}
