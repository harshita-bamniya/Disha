import { describe, it, expect } from 'vitest'
import { cn } from './utils'

describe('cn', () => {
  it('merges plain class strings', () => {
    expect(cn('px-2', 'py-1')).toBe('px-2 py-1')
  })

  it('drops falsy values', () => {
    expect(cn('px-2', false, undefined, null, '')).toBe('px-2')
  })

  it('lets a later conflicting Tailwind class win', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4')
  })
})
