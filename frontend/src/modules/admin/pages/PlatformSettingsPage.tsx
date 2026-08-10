import { useState } from 'react'
import { Settings, Flag } from 'lucide-react'
import { usePlatformSettings, useUpdatePlatformSetting, useFeatureFlags, useUpdateFeatureFlag } from '../hooks/useAdmin'
import { Spinner, Empty } from '../shared/adminUI'
import { cn } from '@/lib/utils'
import { colors } from '@/design-system/tokens'
import Button from '@/shared/components/primitives/Button'


export default function PlatformSettingsPage() {
  const { data: settings, isLoading: settingsLoading } = usePlatformSettings()
  const { data: flags,    isLoading: flagsLoading }    = useFeatureFlags()
  const updateSetting = useUpdatePlatformSetting()
  const updateFlag    = useUpdateFeatureFlag()

  const [editingKey,  setEditingKey]  = useState<string | null>(null)
  const [settingValue, setSettingValue] = useState('')
  const [editingFlag,  setEditingFlag]  = useState<string | null>(null)
  const [flagRollout,  setFlagRollout]  = useState('0')

  const inputStyle = { height: 32, padding: '0 8px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.08)', fontSize: 12, outline: 'none' }

  return (
    <section className="flex flex-col gap-8">
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: colors.text.ink, fontFamily: 'Hind, sans-serif', letterSpacing: '-0.3px' }}>Platform Settings</h1>
        <p style={{ fontSize: 14, color: colors.text.muted, marginTop: 4 }}>Super Admin only — changes affect all users immediately.</p>
      </div>

      {/* Platform settings */}
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(0,0,0,0.08)', background: colors.surface.bg, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Settings size={14} style={{ color: colors.text.muted }} />
          <h2 style={{ fontSize: 14, fontWeight: 700, color: colors.text.ink }}>Platform Settings</h2>
        </div>

        {settingsLoading ? <Spinner /> : !settings || settings.length === 0 ? (
          <Empty icon={Settings} text="No platform settings configured" />
        ) : (
          settings.map((s, idx) => (
            <div
              key={s.id}
              style={{
                padding: '12px 20px',
                borderBottom: idx < settings.length - 1 ? '1px solid rgba(0,0,0,0.06)' : 'none',
                background: idx % 2 === 0 ? '#fff' : colors.surface.bg,
              }}
            >
              {editingKey === s.key ? (
                <div className="flex flex-wrap items-end gap-3">
                  <div className="flex-1 min-w-[200px]">
                    <p style={{ fontSize: 10, color: colors.text.muted, marginBottom: 4 }}>{s.key}</p>
                    <input
                      value={settingValue}
                      onChange={e => setSettingValue(e.target.value)}
                      style={{ ...inputStyle, width: '100%', fontFamily: 'monospace' }}
                    />
                  </div>
                  <Button
                    size="sm"
                    loading={updateSetting.isPending}
                    onClick={() => {
                      let parsed: unknown = settingValue
                      try { parsed = JSON.parse(settingValue) } catch { /* keep as string */ }
                      updateSetting.mutate({ key: s.key, value: parsed }, { onSuccess: () => setEditingKey(null) })
                    }}
                  >Save</Button>
                  <Button variant="outline" size="sm" onClick={() => setEditingKey(null)}>Cancel</Button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p style={{ fontSize: 14, fontWeight: 600, color: colors.text.ink }}>{s.key}</p>
                    <p style={{ fontSize: 12, color: colors.text.muted, marginTop: 2, fontFamily: 'monospace' }} className="truncate">{JSON.stringify(s.value)}</p>
                    {s.description && <p style={{ fontSize: 12, color: colors.text.muted, marginTop: 2 }}>{s.description}</p>}
                  </div>
                  <button
                    onClick={() => { setEditingKey(s.key); setSettingValue(JSON.stringify(s.value)) }}
                    style={{ flexShrink: 0, fontSize: 12, fontWeight: 600, color: colors.brand.navy, background: 'transparent', border: 'none' }}
                  >Edit</button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Feature flags */}
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(0,0,0,0.08)', background: colors.surface.bg, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Flag size={14} style={{ color: colors.text.muted }} />
          <h2 style={{ fontSize: 14, fontWeight: 700, color: colors.text.ink }}>Feature Flags</h2>
        </div>

        {flagsLoading ? <Spinner /> : !flags || flags.length === 0 ? (
          <Empty icon={Flag} text="No feature flags configured" />
        ) : (
          flags.map((f, idx) => (
            <div
              key={f.id}
              style={{
                padding: '12px 20px',
                borderBottom: idx < flags.length - 1 ? '1px solid rgba(0,0,0,0.06)' : 'none',
                background: idx % 2 === 0 ? '#fff' : colors.surface.bg,
              }}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p style={{ fontSize: 14, fontWeight: 600, color: colors.text.ink }}>{f.flag_name}</p>
                  <p style={{ fontSize: 12, color: colors.text.muted, marginTop: 2 }}>
                    {f.rollout_pct}% rollout
                    {f.target_roles && f.target_roles.length > 0 && ` · ${f.target_roles.join(', ')}`}
                  </p>
                  {f.description && <p style={{ fontSize: 12, color: colors.text.muted, marginTop: 2 }}>{f.description}</p>}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {editingFlag === f.flag_name ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="number" min={0} max={100} value={flagRollout}
                        onChange={e => setFlagRollout(e.target.value)}
                        style={{ ...inputStyle, width: 64 }}
                      />
                      <button
                        onClick={() => updateFlag.mutate({
                          flagName: f.flag_name,
                          payload: { is_enabled: f.is_enabled, rollout_pct: Number(flagRollout) || 0, target_roles: f.target_roles },
                        }, { onSuccess: () => setEditingFlag(null) })}
                        style={{ height: 32, padding: '0 8px', borderRadius: 10, background: colors.brand.navy, color: '#fff', fontSize: 12, fontWeight: 600, border: 'none' }}
                      >Save</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setEditingFlag(f.flag_name); setFlagRollout(String(f.rollout_pct)) }}
                      style={{ fontSize: 12, fontWeight: 600, color: colors.brand.navy, background: 'transparent', border: 'none' }}
                    >Rollout %</button>
                  )}
                  {/* Toggle */}
                  <button
                    onClick={() => updateFlag.mutate({
                      flagName: f.flag_name,
                      payload: { is_enabled: !f.is_enabled, rollout_pct: f.rollout_pct, target_roles: f.target_roles },
                    })}
                    disabled={updateFlag.isPending}
                    style={{
                      height: 28, width: 48, borderRadius: 9999, position: 'relative', flexShrink: 0,
                      background: f.is_enabled ? colors.brand.navy : colors.surface.elevated, border: 'none', transition: 'background 0.2s',
                      opacity: updateFlag.isPending ? 0.6 : 1,
                    }}
                  >
                    <span style={{
                      position: 'absolute', top: 4, left: f.is_enabled ? 'calc(100% - 24px)' : 4,
                      width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left 0.2s',
                    }} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  )
}
