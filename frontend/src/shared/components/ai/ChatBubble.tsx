import { memo, type ReactNode } from 'react'
import { colors } from '@/design-system/tokens'

export interface ChatBubbleTheme {
  /** Avatar background — defaults to navy */
  avatarBg?: string
  /** Avatar content (icon node or initials string) */
  avatarContent?: ReactNode
  /** User bubble background */
  userBg?: string
  /** User bubble text color */
  userColor?: string
  /** AI bubble border color */
  aiBorderColor?: string
}

const DEFAULT_THEME: Required<ChatBubbleTheme> = {
  avatarBg:     colors.brand.navy,
  avatarContent: 'AI',
  userBg:       colors.brand.navy,
  userColor:    '#FFFFFF',
  aiBorderColor: colors.border.default,
}

interface ChatBubbleProps {
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean
  theme?: ChatBubbleTheme
}

const ChatBubble = memo(function ChatBubble({ role, content, streaming = false, theme = {} }: ChatBubbleProps) {
  const t = { ...DEFAULT_THEME, ...theme }
  const isUser = role === 'user'

  return (
    <div style={{
      display: 'flex',
      justifyContent: isUser ? 'flex-end' : 'flex-start',
      marginBottom: 16,
      animation: 'fadeInMsg 0.25s ease both',
    }}>
      {!isUser && (
        <div style={{
          width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
          background: t.avatarBg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginRight: 10, marginTop: 2,
          fontSize: 12, fontWeight: 800, color: '#fff',
        }}>
          {t.avatarContent}
        </div>
      )}
      <div style={{
        maxWidth: '72%',
        background: isUser ? t.userBg : colors.surface.card,
        color: isUser ? t.userColor : colors.text.ink,
        padding: '12px 16px',
        borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
        fontSize: 14, lineHeight: 1.7,
        boxShadow: isUser ? '0 4px 14px rgba(26,39,68,0.20)' : '0 2px 8px rgba(0,0,0,0.05)',
        border: isUser ? 'none' : `1px solid ${t.aiBorderColor}`,
        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
      }}>
        {content}
        {streaming && (
          <span style={{
            display: 'inline-block', width: 8, height: 8,
            background: isUser ? 'rgba(255,255,255,0.6)' : colors.text.muted,
            borderRadius: '50%', marginLeft: 5,
            animation: 'blink 1s ease infinite',
          }} />
        )}
      </div>
    </div>
  )
})

export default ChatBubble

// Inject keyframes once
if (typeof document !== 'undefined' && !document.getElementById('chat-anim-style')) {
  const s = document.createElement('style')
  s.id = 'chat-anim-style'
  s.textContent = `
    @keyframes fadeInMsg { from { opacity:0; transform:translateY(6px) } to { opacity:1; transform:none } }
    @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.2} }
  `
  document.head.appendChild(s)
}
