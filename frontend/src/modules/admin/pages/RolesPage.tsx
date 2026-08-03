import { useState, useMemo } from 'react'
import { KeyRound, Plus, Trash2, X, Copy } from 'lucide-react'
import {
  useAdminRoles, useUpdateRolePermissions, useAdminPermissions,
  useCreateRole, useDeleteRole,
} from '../hooks/useAdmin'
import { Spinner, Empty, Badge } from '../shared/adminUI'
import { getApiError } from '@/api/client'
import type { RoleEntry, PermissionEntry } from '@/api/admin'

const N = { navy: '#1A2744', ink: '#1E3A5F', muted: '#94A3B8', cream: '#F4F5F7', creamDk: '#EAECF0' }

// ── Permission checkbox group ──────────────────────────────────────────────────

function PermissionMatrix({
  permissions,
  selectedIds,
  onChange,
  readonly = false,
}: {
  permissions: PermissionEntry[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
  readonly?: boolean
}) {
  const byResource = useMemo(() => {
    const map = new Map<string, PermissionEntry[]>()
    permissions.forEach(p => {
      map.set(p.resource, [...(map.get(p.resource) ?? []), p])
    })
    return map
  }, [permissions])

  const toggle = (id: string, checked: boolean) =>
    onChange(checked ? [...selectedIds, id] : selectedIds.filter(x => x !== id))

  const toggleResource = (perms: PermissionEntry[], checked: boolean) => {
    const ids = perms.map(p => p.id)
    onChange(checked
      ? [...new Set([...selectedIds, ...ids])]
      : selectedIds.filter(id => !ids.includes(id)),
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {Array.from(byResource.entries()).map(([resource, perms]) => {
        const allChecked = perms.every(p => selectedIds.includes(p.id))
        const someChecked = perms.some(p => selectedIds.includes(p.id))
        return (
          <div key={resource}>
            <div className="flex items-center gap-2 mb-2">
              {!readonly && (
                <input
                  type="checkbox"
                  checked={allChecked}
                  ref={el => { if (el) el.indeterminate = someChecked && !allChecked }}
                  onChange={e => toggleResource(perms, e.target.checked)}
                  className="rounded"
                />
              )}
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: N.muted }}>{resource}</p>
              <span style={{ fontSize: 10, color: '#CBD5E1', fontWeight: 500 }}>{perms.filter(p => selectedIds.includes(p.id)).length}/{perms.length}</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 pl-1">
              {perms.map(perm => (
                <label key={perm.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: N.ink, cursor: readonly ? 'default' : 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(perm.id)}
                    onChange={e => !readonly && toggle(perm.id, e.target.checked)}
                    disabled={readonly}
                    className="rounded"
                  />
                  {perm.action}
                </label>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Edit permissions modal ─────────────────────────────────────────────────────

function EditModal({
  role,
  permissions,
  onClose,
}: {
  role: RoleEntry
  permissions: PermissionEntry[]
  onClose: () => void
}) {
  const permByKey = useMemo(() => {
    const map = new Map<string, string>()
    permissions.forEach(p => map.set(`${p.resource}:${p.action}`, p.id))
    return map
  }, [permissions])

  const [selectedIds, setSelectedIds] = useState<string[]>(
    role.permissions.map(key => permByKey.get(key)).filter((id): id is string => !!id),
  )
  const update = useUpdateRolePermissions()

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div style={{ background: '#fff', borderRadius: 16, padding: 24, maxWidth: 512, width: '100%', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
        <div className="flex items-start justify-between mb-4 shrink-0">
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 900, color: N.ink, textTransform: 'capitalize' }}>{role.name.replace(/_/g, ' ')}</h3>
            <p style={{ fontSize: 12, color: N.muted, marginTop: 2 }}>{selectedIds.length} permission{selectedIds.length !== 1 ? 's' : ''} selected</p>
          </div>
          <button onClick={onClose} style={{ color: N.muted }}><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <PermissionMatrix permissions={permissions} selectedIds={selectedIds} onChange={setSelectedIds} />
        </div>
        {update.isError && <p style={{ fontSize: 12, color: '#EF4444', marginTop: 12, flexShrink: 0 }}>{getApiError(update.error)}</p>}
        <div className="flex gap-3 mt-5 shrink-0">
          <button onClick={onClose} style={{ flex: 1, height: 40, borderRadius: 10, border: '1px solid rgba(0,0,0,0.08)', fontSize: 14, fontWeight: 500, color: N.muted, background: '#fff' }}>Cancel</button>
          <button
            onClick={() => update.mutate({ roleId: role.id, permissionIds: selectedIds }, { onSuccess: onClose })}
            disabled={update.isPending}
            style={{ flex: 1, height: 40, borderRadius: 10, background: N.navy, color: '#fff', fontSize: 14, fontWeight: 600, border: 'none', opacity: update.isPending ? 0.4 : 1 }}
          >
            {update.isPending ? 'Saving…' : 'Save permissions'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Create role modal ──────────────────────────────────────────────────────────

function CreateModal({
  permissions,
  roles,
  onClose,
}: {
  permissions: PermissionEntry[]
  roles: RoleEntry[]
  onClose: () => void
}) {
  const create = useCreateRole()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [cloneFrom, setCloneFrom] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const permByKey = useMemo(() => {
    const map = new Map<string, string>()
    permissions.forEach(p => map.set(`${p.resource}:${p.action}`, p.id))
    return map
  }, [permissions])

  const handleCloneChange = (roleId: string) => {
    setCloneFrom(roleId)
    if (roleId) {
      const source = roles.find(r => r.id === roleId)
      if (source) {
        setSelectedIds(
          source.permissions.map(key => permByKey.get(key)).filter((id): id is string => !!id),
        )
      }
    } else {
      setSelectedIds([])
    }
  }

  const nameValid = /^[a-z][a-z0-9_]*$/.test(name)
  const canSubmit = name.length >= 2 && nameValid && !create.isPending

  const handleSubmit = () => {
    create.mutate(
      { name, description: description || undefined, permission_ids: selectedIds, clone_from_id: cloneFrom || undefined },
      { onSuccess: onClose },
    )
  }

  const inputStyle = { width: '100%', height: 36, padding: '0 12px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.08)', fontSize: 14, outline: 'none' }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div style={{ background: '#fff', borderRadius: 16, padding: 24, maxWidth: 512, width: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
        <div className="flex items-start justify-between mb-5 shrink-0">
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 900, color: N.ink }}>Create custom role</h3>
            <p style={{ fontSize: 12, color: N.muted, marginTop: 2 }}>Custom roles can be assigned to sub-admins and deleted when no longer needed.</p>
          </div>
          <button onClick={onClose} style={{ color: N.muted }}><X className="w-4 h-4" /></button>
        </div>

        <div className="flex flex-col gap-4 shrink-0">
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: N.ink, marginBottom: 4, display: 'block' }}>
              Role name <span style={{ fontWeight: 400, color: N.muted }}>(lowercase, underscores only)</span>
            </label>
            <input
              value={name}
              onChange={e => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              placeholder="e.g. content_moderator"
              style={inputStyle}
            />
            {name.length >= 2 && !nameValid && (
              <p style={{ fontSize: 12, color: '#EF4444', marginTop: 4 }}>Must start with a letter and contain only lowercase letters, numbers, underscores.</p>
            )}
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: N.ink, marginBottom: 4, display: 'block' }}>Description <span style={{ fontWeight: 400, color: N.muted }}>(optional)</span></label>
            <input value={description} onChange={e => setDescription(e.target.value)} placeholder="What does this role do?" style={inputStyle} />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: N.ink, marginBottom: 4, display: 'block' }}>
              <Copy className="w-3 h-3 inline mr-1" />
              Clone permissions from <span style={{ fontWeight: 400, color: N.muted }}>(optional)</span>
            </label>
            <select
              value={cloneFrom}
              onChange={e => handleCloneChange(e.target.value)}
              style={{ width: '100%', height: 36, padding: '0 12px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.08)', fontSize: 14, background: '#fff', outline: 'none' }}
            >
              <option value="">— start empty —</option>
              {roles.filter(r => r.name !== 'super_admin').map(r => (
                <option key={r.id} value={r.id}>{r.name.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', marginTop: 16, borderTop: '1px solid rgba(0,0,0,0.08)', paddingTop: 16 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: N.muted, marginBottom: 12 }}>{selectedIds.length} permission{selectedIds.length !== 1 ? 's' : ''} selected</p>
          <PermissionMatrix permissions={permissions} selectedIds={selectedIds} onChange={setSelectedIds} />
        </div>

        {create.isError && (
          <p style={{ fontSize: 12, color: '#EF4444', marginTop: 12, flexShrink: 0 }}>{getApiError(create.error)}</p>
        )}

        <div className="flex gap-3 mt-5 shrink-0">
          <button onClick={onClose} style={{ flex: 1, height: 40, borderRadius: 10, border: '1px solid rgba(0,0,0,0.08)', fontSize: 14, fontWeight: 500, color: N.muted, background: '#fff' }}>Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            style={{ flex: 1, height: 40, borderRadius: 10, background: N.navy, color: '#fff', fontSize: 14, fontWeight: 600, border: 'none', opacity: !canSubmit ? 0.4 : 1 }}
          >
            {create.isPending ? 'Creating…' : 'Create role'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Delete confirmation ────────────────────────────────────────────────────────

function DeleteConfirm({ role, onClose }: { role: RoleEntry; onClose: () => void }) {
  const del = useDeleteRole()
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div style={{ background: '#fff', borderRadius: 16, padding: 24, maxWidth: 384, width: '100%' }}>
        <h3 style={{ fontSize: 16, fontWeight: 900, color: N.ink, marginBottom: 8 }}>Delete role?</h3>
        <p style={{ fontSize: 14, color: N.muted, marginBottom: 4 }}>
          This will permanently delete <span style={{ fontWeight: 600, color: N.ink }}>"{role.name}"</span> and remove all its permission assignments.
        </p>
        <p style={{ fontSize: 12, color: '#D97706', background: '#FFFBEB', borderRadius: 10, padding: '8px 12px', marginBottom: 20 }}>
          The role must have no assigned users before it can be deleted.
        </p>
        {del.isError && <p style={{ fontSize: 12, color: '#EF4444', marginBottom: 12 }}>{getApiError(del.error)}</p>}
        <div className="flex gap-3">
          <button onClick={onClose} style={{ flex: 1, height: 40, borderRadius: 10, border: '1px solid rgba(0,0,0,0.08)', fontSize: 14, fontWeight: 500, color: N.muted, background: '#fff' }}>Cancel</button>
          <button
            onClick={() => del.mutate(role.id, { onSuccess: onClose })}
            disabled={del.isPending}
            style={{ flex: 1, height: 40, borderRadius: 10, background: '#EF4444', color: '#fff', fontSize: 14, fontWeight: 600, border: 'none', opacity: del.isPending ? 0.4 : 1 }}
          >
            {del.isPending ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

type Modal =
  | { type: 'edit';   role: RoleEntry }
  | { type: 'create' }
  | { type: 'delete'; role: RoleEntry }

export default function RolesPage() {
  const { data: roles, isLoading } = useAdminRoles()
  const { data: permissions = [] } = useAdminPermissions()
  const [modal, setModal] = useState<Modal | null>(null)

  const systemRoles  = (roles ?? []).filter(r => r.is_system)
  const customRoles  = (roles ?? []).filter(r => !r.is_system)

  return (
    <section className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: N.ink, fontFamily: 'Hind, sans-serif', letterSpacing: '-0.3px' }}>Roles & Permissions</h1>
          <p style={{ fontSize: 14, color: N.muted, marginTop: 4 }}>Click a role to edit its permission set. Create custom roles for fine-grained delegation.</p>
        </div>
        <button
          onClick={() => setModal({ type: 'create' })}
          className="flex items-center gap-1.5 shrink-0"
          style={{ height: 36, padding: '0 16px', borderRadius: 10, background: N.navy, color: '#fff', fontSize: 12, fontWeight: 600, border: 'none' }}
        >
          <Plus className="w-3.5 h-3.5" />
          New role
        </button>
      </div>

      {isLoading ? <Spinner /> : !roles || roles.length === 0 ? (
        <Empty icon={KeyRound} text="No roles found" />
      ) : (
        <>
          <RoleTable
            title="System Roles"
            subtitle="Built-in roles — cannot be deleted. Super admin always holds all permissions."
            roles={systemRoles}
            onEdit={role => setModal({ type: 'edit', role })}
          />

          {customRoles.length > 0 && (
            <RoleTable
              title="Custom Roles"
              subtitle="Created by super admins. Can be deleted when no users are assigned."
              roles={customRoles}
              onEdit={role => setModal({ type: 'edit', role })}
              onDelete={role => setModal({ type: 'delete', role })}
            />
          )}

          {customRoles.length === 0 && (
            <div style={{ background: N.cream, borderRadius: 16, border: '1px solid rgba(0,0,0,0.08)', padding: '40px 24px', textAlign: 'center' }}>
              <KeyRound className="w-8 h-8 mx-auto mb-3" style={{ color: N.creamDk }} />
              <p style={{ fontSize: 14, fontWeight: 600, color: N.muted }}>No custom roles yet</p>
              <p style={{ fontSize: 12, color: '#CBD5E1', marginTop: 4 }}>Click "New role" to create one from scratch or clone an existing role.</p>
            </div>
          )}
        </>
      )}

      {modal?.type === 'edit' && modal.role.name !== 'super_admin' && (
        <EditModal role={modal.role} permissions={permissions} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'create' && (
        <CreateModal permissions={permissions} roles={roles ?? []} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'delete' && (
        <DeleteConfirm role={modal.role} onClose={() => setModal(null)} />
      )}
    </section>
  )
}

// ── Role table ─────────────────────────────────────────────────────────────────

function RoleTable({
  title, subtitle, roles, onEdit, onDelete,
}: {
  title: string
  subtitle: string
  roles: RoleEntry[]
  onEdit: (r: RoleEntry) => void
  onDelete?: (r: RoleEntry) => void
}) {
  return (
    <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(0,0,0,0.08)', overflow: 'hidden' }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(0,0,0,0.08)', background: N.cream }}>
        <p style={{ fontSize: 14, fontWeight: 900, color: N.ink }}>{title}</p>
        <p style={{ fontSize: 12, color: N.muted, marginTop: 2 }}>{subtitle}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr style={{ background: N.cream, borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
              <th style={{ textAlign: 'left', padding: '10px 20px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: N.muted }}>Role</th>
              <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: N.muted }}>Description</th>
              <th style={{ textAlign: 'right', padding: '10px 16px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: N.muted }}>Users</th>
              <th style={{ textAlign: 'right', padding: '10px 16px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: N.muted }}>Permissions</th>
              <th style={{ padding: '10px 16px' }}></th>
            </tr>
          </thead>
          <tbody>
            {roles.map((role, idx) => (
              <tr
                key={role.id}
                style={{ background: idx % 2 === 0 ? '#fff' : N.cream, borderBottom: '1px solid rgba(0,0,0,0.06)' }}
                onMouseOver={e => (e.currentTarget.style.background = N.creamDk)}
                onMouseOut={e => (e.currentTarget.style.background = idx % 2 === 0 ? '#fff' : N.cream)}
              >
                <td style={{ padding: '12px 20px' }}>
                  <div className="flex items-center gap-2">
                    <span style={{ fontWeight: 700, color: N.ink, textTransform: 'capitalize' }}>{role.name.replace(/_/g, ' ')}</span>
                    {role.is_system && <Badge color="gray">system</Badge>}
                  </div>
                </td>
                <td style={{ padding: '12px 16px', color: N.muted, maxWidth: 280 }} className="truncate">{role.description ?? '—'}</td>
                <td style={{ padding: '12px 16px', textAlign: 'right', color: N.ink }}>{role.user_count}</td>
                <td style={{ padding: '12px 16px', textAlign: 'right', color: N.ink }}>
                  {role.name === 'super_admin' ? 'All' : role.permissions.length}
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => onEdit(role)}
                      disabled={role.name === 'super_admin'}
                      title={role.name === 'super_admin' ? 'Super admin always has all permissions' : 'Edit permissions'}
                      style={{ fontSize: 12, fontWeight: 600, color: N.navy, background: 'transparent', border: 'none', opacity: role.name === 'super_admin' ? 0.3 : 1 }}
                    >
                      Edit
                    </button>
                    {onDelete && (
                      <button
                        onClick={() => onDelete(role)}
                        title="Delete role"
                        style={{ padding: 4, borderRadius: 8, color: N.muted, background: 'transparent', border: 'none' }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
