import { useState } from 'react'
import { Bell, Plus, Send, Trash2, X, Edit2, Calendar, Users, Radio, Activity, CheckCircle, AlertCircle, Mail } from 'lucide-react'
import {
  useAnnouncements, useCreateAnnouncement, useUpdateAnnouncement,
  usePublishAnnouncement, useDeleteAnnouncement,
  useAdminNotifications, useNotificationsStats, useDeleteNotification,
} from '../hooks/useAdmin'
import { Spinner, Empty, Badge } from '../shared/adminUI'
import { getApiError } from '@/api/client'
import type {
  AnnouncementEntry, AnnouncementType, AnnouncementTarget,
  AnnouncementChannel, AnnouncementCreatePayload, AdminNotificationEntry,
} from '@/api/admin'
import { colors } from '@/design-system/tokens'
import Button from '@/shared/components/primitives/Button'


// ── helpers ────────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<AnnouncementType, { label: string; color: 'blue' | 'amber' | 'green' | 'red' }> = {
  info:    { label: 'Info',    color: 'blue' },
  warning: { label: 'Warning', color: 'amber' },
  success: { label: 'Success', color: 'green' },
  alert:   { label: 'Alert',   color: 'red' },
}

const TARGET_LABELS: Record<AnnouncementTarget, string> = {
  all:       'Everyone',
  aspirants: 'Aspirants only',
  employers: 'Employers only',
}

const CHANNEL_LABELS: Record<AnnouncementChannel, string> = {
  in_app: 'In-app',
  email:  'Email',
  both:   'In-app + Email',
}

