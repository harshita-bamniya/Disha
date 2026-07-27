import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { resumeApi, type ResumeVersion } from '@/api/resume'
import { X, Clock, Wand2, RotateCcw } from 'lucide-react'

interface Props {
  resumeId: string
  onClose: () => void
  onRestored: () => void
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function VersionDrawer({ resumeId, onClose, onRestored }: Props) {
  const qc = useQueryClient()

  const { data: versions, isLoading } = useQuery({
    queryKey: ['resume-versions', resumeId],
    queryFn: () => resumeApi.getVersions(resumeId),
  })

  const restoreMutation = useMutation({
    mutationFn: (versionId: string) => resumeApi.restoreVersion(resumeId, versionId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['resume', resumeId] })
      qc.invalidateQueries({ queryKey: ['resume-versions', resumeId] })
      onRestored()
      onClose()
    },
  })

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)',
        zIndex: 200, display: 'flex', justifyContent: 'flex-end',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 360, height: '100%', background: 'white',
          display: 'flex', flexDirection: 'column',
          boxShadow: '-8px 0 40px rgba(15,23,42,0.12)',
        }}
      >
        {/* header */}
        <div style={{
          padding: '18px 20px', borderBottom: '1px solid #F1F5F9',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <Clock size={16} color="#6366F1" />
          <span style={{ flex: 1, fontSize: 14, fontWeight: 800, color: '#0F172A' }}>Version History</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 4 }}>
            <X size={16} />
          </button>
        </div>

        {/* version list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {isLoading && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
              <div style={{ width: 22, height: 22, border: '2.5px solid #6366F1', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            </div>
          )}

          {versions?.length === 0 && !isLoading && (
            <div style={{ textAlign: 'center', padding: 32, color: '#94A3B8', fontSize: 13 }}>
              No saved versions yet. Versions are created automatically when AI generates content, or manually via Save Version.
            </div>
          )}

          {versions?.map((v: ResumeVersion) => (
            <div key={v.id} style={{
              background: '#F8FAFC', borderRadius: 12, padding: '12px 14px',
              border: '1px solid #E2E8F0',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: '#0F172A' }}>
                  Version {v.version_num}
                </span>
                {v.ai_generated && (
                  <span style={{
                    fontSize: 10, color: '#7C3AED', fontWeight: 700,
                    background: '#F3E8FF', padding: '1px 6px', borderRadius: 8,
                    display: 'flex', alignItems: 'center', gap: 3,
                  }}>
                    <Wand2 size={9} /> AI
                  </span>
                )}
                {!v.ai_generated && (
                  <span style={{
                    fontSize: 10, color: '#0284C7', fontWeight: 700,
                    background: '#E0F2FE', padding: '1px 6px', borderRadius: 8,
                  }}>
                    Manual
                  </span>
                )}
              </div>
              <div style={{ fontSize: 11, color: '#64748B', marginBottom: 10 }}>
                {formatDate(v.created_at)}
              </div>
              <button
                onClick={() => {
                  if (confirm(`Restore to Version ${v.version_num}? Current sections will be saved as a new version first.`)) {
                    restoreMutation.mutate(v.id)
                  }
                }}
                disabled={restoreMutation.isPending}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                  border: '1.5px solid #E2E8F0', background: 'white',
                  color: '#374151', cursor: 'pointer',
                  opacity: restoreMutation.isPending ? 0.6 : 1,
                }}
              >
                <RotateCcw size={11} />
                Restore this version
              </button>
            </div>
          ))}
        </div>

        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    </div>
  )
}
