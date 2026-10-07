import { useCallback, useEffect, useRef } from 'react'
import { verifiedApi } from '@/api/verifiedInterview'

// Verified interviews only. Records when the candidate switched tabs or left
// the interview window, as timestamps relative to the start of the interview
// (never screenshots or content). They are shown to the employer AND the
// candidate as observations; they never lower a score or reject anyone.

const FLUSH_EVERY_MS = 15_000

interface PendingEvent { kind: string; started_ms: number; ended_ms?: number }

export function useIntegrityEvents(sessionId: string | undefined, enabled: boolean) {
  const startedAt = useRef(Date.now())
  const queue = useRef<PendingEvent[]>([])
  const open = useRef<Record<string, PendingEvent | undefined>>({})

  const now = () => Date.now() - startedAt.current

  const flush = useCallback(async () => {
    if (!sessionId || queue.current.length === 0) return
    const batch = queue.current.splice(0, queue.current.length)
    try {
      await verifiedApi.sendIntegrityEvents(sessionId, batch)
    } catch {
      queue.current.unshift(...batch)   // try again on the next flush
    }
  }, [sessionId])

  useEffect(() => {
    if (!enabled || !sessionId) return

    const begin = (kind: string) => {
      if (!open.current[kind]) open.current[kind] = { kind, started_ms: now() }
    }
    const end = (kind: string) => {
      const ev = open.current[kind]
      if (!ev) return
      open.current[kind] = undefined
      queue.current.push({ ...ev, ended_ms: now() })
    }

    const onVisibility = () => (document.visibilityState === 'hidden' ? begin('tab_hidden') : end('tab_hidden'))
    // A blur while the tab is still visible means another window took focus.
    const onBlur = () => { if (document.visibilityState === 'visible') begin('window_blur') }
    const onFocus = () => end('window_blur')

    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('blur', onBlur)
    window.addEventListener('focus', onFocus)
    const timer = setInterval(() => { void flush() }, FLUSH_EVERY_MS)

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('focus', onFocus)
      clearInterval(timer)
      void flush()
    }
  }, [enabled, sessionId, flush])

  return { flush }
}
