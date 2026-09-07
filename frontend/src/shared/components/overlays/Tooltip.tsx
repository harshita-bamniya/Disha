import { useState, type ReactNode } from 'react'
import { colors, radius, shadows } from '@/design-system/tokens'

interface TooltipProps {
  content: string
  children: ReactNode
  placement?: 'top' | 'bottom' | 'left' | 'right'
  delay?: number
}

export default function Tooltip({ content, children, placement = 'top', delay = 400 }: TooltipProps) {
  const [visible, setVisible] = useState(false)
  const [timer, setTimer] = useState<ReturnType<typeof setTimeout> | null>(null)

  function show() {
    const t = setTimeout(() => setVisible(true), delay)
    setTimer(t)
  }

  function hide() {
    if (timer) clearTimeout(timer)
    setVisible(false)
  }

  const OFFSET = 6
  const placement_style: Record<string, React.CSSProperties> = {
    top:    { bottom: `calc(100% + ${OFFSET}px)`, left: '50%', transform: 'translateX(-50%)' },
    bottom: { top: `calc(100% + ${OFFSET}px)`, left: '50%', transform: 'translateX(-50%)' },
    left:   { right: `calc(100% + ${OFFSET}px)`, top: '50%', transform: 'translateY(-50%)' },
    right:  { left: `calc(100% + ${OFFSET}px)`, top: '50%', transform: 'translateY(-50%)' },
  }

  return (
    <span
      style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {visible && (
        <span style={{
          position: 'absolute', zIndex: 999,
          ...placement_style[placement],
          background: colors.text.ink, color: '#fff',
          fontSize: 11, fontWeight: 500, lineHeight: 1.4,
          padding: '5px 8px', borderRadius: radius.md,
          boxShadow: shadows.elevated,
          whiteSpace: 'nowrap', pointerEvents: 'none',
          animation: 'tooltipIn 0.1s ease both',
        }}>
          {content}
        </span>
      )}
      <style>{`@keyframes tooltipIn { from { opacity:0; transform:${placement === 'top' ? 'translateX(-50%) translateY(4px)' : placement === 'bottom' ? 'translateX(-50%) translateY(-4px)' : 'translateY(-50%)'} } to { opacity:1; transform:${placement_style[placement].transform} } }`}</style>
    </span>
  )
}
