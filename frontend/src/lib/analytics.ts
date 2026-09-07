import { apiClient } from '@/api/client'

interface AnalyticsEvent {
  event_name: string
  event_data?: Record<string, unknown>
  page_url?: string
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

export function track(event_name: string, event_data?: Record<string, unknown>) {
  queue.push({
    event_name,
    event_data: event_data ?? {},
    page_url: window.location.pathname,
  })
  if (queue.length >= 20) {
    if (flushTimer) { clearTimeout(flushTimer); flushTimer = null }
    flush()
  } else {
    scheduleFlush()
  }
}

export function trackJobEvent(
  eventName: 'job_card_click' | 'application_started' | 'application_submitted',
  jobId: string,
  extra?: Record<string, unknown>,
) {
  track(eventName, { job_id: jobId, ...extra })
}

// Flush on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush()
  })
}
