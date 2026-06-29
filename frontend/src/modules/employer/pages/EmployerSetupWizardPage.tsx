import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Building2, Globe, User, MapPin, Image as ImageIcon, ShieldCheck,
  CheckCircle2, ArrowRight, ArrowLeft,
} from 'lucide-react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { cn } from '@/lib/utils'
import {
  useCompanyProfile, useUpdateCompanyProfile, useUpdateEmployerProfile,
  useUploadCompanyLogo, useUploadCompanyBanner,
} from '../hooks/useJobs'
import type { CompanySize } from '@/types'

const INDUSTRIES = [
  'Banking & Finance', 'Consulting', 'Education', 'Government & PSU',
  'Healthcare', 'IT & Technology', 'Legal', 'Manufacturing',
  'Media & Communication', 'NGO & Social Sector', 'Real Estate',
  'Research & Analytics', 'Retail', 'Other',
]

const COMPANY_SIZES: { value: CompanySize; label: string }[] = [
  { value: '1-10', label: '1–10' },
  { value: '11-50', label: '11–50' },
  { value: '51-200', label: '51–200' },
  { value: '201-500', label: '201–500' },
  { value: '501-1000', label: '501–1000' },
  { value: '1000+', label: '1000+' },
]

const STEPS = ['Company info', 'Recruiter info', 'Branding', 'Verification']

