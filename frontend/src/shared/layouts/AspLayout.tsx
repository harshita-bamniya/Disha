import type { ReactNode } from 'react'
import AppSidebar, { type NavPath } from '@/components/layout/AppSidebar'
import { tokens } from '@/design-system'

export type { NavPath }

// Shared aspirant page shell: sidebar + content column. Every authenticated
// aspirant page should wrap its content in this instead of hand-rolling the
// `minHeight: 100vh` + `<AppSidebar />` + flex wrapper each page previously
// repeated on its own (audit finding C-01).
export default function AspLayout({ activePath, children }: { activePath?: NavPath; children: ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: tokens.color.surface.bg, display: 'flex' }}>
      <AppSidebar activePath={activePath} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    </div>
  )
}
