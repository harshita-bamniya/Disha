import { useEmployerPermissions } from '../hooks/useJobs'
import EmployerHomePage from './EmployerHomePage'
import { DashboardSkeleton, LegacyEmployerDashboard } from './EmployerDashboardLegacy'

/** Owners, HR managers and recruiters get the redesigned home. Hiring managers and interviewers keep the old page for now. */
export default function EmployerDashboardPage() {
  const { data: perms, isLoading } = useEmployerPermissions()
  if (isLoading) return <DashboardSkeleton />
  if (perms && (perms.role_name === 'hiring_manager' || perms.role_name === 'interviewer')) return <LegacyEmployerDashboard />
  return <EmployerHomePage />
}
