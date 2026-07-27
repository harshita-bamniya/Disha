import { apiClient } from './client'
import { useAuthStore } from '@/stores/authStore'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export interface ScoreCriterion {
  score: number
  explanation: string
}

export interface ScoreBreakdown {
  ats_compatibility: ScoreCriterion
  keyword_coverage: ScoreCriterion
  impact: ScoreCriterion
  completeness: ScoreCriterion
  readability: ScoreCriterion
  formatting: ScoreCriterion
  overall: number
}

export interface ParsedPersonalInfo {
  name: string | null
  email: string | null
  phone: string | null
  location: string | null
  linkedin: string | null
  website: string | null
}

export interface ParsedResumeData {
  personal_info: ParsedPersonalInfo | null
  summary: string | null
  experience: Record<string, unknown>[]
  education: Record<string, unknown>[]
  skills: Record<string, unknown>
  projects: Record<string, unknown>[]
  certifications: Record<string, unknown>[]
  achievements: string[]
  languages: Record<string, unknown>[]
}

export type ResumeCopilotEvent =
  | { type: 'step'; label: string }
  | { type: 'question'; id: string; section: string; question: string }
  | { type: 'section_done'; section_type: string; label: string; content: Record<string, unknown> }
  | { type: 'complete'; message: string; sections_created: number; ats_score: number | null }
  | { type: 'error'; message: string }

export interface ResumeTemplate {
  id: string
  name: string
  description: string | null
  template_type: string | null
  thumbnail_url: string | null
}

export interface ResumeSection {
  id: string
  section_type: string
  title: string | null
  content: Record<string, unknown>
  sort_order: number
  ai_improved: boolean
}

export interface ResumeSummary {
  id: string
  title: string
  is_primary: boolean
  ats_score: number | null
  score_breakdown: ScoreBreakdown | null
  career_track_name: string | null
  template_name: string | null
  section_count: number
  created_at: string
  updated_at: string
}

export interface ResumeDetail extends ResumeSummary {
  sections: ResumeSection[]
}

export interface ResumeVersion {
  id: string
  version_num: number
  ai_generated: boolean
  created_at: string
}

export const resumeApi = {
  getTemplates: () =>
    apiClient.get<ResumeTemplate[]>('/resume/templates').then(r => r.data),

  listResumes: () =>
    apiClient.get<ResumeSummary[]>('/resume/').then(r => r.data),

  createResume: (data: { title: string; career_track_id?: string; template_id?: string }) =>
    apiClient.post<ResumeDetail>('/resume/', data).then(r => r.data),

  getResume: (resumeId: string) =>
    apiClient.get<ResumeDetail>(`/resume/${resumeId}`).then(r => r.data),

  updateResume: (resumeId: string, data: {
    title?: string
    career_track_id?: string
    template_id?: string
    is_primary?: boolean
  }) => apiClient.put<ResumeDetail>(`/resume/${resumeId}`, data).then(r => r.data),

  deleteResume: (resumeId: string) =>
    apiClient.delete(`/resume/${resumeId}`),

  deleteSection: (resumeId: string, sectionId: string) =>
    apiClient.delete(`/resume/${resumeId}/sections/${sectionId}`),

  upsertSection: (resumeId: string, data: {
    section_type: string
    title?: string
    content: Record<string, unknown>
    sort_order?: number
  }) => apiClient.post<ResumeSection>(`/resume/${resumeId}/sections`, data).then(r => r.data),

  aiImproveSection: (resumeId: string, sectionId: string, careerContext?: string) =>
    apiClient.post(`/resume/${resumeId}/ai-improve`, {
      section_id: sectionId,
      career_context: careerContext,
    }).then(r => r.data),

  aiGenerateResume: (resumeId: string, jobContext?: {
    job_title?: string
    company_name?: string
    required_skills?: string[]
    job_description?: string
  }) =>
    apiClient.post(`/resume/${resumeId}/ai-generate`, jobContext ?? {}).then(r => r.data),

  /**
   * Interactive resume co-pilot — streams generation progress as SSE events.
   * `answers` carries clarification answers collected so far; the caller
   * resends the same request with the new answer merged in to resume after
   * a 'question' event.
   */
  aiGenerateResumeStream: async (
    resumeId: string,
    jobContext: {
      job_title?: string
      company_name?: string
      required_skills?: string[]
      job_description?: string
    },
    answers: Record<string, string>,
    onEvent: (event: ResumeCopilotEvent) => void,
    onDone: () => void,
    onError: (err: Error) => void,
  ): Promise<void> => {
    const token = useAuthStore.getState().accessToken
    try {
      const response = await fetch(`${BASE_URL}/api/resume/${resumeId}/ai-generate-stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ ...jobContext, answers }),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`)
      }
      if (!response.body) {
        throw new Error('No response body')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6)
          if (data === '[DONE]') {
            onDone()
            return
          }
          onEvent(JSON.parse(data) as ResumeCopilotEvent)
        }
      }
      onDone()
    } catch (err) {
      onError(err instanceof Error ? err : new Error(String(err)))
    }
  },

  reorderSections: (resumeId: string, sections: { section_id: string; sort_order: number }[]) =>
    apiClient.put(`/resume/${resumeId}/sections/reorder`, { sections }),

  parseResumeFile: async (file: File): Promise<ParsedResumeData> => {
    const form = new FormData()
    form.append('file', file)
    const token = useAuthStore.getState().accessToken
    const res = await fetch(`${BASE_URL}/api/resume/parse`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Parse failed' }))
      throw new Error(err.detail ?? 'Upload failed')
    }
    return res.json()
  },

  importParsedResume: (data: {
    title: string
    career_track_id?: string
    template_id?: string
    parsed_data: ParsedResumeData
  }) => apiClient.post<ResumeDetail>('/resume/import-parsed', data).then(r => r.data),

  setJobTarget: (resumeId: string, data: { job_posting_id?: string; job_description?: string }) =>
    apiClient.post(`/resume/${resumeId}/set-job-target`, data).then(r => r.data),

  restoreVersion: (resumeId: string, versionId: string) =>
    apiClient.post<ResumeDetail>(`/resume/${resumeId}/versions/${versionId}/restore`).then(r => r.data),

  getVersions: (resumeId: string) =>
    apiClient.get<ResumeVersion[]>(`/resume/${resumeId}/versions`).then(r => r.data),

  saveVersion: (resumeId: string) =>
    apiClient.post(`/resume/${resumeId}/save-version`).then(r => r.data),

  /**
   * Download the resume as a PDF.
   * Returns a Blob that callers should convert to an object URL and trigger download.
   */
  exportPdf: (resumeId: string) =>
    apiClient.get(`/resume/${resumeId}/export`, { responseType: 'blob' }).then(r => r.data as Blob),
}