const STATUS_COLORS: Record<string, 'gray' | 'blue' | 'green'> = {
  draft:     'gray',
  scheduled: 'blue',
  published: 'green',
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ── Compose / Edit modal ───────────────────────────────────────────────────────

const EMPTY_FORM: AnnouncementCreatePayload = {
  title: '', body: '', type: 'info', target: 'all', channel: 'in_app', scheduled_at: null,
}

function ComposeModal({
  initial,
  onClose,
}: {
  initial?: AnnouncementEntry
  onClose: () => void
}) {
  const create = useCreateAnnouncement()
  const update = useUpdateAnnouncement()
  const isPending = create.isPending || update.isPending
  const isEdit = !!initial

  const [form, setForm] = useState<AnnouncementCreatePayload>(
    initial
      ? { title: initial.title, body: initial.body, type: initial.type, target: initial.target, channel: initial.channel, scheduled_at: initial.scheduled_at }
      : { ...EMPTY_FORM },
  )

  const set = <K extends keyof AnnouncementCreatePayload>(k: K, v: AnnouncementCreatePayload[K]) =>
    setForm(f => ({ ...f, [k]: v }))

  const canSubmit = form.title.trim().length >= 3 && form.body.trim().length >= 10 && !isPending

  const handleSubmit = () => {
    if (isEdit) {
      update.mutate({ id: initial!.id, payload: form }, { onSuccess: onClose })
    } else {
      create.mutate(form, { onSuccess: onClose })
    }
  }

  const err = create.error || update.error

  const inputStyle = { width: '100%', height: 36, padding: '0 12px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.08)', fontSize: 14, outline: 'none' }
  const selectStyle = { width: '100%', height: 36, padding: '0 12px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.08)', fontSize: 14, background: '#fff', outline: 'none' }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div style={{ background: '#fff', borderRadius: 16, padding: 24, maxWidth: 512, width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div className="flex items-start justify-between mb-5 shrink-0">
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 900, color: colors.text.ink }}>{isEdit ? 'Edit announcement' : 'New announcement'}</h3>
            <p style={{ fontSize: 12, color: colors.text.muted, marginTop: 2 }}>Broadcast a message to a segment of your users.</p>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ color: colors.text.muted }}><X className="w-4 h-4" /></button>
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto flex-1">
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: colors.text.ink, marginBottom: 4, display: 'block' }}>Title</label>
            <input value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Platform maintenance on Sunday" style={inputStyle} />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: colors.text.ink, marginBottom: 4, display: 'block' }}>Message</label>
            <textarea
              value={form.body}
              onChange={e => set('body', e.target.value)}
              placeholder="Write the full announcement text…"
              rows={4}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.08)', fontSize: 14, outline: 'none', resize: 'none' }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: colors.text.ink, marginBottom: 4, display: 'block' }}>Type</label>
              <select value={form.type} onChange={e => set('type', e.target.value as AnnouncementType)} style={selectStyle}>
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="success">Success</option>
                <option value="alert">Alert</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: colors.text.ink, marginBottom: 4, display: 'block' }}>Audience</label>
              <select value={form.target} onChange={e => set('target', e.target.value as AnnouncementTarget)} style={selectStyle}>
                <option value="all">Everyone</option>
                <option value="aspirants">Aspirants only</option>
                <option value="employers">Employers only</option>
              </select>
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: colors.text.ink, marginBottom: 4, display: 'block' }}>Channel</label>
            <select value={form.channel} onChange={e => set('channel', e.target.value as AnnouncementChannel)} style={selectStyle}>
              <option value="in_app">In-app only</option>
              <option value="email">Email only</option>
              <option value="both">In-app + Email</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: colors.text.ink, marginBottom: 4, display: 'block' }}>
              Schedule for <span style={{ fontWeight: 400, color: colors.text.muted }}>(optional — leave blank to save as draft)</span>
            </label>
            <input
              type="datetime-local"
              value={form.scheduled_at ? form.scheduled_at.slice(0, 16) : ''}
              onChange={e => set('scheduled_at', e.target.value ? new Date(e.target.value).toISOString() : null)}
              style={inputStyle}
            />
          </div>
        </div>

        {err && <p style={{ fontSize: 12, color: '#EF4444', marginTop: 12, flexShrink: 0 }}>{getApiError(err)}</p>}

        <div className="flex gap-3 mt-5 shrink-0">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" disabled={!canSubmit} loading={isPending} onClick={handleSubmit}>
            {isEdit ? 'Save changes' : 'Save draft'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Delete confirm ─────────────────────────────────────────────────────────────

function DeleteConfirm({ ann, onClose }: { ann: AnnouncementEntry; onClose: () => void }) {
  const del = useDeleteAnnouncement()
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div style={{ background: '#fff', borderRadius: 16, padding: 24, maxWidth: 384, width: '100%' }}>
        <h3 style={{ fontSize: 16, fontWeight: 900, color: colors.text.ink, marginBottom: 8 }}>Delete announcement?</h3>
        <p style={{ fontSize: 14, color: colors.text.muted, marginBottom: 20 }}>
          "<span style={{ fontWeight: 600, color: colors.text.ink }}>{ann.title}</span>" will be permanently removed.
        </p>
        {del.isError && <p style={{ fontSize: 12, color: '#EF4444', marginBottom: 12 }}>{getApiError(del.error)}</p>}
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button variant="danger" className="flex-1" loading={del.isPending} onClick={() => del.mutate(ann.id, { onSuccess: onClose })}>Delete</Button>
        </div>
      </div>
    </div>
  )
}

// ── Publish confirm ────────────────────────────────────────────────────────────

function PublishConfirm({ ann, onClose }: { ann: AnnouncementEntry; onClose: () => void }) {
  const pub = usePublishAnnouncement()
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div style={{ background: '#fff', borderRadius: 16, padding: 24, maxWidth: 384, width: '100%' }}>
        <h3 style={{ fontSize: 16, fontWeight: 900, color: colors.text.ink, marginBottom: 8 }}>Publish now?</h3>
        <p style={{ fontSize: 14, color: colors.text.muted, marginBottom: 4 }}>
          "<span style={{ fontWeight: 600, color: colors.text.ink }}>{ann.title}</span>" will be sent to{' '}
          <span style={{ fontWeight: 600 }}>{TARGET_LABELS[ann.target]}</span> via{' '}
          <span style={{ fontWeight: 600 }}>{CHANNEL_LABELS[ann.channel]}</span>.
        </p>
        <p style={{ fontSize: 12, color: '#D97706', background: '#FFFBEB', borderRadius: 10, padding: '8px 12px', marginBottom: 20 }}>
          Published announcements cannot be edited or un-published.
        </p>
        {pub.isError && <p style={{ fontSize: 12, color: '#EF4444', marginBottom: 12 }}>{getApiError(pub.error)}</p>}
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" loading={pub.isPending} onClick={() => pub.mutate(ann.id, { onSuccess: onClose })}>Publish</Button>
        </div>
      </div>
    </div>
  )
}

