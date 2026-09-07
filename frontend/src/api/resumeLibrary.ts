import { apiClient } from './client'
import { useAuthStore } from '@/stores/authStore'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

// Field names match backend ResumeFileOut exactly
export interface ResumeFile {
  id: string
  filename: string          // backend: filename
  label: string | null      // backend: label
  format: string            // backend: format  (pdf | docx | doc | rtf)
  file_size_bytes: number   // backend: file_size_bytes
  source: string            // backend: source
  last_used_at: string | null
  created_at: string
}

export interface ResumeLibraryOut {
  total: number
  resumes: ResumeFile[]     // backend: resumes  (not items)
}

export interface ResumeRecommendation {
  resume_id: string
  file_name: string
  reason: string
  score: number
}

export const resumeLibraryApi = {
  list: () =>
    apiClient.get<ResumeLibraryOut>('/candidates/me/resumes/').then(r => r.data),

  upload: async (file: File): Promise<ResumeFile> => {
    const token = useAuthStore.getState().accessToken
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(`${BASE_URL}/api/candidates/me/resumes/`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Upload failed' }))
      throw new Error(err.detail ?? 'Upload failed')
    }
    return res.json()
  },

  rename: (resumeId: string, fileName: string) =>
    apiClient.put<ResumeFile>(`/candidates/me/resumes/${resumeId}`, { file_name: fileName }).then(r => r.data),

  delete: (resumeId: string) =>
    apiClient.delete(`/candidates/me/resumes/${resumeId}`),

  previewUrl: (resumeId: string): string => {
    const token = useAuthStore.getState().accessToken
    return `${BASE_URL}/api/candidates/me/resumes/${resumeId}/preview${token ? `?token=${token}` : ''}`
  },

  downloadUrl: (resumeId: string): string => {
    const token = useAuthStore.getState().accessToken
    return `${BASE_URL}/api/candidates/me/resumes/${resumeId}/download${token ? `?token=${token}` : ''}`
  },

  recommend: (jobId?: string, jobDescription?: string) =>
    apiClient.get<ResumeRecommendation[]>('/candidates/me/resumes/recommend', {
      params: { job_id: jobId, job_description: jobDescription },
    }).then(r => r.data),
}
