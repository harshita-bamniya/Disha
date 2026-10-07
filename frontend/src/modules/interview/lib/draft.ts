// The setup -> instructions -> system-check pages share the user's choices via
// sessionStorage so a refresh doesn't lose them. The backend session is only
// created at the end of the system check, so a failed device check never
// spends one of the user's free interviews.

export type DurationKey = 'quick' | 'indepth' | 'stress'
export type ExperienceKey = 'Internship' | 'Fresher' | 'Experienced'

export type LanguageKey = 'en' | 'hi' | 'hinglish'

export const LANGUAGE_OPTIONS: { value: LanguageKey; label: string; hint: string }[] = [
  { value: 'en', label: 'English', hint: 'Questions and feedback in English' },
  { value: 'hi', label: 'Hindi', hint: 'Questions and feedback in Hindi' },
  { value: 'hinglish', label: 'Hinglish', hint: 'Hindi and English mixed' },
]

export interface InterviewDraft {
  role: string
  level: ExperienceKey
  duration: DurationKey
  jobDesc: string
  consent: boolean
  language?: LanguageKey
  // Optional extra consent: keep my answer audio for a limited time.
  saveAudio?: boolean
  // Set when this is an employer's Verified Interview rather than practice.
  invitationId?: string
  employerName?: string
  verifiedMinutes?: number
  // Verified only: the candidate agreed the employer may see the result.
  shareWithEmployer?: boolean
}

export const DURATIONS: Record<DurationKey, { label: string; minutes: number; questions: number; sessionType: 'practice' | 'full_mock' | 'stress'; questionRange: string }> = {
  quick:   { label: 'Quick',    minutes: 10, questions: 5, sessionType: 'practice',  questionRange: '4-5 questions' },
  indepth: { label: 'In-depth', minutes: 20, questions: 8, sessionType: 'full_mock', questionRange: '7-8 questions' },
  // Opt-in and unlocked after a few regular interviews (see /interview/eligibility).
  stress:  { label: 'Stress',   minutes: 15, questions: 6, sessionType: 'stress',    questionRange: '5-6 questions' },
}

const KEY = 'interview-draft'

export function loadDraft(): InterviewDraft | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as InterviewDraft) : null
  } catch {
    return null
  }
}

export function saveDraft(draft: InterviewDraft) {
  try { sessionStorage.setItem(KEY, JSON.stringify(draft)) } catch { /* storage unavailable */ }
}

export function clearDraft() {
  try { sessionStorage.removeItem(KEY) } catch { /* storage unavailable */ }
}
