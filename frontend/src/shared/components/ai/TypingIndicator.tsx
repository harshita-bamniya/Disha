import type { ReactNode } from 'react'
import { colors } from '@/design-system/tokens'

interface TypingIndicatorProps {
  avatarBg?: string
  avatarContent?: ReactNode
  dotColor?: string
  /** Override the bubble background — useful for dark-themed containers */
  bubbleBg?: string
}

export default function TypingIndicator({
  avatarBg = colors.brand.navy,
  avatarContent = 'AI',
  dotColor = colors.text.muted,
  bubbleBg,
}: TypingIndicatorProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
      <div style={{
        width: 32, height: 32, borderRadius: '50%',
        background: avatarBg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, fontWeight: 800, color: '#fff', marginRight: 10,
        flexShrink: 0,
      }}>
        {avatarContent}
      </div>
      <div style={{
        background: bubbleBg ?? colors.surface.card,
        padding: '12px 16px', borderRadius: '18px 18px 18px 4px',
        border: `1px solid ${colors.border.default}`,
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
        display: 'flex', gap: 5, alignItems: 'center',
      }}>
        {[0, 1, 2].map(i => (
          <div
            key={i}
            style={{
              width: 7, height: 7, borderRadius: '50%',
              background: dotColor,
              animation: `typingBounce 1.2s ease-in-out ${i * 0.2}s infinite`,
            }}
          />
        ))}
      </div>
    </div>
  )
}

if (typeof document !== 'undefined' && !document.getElementById('typing-anim-style')) {
  const s = document.createElement('style')
  s.id = 'typing-anim-style'
  s.textContent = `@keyframes typingBounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-6px)} }`
  document.head.appendChild(s)
}
