import { Suspense } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import AppSidebar from '@/components/layout/AppSidebar'
import { colors } from '@/design-system/tokens'
import Spinner from '@/shared/components/feedback/Spinner'

export default function AspLayout() {
  const { pathname } = useLocation()

  return (
    <div style={{ minHeight: '100vh', background: colors.surface.bg, display: 'flex' }}>
      <AppSidebar activePath={pathname} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <Suspense fallback={<Spinner size="lg" />}>
          <Outlet />
        </Suspense>
      </div>
    </div>
  )
}
