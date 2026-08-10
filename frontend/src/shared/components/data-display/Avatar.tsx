import { memo } from 'react'
import { avatarColors, initials } from '@/shared/utils/color'
import { radius } from '@/design-system/tokens'

interface AvatarProps {
  name: string
  src?: string | null
  size?: number
  shape?: 'circle' | 'rounded'
  className?: string
}

const Avatar = memo(function Avatar({ name, src, size = 36, shape = 'circle' }: AvatarProps) {
  const [bg, fg] = avatarColors(name)
  const r = shape === 'circle' ? radius.full : radius.lg
  const fontSize = Math.max(10, Math.round(size * 0.38))

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        style={{ width: size, height: size, borderRadius: r, objectFit: 'cover', flexShrink: 0 }}
      />
    )
  }

  return (
    <div
      aria-label={name}
      style={{
        width: size, height: size, borderRadius: r, flexShrink: 0,
        background: bg, color: fg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize, fontWeight: 700, letterSpacing: '-0.02em',
        userSelect: 'none',
      }}
    >
      {initials(name)}
    </div>
  )
})

export default Avatar
