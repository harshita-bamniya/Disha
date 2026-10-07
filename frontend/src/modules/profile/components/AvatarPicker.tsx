import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, Pencil } from 'lucide-react'
import { onboardingApi } from '@/api/onboarding'
import { AVATARS, getAvatar } from '@/shared/constants/avatars'
import { PROFILE_KEY } from './profileConstants'

interface Props {
  avatarId: string | null
  fallbackInitial: string
  size?: number
}

export function AvatarPicker({ avatarId, fallbackInitial, size = 52 }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const qc = useQueryClient()

  const mut = useMutation({
    mutationFn: (id: string) => onboardingApi.saveAvatar(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...PROFILE_KEY] })
      qc.invalidateQueries({ queryKey: ['krs', 'dashboard'] })
      setOpen(false)
    },
  })

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const chosen = getAvatar(avatarId)

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label="Change avatar"
        style={{
          width: size, height: size, borderRadius: '50%', flexShrink: 0,
          background: chosen ? chosen.bg : '#1A2744',
          border: '1px solid rgba(26,39,68,0.18)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: chosen ? size * 0.52 : size * 0.42,
          color: 'white', fontWeight: 700, cursor: 'pointer', padding: 0,
        }}
      >
        {chosen ? chosen.emoji : fallbackInitial}
      </button>
      <div style={{
        position: 'absolute', bottom: -2, right: -2, width: 20, height: 20, borderRadius: '50%',
        background: '#1A2744', border: '2px solid white',
        display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
      }}>
        <Pencil size={9} color="white" />
      </div>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, marginTop: 8, zIndex: 20,
          background: 'white', borderRadius: 16, border: '1px solid #E2E8F0',
          boxShadow: '0 12px 36px rgba(15,23,42,0.14)', padding: 14, width: 240,
        }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.4px', margin: '0 0 10px' }}>
            Choose an avatar
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
            {AVATARS.map(a => {
              const isSelected = avatarId === a.id
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => mut.mutate(a.id)}
                  disabled={mut.isPending}
                  aria-label={a.id}
                  aria-pressed={isSelected}
                  style={{
                    position: 'relative', width: 40, height: 40, borderRadius: '50%',
                    background: a.bg, border: isSelected ? '2px solid #1A2744' : '2px solid transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 19, cursor: mut.isPending ? 'default' : 'pointer', padding: 0,
                    opacity: mut.isPending && !isSelected ? 0.5 : 1,
                  }}
                >
                  {a.emoji}
                  {isSelected && (
                    <span style={{
                      position: 'absolute', bottom: -3, right: -3, width: 15, height: 15, borderRadius: '50%',
                      background: '#16A34A', border: '1.5px solid white',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Check size={9} color="white" />
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
