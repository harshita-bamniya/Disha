import type { ReactNode } from 'react'
import AppSidebar from '@/components/layout/AppSidebar'
import { colors } from '@/design-system/tokens'

type NavPath =
  | '/app/dashboard'
  | '/app/profile'
  | '/app/resume'
  | '/app/resume-library'
  | '/app/interview'
  | '/app/mock-interview'
  | '/app/interview/setup'
  | '/app/counsellor'
  | '/app/jobs'
  | '/app/jobs/applications'
  | '/app/roadmap'
  | '/app/roadmap/history'
  | '/app/companion'
  | '/app/security'
  | '/app/support'

interface AspLayoutProps {
  activePath?: NavPath
  children: ReactNode
}

export default function AspLayout({ activePath, children }: AspLayoutProps) {
  return (
    <div style={{ minHeight: '100vh', background: colors.surface.bg, display: 'flex' }}>
      <AppSidebar activePath={activePath} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    </div>
  )
}
