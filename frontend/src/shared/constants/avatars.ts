/** Curated icon avatars offered in the Profile page, replacing a required
 * uploaded profile photo. Keep `id`s in sync with AVATAR_IDS in
 * backend/app/modules/onboarding/schemas.py. */
export interface AvatarOption {
  id: string
  emoji: string
  bg: string
}

export const AVATARS: AvatarOption[] = [
  { id: 'fox',      emoji: '🦊', bg: '#F97316' },
  { id: 'owl',      emoji: '🦉', bg: '#7C3AED' },
  { id: 'panda',    emoji: '🐼', bg: '#334155' },
  { id: 'lion',     emoji: '🦁', bg: '#D97706' },
  { id: 'koala',    emoji: '🐨', bg: '#64748B' },
  { id: 'penguin',  emoji: '🐧', bg: '#0F172A' },
  { id: 'tiger',    emoji: '🐯', bg: '#EA580C' },
  { id: 'rabbit',   emoji: '🐰', bg: '#DB2777' },
  { id: 'bear',     emoji: '🐻', bg: '#92400E' },
  { id: 'cat',      emoji: '🐱', bg: '#0891B2' },
  { id: 'dog',      emoji: '🐶', bg: '#CA8A04' },
  { id: 'dolphin',  emoji: '🐬', bg: '#0284C7' },
  { id: 'elephant', emoji: '🐘', bg: '#4B5563' },
  { id: 'unicorn',  emoji: '🦄', bg: '#DB2777' },
]

export const AVATAR_MAP: Record<string, AvatarOption> = Object.fromEntries(
  AVATARS.map(a => [a.id, a]),
)

export function getAvatar(avatarId?: string | null): AvatarOption | null {
  return avatarId ? AVATAR_MAP[avatarId] ?? null : null
}
