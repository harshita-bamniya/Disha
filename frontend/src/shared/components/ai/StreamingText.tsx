import { colors } from '@/design-system/tokens'

interface StreamingTextProps {
  text: string
  /** Show blinking cursor at end while streaming */
  streaming?: boolean
  cursorColor?: string
  style?: React.CSSProperties
}

export default function StreamingText({ text, streaming = false, cursorColor, style }: StreamingTextProps) {
  return (
    <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', ...style }}>
      {text}
      {streaming && (
        <span style={{
          display: 'inline-block', width: 2, height: '1em',
          background: cursorColor ?? colors.brand.navy,
          marginLeft: 2, verticalAlign: 'text-bottom',
          animation: 'cursorBlink 0.9s step-end infinite',
        }} />
      )}
    </span>
  )
}

if (typeof document !== 'undefined' && !document.getElementById('cursor-anim-style')) {
  const s = document.createElement('style')
  s.id = 'cursor-anim-style'
  s.textContent = `@keyframes cursorBlink { 0%,100%{opacity:1} 50%{opacity:0} }`
  document.head.appendChild(s)
}
