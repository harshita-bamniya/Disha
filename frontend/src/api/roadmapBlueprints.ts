import { apiClient } from './client'

// Mirrors backend/app/modules/roadmap_engine/admin_router.py (admin only)

export interface BlueprintSummary {
  id: string
  slug: string
  title: string
  version: number
  review_status: 'draft' | 'reviewed'
  is_current: boolean
  skills: number
  total_base_hours: number
  postings_analyzed: number
  roles_analyzed: number
  judge_score: number | null
  skills_without_reference: number
  grounding: { level: 'grounded' | 'partial' | 'unverified'; skills_with_postings: number; skills_total: number }
  reviewed_by: string | null
  reviewed_at: string | null
  updated_at: string | null
}

export interface BlueprintSkill {
  id: string
  name: string
  phase: string
  base_hours: number
  why_for_role: string
  references: { title: string; url: string; verified?: boolean }[]
  evidence?: { roles_matched?: number; roles_total?: number }
}

export interface BlueprintDetail extends BlueprintSummary {
  graph: { skills: BlueprintSkill[] }
  sources: { roles_used?: { id: string; company: string; role: string }[]; judge?: { notes?: string } }
  review_notes: string | null
  checklist: { kind: string; text: string }[]
}

export type ReviewDecision = 'approve' | 'needs_changes' | 'retire'

export const roadmapBlueprintsApi = {
  list: (): Promise<BlueprintSummary[]> => apiClient.get('/admin/roadmap-blueprints').then(r => r.data),
  detail: (id: string): Promise<BlueprintDetail> => apiClient.get(`/admin/roadmap-blueprints/${id}`).then(r => r.data),
  review: (id: string, decision: ReviewDecision, notes?: string): Promise<BlueprintSummary> =>
    apiClient.post(`/admin/roadmap-blueprints/${id}/review`, { decision, notes }).then(r => r.data),
}
