import type { ReactNode } from 'react'

// Shared structural shell for AI chat messages (audit H-09: Companion,
// Counsellor, and Interview each had a hand-rolled, near-identical
// MessageBubble — same flex layout, avatar-on-left-for-assistant,
// asymmetric bubble corners, fade-in animation — but different color
// themes. `theme` carries the part that's genuinely different per
// product surface; the structure below is what was actually duplicated.
export interface ChatBubbleTheme {
  avatar: ReactNode
  userBg: string
  userText: string
  userShadow: string
  assistantBg: string
  assistantText: string
  assistantShadow: string
  assistantBorder: string
  streamingDotColor: string
}

export function ChatBubble({ isUser, content, streaming, theme }: {
  isUser: boolean
  content: string
  streaming?: boolean
  theme: ChatBubbleTheme
}) {
  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', marginBottom: 16, animation: 'fadeInMsg 0.3s ease both' }}>
      {!isUser && (
        <div style={{ flexShrink: 0, marginRight: 10, marginTop: 2 }}>
          {theme.avatar}
        </div>
      )}
      <div style={{
        maxWidth: '72%',
        background: isUser ? theme.userBg : theme.assistantBg,
        color: isUser ? theme.userText : theme.assistantText,
        padding: '12px 16px',
        borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
        fontSize: 14, lineHeight: 1.7,
        boxShadow: isUser ? theme.userShadow : theme.assistantShadow,
        border: isUser ? 'none' : theme.assistantBorder,
        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
      }}>
        {content}
        {streaming && (
          <span style={{ display: 'inline-block', width: 10, height: 10, background: theme.streamingDotColor, borderRadius: '50%', marginLeft: 4, animation: 'blink 1s infinite' }} />
        )}
      </div>
    </div>
  )
}
