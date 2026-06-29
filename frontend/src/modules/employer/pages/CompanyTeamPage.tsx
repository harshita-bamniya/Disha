import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Building2, Users, Plus, Trash2, Crown, X } from 'lucide-react'
import {
  useCompanyProfile, useUpdateCompanyProfile,
  useTeamMembers, useInviteTeamMember, useRemoveTeamMember, useTransferOwnership,
  useHasPermission,
} from '../hooks/useJobs'
import { getApiError } from '@/api/client'
import type { TeamInvitePayload } from '@/api/company'

const ROLE_LABELS: Record<string, string> = {
  employer: 'Owner', employer_owner: 'Owner',
  hr_manager: 'HR Manager', recruiter: 'Recruiter', interviewer: 'Interviewer',
}

function InviteModal({ onClose }: { onClose: () => void }) {
  const invite = useInviteTeamMember()
  const [form, setForm] = useState<TeamInvitePayload>({ email: '', contact_person: '', role_name: 'recruiter' })

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 24, maxWidth: 380, width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 16, fontWeight: 800, color: '#1E3A5F', margin: 0 }}>Invite team member</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF' }}><X size={16} /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input
            value={form.contact_person}
            onChange={e => setForm({ ...form, contact_person: e.target.value })}
            placeholder="Full name"
            style={{ height: 38, borderRadius: 10, border: '1px solid #E5E7EB', padding: '0 12px', fontSize: 13 }}
          />
          <input
            value={form.email}
            onChange={e => setForm({ ...form, email: e.target.value })}
            placeholder="email@company.com"
            style={{ height: 38, borderRadius: 10, border: '1px solid #E5E7EB', padding: '0 12px', fontSize: 13 }}
          />
          <select
            value={form.role_name}
            onChange={e => setForm({ ...form, role_name: e.target.value as TeamInvitePayload['role_name'] })}
            style={{ height: 38, borderRadius: 10, border: '1px solid #E5E7EB', padding: '0 12px', fontSize: 13 }}
          >
            <option value="hr_manager">HR Manager</option>
            <option value="recruiter">Recruiter</option>
            <option value="interviewer">Interviewer</option>
          </select>
          {invite.isError && <p style={{ fontSize: 12, color: '#DC2626' }}>{getApiError(invite.error)}</p>}
          <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
            <button onClick={onClose} style={{ flex: 1, height: 38, borderRadius: 10, border: '1px solid #E5E7EB', background: '#fff', fontSize: 13, fontWeight: 600, color: '#6B7280', cursor: 'pointer' }}>Cancel</button>
            <button
              onClick={() => form.email.trim() && form.contact_person.trim() && invite.mutate(form, { onSuccess: onClose })}
              disabled={!form.email.trim() || !form.contact_person.trim() || invite.isPending}
              style={{ flex: 1, height: 38, borderRadius: 10, border: 'none', background: '#3B82F6', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: invite.isPending ? 0.6 : 1 }}
            >{invite.isPending ? 'Inviting…' : 'Invite'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function CompanyTeamPage() {
  const { data: company, isLoading: companyLoading } = useCompanyProfile()
  const updateCompany = useUpdateCompanyProfile()
  const { data: team, isLoading: teamLoading } = useTeamMembers()
  const removeMember = useRemoveTeamMember()
  const transferOwnership = useTransferOwnership()
  const [showInvite, setShowInvite] = useState(false)
  const [editingDescription, setEditingDescription] = useState(false)
  const [description, setDescription] = useState(company?.description ?? '')

  const canInvite = useHasPermission('team:invite')
  const canRemove = useHasPermission('team:remove')
  const canTransferOwnership = useHasPermission('team:transfer_ownership')
  const canEditCompany = useHasPermission('companies:edit')

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', padding: '32px 24px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <Link to="/app/employer/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#6B7280', fontSize: 13, fontWeight: 600, textDecoration: 'none', marginBottom: 20 }}>
          <ArrowLeft size={14} />Back to dashboard
        </Link>

        {/* Company profile card */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E5E7EB', padding: 24, marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <Building2 size={20} color="#3B82F6" />
            <h1 style={{ fontFamily: 'Hind, sans-serif', fontSize: 20, fontWeight: 800, color: '#1E3A5F', margin: 0 }}>{companyLoading ? 'Loading…' : company?.name}</h1>
          </div>
          {company && (
            <>
              <p style={{ fontSize: 12, color: '#94A3B8', margin: '2px 0 14px' }}>
                {company.industry} · {company.company_size} employees
                {company.headquarters ? ` · ${company.headquarters}` : ''}
              </p>
              {editingDescription ? (
                <div>
                  <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    rows={4}
                    style={{ width: '100%', borderRadius: 10, border: '1px solid #E5E7EB', padding: 12, fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }}
                  />
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button onClick={() => setEditingDescription(false)} style={{ height: 32, padding: '0 14px', borderRadius: 8, border: '1px solid #E5E7EB', background: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                    <button
                      onClick={() => updateCompany.mutate({ description }, { onSuccess: () => setEditingDescription(false) })}
                      disabled={updateCompany.isPending}
                      style={{ height: 32, padding: '0 14px', borderRadius: 8, border: 'none', background: '#3B82F6', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                    >{updateCompany.isPending ? 'Saving…' : 'Save'}</button>
                  </div>
                </div>
              ) : (
                <p
                  onClick={() => { if (canEditCompany) { setDescription(company.description ?? ''); setEditingDescription(true) } }}
                  style={{ fontSize: 13, color: company.description ? '#374151' : '#9CA3AF', cursor: canEditCompany ? 'pointer' : 'default', margin: 0 }}
                >
                  {company.description || (canEditCompany ? 'Click to add a company description…' : 'No description yet.')}
                </p>
              )}
            </>
          )}
        </div>

        {/* Team */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #F1F5F9' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Users size={16} color="#3B82F6" />
              <h2 style={{ fontSize: 14, fontWeight: 800, color: '#1E3A5F', margin: 0 }}>Team Members</h2>
            </div>
            {canInvite && (
              <button
                onClick={() => setShowInvite(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, height: 32, padding: '0 12px', borderRadius: 8, border: 'none', background: '#3B82F6', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
              ><Plus size={13} />Invite</button>
            )}
          </div>

          {teamLoading ? (
            <p style={{ padding: 20, fontSize: 13, color: '#9CA3AF' }}>Loading…</p>
          ) : !team || team.length === 0 ? (
            <p style={{ padding: 20, fontSize: 13, color: '#9CA3AF' }}>No team members yet.</p>
          ) : (
            team.map((m, idx) => (
              <div
                key={m.employer_profile_id}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '14px 20px', borderBottom: idx < team.length - 1 ? '1px solid #F1F5F9' : 'none',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', margin: 0 }}>{m.contact_person}</p>
                    {m.is_owner && <Crown size={13} color="#D97706" />}
                  </div>
                  <p style={{ fontSize: 11, color: '#94A3B8', margin: '2px 0 0' }}>{m.email ?? m.phone}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#3B82F6', background: 'rgba(59,130,246,0.08)', padding: '3px 10px', borderRadius: 20 }}>
                    {ROLE_LABELS[m.role_name] ?? m.role_name}
                  </span>
                  {!m.is_owner && canTransferOwnership && (
                    <button
                      onClick={() => transferOwnership.mutate(m.employer_profile_id)}
                      disabled={transferOwnership.isPending}
                      title="Transfer ownership to this member"
                      style={{ fontSize: 11, color: '#7C3AED', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                    >Make owner</button>
                  )}
                  {!m.is_owner && canRemove && (
                    <button
                      onClick={() => removeMember.mutate(m.employer_profile_id)}
                      disabled={removeMember.isPending}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626' }}
                    ><Trash2 size={14} /></button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {showInvite && <InviteModal onClose={() => setShowInvite(false)} />}
    </div>
  )
}
