import { Info } from 'lucide-react'
import { INK_SFT } from '@/design-system/tokens'

/** Said on every reference-role card and page: these are research records, not openings. */
export default function ReferenceNotice({ compact = false }: { compact?: boolean }) {
  return (
    <div role="note" style={{
      display: 'flex', alignItems: 'flex-start', gap: 8, background: '#FFFBEB', border: '1px solid #FDE68A',
      borderRadius: 10, padding: compact ? '7px 10px' : '10px 14px', color: '#92400E',
      fontSize: compact ? 11.5 : 12.5, lineHeight: 1.5,
    }}>
      <Info size={compact ? 13 : 15} style={{ flexShrink: 0, marginTop: 2 }} />
      <span style={{ color: compact ? '#92400E' : INK_SFT }}>
        <strong style={{ color: '#92400E' }}>Reference role, not an open vacancy.</strong>{' '}
        {compact
          ? 'Research data: you cannot apply here.'
          : 'This comes from research on what organisations hire UPSC aspirants for. Nothing here is a live opening and you cannot apply to it on this platform. Salaries and fit scores are research estimates.'}
      </span>
    </div>
  )
}
