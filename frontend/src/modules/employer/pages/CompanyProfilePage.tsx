import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Building2, MapPin, Globe, Users2, CheckCircle2, AlertCircle,
  Plus, Trash2, Pencil, Upload, Check, Lock,
} from 'lucide-react'
import {
  useCompanyProfile, useUpdateCompanyProfile, useUploadCompanyLogo, useUploadCompanyBanner,
  useOffices, useCreateOffice, useDeleteOffice, useHasPermission, useVerificationStatus,
} from '../hooks/useJobs'
import { getApiError } from '@/api/client'
import type { CompanyProfile } from '@/api/company'
import { DS, C } from '../ds'
import { colors, radius, shadows } from '@/design-system/tokens'
import PageHeader from '@/shared/layouts/PageHeader'
import Button from '@/shared/components/primitives/Button'
import Modal from '@/shared/components/overlays/Modal'
import ErrorState from '@/shared/components/feedback/ErrorState'
import Spinner from '@/shared/components/feedback/Spinner'
import ChangePasswordCard from '@/modules/auth/components/ChangePasswordCard'
import TwoFactorSettings from '@/modules/auth/components/TwoFactorSettings'

const inputStyle: React.CSSProperties = { width: '100%', padding: '7px 10px', border: `1px solid ${colors.border.default}`, borderRadius: 7, fontSize: 13, color: colors.text.ink, background: colors.surface.card, outline: 'none', boxSizing: 'border-box' }
const selectStyle: React.CSSProperties = { padding: '6px 10px', border: `1px solid ${colors.border.default}`, borderRadius: 7, fontSize: 13, color: colors.text.ink, background: colors.surface.card, cursor: 'pointer' }

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 600, color: C.ink2, display: 'block', marginBottom: 5 }}>{label}</label>
      {children}
      {hint && <p style={{ fontSize: 11, color: C.ink3, margin: '4px 0 0' }}>{hint}</p>}
    </div>
  )
}

// ── Branding upload widget ──────────────────────────────────────────────────────

function BrandingUpload({ label, hint, currentUrl, uploading, disabled, onFile }: {
  label: string; hint: string; currentUrl?: string | null; uploading: boolean; disabled: boolean; onFile: (f: File) => void
}) {
  return (
    <label style={{ cursor: disabled ? 'default' : 'pointer', display: 'block' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14,
        border: `1.5px solid ${C.border}`, borderRadius: radius.lg, padding: '14px 16px',
      }}>
        {currentUrl
          ? <img src={currentUrl} alt={label} style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover', border: `1px solid ${C.border}` }} />
          : <div style={{ width: 44, height: 44, borderRadius: 8, background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Upload size={16} color={C.ink3} />
            </div>
        }
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.ink1, marginBottom: 2 }}>{label}</div>
          <div style={{ fontSize: 11, color: C.ink3 }}>
            {uploading ? 'Uploading…' : disabled ? (currentUrl ? 'Set' : 'Not set') : currentUrl ? 'Click to replace' : hint}
          </div>
        </div>
        {currentUrl && <Check size={15} color={C.accent} />}
      </div>
      {!disabled && (
        <input
          type="file" accept="image/png,image/jpeg" className="hidden" disabled={uploading}
          onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f) }}
        />
      )}
    </label>
  )
}

// ── Offices modal ────────────────────────────────────────────────────────────────

