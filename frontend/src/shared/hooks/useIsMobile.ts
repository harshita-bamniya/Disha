import { useEffect, useState } from 'react'

// Single shared mobile-breakpoint hook — was previously copy-pasted
// identically in AppSidebar, AdminLayout, EmployerLayout, and DishaLanding.
export function useIsMobile(breakpoint = 768) {
  const [mobile, setMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < breakpoint)
  useEffect(() => {
    const handler = () => setMobile(window.innerWidth < breakpoint)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [breakpoint])
  return mobile
}
