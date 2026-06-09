import { apiClient } from '@/api/client'

interface AnalyticsEvent {
  event_type: string
  page?: string
  properties?: Record<string, unknown>
}

const queue: AnalyticsEvent[] = []
let flushTimer: ReturnType<typeof setTimeout> | null = null

function flush() {
  if (queue.length === 0) return
  const batch = queue.splice(0, 50)
  // Fire-and-forget — analytics failures must never block UX
  apiClient
    .post('/analytics/events', { events: batch })
    .catch(() => {})
}

function scheduleFlush() {
  if (flushTimer) return
  flushTimer = setTimeout(() => {
    flushTimer = null
    flush()
  }, 2000)
}

export function track(event_type: string, properties?: Record<string, unknown>) {
  queue.push({
    event_type,
    page: window.location.pathname,
    properties,
  })
  if (queue.length >= 20) {
    if (flushTimer) { clearTimeout(flushTimer); flushTimer = null }
    flush()
  } else {
    scheduleFlush()
  }
}

// Flush on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush()
  })
}
