import { useState, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import EmployerSidebar from './EmployerSidebar'
import { Menu } from 'lucide-react'

function useIsMobile() {
  const [mobile, setMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768)
  useEffect(() => {
    const handler = () => setMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])
  return mobile
}

export default function EmployerLayout() {
  const isMobile = useIsMobile()
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <div style={{ minHeight: '100vh', background: '#F9FAFB', display: 'flex' }}>

      {/* Desktop sidebar */}
      {!isMobile && <EmployerSidebar />}

      {/* Mobile: hamburger + drawer */}
      {isMobile && (
        <>
          <button
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            style={{
              position: 'fixed', top: 14, left: 14, zIndex: 1100,
              width: 42, height: 42, borderRadius: 12,
              background: '#1E3A5F', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 16px rgba(15,30,60,0.30)',
              opacity: drawerOpen ? 0 : 1,
              pointerEvents: drawerOpen ? 'none' : 'auto',
              transition: 'opacity 0.2s',
            }}
          >
            <Menu size={18} color="white" />
          </button>

          {drawerOpen && (
            <div
              onClick={() => setDrawerOpen(false)}
              style={{ position: 'fixed', inset: 0, zIndex: 1099, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)' }}
            />
          )}

          <div style={{
            position: 'fixed', top: 0, left: 0, zIndex: 1100, height: '100vh',
            transform: drawerOpen ? 'translateX(0)' : 'translateX(-100%)',
            transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)',
          }}>
            <EmployerSidebar onClose={() => setDrawerOpen(false)} />
          </div>
        </>
      )}

      <div style={{
        flex: 1, minWidth: 0,
        display: 'flex', flexDirection: 'column',
        overflow: 'auto',
        paddingTop: isMobile ? 70 : 0,
      }}>
        <Outlet />
      </div>
    </div>
  )
}
