import { apiClient } from './client'

export interface LearningPathSummary {
  id: string
  name: string
  title?: string          // alias — same as name, for compatibility
  description: string | null
  estimated_hours: number
  difficulty: string | null
  career_track_name: string | null
  career_track_slug: string | null  // slug of the matched career track
  total_lessons: number
  completed_lessons: number
  progress_pct: number
  status: string | null
  is_enrolled: boolean
}

export interface LessonOut {
  id: string
  title: string
  content_type: string | null
  content_url: string | null
  content_body: string | null
  duration_minutes: number
  sort_order: number
  language: string
  is_completed: boolean
}

export interface PathModuleOut {
  id: string
  title: string
  description: string | null
  sort_order: number
  skill_focus: string | null
  lessons: LessonOut[]
  completed_count: number
}

export interface LearningPathDetail extends LearningPathSummary {
  modules: PathModuleOut[]
}

export interface StreakData {
  current_streak: number
  longest_streak: number
  last_activity: string | null
}

export const learningApi = {
  getAllPaths: () =>
    apiClient.get<LearningPathSummary[]>('/learn/paths').then(r => r.data),

  getRecommendedPaths: () =>
    apiClient.get<LearningPathSummary[]>('/learn/paths/recommended').then(r => r.data),

  getMyEnrollments: () =>
    apiClient.get<LearningPathSummary[]>('/learn/enrollments').then(r => r.data),

  getPathDetail: (pathId: string) =>
    apiClient.get<LearningPathDetail>(`/learn/paths/${pathId}`).then(r => r.data),

  enrollPath: (pathId: string) =>
    apiClient.post(`/learn/paths/${pathId}/enroll`).then(r => r.data),

  completeLesson: (lessonId: string, timeSpentSec: number = 0, score?: number) =>
    apiClient.post(`/learn/lessons/${lessonId}/complete`, {
      time_spent_sec: timeSpentSec,
      score,
    }).then(r => r.data),

  getStreak: () =>
    apiClient.get<StreakData>('/learn/streak').then(r => r.data),
}
