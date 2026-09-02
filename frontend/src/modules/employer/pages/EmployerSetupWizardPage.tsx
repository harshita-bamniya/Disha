import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Building2, Globe, User, Image as ImageIcon, ShieldCheck,
  ArrowRight, ArrowLeft, Check, Upload, Mail,
} from 'lucide-react'
import Input from '@/shared/components/primitives/Input'
import Button from '@/shared/components/primitives/Button'
import {
  useCompanyProfile, useUpdateCompanyProfile, useUpdateEmployerProfile,
  useUploadCompanyLogo, useUploadCompanyBanner,
} from '../hooks/useJobs'
import type { CompanySize } from '@/types'

const N = {
  navy:    '#1A2744',
  navySoft:'#243359',
  ink:     '#1E3A5F',
  inkSoft: '#475569',
  muted:   '#94A3B8',
  bg:      '#F4F5F7',
  white:   '#FFFFFF',
}

const INDUSTRIES = [
  'IT & Technology', 'Banking & Finance', 'Consulting', 'Education',
  'Government & PSU', 'Healthcare', 'Legal', 'Manufacturing',
  'Media & Communication', 'NGO & Social Sector', 'Real Estate',
  'Research & Analytics', 'Retail', 'Other',
]

const COMPANY_SIZES: { value: CompanySize; label: string }[] = [
  { value: '1-10',    label: '1–10' },
  { value: '11-50',   label: '11–50' },
  { value: '51-200',  label: '51–200' },
  { value: '201-500', label: '201–500' },
  { value: '501-1000',label: '501–1000' },
  { value: '1000+',   label: '1000+' },
]

const STEPS = [
  { id: 'details',      label: 'Your details',     icon: User,       hint: 'Name, email and designation' },
  { id: 'company',      label: 'Company info',      icon: Building2,  hint: 'Industry, size and website' },
  { id: 'branding',     label: 'Branding',          icon: ImageIcon,  hint: 'Logo, banner and description' },
  { id: 'verification', label: 'Verification',      icon: ShieldCheck,hint: 'Get your verified badge' },
]

const LEFT_CONTEXT = [
  {
    title: 'Tell us about yourself',
    body: 'This information helps candidates know who they\'re connecting with and is used during the verification process.',
  },
  {
    title: 'Help candidates find the right fit',
    body: 'Your company profile appears on every job listing you post. Complete profiles get 3× more quality applicants from UPSC backgrounds.',
  },
  {
    title: 'Stand out in the listings',
    body: 'Companies with a logo get significantly more clicks. A banner and description build trust and help candidates understand your culture.',
  },
  {
    title: 'Build trust instantly',
    body: 'A verified badge appears on all your job listings and unlocks unlimited posting limits. Verification takes 24–48 hours.',
  },
]

