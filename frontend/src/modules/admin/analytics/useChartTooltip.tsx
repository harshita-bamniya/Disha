import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

// Dark tooltip that follows the pointer (14px offset), stays inside the viewport, and hides on
// scroll, blur and Esc. The same content is shown when a mark is keyboard-focused.

interface TipState { x: number; y: number; content: ReactNode }

export function useChartTooltip() {
  const [tip, setTip] = useState<TipState | null>(null)
  const hide = useCallback(() => setTip(null), [])

  useEffect(() => {
    if (!tip) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') hide() }
    window.addEventListener('scroll', hide, true)
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('scroll', hide, true); window.removeEventListener('keydown', onKey) }
  }, [tip, hide])

  const showAtPointer = useCallback((e: { clientX: number; clientY: number }, content: ReactNode) =>
    setTip({ x: e.clientX, y: e.clientY, content }), [])

  const showAtElement = useCallback((el: Element, content: ReactNode) => {
    const r = el.getBoundingClientRect()
    setTip({ x: r.left + r.width / 2, y: r.top + r.height / 2, content })
  }, [])

  const node = tip && typeof document !== 'undefined'
    ? createPortal(<TooltipBox x={tip.x} y={tip.y}>{tip.content}</TooltipBox>, document.body)
    : null

  return { showAtPointer, showAtElement, hide, tooltip: node }
}

function TooltipBox({ x, y, children }: { x: number; y: number; children: ReactNode }) {
  const [size, setSize] = useState({ w: 0, h: 0 })
  const ref = useCallback((el: HTMLDivElement | null) => { if (el) setSize({ w: el.offsetWidth, h: el.offsetHeight }) }, [])
  const OFFSET = 14
  let left = x + OFFSET
  let top = y + OFFSET
  if (left + size.w > window.innerWidth - 8) left = Math.max(8, x - OFFSET - size.w)
  if (top + size.h > window.innerHeight - 8) top = Math.max(8, y - OFFSET - size.h)
  return (
    <div
      ref={ref} role="tooltip"
      style={{
        position: 'fixed', left, top, zIndex: 9999, pointerEvents: 'none', maxWidth: 280,
        background: '#1E3A5F', color: '#fff', borderRadius: 8, padding: '6px 9px', fontSize: 12, lineHeight: 1.45,
        boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
      }}
    >{children}</div>
  )
}
