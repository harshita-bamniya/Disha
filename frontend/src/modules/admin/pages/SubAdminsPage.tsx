import SubAdminManagement from '../components/SubAdminManagement'

const N = { navy: '#1A2744', ink: '#1E3A5F', muted: '#94A3B8', cream: '#F4F5F7', creamDk: '#EAECF0' }

export default function SubAdminsPage() {
  return (
    <section className="flex flex-col gap-6">
      <h1 style={{ fontSize: 20, fontWeight: 800, color: N.ink, fontFamily: 'Hind, sans-serif', letterSpacing: '-0.3px' }}>Sub-Admin Management</h1>
      <SubAdminManagement />
    </section>
  )
}
