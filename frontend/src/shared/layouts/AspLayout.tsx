import type { ReactNode } from 'react'
import AppSidebar, { type NavPath } from '@/components/layout/AppSidebar'
import { tokens } from '@/design-system'

export type { NavPath }

// Shared aspirant page shell: sidebar + content column. Every authenticated
// aspirant page should wrap its content in this instead of hand-rolling the
// `minHeight: 100vh` + `<AppSidebar />` + flex wrapper each page previously
// repeated on its own (audit finding C-01).
//
// scroll="page" (default): the whole page grows and the browser scrolls it —
//   use position:sticky on your own header if you want it pinned.
// scroll="contained": the shell is clipped to the viewport height and never
//   scrolls itself — for pages whose own <main> scrolls internally instead
//   (e.g. a fixed topbar with an independently-scrolling content pane).
export default function AspLayout({ activePath, scroll = 'page', children }: {
  activePath?: NavPath
  scroll?: 'page' | 'contained'
  children: ReactNode
}) {
  const contained = scroll === 'contained'
  return (
    <div style={{
      ...(contained ? { height: '100vh', overflow: 'hidden' } : { minHeight: '100vh' }),
      background: tokens.color.surface.bg, display: 'flex',
    }}>
      <AppSidebar activePath={activePath} />
      <div style={{
        flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column',
        ...(contained ? { overflow: 'hidden' } : null),
      }}>
        {children}
      </div>
    </div>
  )
}