function OfficesModal({ onClose }: { onClose: () => void }) {
  const { data: offices, isLoading: officesLoading } = useOffices()
  const createOffice = useCreateOffice()
  const deleteOffice = useDeleteOffice()
  const [form, setForm] = useState({ name: '', city: '' })
  const [err, setErr] = useState('')

  const handleAdd = () => {
    if (!form.name.trim() || !form.city.trim()) { setErr('Both office name and city are required'); return }
    createOffice.mutate(form, {
      onSuccess: () => { setForm({ name: '', city: '' }); setErr('') },
      onError: e => setErr(getApiError(e)),
    })
  }

  return (
    <Modal open={true} title="Manage Offices" onClose={onClose} width={480}>
      <div style={{ marginBottom: 24 }}>
        {officesLoading ? (
          <div style={{ textAlign: 'center', padding: '24px 0', color: C.ink3, fontSize: 13 }}>Loading offices…</div>
        ) : !offices || offices.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 0', color: C.ink3, fontSize: 13 }}>No offices added yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {offices.map(o => (
              <div key={o.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 14px', background: C.bg, borderRadius: 8,
                border: `1px solid ${C.border}`,
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 8, background: C.blueBg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <MapPin size={16} color={C.blue} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: C.ink1 }}>{o.name}</span>
                    {o.is_headquarters && (
                      <span style={{ fontSize: 10, fontWeight: 700, color: C.amber, background: C.amberBg, padding: '1px 6px', borderRadius: 20 }}>HQ</span>
                    )}
                  </div>
                  <span style={{ fontSize: 12, color: C.ink2 }}>{[o.city, o.state].filter(Boolean).join(', ')}</span>
                </div>
                <Button variant="ghost" size="icon" onClick={() => deleteOffice.mutate(o.id)} aria-label="Delete office" style={{ color: C.red }}>
                  <Trash2 size={14} />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 20 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: C.ink1, margin: '0 0 12px' }}>Add new office</p>
        <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
          <input
            value={form.name}
            onChange={e => { setForm({ ...form, name: e.target.value }); setErr('') }}
            placeholder="Office name (e.g. Mumbai HQ)"
            style={{ ...inputStyle, flex: 1 }}
          />
          <input
            value={form.city}
            onChange={e => { setForm({ ...form, city: e.target.value }); setErr('') }}
            placeholder="City"
            style={{ ...inputStyle, flex: 1 }}
          />
        </div>
        {err && <p style={{ fontSize: 12, color: C.red, margin: '0 0 8px' }}>{err}</p>}
        <Button variant="primary" size="sm" fullWidth onClick={handleAdd} loading={createOffice.isPending}>
          <Plus size={14} />Add Office
        </Button>
      </div>
    </Modal>
  )
}

// ── Edit details modal ────────────────────────────────────────────────────────────

const EDIT_INDUSTRIES = [
  'IT & Technology', 'Banking & Finance', 'Consulting', 'Education',
  'Government & PSU', 'Healthcare', 'Legal', 'Manufacturing',
  'Media & Communication', 'NGO & Social Sector', 'Real Estate',
  'Research & Analytics', 'Retail', 'Other',
]

const EDIT_COMPANY_SIZES = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+']

