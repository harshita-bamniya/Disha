import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { commandCenterApi, type FunnelResponse, type RangeParams, type Side } from '@/api/commandCenter'
import { downloadCSV } from '@/modules/admin/shared/adminUI'
import { colors } from '@/design-system/tokens'
import { ChartCard, Chip, Segmented, type ViewMode } from './ChartCard'
import { formatCI, formatCount, formatPct, trendGlyph } from './format'
import { useChartTooltip } from './useChartTooltip'

const SIDES = [
  { value: 'aspirant' as Side, label: 'Aspirants' },
  { value: 'employer' as Side, label: 'Employers' },
]
const MONO = 'JetBrains Mono, monospace'
const ROW_GRID = 'grid grid-cols-[96px_1fr_44px] sm:grid-cols-[118px_1fr_52px] items-center gap-[10px]'

export function FunnelChart({ range, compare }: { range: RangeParams; compare: boolean }) {
  const [side, setSide] = useState<Side>('aspirant')
  const [view, setView] = useState<ViewMode>('chart')
  const { showAtPointer, showAtElement, hide, tooltip } = useChartTooltip()

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['admin', 'command-center', 'funnel', side, range, compare],
    queryFn: () => commandCenterApi.getFunnel({ ...range, side, compare }),
    staleTime: 60_000,
  })

  const accent = side === 'aspirant' ? 'var(--color-chart-aspirant)' : 'var(--color-chart-employer)'
  const empty = data && data.steps[0]?.count === 0
    ? { message: side === 'aspirant' ? 'No signups in this period' : 'No employers registered in this period',
        hint: 'Try a longer date range.' }
    : null

  const tipFor = (s: FunnelResponse['steps'][number], i: number) => (
    <div>
      <div style={{ fontWeight: 600 }}>{s.label}</div>
      <div>{formatCount(s.count)} {s.count === 1 ? "person" : "people"} · {s.pct_of_start}% of start</div>
      {i > 0 && s.pct_of_prev && (
        <div>{formatPct(s.pct_of_prev.rate, 1)} of previous step (95% CI {formatCI(s.pct_of_prev.ci_low, s.pct_of_prev.ci_high)}%)</div>
      )}
      {s.low_sample && s.pct_of_prev && <div style={{ opacity: 0.8 }}>Low sample: n = {formatCount(s.pct_of_prev.denominator)}</div>}
    </div>
  )

  const exportCsv = () => {
    if (!data) return
    downloadCSV(
      data.steps.map(s => ({
        step: s.label, count: s.count, pct_of_start: s.pct_of_start,
        pct_of_previous: s.pct_of_prev?.rate != null ? +(s.pct_of_prev.rate * 100).toFixed(1) : '',
        ci_low_pct: s.pct_of_prev?.ci_low != null ? +(s.pct_of_prev.ci_low * 100).toFixed(1) : '',
        ci_high_pct: s.pct_of_prev?.ci_high != null ? +(s.pct_of_prev.ci_high * 100).toFixed(1) : '',
        low_sample: s.low_sample,
      })),
      `funnel_${side}`,
    )
  }

  return (
    <>
      <ChartCard
        title="Journey funnel"
        question="Where do we lose people, and are we producing placements?"
        controls={<Segmented label="Funnel side" value={side} options={SIDES} onChange={setSide} />}
        view={view} onViewChange={setView} onExport={exportCsv}
        isLoading={isPending && !isError} isError={isError} onRetry={() => refetch()}
        emptyMessage={empty?.message ?? null} emptyHint={empty?.hint}
        skeleton={<FunnelSkeleton />}
        table={data && <FunnelTable data={data} />}
        footer={data && <FunnelFooter data={data} />}
      >
        {data && (
          <div role="list" aria-label={`${side} funnel`} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div className={ROW_GRID} style={{ padding: '0 8px', fontFamily: MONO, fontSize: 9, letterSpacing: '0.08em', color: 'var(--color-chart-neutral)' }}>
              <span>STEP</span><span>COUNT</span><span style={{ textAlign: 'right' }}>% PREV</span>
            </div>
            {data.steps.map((s, i) => {
              const isLeak = data.biggest_leak?.to_key === s.key
              const hatched = s.low_sample && i > 0
              const width = Math.max(s.pct_of_start, 9)
              const prevRate = s.pct_of_prev?.rate
              return (
                <div
                  key={s.key} role="listitem" tabIndex={0}
                  aria-label={`${s.label}: ${formatCount(s.count)}${prevRate != null ? `, ${formatPct(prevRate)} of previous step` : ''}${hatched ? ', low sample' : ''}`}
                  className={`${ROW_GRID} outline-none focus-visible:outline-2 focus-visible:outline-offset-2`}
                  style={{
                    padding: '6px 8px', borderRadius: 10,
                    background: isLeak ? 'color-mix(in srgb, var(--color-chart-warn) 12%, transparent)' : 'transparent',
                    outlineColor: 'var(--color-chart-aspirant)',
                  }}
                  onMouseMove={e => showAtPointer(e, tipFor(s, i))}
                  onMouseLeave={hide}
                  onFocus={e => showAtElement(e.currentTarget, tipFor(s, i))}
                  onBlur={hide}
                >
                  <span title={s.label} style={{ fontSize: 12.5, color: colors.text.inkSoft, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.label}</span>
                  <div style={{ height: 24, display: 'flex', alignItems: 'center' }}>
                    {s.count === 0 ? (
                      // Zero-width bar: the count stays readable beside an empty track.
                      <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 500, color: 'var(--color-chart-neutral)', fontVariantNumeric: 'tabular-nums' }}>0</span>
                    ) : (
                    <div
                      className="motion-reduce:transition-none"
                      style={{
                        position: 'relative', height: 24, borderRadius: 6, minWidth: s.count === 0 ? 0 : 44, width: `${width}%`,
                        background: isLeak ? 'var(--color-chart-warn-strong)' : accent,
                        transition: 'width 350ms ease-out', overflow: 'hidden',
                        display: 'flex', alignItems: 'center', paddingLeft: 8,
                      }}
                    >
                      {hatched && (
                        <span aria-hidden style={{
                          position: 'absolute', inset: 0,
                          backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.55) 0 2px, transparent 2px 6px)',
                        }} />
                      )}
                      <span style={{ position: 'relative', fontFamily: MONO, fontSize: 12, fontWeight: 500, color: '#fff', fontVariantNumeric: 'tabular-nums', textShadow: hatched ? '0 0 3px rgba(0,0,0,0.5)' : 'none' }}>
                        {formatCount(s.count)}
                      </span>
                    </div>
                    )}
                  </div>
                  <span style={{
                    fontFamily: MONO, fontSize: 11.5, textAlign: 'right', fontVariantNumeric: 'tabular-nums',
                    color: isLeak ? 'var(--color-chart-warn-strong)' : 'var(--color-chart-neutral)', fontWeight: isLeak ? 600 : 400,
                  }}>
                    {i === 0 || prevRate == null ? '' : `${s.low_sample ? '~' : ''}${formatPct(prevRate)}`}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </ChartCard>
      {tooltip}
    </>
  )
}

function FunnelFooter({ data }: { data: FunnelResponse }) {
  const label = (key: string) => data.steps.find(s => s.key === key)?.label ?? key
  const leak = data.biggest_leak
  const overall = data.overall
  const dataCheck = data.meta.warnings.length > 0
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
      {leak ? (
        <>
          <Chip tone="warn">Biggest leak</Chip>
          <span>{label(leak.from_key)} → {label(leak.to_key)}: only {formatPct(leak.rate)} continue.</span>
        </>
      ) : (
        <span>No biggest leak yet: every step has fewer than 30 people before it.</span>
      )}
      {overall && overall.rate != null && (
        <span>
          Overall conversion {(overall.rate * 100).toFixed(1)}% (95% CI {formatCI(overall.ci_low, overall.ci_high)}).
        </span>
      )}
      {data.meta.compare && overall?.delta_pt != null && (
        <Chip tone={overall.delta_pt > 0 ? 'good' : overall.delta_pt < 0 ? 'bad' : 'neutral'}>
          {trendGlyph(overall.delta_pt)} {Math.abs(overall.delta_pt).toFixed(1)} pt vs previous period
        </Chip>
      )}
      {dataCheck && <Chip tone="warn" >data check</Chip>}
    </div>
  )
}

function FunnelTable({ data }: { data: FunnelResponse }) {
  const th = { textAlign: 'left' as const, padding: '8px 10px', fontSize: 11, color: colors.text.inkSoft, fontWeight: 600, whiteSpace: 'nowrap' as const }
  const td = { padding: '8px 10px', fontSize: 12.5, color: colors.text.ink, fontVariantNumeric: 'tabular-nums' as const, whiteSpace: 'nowrap' as const }
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <caption className="sr-only">Funnel steps for {data.side}s</caption>
        <thead>
          <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
            <th scope="col" style={th}>Step</th><th scope="col" style={th}>Count</th><th scope="col" style={th}>% of start</th>
            <th scope="col" style={th}>% of previous</th><th scope="col" style={th}>95% CI</th>
          </tr>
        </thead>
        <tbody>
          {data.steps.map((s, i) => (
            <tr key={s.key} style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
              <th scope="row" style={{ ...td, textAlign: 'left', fontWeight: 500 }}>{s.label}</th>
              <td style={td}>{formatCount(s.count)}</td>
              <td style={td}>{s.pct_of_start}%</td>
              <td style={td}>{i === 0 ? '' : s.pct_of_prev?.rate == null ? 'n/a' : `${s.low_sample ? '~' : ''}${formatPct(s.pct_of_prev.rate, 1)}`}</td>
              <td style={td}>{i === 0 ? '' : s.pct_of_prev?.rate == null ? 'n/a' : `${formatCI(s.pct_of_prev.ci_low, s.pct_of_prev.ci_high)}%`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function FunnelSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading funnel" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {[100, 72, 55, 40, 22, 12, 6].map((w, i) => (
        <div key={i} className="motion-safe:animate-pulse" style={{ height: 24, width: `${w}%`, minWidth: 44, borderRadius: 6, background: 'var(--color-chart-grid)' }} />
      ))}
    </div>
  )
}
