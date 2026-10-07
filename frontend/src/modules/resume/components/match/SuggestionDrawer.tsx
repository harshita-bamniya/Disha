import { useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { AlertTriangle, Copy, Lightbulb } from 'lucide-react'
import Drawer from '@/shared/components/overlays/Drawer'
import Spinner from '@/shared/components/feedback/Spinner'
import Textarea from '@/shared/components/primitives/Textarea'
import Button from '@/shared/components/primitives/Button'
import { toast } from '@/shared/components/feedback/Toast'
import { colors } from '@/design-system/tokens'
import { getApiError } from '@/api/client'
import { resumeMatchApi, type RewriteOut } from '@/api/resumeMatch'

interface Props {
  open: boolean
  scanId: string
  requirement: string | null
  onClose: () => void
}

function LineBox({ label, text, tone }: { label: string; text: string; tone: 'old' | 'new' }) {
  return (
    <div style={{
      borderRadius: 10, padding: '10px 12px',
      background: tone === 'new' ? colors.state.successBg : colors.surface.bg,
      border: `1px solid ${tone === 'new' ? `${colors.state.success}44` : colors.border.default}`,
    }}>
      <p style={{ margin: '0 0 4px', fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.4px', color: colors.text.muted }}>
        {label}
      </p>
      <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, color: colors.text.ink }}>{text}</p>
    </div>
  )
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.success('Copied. Paste it into your resume.')
  } catch {
    toast.warning('Could not copy automatically. Select the text and copy it.')
  }
}

export default function SuggestionDrawer({ open, scanId, requirement, onClose }: Props) {
  const [result, setResult] = useState<RewriteOut | null>(null)
  const [answer, setAnswer] = useState('')

  const rewrite = useMutation({
    mutationFn: (req: string) => resumeMatchApi.rewrite(scanId, req),
    onSuccess: setResult,
    onError: e => { toast.danger(getApiError(e, 'Could not get a suggestion right now.')); onClose() },
  })
  const fromAnswer = useMutation({
    mutationFn: (vars: { req: string; text: string }) => resumeMatchApi.answer(scanId, vars.req, vars.text),
    onSuccess: setResult,
    onError: e => toast.danger(getApiError(e, 'Could not write that line right now.')),
  })

  useEffect(() => {
    if (open && requirement) {
      setResult(null)
      setAnswer('')
      rewrite.mutate(requirement)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, requirement, scanId])

  const busy = rewrite.isPending || fromAnswer.isPending

  return (
    <Drawer open={open} onClose={onClose} title={requirement ? `Improve: ${requirement}` : 'Improve'} width={460}>
      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {busy && !result && <Spinner />}

        {result?.kind === 'rewrite' && (
          <>
            {result.original && <LineBox label="Your current line" text={result.original} tone="old" />}
            {result.suggestion
              ? <LineBox label="Suggested wording" text={result.suggestion} tone="new" />
              : null}
            {result.suggestion && (
              <Button variant="outline" size="sm" onClick={() => copy(result.suggestion!)}>
                <Copy size={13} style={{ marginRight: 6 }} /> Copy
              </Button>
            )}
          </>
        )}

        {result?.kind === 'from_answer' && result.suggestion && (
          <>
            <LineBox label="Suggested line" text={result.suggestion} tone="new" />
            {result.role && (
              <p style={{ margin: 0, fontSize: 12.5, color: colors.text.inkSoft }}>
                Add it under: <strong>{result.role}</strong>
              </p>
            )}
            {result.missing_detail && (
              <div style={{ display: 'flex', gap: 8, fontSize: 12.5, color: colors.text.ink, lineHeight: 1.5 }}>
                <Lightbulb size={15} color={colors.state.warning} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>Make it stronger: {result.missing_detail}</span>
              </div>
            )}
            <Button variant="outline" size="sm" onClick={() => copy(result.suggestion!)}>
              <Copy size={13} style={{ marginRight: 6 }} /> Copy
            </Button>
          </>
        )}

        {result?.kind === 'needs_input' && requirement && (
          <>
            <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, color: colors.text.ink }}>{result.question}</p>
            <Textarea
              value={answer}
              onChange={e => setAnswer(e.target.value)}
              rows={5}
              maxLength={2000}
              placeholder="e.g. At my last job I used it to… and the result was…"
              aria-label={`Where you used ${requirement}`}
            />
            <Button
              loading={fromAnswer.isPending}
              disabled={answer.trim().length < 15 || fromAnswer.isPending}
              onClick={() => fromAnswer.mutate({ req: requirement, text: answer })}
            >
              Write my resume line
            </Button>
            <p style={{ margin: 0, fontSize: 11.5, color: colors.text.muted }}>
              If you haven&apos;t used it, skip this. Only add experience you really have.
            </p>
          </>
        )}

        {result?.warnings.map(w => (
          <div key={w} style={{
            display: 'flex', gap: 8, padding: '10px 12px', borderRadius: 10, fontSize: 12.5, lineHeight: 1.5,
            background: colors.state.warningBg, border: `1px solid ${colors.state.warning}44`, color: colors.text.ink,
          }}>
            <AlertTriangle size={15} color={colors.state.warning} style={{ flexShrink: 0, marginTop: 1 }} />
            {w}
          </div>
        ))}

        {result && result.kind !== 'needs_input' && (
          <p style={{ margin: 0, fontSize: 11.5, color: colors.text.muted, lineHeight: 1.5 }}>
            AI-written suggestions can be wrong. Read it, fix anything that isn&apos;t accurate, then re-check your resume.
          </p>
        )}
      </div>
    </Drawer>
  )
}