function EditDetailsModal({ company, onClose }: { company: CompanyProfile | undefined; onClose: () => void }) {
  const updateCompany = useUpdateCompanyProfile()
  const [industry, setIndustry]         = useState(company?.industry ?? '')
  const [companySize, setCompanySize]   = useState(company?.company_size ?? '')
  const [website, setWebsite]           = useState(company?.website ?? '')
  const [headquarters, setHeadquarters] = useState(company?.headquarters ?? '')
  const [description, setDescription]   = useState(company?.description ?? '')
  const [err, setErr] = useState('')

  const save = () => {
    updateCompany.mutate({
      industry: industry || undefined,
      company_size: companySize || undefined,
      website: website || undefined,
      headquarters: headquarters || undefined,
      description,
    }, {
      onSuccess: onClose,
      onError: e => setErr(getApiError(e)),
    })
  }

  return (
    <Modal open={true} title="Edit Company Details" onClose={onClose} width={480}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label="Industry">
          <select value={industry} onChange={e => setIndustry(e.target.value)} style={{ ...selectStyle, width: '100%' }}>
            <option value="">— Not set —</option>
            {EDIT_INDUSTRIES.map(ind => <option key={ind} value={ind}>{ind}</option>)}
          </select>
        </Field>
        <Field label="Company size">
          <select value={companySize} onChange={e => setCompanySize(e.target.value)} style={{ ...selectStyle, width: '100%' }}>
            <option value="">— Not set —</option>
            {EDIT_COMPANY_SIZES.map(sz => <option key={sz} value={sz}>{sz}</option>)}
          </select>
        </Field>
        <Field label="Website">
          <input value={website} onChange={e => setWebsite(e.target.value)} style={inputStyle} placeholder="https://yourcompany.com" />
        </Field>
        <Field label="Location" hint="City / headquarters shown to candidates and admins.">
          <input value={headquarters} onChange={e => setHeadquarters(e.target.value)} style={inputStyle} placeholder="e.g. New Delhi" />
        </Field>
        <Field label="Description" hint="Tell candidates what your company is about.">
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={5}
            style={{ ...inputStyle, resize: 'vertical' }}
            placeholder="Describe your company culture, mission, and what makes it a great place to work…"
          />
        </Field>
      </div>
      {err && <p style={{ fontSize: 12, color: C.red, margin: '10px 0 0' }}>{err}</p>}
      <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
        <Button variant="outline" size="sm" style={{ flex: 1, justifyContent: 'center' }} onClick={onClose}>Cancel</Button>
        <Button variant="primary" size="sm" style={{ flex: 1, justifyContent: 'center' }} onClick={save} loading={updateCompany.isPending}>
          Save
        </Button>
      </div>
    </Modal>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function CompanyProfilePage() {
  const { data: company, isLoading, isError, refetch } = useCompanyProfile()
  const { data: offices, isLoading: officesLoading } = useOffices()
  const { data: verification } = useVerificationStatus()
  const uploadLogo = useUploadCompanyLogo()
  const uploadBanner = useUploadCompanyBanner()
  const canEdit = useHasPermission('companies:edit')

  const [showEdit, setShowEdit] = useState(false)
  const [showOffices, setShowOffices] = useState(false)

  if (isLoading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <Spinner size="md" />
    </div>
  )
  if (isError || !company) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <ErrorState title="Company profile unavailable" description="Could not load your company profile. Please try again." onRetry={() => refetch()} />
    </div>
  )

  // Company.verification_status on the profile response is never updated by
  // the real KYC flow (admin approval writes to the EmployerVerification
  // record instead) — use the actual verification status endpoint so this
  // badge doesn't permanently read "unverified" for approved companies.
  const isVerified = verification?.status === 'approved'

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <PageHeader
        title="Company Profile"
        subtitle="Branding, details, and office locations candidates see"
        actions={canEdit && (
          <Button variant="outline" size="sm" onClick={() => setShowEdit(true)}>
            <Pencil size={13} />Edit Details
          </Button>
        )}
      />

      <div style={{ flex: 1, padding: '24px 28px', background: colors.surface.bg }}>
        <div style={{ maxWidth: 740, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Identity header */}
          <div style={{ ...DS.card, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 52, height: 52, borderRadius: radius.lg, background: colors.brand.navy,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden',
            }}>
              {company.logo_url
                ? <img src={company.logo_url} alt={company.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <Building2 size={22} color="#fff" />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 16, fontWeight: 700, color: C.ink1, margin: 0 }}>{company.name}</p>
              <p style={{ fontSize: 12, color: C.ink2, margin: '2px 0 0' }}>
                {[company.industry, company.company_size].filter(Boolean).join(' · ') || 'Add your industry and size'}
              </p>
            </div>
            <Link
              to="/app/employer/verification"
              style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, textDecoration: 'none', color: isVerified ? colors.state.success : colors.state.warning }}
            >
              {isVerified ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
              {isVerified ? 'Verified' : 'Pending verification'}
            </Link>
          </div>

          {/* Branding */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
            <BrandingUpload
              label="Company logo" hint="PNG or JPG, square recommended"
              currentUrl={company.logo_url} uploading={uploadLogo.isPending} disabled={!canEdit}
              onFile={f => uploadLogo.mutate(f)}
            />
            <BrandingUpload
              label="Cover banner" hint="PNG or JPG, 1200×300 recommended"
              currentUrl={company.cover_banner_url} uploading={uploadBanner.isPending} disabled={!canEdit}
              onFile={f => uploadBanner.mutate(f)}
            />
          </div>

          {/* Description */}
          {company.description && (
            <div style={{ ...DS.card, padding: '14px 18px', boxShadow: shadows.card, fontSize: 13, color: C.ink2, lineHeight: 1.6 }}>
              {company.description}
            </div>
          )}

          {/* Details */}
          <div style={DS.card}>
            <div style={DS.cardHeader}>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.ink1 }}>Company details</span>
            </div>
            <div style={{ padding: '4px 20px 16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
              <DetailRow label="Industry" value={company.industry} />
              <DetailRow label="Company size" value={company.company_size} />
              <DetailRow label="Headquarters" value={company.headquarters} />
              <DetailRow label="Website" value={company.website} isLink />
            </div>
          </div>

          {/* Offices */}
          <div style={DS.card}>
            <div style={DS.cardHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <MapPin size={14} color={C.blue} />
                <span style={{ fontSize: 13, fontWeight: 700, color: C.ink1 }}>Offices</span>
                {offices && offices.length > 0 && (
                  <span style={{ fontSize: 11, fontWeight: 600, color: C.blue, background: C.blueBg, padding: '1px 7px', borderRadius: 20 }}>
                    {offices.length}
                  </span>
                )}
              </div>
              {canEdit && (
                <Button variant="outline" size="sm" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => setShowOffices(true)}>
                  <Globe size={12} />Manage
                </Button>
              )}
            </div>
            <div style={{ padding: '12px 20px 16px' }}>
              {officesLoading ? (
                <p style={{ fontSize: 12, color: C.ink3 }}>Loading offices…</p>
              ) : !offices || offices.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '12px 0' }}>
                  <p style={{ fontSize: 12, color: C.ink3, margin: '0 0 10px' }}>No office locations added yet.</p>
                  {canEdit && (
                    <Button variant="primary" size="sm" style={{ fontSize: 12 }} onClick={() => setShowOffices(true)}>
                      <Plus size={12} />Add Office
                    </Button>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {offices.map(o => (
                    <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.blue, flexShrink: 0 }} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: C.ink1 }}>{o.name}</span>
                      {o.is_headquarters && <span style={{ fontSize: 10, color: C.amber, fontWeight: 700 }}>HQ</span>}
                      <span style={{ fontSize: 12, color: C.ink3, marginLeft: 'auto' }}>{[o.city, o.state].filter(Boolean).join(', ')}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Security — folded in from the old standalone Security Settings
              page so account/sign-in settings live alongside the rest of
              this employer's account, not on a separate sidebar page. */}
          <div style={DS.card}>
            <div style={DS.cardHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <Lock size={14} color={C.accent} />
                <span style={{ fontSize: 13, fontWeight: 700, color: C.ink1 }}>Security</span>
              </div>
            </div>
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
              <TwoFactorSettings embedded />
              <ChangePasswordCard embedded />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.ink3 }}>
            <Users2 size={13} />
            Managing people instead? Head to <Link to="/app/employer/company" style={{ color: colors.state.info, fontWeight: 600, textDecoration: 'none' }}>Team</Link>.
          </div>

        </div>
      </div>

      {showEdit    && <EditDetailsModal company={company} onClose={() => setShowEdit(false)} />}
      {showOffices && <OfficesModal onClose={() => setShowOffices(false)} />}
    </div>
  )
}

function DetailRow({ label, value, isLink }: { label: string; value: string | null; isLink?: boolean }) {
  return (
    <div>
      <p style={{ fontSize: 11, fontWeight: 600, color: C.ink3, textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 3px' }}>{label}</p>
      {value ? (
        isLink
          ? <a href={value} target="_blank" rel="noreferrer" style={{ fontSize: 13, fontWeight: 600, color: colors.state.info, textDecoration: 'none' }}>{value}</a>
          : <p style={{ fontSize: 13, fontWeight: 600, color: C.ink1, margin: 0 }}>{value}</p>
      ) : (
        <p style={{ fontSize: 13, color: C.ink3, margin: 0, fontStyle: 'italic' }}>Not set</p>
      )}
    </div>
  )
}
