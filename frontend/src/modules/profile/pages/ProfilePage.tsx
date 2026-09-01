import { useState } from 'react'
import { User } from 'lucide-react'
import { useOnboardingProfile } from '@/modules/onboarding/hooks/useOnboarding'
import PageHeader from '@/shared/layouts/PageHeader'
import { KrsPanel } from '../components/KrsPanel'
import { PersonalSection } from '../components/PersonalSection'
import { EducationSection } from '../components/EducationSection'
import { UpscSection } from '../components/UpscSection'
import { WorkSection } from '../components/WorkSection'
import { SkillsSection } from '../components/SkillsSection'
import { PreferencesSection } from '../components/PreferencesSection'
import { LearningSetupSection } from '../components/LearningSetupSection'

type SectionKey = 'personal' | 'education' | 'upsc' | 'work' | 'skills' | 'preferences' | 'learningSetup'

export default function ProfilePage() {
  const [openSection, setOpenSection] = useState<SectionKey | null>(null)

  const { data: profile, isLoading, error } = useOnboardingProfile()

  const toggle = (section: SectionKey) =>
    setOpenSection(prev => (prev === section ? null : section))

  return (
    <>
      <PageHeader
        title="My Profile"
        subtitle="Every update improves your KRS score & job matches"
      />

      <main style={{ padding: '28px 32px', flex: 1 }}>

        <div style={{ borderBottom: '1px solid rgba(26,39,68,0.08)', paddingBottom: 20, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{
              width: 52, height: 52, borderRadius: '50%',
              background: '#1A2744',
              border: '1px solid rgba(26,39,68,0.18)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22, flexShrink: 0, color: 'white', fontWeight: 700,
            }}>
              {profile?.full_name ? profile.full_name.charAt(0).toUpperCase() : <User size={22} />}
            </div>
            <div>
              <p style={{ fontSize: 11.5, color: '#9CA3AF', marginBottom: 2 }}>Your profile</p>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111827' }}>
                {profile?.full_name ?? 'Complete your profile'}
              </h2>
              <p style={{ fontSize: 12.5, color: '#6B7280', marginTop: 2 }}>
                {profile?.city ? `${profile.city}, ${profile.state ?? ''}` : 'Add your location'}
              </p>
            </div>
          </div>
          <p style={{ fontSize: 12, color: '#9CA3AF', lineHeight: 1.5, marginTop: 14 }}>
            Each section you complete improves your KRS score and surfaces better job matches.
          </p>
        </div>

        <KrsPanel />

        {isLoading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[1, 2, 3, 4].map(i => (
              <div key={i} style={{ height: 80, borderRadius: 14, background: '#F8FAFC', animation: 'pulse 2s infinite', border: '1px solid rgba(37,99,235,0.08)' }} />
            ))}
          </div>
        )}

        {error && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, padding: '14px 18px', fontSize: 14, color: '#DC2626' }}>
            Could not load profile. Please refresh.
          </div>
        )}

        {profile && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }} className="md:grid-cols-2 grid-cols-1">
            <div style={{ gridColumn: openSection === 'personal'     ? '1 / -1' : undefined }}>
              <PersonalSection    profile={profile} open={openSection === 'personal'}     onToggle={() => toggle('personal')} />
            </div>
            <div style={{ gridColumn: openSection === 'education'    ? '1 / -1' : undefined }}>
              <EducationSection   profile={profile} open={openSection === 'education'}    onToggle={() => toggle('education')} />
            </div>
            <div style={{ gridColumn: openSection === 'upsc'         ? '1 / -1' : undefined }}>
              <UpscSection        profile={profile} open={openSection === 'upsc'}         onToggle={() => toggle('upsc')} />
            </div>
            <div style={{ gridColumn: openSection === 'work'         ? '1 / -1' : undefined }}>
              <WorkSection        profile={profile} open={openSection === 'work'}         onToggle={() => toggle('work')} />
            </div>
            <div style={{ gridColumn: openSection === 'skills'       ? '1 / -1' : undefined }}>
              <SkillsSection      profile={profile} open={openSection === 'skills'}       onToggle={() => toggle('skills')} />
            </div>
            <div style={{ gridColumn: openSection === 'preferences'  ? '1 / -1' : undefined }}>
              <PreferencesSection profile={profile} open={openSection === 'preferences'}  onToggle={() => toggle('preferences')} />
            </div>
            <div style={{ gridColumn: openSection === 'learningSetup' ? '1 / -1' : undefined }}>
              <LearningSetupSection profile={profile} open={openSection === 'learningSetup'} onToggle={() => toggle('learningSetup')} />
            </div>
          </div>
        )}
      </main>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }`}</style>
    </>
  )
}