export default function EmployerSetupWizardPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)

  const { data: company } = useCompanyProfile()
  const updateCompany = useUpdateCompanyProfile()
  const updateProfile = useUpdateEmployerProfile()
  const uploadLogo = useUploadCompanyLogo()
  const uploadBanner = useUploadCompanyBanner()

  const [companyForm, setCompanyForm] = useState({ industry: '', company_size: '' as CompanySize | '', website: '' })
  const [recruiterForm, setRecruiterForm] = useState({ contact_person: '', designation: '' })
  const [description, setDescription] = useState('')

  const finish = () => navigate('/app/employer/dashboard')
  const goNext = () => (step < STEPS.length - 1 ? setStep(step + 1) : finish())
  const goBack = () => setStep((s) => Math.max(0, s - 1))

  const saveCompanyStep = () => {
    updateCompany.mutate(
      {
        industry: companyForm.industry || undefined,
        company_size: companyForm.company_size || undefined,
        website: companyForm.website || undefined,
      },
      { onSuccess: goNext },
    )
  }

  const saveRecruiterStep = () => {
    updateProfile.mutate(
      {
        contact_person: recruiterForm.contact_person || undefined,
        designation: recruiterForm.designation || undefined,
      },
      { onSuccess: goNext },
    )
  }

  const saveBrandingStep = () => {
    if (description) {
      updateCompany.mutate({ description }, { onSuccess: goNext })
    } else {
      goNext()
    }
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Stepper */}
        <div className="flex items-center justify-between mb-8">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-shrink-0">
                <div className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors',
                  i < step ? 'bg-primary text-white' :
                  i === step ? 'bg-primary/15 text-primary border-2 border-primary' :
                  'bg-gray-100 text-gray-400',
                )}>
                  {i < step ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                </div>
                <span className={cn('text-[11px] mt-1.5 font-medium whitespace-nowrap', i <= step ? 'text-gray-700' : 'text-gray-400')}>
                  {label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={cn('h-0.5 flex-1 mx-2 rounded-full', i < step ? 'bg-primary' : 'bg-gray-200')} />
              )}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          {step === 0 && (
            <div className="flex flex-col gap-4">
              <Header
                icon={<Building2 className="w-4 h-4 text-accent" />}
                title="Tell us about your company"
                subtitle={`Helps candidates find ${company?.name ?? 'your company'} — skip and fill in later if you're not sure yet.`}
              />
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">Industry</label>
                <select
                  value={companyForm.industry}
                  onChange={(e) => setCompanyForm((p) => ({ ...p, industry: e.target.value }))}
                  className="w-full h-11 rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                >
                  <option value="">Select industry</option>
                  {INDUSTRIES.map((ind) => <option key={ind} value={ind}>{ind}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">Company size</label>
                <div className="grid grid-cols-3 gap-2">
                  {COMPANY_SIZES.map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setCompanyForm((p) => ({ ...p, company_size: value }))}
                      className={cn(
                        'h-10 rounded-xl border text-xs font-medium transition-all',
                        companyForm.company_size === value
                          ? 'bg-accent text-white border-accent'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-accent/50',
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <Input
                label="Website (optional)"
                placeholder="https://acme.com"
                value={companyForm.website}
                onChange={(e) => setCompanyForm((p) => ({ ...p, website: e.target.value }))}
                prefix={<Globe className="w-4 h-4" />}
                type="url"
              />
              <StepFooter
                onSkip={goNext}
                onNext={saveCompanyStep}
                loading={updateCompany.isPending}
                isLast={false}
              />
            </div>
          )}

          {step === 1 && (
            <div className="flex flex-col gap-4">
              <Header
                icon={<User className="w-4 h-4 text-accent" />}
                title="Who's the main point of contact?"
                subtitle="Shown to our team during account verification — not visible to candidates."
              />
              <Input
                label="Full name"
                placeholder="Rajiv Sharma"
                value={recruiterForm.contact_person}
                onChange={(e) => setRecruiterForm((p) => ({ ...p, contact_person: e.target.value }))}
                prefix={<User className="w-4 h-4" />}
              />
              <Input
                label="Designation (optional)"
                placeholder="HR Manager"
                value={recruiterForm.designation}
                onChange={(e) => setRecruiterForm((p) => ({ ...p, designation: e.target.value }))}
                prefix={<MapPin className="w-4 h-4" />}
              />
              <StepFooter
                onSkip={goNext}
                onNext={saveRecruiterStep}
                loading={updateProfile.isPending}
                isLast={false}
              />
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-4">
              <Header
                icon={<ImageIcon className="w-4 h-4 text-accent" />}
                title="Add your branding"
                subtitle="A logo and banner help your job listings stand out. Always editable later from Company Settings."
              />
              <FileUploadRow
                label="Company logo"
                accept="image/png,image/jpeg"
                currentUrl={company?.logo_url}
                uploading={uploadLogo.isPending}
                onFile={(file) => uploadLogo.mutate(file)}
              />
              <FileUploadRow
                label="Cover banner"
                accept="image/png,image/jpeg"
                currentUrl={company?.cover_banner_url}
                uploading={uploadBanner.isPending}
                onFile={(file) => uploadBanner.mutate(file)}
              />
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">About company (optional)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of your company and what kind of talent you're looking for..."
                  rows={3}
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 resize-none"
                />
              </div>
              <StepFooter
                onSkip={goNext}
                onNext={saveBrandingStep}
                loading={updateCompany.isPending}
                isLast={false}
              />
            </div>
          )}

          {step === 3 && (
            <div className="flex flex-col gap-4">
              <Header
                icon={<ShieldCheck className="w-4 h-4 text-accent" />}
                title="Verify your company"
                subtitle="Submit business documents to get a verified badge on your job listings and unlock full posting limits. You can do this anytime from Company Settings."
              />
              <div className="bg-accent/5 border border-accent/15 rounded-xl px-4 py-3 text-sm text-gray-600">
                Verification typically takes 24–48 hours once documents are submitted.
              </div>
              <div className="flex gap-3 mt-2">
                <Button variant="ghost" fullWidth onClick={finish}>
                  Skip for now
                </Button>
                <Button fullWidth onClick={() => navigate('/app/employer/verification')}>
                  Start verification <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </div>

        {step > 0 && step < 3 && (
          <button
            type="button"
            onClick={goBack}
            className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 mt-4 mx-auto"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </button>
        )}
      </div>
    </div>
  )
}

function Header({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="mb-1">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">{icon}</div>
      </div>
      <h1 className="text-xl font-bold text-gray-900" style={{ fontFamily: 'Hind, sans-serif' }}>{title}</h1>
      <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
    </div>
  )
}

function StepFooter({ onSkip, onNext, loading, isLast }: {
  onSkip: () => void; onNext: () => void; loading: boolean; isLast: boolean
}) {
  return (
    <div className="flex gap-3 mt-2">
      <Button type="button" variant="ghost" fullWidth onClick={onSkip}>
        Skip for now
      </Button>
      <Button type="button" fullWidth loading={loading} onClick={onNext}>
        {isLast ? 'Finish' : 'Continue'} <ArrowRight className="w-4 h-4 ml-1" />
      </Button>
    </div>
  )
}

function FileUploadRow({ label, accept, currentUrl, uploading, onFile }: {
  label: string; accept: string; currentUrl?: string | null; uploading: boolean; onFile: (file: File) => void
}) {
  return (
    <div className="flex items-center gap-3">
      {currentUrl ? (
        <img src={currentUrl} alt={label} className="w-12 h-12 rounded-lg object-cover border border-gray-200" />
      ) : (
        <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
          <ImageIcon className="w-5 h-5 text-gray-400" />
        </div>
      )}
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-700">{label}</p>
        <label className="text-xs text-primary font-medium cursor-pointer hover:underline">
          {uploading ? 'Uploading…' : currentUrl ? 'Replace' : 'Upload'}
          <input
            type="file"
            accept={accept}
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) onFile(file)
            }}
          />
        </label>
      </div>
    </div>
  )
}
