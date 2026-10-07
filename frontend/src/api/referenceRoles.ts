import { apiClient } from './client'

// Mirrors backend/app/modules/market_roles/router.py
// These are RESEARCH reference roles, not vacancies: there is no apply call here by design.

export interface SalaryRange { text: string | null; min: number | null; max: number | null }

export interface ReferenceRoleCard {
  id: string
  company_name: string
  job_role: string
  industry: string
  company_type: string | null
  headquarters: string | null
  hiring_locations: string[]
  website_url: string | null
  required_skills: string[]
  entry_salary: SalaryRange
  candidate_fit_score: number | null
  suitable_candidate_categories: string[]
  is_reference: true
  reference_notice: string
}

export interface ReferenceRoleDetail extends ReferenceRoleCard {
  sub_industry: string | null
  department: string | null
  job_description: string | null
  key_responsibilities: string[]
  preferred_skills: string[]
  transferable_upsc_skills: string[]
  upsc_skill_mapping: string | null
  employability_score: number | null
  hiring_suitability_score: number | null
  salary: { entry: SalaryRange; mid: SalaryRange; senior: SalaryRange; notes: Record<string, string> }
  career_path_steps: string[]
  future_growth: string | null
  why_suitable: string | null
  additional_notes: string | null
}

export interface ReferenceRoleList {
  items: ReferenceRoleCard[]
  total: number
  page: number
  page_size: number
  reference_notice: string
}

export interface FacetValue { value: string; count: number }
export interface ReferenceRoleFilters {
  industries: FacetValue[]
  company_types: FacetValue[]
  locations: FacetValue[]
  categories: FacetValue[]
  total: number
}

export interface ReferenceRoleQuery {
  q?: string
  industry?: string
  company_type?: string
  location?: string
  salary_min?: number
  salary_max?: number
  skill?: string
  category?: string
  sort?: 'fit' | 'salary' | 'company' | 'role'
  page?: number
  page_size?: number
}

export interface SkillFitItem {
  skill: string
  status: 'have' | 'related' | 'gap'
  via: string | null
  reason?: string
}

export interface SkillFit {
  needs_profile_skills: boolean
  message?: string
  based_on: string
  required?: SkillFitItem[]
  preferred?: SkillFitItem[]
  summary?: { required_total: number; have: number; related: number; gap: number }
  profile_skill_count?: number
  transferable_upsc_skills?: string[]
}

export const referenceRolesApi = {
  list: (params: ReferenceRoleQuery): Promise<ReferenceRoleList> =>
    apiClient.get('/reference-roles', { params }).then(r => r.data),
  filters: (): Promise<ReferenceRoleFilters> =>
    apiClient.get('/reference-roles/filters').then(r => r.data),
  detail: (id: string): Promise<ReferenceRoleDetail> =>
    apiClient.get(`/reference-roles/${id}`).then(r => r.data),
  skillFit: (id: string): Promise<SkillFit> =>
    apiClient.get(`/reference-roles/${id}/skill-fit`).then(r => r.data),
}
