import { X } from 'lucide-react'
import { PASSWORD_RULES, type PasswordRule } from './passwordRules'

const STRENGTH_LABELS = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong', 'Very strong']
const STRENGTH_COLORS = ['#E2E8F0', '#EF4444', '#F97316', '#EAB308', '#65A30D', '#16A34A']

interface PasswordStrengthMeterProps {
  password: string
  rules?: PasswordRule[]
}

/** Shared across every register/password form (aspirant + employer signup,
 * change-password, etc.) so strength feedback looks and behaves the same
 * everywhere: a slim colored bar + label, and only the *unmet* requirements
 * listed below it — not a two-column checklist of everything at once. */
export default function PasswordStrengthMeter({ password, rules = PASSWORD_RULES }: PasswordStrengthMeterProps) {
  if (!password) return null

  const results = rules.map((r) => ({ ...r, pass: r.test(password) }))
  const passedCount = results.filter((r) => r.pass).length
  const color = STRENGTH_COLORS[passedCount]
  const label = STRENGTH_LABELS[passedCount]
  const unmet = results.filter((r) => !r.pass)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 2 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ display: 'flex', gap: 4, flex: 1 }}>
          {rules.map((_, i) => (
            <div
              key={i}
              style={{
                height: 3, flex: 1, borderRadius: 3,
                background: i < passedCount ? color : '#E2E8F0',
                transition: 'background 0.2s',
              }}
            />
          ))}
        </div>
        <span style={{ fontSize: 11.5, fontWeight: 600, color, minWidth: 74, textAlign: 'right' }}>
          {label}
        </span>
      </div>

      {unmet.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px 12px' }}>
          {unmet.map((r) => (
            <span
              key={r.key}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#94A3B8' }}
            >
              <X size={10} /> {r.label}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
