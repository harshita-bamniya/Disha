import SubAdminManagement from '../components/SubAdminManagement'
import { colors } from '@/design-system/tokens'


export default function SubAdminsPage() {
  return (
    <section className="flex flex-col gap-6">
      <h1 style={{ fontSize: 20, fontWeight: 800, color: colors.text.ink, fontFamily: 'Hind, sans-serif', letterSpacing: '-0.3px' }}>Sub-Admin Management</h1>
      <SubAdminManagement />
    </section>
  )
}
