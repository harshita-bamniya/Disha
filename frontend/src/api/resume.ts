import { apiClient } from './client'

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