// ── Announcement card ──────────────────────────────────────────────────────────

function AnnCard({
  ann,
  onEdit,
  onPublish,
  onDelete,
}: {
  ann: AnnouncementEntry
  onEdit: () => void
  onPublish: () => void
  onDelete: () => void
}) {
  const tc = TYPE_LABELS[ann.type]
  const isPublished = ann.status === 'published'

  return (
    <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(0,0,0,0.08)', padding: 20 }}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge color={tc.color}>{tc.label}</Badge>
          <Badge color={STATUS_COLORS[ann.status] ?? 'gray'} className="capitalize">{ann.status}</Badge>
          <span style={{ fontSize: 10, color: colors.text.muted, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Users className="w-3 h-3" />{TARGET_LABELS[ann.target]}
          </span>
          <span style={{ fontSize: 10, color: colors.text.muted, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Radio className="w-3 h-3" />{CHANNEL_LABELS[ann.channel]}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {!isPublished && (
            <>
              <button
                onClick={onEdit}
                style={{ padding: 6, borderRadius: 8, color: colors.text.muted, background: 'transparent', border: 'none' }}
                title="Edit"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={onPublish}
                className="flex items-center gap-1"
                style={{ padding: '4px 10px', height: 28, borderRadius: 8, background: colors.surface.elevated, color: colors.text.ink, fontSize: 12, fontWeight: 600, border: 'none' }}
              >
                <Send className="w-3 h-3" />
                Publish
              </button>
            </>
          )}
          <button
            onClick={onDelete}
            style={{ padding: 6, borderRadius: 8, color: colors.text.muted, background: 'transparent', border: 'none' }}
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <h3 style={{ fontSize: 14, fontWeight: 700, color: colors.text.ink, marginBottom: 4 }}>{ann.title}</h3>
      <p style={{ fontSize: 12, color: colors.text.muted, lineHeight: 1.6 }} className="line-clamp-3">{ann.body}</p>

      <div className="flex items-center gap-4 mt-3 pt-3" style={{ borderTop: '1px solid rgba(0,0,0,0.06)', fontSize: 10, color: colors.text.muted }}>
        {isPublished && (
          <span className="flex items-center gap-1">
            <Send className="w-3 h-3" />
            Sent to {ann.sent_count.toLocaleString('en-IN')} users
          </span>
        )}
        {ann.scheduled_at && !isPublished && (
          <span className="flex items-center gap-1" style={{ color: '#3B82F6' }}>
            <Calendar className="w-3 h-3" />
            Scheduled {fmtDate(ann.scheduled_at)}
          </span>
        )}
        {isPublished && (
          <span className="flex items-center gap-1">
            Published {fmtDate(ann.published_at)}
          </span>
        )}
        {ann.created_by_name && (
          <span>by {ann.created_by_name}</span>
        )}
        <span className="ml-auto">Created {fmtDate(ann.created_at)}</span>
      </div>
    </div>
  )
}

// ── Delivery Log tab ──────────────────────────────────────────────────────────

const DELIVERY_COLORS: Record<string, 'green' | 'red' | 'gray'> = {
  sent:    'green',
  failed:  'red',
  pending: 'gray',
}

function DeliveryLogTab() {
  const [deliveryStatus, setDeliveryStatus] = useState<string>('')
  const { data: stats } = useNotificationsStats()
  const { data, isLoading } = useAdminNotifications(
    deliveryStatus ? { delivery_status: deliveryStatus, limit: 100 } : { limit: 100 }
  )
  const del = useDeleteNotification()

  const statCards = stats ? [
    { label: 'Sent today',   value: stats.sent_today,    icon: CheckCircle },
    { label: 'Failed today', value: stats.failed_today,  icon: AlertCircle },
    { label: 'Total today',  value: stats.total_today,   icon: Mail },
    { label: 'Unread total', value: stats.unread_total,  icon: Bell },
  ] : []

  const FILTERS = [
    { key: '',        label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'sent',    label: 'Sent' },
    { key: 'failed',  label: 'Failed' },
  ]

  return (
    <div className="flex flex-col gap-5">
      {/* Stats row */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {statCards.map(({ label, value, icon: Icon }) => (
            <div key={label} style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(0,0,0,0.08)', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: colors.surface.elevated, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon className="w-5 h-5" style={{ color: colors.text.ink }} />
              </div>
              <div>
                <p style={{ fontSize: 28, fontWeight: 800, color: colors.text.ink }}>{value.toLocaleString()}</p>
                <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: colors.text.muted }}>{label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delivery status filter */}
      <div style={{ display: 'flex', gap: 2, background: colors.surface.bg, borderRadius: 10, padding: 3, border: '1px solid rgba(0,0,0,0.08)', width: 'fit-content' }}>
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setDeliveryStatus(f.key)}
            style={{
              padding: '4px 12px',
              height: 28,
              borderRadius: 7,
              fontSize: 12,
              fontWeight: 600,
              border: 'none',
              background: deliveryStatus === f.key ? colors.brand.navy : 'transparent',
              color: deliveryStatus === f.key ? '#fff' : colors.text.muted,
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Table */}
      {isLoading ? <Spinner /> : !data || data.items.length === 0 ? (
        <Empty icon={Activity} text="No notifications found" />
      ) : (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(0,0,0,0.08)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(0,0,0,0.08)', background: colors.surface.bg, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: colors.text.muted }}>{data.total.toLocaleString()} total</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: colors.surface.bg, borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
                  {['Recipient', 'Title', 'Type', 'Delivery', 'Read', 'Sent at', ''].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: colors.text.muted, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.items.map((n: AdminNotificationEntry, idx) => (
                  <tr
                    key={n.id}
                    style={{ background: idx % 2 === 0 ? '#fff' : colors.surface.bg, borderBottom: '1px solid rgba(0,0,0,0.06)' }}
                    onMouseOver={e => (e.currentTarget.style.background = colors.surface.elevated)}
                    onMouseOut={e => (e.currentTarget.style.background = idx % 2 === 0 ? '#fff' : colors.surface.bg)}
                  >
                    <td style={{ padding: '12px 16px', maxWidth: 160 }} className="truncate">
                      <p style={{ fontSize: 12, fontWeight: 500, color: colors.text.ink }} className="truncate">{n.user_email ?? n.user_phone ?? n.user_id.slice(0, 8)}</p>
                    </td>
                    <td style={{ padding: '12px 16px', maxWidth: 220 }} className="truncate">
                      <p style={{ fontSize: 12, color: colors.text.ink }} className="truncate">{n.title}</p>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: 10, fontWeight: 600, background: colors.surface.bg, color: colors.text.muted, padding: '2px 8px', borderRadius: 9999, textTransform: 'capitalize' }}>
                        {n.type.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <Badge color={DELIVERY_COLORS[n.delivery_status ?? 'pending'] ?? 'gray'} className="capitalize">
                        {n.delivery_status ?? 'none'}
                      </Badge>
                      {n.delivery_status === 'failed' && n.email_failed_reason && (
                        <p style={{ fontSize: 10, color: '#EF4444', marginTop: 2, maxWidth: 140 }} className="truncate" title={n.email_failed_reason}>
                          {n.email_failed_reason}
                        </p>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: 10, fontWeight: 600, color: n.is_read ? '#16A34A' : colors.text.muted }}>
                        {n.is_read ? 'Read' : 'Unread'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 11, color: colors.text.muted, whiteSpace: 'nowrap' }}>
                      {new Date(n.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <button
                        onClick={() => del.mutate(n.id)}
                        disabled={del.isPending}
                        style={{ padding: 4, borderRadius: 6, color: colors.text.muted, background: 'transparent', border: 'none' }}
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

type PageTab = 'announcements' | 'delivery-log'
type AnnFilter = 'all' | 'draft' | 'scheduled' | 'published'
type Modal =
  | { type: 'compose' }
  | { type: 'edit';    ann: AnnouncementEntry }
  | { type: 'publish'; ann: AnnouncementEntry }
  | { type: 'delete';  ann: AnnouncementEntry }

export default function NotificationsPage() {
  const [pageTab, setPageTab] = useState<PageTab>('announcements')
  const [filter, setFilter] = useState<AnnFilter>('all')
  const [modal, setModal] = useState<Modal | null>(null)

  const { data: all, isLoading } = useAnnouncements()

  const filtered = (all ?? []).filter(a => filter === 'all' || a.status === filter)

  const counts = {
    draft:     (all ?? []).filter(a => a.status === 'draft').length,
    scheduled: (all ?? []).filter(a => a.status === 'scheduled').length,
    published: (all ?? []).filter(a => a.status === 'published').length,
  }

  const FILTERS: { key: AnnFilter; label: string; count?: number }[] = [
    { key: 'all',       label: 'All',       count: all?.length },
    { key: 'draft',     label: 'Drafts',    count: counts.draft },
    { key: 'scheduled', label: 'Scheduled', count: counts.scheduled },
    { key: 'published', label: 'Published', count: counts.published },
  ]

  const tabBtnStyle = (active: boolean) => ({
    display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', height: 28, borderRadius: 7, fontSize: 12, fontWeight: 600, border: 'none',
    background: active ? colors.brand.navy : 'transparent',
    color: active ? '#fff' : colors.text.muted,
  })

  return (
    <section className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div style={{ width: 36, height: 36, borderRadius: 12, background: colors.surface.elevated, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Bell className="w-4 h-4" style={{ color: colors.text.ink }} />
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: colors.text.ink, fontFamily: 'Hind, sans-serif', letterSpacing: '-0.3px' }}>Notifications</h1>
            <p style={{ fontSize: 14, color: colors.text.muted, marginTop: 2 }}>Manage announcements and view notification delivery status.</p>
          </div>
        </div>
        {pageTab === 'announcements' && (
          <Button size="sm" className="shrink-0" onClick={() => setModal({ type: 'compose' })}>
            <Plus className="w-3.5 h-3.5" /> New announcement
          </Button>
        )}
      </div>

      {/* Page tabs */}
      <div style={{ display: 'flex', gap: 2, background: colors.surface.bg, borderRadius: 10, padding: 3, border: '1px solid rgba(0,0,0,0.08)', width: 'fit-content' }}>
        <button onClick={() => setPageTab('announcements')} style={tabBtnStyle(pageTab === 'announcements')} className="flex items-center gap-1.5">
          <Radio className="w-3 h-3" />
          Announcements
        </button>
        <button onClick={() => setPageTab('delivery-log')} style={tabBtnStyle(pageTab === 'delivery-log')} className="flex items-center gap-1.5">
          <Activity className="w-3 h-3" />
          Delivery Log
        </button>
      </div>

      {/* Announcements tab */}
      {pageTab === 'announcements' && (
        <>
          {/* Filter tabs */}
          <div style={{ display: 'flex', gap: 2, background: colors.surface.bg, borderRadius: 10, padding: 3, border: '1px solid rgba(0,0,0,0.08)', width: 'fit-content' }}>
            {FILTERS.map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                style={{ ...tabBtnStyle(filter === f.key), display: 'flex', alignItems: 'center', gap: 6 }}
              >
                {f.label}
                {f.count !== undefined && f.count > 0 && (
                  <span style={{
                    padding: '0 6px', borderRadius: 9999, fontSize: 9, fontWeight: 700,
                    background: filter === f.key ? 'rgba(255,255,255,0.2)' : colors.surface.elevated,
                    color: filter === f.key ? '#fff' : colors.text.muted,
                  }}>
                    {f.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* List */}
          {isLoading ? <Spinner /> : filtered.length === 0 ? (
            <Empty icon={Bell} text={filter === 'all' ? 'No announcements yet' : `No ${filter} announcements`} />
          ) : (
            <div className="flex flex-col gap-4">
              {filtered.map(ann => (
                <AnnCard
                  key={ann.id}
                  ann={ann}
                  onEdit={() => setModal({ type: 'edit', ann })}
                  onPublish={() => setModal({ type: 'publish', ann })}
                  onDelete={() => setModal({ type: 'delete', ann })}
                />
              ))}
            </div>
          )}

          {modal?.type === 'compose' && <ComposeModal onClose={() => setModal(null)} />}
          {modal?.type === 'edit' && <ComposeModal initial={modal.ann} onClose={() => setModal(null)} />}
          {modal?.type === 'publish' && <PublishConfirm ann={modal.ann} onClose={() => setModal(null)} />}
          {modal?.type === 'delete' && <DeleteConfirm ann={modal.ann} onClose={() => setModal(null)} />}
        </>
      )}

      {pageTab === 'delivery-log' && <DeliveryLogTab />}
    </section>
  )
}