export default function EmployerSetupWizardPage() {
  const navigate = useNavigate()
  const { data: company } = useCompanyProfile()
  const updateCompany  = useUpdateCompanyProfile()
  const updateProfile  = useUpdateEmployerProfile()
  const uploadLogo     = useUploadCompanyLogo()
  const uploadBanner   = useUploadCompanyBanner()

  const [step, setStep] = useState(0)

  // Step 0 — Your details
  const [fullName,     setFullName]     = useState('')
  const [email,        setEmail]        = useState('')
  const [designation,  setDesignation]  = useState('')

  // Step 1 — Company info
  const [industry,     setIndustry]     = useState('')
  const [companySize,  setCompanySize]  = useState<CompanySize | ''>('')
  const [website,      setWebsite]      = useState('')

  // Step 2 — Branding
  const [description,  setDescription]  = useState('')

  const goNext = () => step < STEPS.length - 1 ? setStep(s => s + 1) : navigate('/app/employer/dashboard')
  const finish = () => navigate('/app/employer/dashboard')

  const saveDetails = () => {
    updateProfile.mutate(
      {
        full_name:    fullName    || undefined,
        email:        email       || undefined,
        designation:  designation || undefined,
      },
      { onSuccess: goNext },
    )
  }

  const saveCompany = () => {
    updateCompany.mutate(
      { industry: industry || undefined, company_size: companySize || undefined, website: website || undefined },
      { onSuccess: goNext },
    )
  }

  const saveBranding = () => {
    if (description) updateCompany.mutate({ description }, { onSuccess: goNext })
    else goNext()
  }

  const ctx = LEFT_CONTEXT[step]

  return (
    <div style={{ minHeight: '100vh', display: 'flex' }}>

      {/* ── Left panel ── */}
      <div style={{
        width: '38%', background: N.navy, flexShrink: 0,
        flexDirection: 'column', justifyContent: 'space-between',
        padding: '40px 44px', position: 'relative', overflow: 'hidden',
      }} className="hidden lg:flex">
        <div style={{ position: 'absolute', width: 400, height: 400, borderRadius: '50%', background: 'rgba(255,255,255,0.03)', top: '-100px', right: '-100px', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', width: 250, height: 250, borderRadius: '50%', background: 'rgba(255,255,255,0.02)', bottom: '8%', left: '-60px', pointerEvents: 'none' }} />

        <span style={{ fontSize: 20, fontWeight: 800, color: '#fff', letterSpacing: '-0.4px', position: 'relative', zIndex: 1 }}>BeginableAI</span>

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ fontSize: 80, fontWeight: 900, color: 'rgba(255,255,255,0.04)', lineHeight: 1, marginBottom: -16, fontFamily: 'system-ui', userSelect: 'none' }}>
            0{step + 1}
          </div>
          <h2 style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: 22, fontWeight: 800, color: N.white, lineHeight: 1.3, marginBottom: 12, letterSpacing: '-0.3px', position: 'relative' }}>
            {ctx.title}
          </h2>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', lineHeight: 1.75, maxWidth: 280 }}>
            {ctx.body}
          </p>

          <div style={{ marginTop: 36, display: 'flex', flexDirection: 'column', gap: 0, borderTop: '0.5px solid rgba(255,255,255,0.08)', paddingTop: 28 }}>
            {STEPS.map((s, i) => {
              const done   = i < step
              const active = i === step
              const Icon   = s.icon
              return (
                <div key={s.id} style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '10px 0',
                  borderBottom: i < STEPS.length - 1 ? '0.5px solid rgba(255,255,255,0.05)' : 'none',
                  opacity: active ? 1 : done ? 0.7 : 0.3,
                  transition: 'opacity 0.2s',
                }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: done ? N.white : active ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.06)',
                    border: active ? '1.5px solid rgba(255,255,255,0.4)' : 'none',
                  }}>
                    {done
                      ? <Check size={13} color={N.navy} strokeWidth={3} />
                      : <Icon size={13} color={active ? N.white : 'rgba(255,255,255,0.5)'} />
                    }
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: active ? 700 : 500, color: active ? N.white : 'rgba(255,255,255,0.6)' }}>{s.label}</div>
                    {active && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>{s.hint}</div>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)', fontStyle: 'italic', lineHeight: 1.6, position: 'relative', zIndex: 1 }}>
          "UPSC aspirants bring discipline and analytical depth most professionals never develop."
        </p>
      </div>

      {/* ── Right panel ── */}
      <div style={{ flex: 1, background: N.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
        <div style={{ width: '100%', maxWidth: 480 }}>

          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: N.muted, marginBottom: 6 }}>
              Step {step + 1} of {STEPS.length}
            </div>
            <h1 style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: 22, fontWeight: 800, color: N.ink, letterSpacing: '-0.3px', marginBottom: 4 }}>
              {STEPS[step].label}
            </h1>
            <p style={{ fontSize: 14, color: N.muted }}>{LEFT_CONTEXT[step].title}</p>
          </div>

          <div style={{ background: N.white, borderRadius: 20, border: '0.5px solid rgba(0,0,0,0.07)', boxShadow: '0 4px 24px rgba(26,39,68,0.06)', padding: '32px 32px' }}>

            {/* Step 0 — Your details */}
            {step === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <Input
                  label="Full name"
                  placeholder="Rajiv Sharma"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  prefix={<User className="w-4 h-4" />}
                />
                <Input
                  label="Email address"
                  type="email"
                  placeholder="rajiv@yourcompany.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  prefix={<Mail className="w-4 h-4" />}
                />
                <Input
                  label="Designation (optional)"
                  placeholder="HR Manager / Founder / Recruiter"
                  value={designation}
                  onChange={e => setDesignation(e.target.value)}
                  prefix={<User className="w-4 h-4" />}
                />
                <Footer onSkip={goNext} onNext={saveDetails} loading={updateProfile.isPending} />
              </div>
            )}

            {/* Step 1 — Company info */}
            {step === 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: N.muted, marginBottom: 10 }}>Industry</div>
                  <div role="radiogroup" aria-label="Industry" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {INDUSTRIES.map(ind => (
                      <button key={ind} type="button" role="radio" aria-checked={industry === ind} onClick={() => setIndustry(ind)} style={{
                        padding: '7px 14px', borderRadius: 100, fontSize: 12, fontWeight: 500, cursor: 'pointer',
                        border: industry === ind ? `1.5px solid ${N.navy}` : '1.5px solid #E2E8F0',
                        background: industry === ind ? N.navy : 'transparent',
                        color: industry === ind ? N.white : N.inkSoft,
                        transition: 'all 0.12s',
                      }}>{ind}</button>
                    ))}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: N.muted, marginBottom: 10 }}>Company size</div>
                  <div role="radiogroup" aria-label="Company size" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(85px, 1fr))', gap: 8 }}>
                    {COMPANY_SIZES.map(({ value, label }) => (
                      <button key={value} type="button" role="radio" aria-checked={companySize === value} onClick={() => setCompanySize(value)} style={{
                        height: 40, borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: 'pointer',
                        border: companySize === value ? `1.5px solid ${N.navy}` : '1.5px solid #E2E8F0',
                        background: companySize === value ? N.navy : 'transparent',
                        color: companySize === value ? N.white : N.inkSoft,
                        transition: 'all 0.12s',
                      }}>{label}</button>
                    ))}
                  </div>
                </div>

                <Input
                  label="Website (optional)"
                  placeholder="https://yourcompany.com"
                  value={website}
                  onChange={e => setWebsite(e.target.value)}
                  prefix={<Globe className="w-4 h-4" />}
                  type="url"
                />

                <Footer onSkip={goNext} onNext={saveCompany} loading={updateCompany.isPending} />
              </div>
            )}

            {/* Step 2 — Branding */}
            {step === 2 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <BrandingUpload
                  label="Company logo"
                  hint="PNG or JPG, square recommended"
                  currentUrl={company?.logo_url}
                  uploading={uploadLogo.isPending}
                  onFile={f => uploadLogo.mutate(f)}
                />
                <BrandingUpload
                  label="Cover banner"
                  hint="PNG or JPG, 1200×300 recommended"
                  currentUrl={company?.cover_banner_url}
                  uploading={uploadBanner.isPending}
                  onFile={f => uploadBanner.mutate(f)}
                />
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: N.muted, marginBottom: 8 }}>About company (optional)</div>
                  <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Brief description of your company and what kind of talent you're looking for..."
                    rows={3}
                    style={{
                      width: '100%', padding: '12px 16px', borderRadius: 12,
                      border: '1.5px solid #E2E8F0', fontSize: 14, color: N.ink,
                      outline: 'none', resize: 'none', lineHeight: 1.6,
                      fontFamily: 'inherit', transition: 'border-color 0.15s', boxSizing: 'border-box',
                    }}
                    onFocus={e => (e.target.style.borderColor = N.navy)}
                    onBlur={e => (e.target.style.borderColor = '#E2E8F0')}
                  />
                </div>
                <Footer onSkip={goNext} onNext={saveBranding} loading={updateCompany.isPending} />
              </div>
            )}

            {/* Step 3 — Verification */}
            {step === 3 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ background: '#F4F5F7', borderRadius: 12, padding: '16px 18px', border: '0.5px solid rgba(0,0,0,0.06)' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: N.ink, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <ShieldCheck size={16} color={N.navy} /> Verification takes 24–48 hours
                  </div>
                  <p style={{ fontSize: 13, color: N.muted, lineHeight: 1.6 }}>
                    Request verification to get a verified badge on all job listings and unlock unlimited posting limits.
                  </p>
                </div>
                <Button variant="primary" size="lg" onClick={() => navigate('/app/employer/verification')} fullWidth>
                  Start verification <ArrowRight size={16} />
                </Button>
                <Button variant="outline" size="lg" onClick={finish} fullWidth>
                  Skip for now — go to dashboard
                </Button>
              </div>
            )}
          </div>

          {/* Progress dots + back */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, marginTop: 24 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {STEPS.map((_, i) => (
                <div key={i} style={{
                  height: 4, borderRadius: 4,
                  width: i === step ? 20 : 4,
                  background: i <= step ? N.navy : '#CBD5E1',
                  transition: 'all 0.25s ease',
                }} />
              ))}
            </div>
            {step > 0 && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setStep(s => s - 1)}>
                <ArrowLeft size={14} /> Back
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function Footer({ onSkip, onNext, loading }: { onSkip: () => void; onNext: () => void; loading: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
      <Button type="button" variant="outline" size="lg" onClick={onSkip} style={{ flex: 1 }}>
        Skip for now
      </Button>
      <Button type="button" variant="primary" size="lg" onClick={onNext} disabled={loading} loading={loading} style={{ flex: 2 }}>
        {loading ? 'Saving…' : <>Continue <ArrowRight size={15} /></>}
      </Button>
    </div>
  )
}

function BrandingUpload({ label, hint, currentUrl, uploading, onFile }: {
  label: string; hint: string; currentUrl?: string | null; uploading: boolean; onFile: (f: File) => void
}) {
  return (
    <label style={{ cursor: 'pointer', display: 'block' }}>
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 14, border: '1.5px solid #E2E8F0', borderRadius: 12, padding: '14px 16px', transition: 'border-color 0.15s' }}
        onMouseOver={e => (e.currentTarget.style.borderColor = N.navy)}
        onMouseOut={e => (e.currentTarget.style.borderColor = '#E2E8F0')}
      >
        {currentUrl
          ? <img src={currentUrl} alt={label} style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover', border: '1px solid #E2E8F0' }} />
          : <div style={{ width: 44, height: 44, borderRadius: 8, background: '#F4F5F7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Upload size={16} color={N.muted} />
            </div>
        }
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: N.ink, marginBottom: 2 }}>{label}</div>
          <div style={{ fontSize: 12, color: N.muted }}>{uploading ? 'Uploading…' : currentUrl ? 'Click to replace' : hint}</div>
        </div>
        {currentUrl && <Check size={15} color={N.navy} />}
      </div>
      <input type="file" accept="image/png,image/jpeg" className="hidden" disabled={uploading} onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f) }} />
    </label>
  )
}
