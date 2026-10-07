import { colors } from '@/design-system/tokens'
import type { Band, FixType, RequirementResult } from '@/api/resumeMatch'

export const bandColor: Record<Band, string> = {
  Strong: colors.state.success,
  Good: colors.state.info,
  Fair: colors.state.warning,
  Low: colors.state.danger,
}

export const bandBadge: Record<Band, 'green' | 'blue' | 'amber' | 'red'> = {
  Strong: 'green', Good: 'blue', Fair: 'amber', Low: 'red',
}

export function verdictColor(credit: number): string {
  if (credit >= 0.7) return colors.state.success
  if (credit > 0) return colors.state.warning
  return colors.state.danger
}

export function verdictLabel(r: RequirementResult): string {
  if (r.requirement.type === 'eligibility') return 'Confirm'
  if (r.credit >= 0.99) return 'Met'
  if (r.credit >= 0.7) return 'Equivalent skill'
  if (r.credit > 0) return 'Weak evidence'
  return 'Missing'
}

export const fixTypeLabel: Record<FixType, string> = {
  reword: 'Reword',
  add_evidence: 'Add evidence',
  real_gap: 'Real gap',
  confirm: 'Confirm',
}

export const fixTypeBadge: Record<FixType, 'blue' | 'amber' | 'red' | 'gray'> = {
  reword: 'blue', add_evidence: 'amber', real_gap: 'red', confirm: 'gray',
}
