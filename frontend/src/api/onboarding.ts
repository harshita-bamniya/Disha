import { apiClient } from './client'
import type {
  OnboardingStatus, StepSavedResponse, Gender, Qualification, UpscExam, UpscStage,
  BurnoutLevel, ConfidenceLevel, SkillProficiency, LearningFormat, LearningChallenge,
} from '@/types'

export interface PersonalPayload {
  full_name: string
  current_status: 'student' | 'fresher' | 'experienced'
  city: string
  date_of_birth?: string
  gender?: Gender
  state?: string
}

export interface EducationPayload {
  highest_qualification: Qualification
  degree: string
  field_of_study: string
  institution: string
  graduation_year: number
}

export interface UpscJourneyPayload {
  upsc_exam: UpscExam
  years_preparing: number
  upsc_attempts: number
  highest_stage_cleared: UpscStage
  optional_subject?: string
}

export interface WorkExperiencePayload {
  has_work_experience: boolean
  work_experience_years?: number
  work_experience_domain?: string
  last_designation?: string
}

export interface SkillsPayload {
  skills: string[]
}

export interface PreferencesPayload {
  preferred_sectors: string[]
  preferred_locations: string[]
  open_to_relocation: boolean
  expected_salary_min: number
  expected_salary_max: number
}

export interface LearningSetupPayload {
  burnout_level: BurnoutLevel
  confidence_level: ConfidenceLevel
  weekly_study_hours: number
  target_completion_date?: string
  skill_proficiency: Record<string, SkillProficiency>
  preferred_learning_format: LearningFormat
  learning_challenge: LearningChallenge
}

export interface ProfileData {
  full_name: string | null
  current_status: string | null
  date_of_birth: string | null
  gender: string | null
  city: string | null
  state: string | null
  highest_qualification: string | null
  degree: string | null
  field_of_study: string | null
  institution: string | null
  graduation_year: number | null
  upsc_exam: string | null
  years_preparing: number | null
  upsc_attempts: number | null
  highest_stage_cleared: string | null
  optional_subject: string | null
  has_work_experience: boolean | null
  work_experience_years: number | null
  work_experience_domain: string | null
  last_designation: string | null
  skills: string[]
  preferred_sectors: string[]
  preferred_locations: string[]
  open_to_relocation: boolean | null
  expected_salary_min: number | null
  expected_salary_max: number | null
  disha_insight: string | null
  has_learning_setup: boolean
  weekly_study_hours: number | null
  target_completion_date: string | null
  skill_proficiency: Record<string, string>
  preferred_learning_format: string | null
  learning_challenge: string | null
}

export interface OnboardingOptions {
  skills: string[]
  skill_categories: Record<string, string[]>
  sectors: string[]
  states: string[]
}

export const onboardingApi = {
  getOptions: () =>
    apiClient.get<OnboardingOptions>('/onboarding/options').then(r => r.data),

  suggestSkills: (q: string) =>
    apiClient.get<{ suggestions: string[] }>('/onboarding/skills/suggest', { params: { q } }).then(r => r.data.suggestions),

  validateSkill: (skill: string) =>
    apiClient.post<{ valid: boolean; canonical_name: string | null }>('/onboarding/skills/validate', { skill }).then(r => r.data),

  getStatus: () =>
    apiClient.get<OnboardingStatus>('/onboarding/status').then((r) => r.data),

  getProfile: () =>
    apiClient.get<ProfileData>('/onboarding/profile').then((r) => r.data),

  savePersonal: (data: PersonalPayload) =>
    apiClient.put<StepSavedResponse>('/onboarding/personal', data).then((r) => r.data),

  saveEducation: (data: EducationPayload) =>
    apiClient.put<StepSavedResponse>('/onboarding/education', data).then((r) => r.data),

  saveUpscJourney: (data: UpscJourneyPayload) =>
    apiClient.put<StepSavedResponse>('/onboarding/upsc-journey', data).then((r) => r.data),

  saveWorkExperience: (data: WorkExperiencePayload) =>
    apiClient.put<StepSavedResponse>('/onboarding/work-experience', data).then((r) => r.data),

  saveSkills: (data: SkillsPayload) =>
    apiClient.put<StepSavedResponse>('/onboarding/skills', data).then((r) => r.data),

  savePreferences: (data: PreferencesPayload) =>
    apiClient.put<StepSavedResponse>('/onboarding/preferences', data).then((r) => r.data),

  saveLearningSetup: (data: LearningSetupPayload) =>
    apiClient.put<StepSavedResponse>('/onboarding/learning-setup', data).then((r) => r.data),
}
