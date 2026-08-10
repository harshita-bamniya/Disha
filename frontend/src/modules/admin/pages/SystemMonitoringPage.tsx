import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Activity, Database, Cpu, Server, RefreshCw, CheckCircle2, AlertCircle, Clock } from 'lucide-react'
import { adminApi } from '@/api/admin'
import type { DbPoolStats, QueueDepth, RedisInfo, ProcessInfo } from '@/api/admin'
import { Spinner } from '@/modules/admin/shared/adminUI'
import ProgressBar from '@/shared/components/data-display/ProgressBar'
import { cn } from '@/lib/utils'
import { colors } from '@/design-system/tokens'


// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt_uptime(s: number): string {
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return `${h}h ${m}m`
}

// ── Mini progress bar ──────────────────────────────────────────────────────────

function PoolBar({ value, max, color }: { value: number; max: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div style={{ flex: 1 }}>
        <ProgressBar value={value} max={max} color={color} height={8} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color: colors.text.ink, width: 48, textAlign: 'right' }}>{value}/{max}</span>
    </div>
  )
}

// ── Section card ───────────────────────────────────────────────────────────────

function MonitorCard({
  icon: Icon, title, children, status,
}: {
  icon: React.ElementType
  title: string
  children: React.ReactNode
  status?: 'ok' | 'warn' | 'error'
}) {
  return (
    <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(0,0,0,0.08)', padding: 20 }}>
      <div className="flex items-center gap-3 mb-4">
        <div style={{
          width: 32, height: 32, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          background: status === 'error' ? '#FEF2F2' : status === 'warn' ? '#FFFBEB' : colors.surface.elevated,
        }}>
          <Icon className="w-4 h-4" style={{ color: status === 'error' ? '#EF4444' : status === 'warn' ? '#F59E0B' : colors.text.ink }} />
        </div>
        <p style={{ fontSize: 14, fontWeight: 900, color: colors.text.ink }}>{title}</p>
        {status === 'error' && <AlertCircle className="w-4 h-4 ml-auto" style={{ color: '#EF4444' }} />}
        {status === 'ok' && <CheckCircle2 className="w-4 h-4 ml-auto" style={{ color: '#22C55E' }} />}
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  )
}

function Row({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span style={{ fontSize: 12, color: colors.text.muted }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: colors.text.ink, fontFamily: mono ? 'monospace' : undefined }}>{value}</span>
    </div>
  )
}

// ── DB pool card ───────────────────────────────────────────────────────────────

function DbPoolCard({ pool }: { pool: DbPoolStats }) {
  const utilizationPct = pool.max_size > 0 ? Math.round((pool.checked_out / pool.max_size) * 100) : 0
  const status = utilizationPct >= 80 ? 'warn' : 'ok'
  return (
    <MonitorCard icon={Database} title="Database Pool" status={status}>
      <Row label="Checked out (in use)" value={pool.checked_out} />
      <PoolBar value={pool.checked_out} max={pool.max_size} color="#6C63FF" />
      <Row label="Idle (checked in)" value={pool.checked_in} />
      <Row label="Overflow connections" value={pool.overflow} />
      <Row label="Pool size / max" value={`${pool.size} / ${pool.max_size}`} />
      {utilizationPct >= 80 && (
        <p style={{ fontSize: 11, color: '#D97706', background: '#FFFBEB', borderRadius: 10, padding: '8px 12px' }}>
          Pool utilisation at {utilizationPct}% — consider increasing DB_POOL_SIZE.
        </p>
      )}
    </MonitorCard>
  )
}

// ── Celery card ────────────────────────────────────────────────────────────────

function CeleryCard({ queues, beat_tasks, broker }: { queues: QueueDepth[]; beat_tasks: string[]; broker: string }) {
  const totalPending = queues.reduce((s, q) => s + (q.pending ?? 0), 0)
  const hasBacklog = totalPending > 50
  return (
    <MonitorCard icon={Cpu} title="Celery Workers" status={hasBacklog ? 'warn' : 'ok'}>
      <Row label="Broker" value={broker} mono />
      <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: 8 }}>
        <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: colors.text.muted, marginBottom: 8 }}>Queue depths</p>
        {queues.map(q => (
          <div key={q.queue} className="flex items-center justify-between py-1">
            <span style={{ fontSize: 12, fontFamily: 'monospace', color: colors.text.muted }}>{q.queue}</span>
            <span style={{
              fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 9999,
              background: q.pending === null ? colors.surface.bg : q.pending > 50 ? '#FFFBEB' : q.pending > 0 ? '#EFF6FF' : '#F0FDF4',
              color: q.pending === null ? colors.text.muted : q.pending > 50 ? '#D97706' : q.pending > 0 ? '#2563EB' : '#16A34A',
            }}>
              {q.pending === null ? '—' : q.pending}
            </span>
          </div>
        ))}
      </div>
      {hasBacklog && (
        <p style={{ fontSize: 11, color: '#D97706', background: '#FFFBEB', borderRadius: 10, padding: '8px 12px' }}>
          {totalPending} tasks pending — check worker logs.
        </p>
      )}
      <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: 8 }}>
        <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: colors.text.muted, marginBottom: 8 }}>Beat schedule ({beat_tasks.length})</p>
        <div className="flex flex-col gap-1">
          {beat_tasks.map(t => (
            <span key={t} style={{ fontSize: 11, fontFamily: 'monospace', color: colors.text.muted }} className="truncate">{t}</span>
          ))}
        </div>
      </div>
    </MonitorCard>
  )
}

