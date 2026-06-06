import { apiClient } from './client'

export interface TrackSummary {
  id: string
  slug: string
  title: string
  sector: string
  salary_range: string | null
  growth_outlook: string | null
  match_score: number | null
  skill_overlap: number | null
  is_selected: boolean
}

export interface TrackDetail extends TrackSummary {
  description: string
  required_skills: string[]
  min_k_score: number
  example_roles: string[]
  skills_you_have: string[]
  skills_to_develop: string[]
}

export interface SelectionResponse {
  track_id: string
  is_selected: boolean
  total_selections: number
  message: string
}

export interface MySelectionsResponse {
  selections: TrackSummary[]
  total: number
}

const careersApi = {
  listTracks: () =>
    apiClient.get<TrackSummary[]>('/careers/tracks').then((r) => r.data),

  getTrack: (slug: string) =>
    apiClient.get<TrackDetail>(`/careers/tracks/${slug}`).then((r) => r.data),

  mySelections: () =>
    apiClient.get<MySelectionsResponse>('/careers/tracks/mine').then((r) => r.data),

  selectTrack: (trackId: string) =>
    apiClient.post<SelectionResponse>(`/careers/tracks/${trackId}/select`).then((r) => r.data),

  deselectTrack: (trackId: string) =>
    apiClient.delete<SelectionResponse>(`/careers/tracks/${trackId}/select`).then((r) => r.data),
}

export default careersApi
