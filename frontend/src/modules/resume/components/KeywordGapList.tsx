import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { resumeApi } from '@/api/resume'
import { CheckCircle, XCircle, AlertCircle, Plus, Loader } from 'lucide-react'

interface KeywordGapResult {
  matched: string[]
  missing_critical: string[]
  missing_nice_to_have: string[]
  match_score: number
}

interface Props {
  resumeId: string
  jobDescription: string | null
  onAddKeyword?: (keyword: string) => void
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 70 ? '#16A34A' : score >= 40 ? '#D97706' : '#DC2626'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
      <div style={{
        width: 48, height: 48, borderRadius: '50%',
        border: `3px solid ${color}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 14, fontWeight: 900, color, flexShrink: 0,
      }}>
        {score}
      </div>
      <div>
        <div style={{ fontSize: 12, fontWeight: 800, color: '#0F172A' }}>Keyword Match</div>
        <div style={{ fontSize: 11, color, fontWeight: 700 }}>
          {score >= 70 ? 'Strong alignment' : score >= 40 ? 'Partial match' : 'Low coverage'}
        </div>
      </div>
    </div>
  )
}

function KeywordChip({
  keyword, variant, onAdd,
}: {
  keyword: string
  variant: 'matched' | 'critical' | 'nice'
  onAdd?: () => void
}) {
  const styles = {
    matched: { bg: '#F0FDF4', color: '#16A34A', border: '#BBF7D0', icon: <CheckCircle size={10} /> },
    critical: { bg: '#FEF2F2', color: '#DC2626', border: '#FCA5A5', icon: <XCircle size={10} /> },
    nice:     { bg: '#FFFBEB', color: '#D97706', border: '#FDE68A', icon: <AlertCircle size={10} /> },
  }[variant]

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 8px', borderRadius: 20,
      background: styles.bg, color: styles.color,
      border: `1px solid ${styles.border}`,
      fontSize: 11, fontWeight: 700, margin: '2px 3px',
    }}>
      {styles.icon}
      {keyword}
      {onAdd && variant !== 'matched' && (
        <button
          onClick={onAdd}
          title="Add to skills"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: styles.color, padding: 0, marginLeft: 2,
            display: 'flex', alignItems: 'center',
          }}
        >
          <Plus size={10} />
        </button>
      )}
    </span>
  )
}

export default function KeywordGapList({ resumeId, jobDescription, onAddKeyword }: Props) {
  const [result, setResult] = useState<KeywordGapResult | null>(null)
  const [jd, setJd] = useState(jobDescription ?? '')
  const [showJdInput, setShowJdInput] = useState(!jobDescription)

  const analyzeMutation = useMutation({
    mutationFn: () => resumeApi.keywordGap(resumeId, jd),
    onSuccess: (data) => setResult(data),
  })

  if (!jobDescription && !result) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <p style={{ fontSize: 12, color: '#64748B', margin: 0 }}>
          Paste a job description to see which keywords your resume is missing.
        </p>
        <textarea
          value={jd}
          onChange={e => setJd(e.target.value)}
          placeholder="Paste job description here..."
          rows={5}
          style={{ width: '100%', padding: '10px 12px', borderRadius: 9, border: '1.5px solid #E2E8F0', fontSize: 12, resize: 'vertical', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit', color: '#0F172A' }}
        />
        <button
          onClick={() => analyzeMutation.mutate()}
          disabled={!jd.trim() || analyzeMutation.isPending}
          style={{ padding: '9px', borderRadius: 9, background: '#1A2744', color: 'white', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, opacity: !jd.trim() || analyzeMutation.isPending ? 0.6 : 1 }}
        >
          {analyzeMutation.isPending ? 'Analyzing…' : 'Analyze Keywords'}
        </button>
      </div>
    )
  }

  if (analyzeMutation.isPending) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 16, color: '#64748B', fontSize: 12 }}>
        <Loader size={16} style={{ animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
        Analyzing keyword coverage…
      </div>
    )
  }

  const data = result
  if (!data && jobDescription) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <p style={{ fontSize: 12, color: '#64748B', margin: 0 }}>Job target is set. Click to analyze keywords.</p>
        <button
          onClick={() => { setJd(jobDescription); analyzeMutation.mutate() }}
          disabled={analyzeMutation.isPending}
          style={{ padding: '9px', borderRadius: 9, background: '#1A2744', color: 'white', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}
        >
          Analyze Keywords
        </button>
      </div>
    )
  }

  if (!data) return null

  return (
    <div>
      <ScoreBadge score={data.match_score} />

      {data.matched.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#16A34A', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
            Matched ({data.matched.length})
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap' }}>
            {data.matched.map(kw => <KeywordChip key={kw} keyword={kw} variant="matched" />)}
          </div>
        </div>
      )}

      {data.missing_critical.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#DC2626', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
            Missing — Critical ({data.missing_critical.length})
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap' }}>
            {data.missing_critical.map(kw => (
              <KeywordChip key={kw} keyword={kw} variant="critical" onAdd={onAddKeyword ? () => onAddKeyword(kw) : undefined} />
            ))}
          </div>
        </div>
      )}

      {data.missing_nice_to_have.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#D97706', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
            Nice to Have ({data.missing_nice_to_have.length})
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap' }}>
            {data.missing_nice_to_have.map(kw => (
              <KeywordChip key={kw} keyword={kw} variant="nice" onAdd={onAddKeyword ? () => onAddKeyword(kw) : undefined} />
            ))}
          </div>
        </div>
      )}

      <button
        onClick={() => { setResult(null); setShowJdInput(true) }}
        style={{ fontSize: 11, color: '#1A2744', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: 4 }}
      >
        Re-analyze with different JD
      </button>

    </div>
  )
}