// ── Redis card ─────────────────────────────────────────────────────────────────

function RedisCard({ info }: { info: RedisInfo }) {
  if (info.error) {
    return (
      <MonitorCard icon={Server} title="Redis" status="error">
        <p style={{ fontSize: 12, color: '#DC2626', fontFamily: 'monospace' }}>{info.error}</p>
      </MonitorCard>
    )
  }
  return (
    <MonitorCard icon={Server} title="Redis" status="ok">
      <Row label="Version" value={info.version ?? '—'} mono />
      <Row label="Memory used" value={`${info.used_memory_mb ?? '—'} MB`} />
      <Row label="Connected clients" value={info.connected_clients ?? '—'} />
      <Row label="Uptime" value={info.uptime_days !== undefined ? `${info.uptime_days} days` : '—'} />
    </MonitorCard>
  )
}

// ── Process card ───────────────────────────────────────────────────────────────

function ProcessCard({ proc, sentry }: { proc: ProcessInfo; sentry: { configured: boolean; dsn_hint: string | null } }) {
  return (
    <MonitorCard icon={Activity} title="API Process" status="ok">
      <Row label="Uptime" value={fmt_uptime(proc.uptime_seconds)} />
      <Row label="Memory (RSS)" value={proc.memory_mb !== null ? `${proc.memory_mb} MB` : '—'} />
      <Row label="Git SHA" value={proc.git_sha} mono />
      <Row label="Environment" value={
        <span style={{
          padding: '2px 8px', borderRadius: 9999, fontSize: 11, fontWeight: 700,
          background: proc.environment === 'production' ? '#DCFCE7' : proc.environment === 'staging' ? '#FFFBEB' : colors.surface.bg,
          color: proc.environment === 'production' ? '#15803D' : proc.environment === 'staging' ? '#D97706' : colors.text.muted,
        }}>
          {proc.environment}
        </span>
      } />
      <Row label="Debug mode" value={
        proc.python_debug
          ? <span style={{ color: '#D97706', fontWeight: 700 }}>ON</span>
          : <span style={{ color: '#16A34A', fontWeight: 700 }}>OFF</span>
      } />
      <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: 8 }}>
        <Row label="Sentry" value={
          sentry.configured
            ? <span style={{ color: '#16A34A', fontWeight: 600 }}>Configured</span>
            : <span style={{ color: colors.text.muted }}>Not configured</span>
        } />
        {sentry.dsn_hint && (
          <p style={{ fontSize: 11, fontFamily: 'monospace', color: colors.text.muted, marginTop: 4 }} className="truncate">{sentry.dsn_hint}</p>
        )}
      </div>
    </MonitorCard>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function SystemMonitoringPage() {
  const qc = useQueryClient()
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['admin', 'system'],
    queryFn: adminApi.getSystemStatus,
    staleTime: 15_000,
    refetchInterval: 30_000,
  })

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <div style={{ width: 40, height: 40, borderRadius: 12, background: colors.surface.elevated, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Activity className="w-5 h-5" style={{ color: colors.text.ink }} />
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: colors.text.ink, fontFamily: 'Hind, sans-serif', letterSpacing: '-0.3px' }}>System Monitoring</h1>
            <p style={{ fontSize: 14, color: colors.text.muted }}>
              Live infrastructure health. Auto-refreshes every 30 s.
              {data && (
                <span style={{ marginLeft: 8, color: '#CBD5E1', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Clock className="w-3 h-3" />
                  {new Date(data.checked_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              )}
            </p>
          </div>
        </div>
        <button
          onClick={() => qc.invalidateQueries({ queryKey: ['admin', 'system'] })}
          disabled={isFetching}
          className="flex items-center gap-1.5 shrink-0"
          style={{ height: 36, padding: '0 16px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.08)', background: '#fff', color: colors.text.ink, fontSize: 12, fontWeight: 600, opacity: isFetching ? 0.5 : 1 }}
        >
          <RefreshCw className={cn('w-3.5 h-3.5', isFetching && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {isLoading ? (
        <Spinner />
      ) : !data ? null : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <DbPoolCard pool={data.db_pool} />
          <CeleryCard queues={data.celery.queues} beat_tasks={data.celery.beat_tasks} broker={data.celery.broker} />
          <RedisCard info={data.redis} />
          <ProcessCard proc={data.process} sentry={data.sentry} />
        </div>
      )}
    </div>
  )
}
