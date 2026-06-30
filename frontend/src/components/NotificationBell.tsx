import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell } from 'lucide-react'
import { inboxApi, aspirantInboxApi } from '@/api/inbox'

export default function NotificationBell({ audience = 'employer' }: { audience?: 'employer' | 'aspirant' }) {
  const [open, setOpen] = useState(false)
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

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          position: 'relative', width: 38, height: 38, borderRadius: 10,
          background: 'rgba(107,114,128,0.07)', border: '1px solid rgba(107,114,128,0.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
        }}
      >
        <Bell size={16} color="#6B7280" />
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -4, minWidth: 16, height: 16, padding: '0 3px',
            borderRadius: 20, background: '#DC2626', color: '#fff', fontSize: 9, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
          <div style={{
            position: 'absolute', top: 46, right: 0, width: 340, maxHeight: 420, overflowY: 'auto',
            background: '#fff', borderRadius: 14, border: '1px solid #E5E7EB',
            boxShadow: '0 12px 32px rgba(15,23,42,0.12)', zIndex: 50,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #F1F5F9' }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: '#0F172A' }}>Notifications</span>
              {unread > 0 && (
                <button onClick={() => markAllRead.mutate()} style={{ fontSize: 11, fontWeight: 700, color: '#3B82F6', background: 'none', border: 'none', cursor: 'pointer' }}>
                  Mark all read
                </button>
              )}
            </div>

            {!data || data.notifications.length === 0 ? (
              <p style={{ padding: 24, textAlign: 'center', fontSize: 12, color: '#94A3B8' }}>No notifications yet.</p>
            ) : (
              data.notifications.map(n => (
                <div
                  key={n.id}
                  onClick={() => {
                    if (!n.is_read) markRead.mutate(n.id)
                    if (n.link_url) navigate(n.link_url)
                    setOpen(false)
                  }}
                  style={{
                    padding: '10px 16px', borderBottom: '1px solid #F8FAFC', cursor: 'pointer',
                    background: n.is_read ? '#fff' : 'rgba(59,130,246,0.04)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                    {!n.is_read && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#3B82F6', marginTop: 5, flexShrink: 0 }} />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12, fontWeight: 700, color: '#0F172A', margin: 0 }}>{n.title}</p>
                      {n.body && <p style={{ fontSize: 11, color: '#64748B', margin: '2px 0 0' }}>{n.body}</p>}
                      <p style={{ fontSize: 10, color: '#94A3B8', margin: '4px 0 0' }}>
                        {new Date(n.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}
