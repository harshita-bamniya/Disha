import { apiClient } from './client'
import { useAuthStore } from '@/stores/authStore'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export interface MessageOut {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  safety_flagged: boolean
  created_at: string
}

export interface ConversationDetail {
  id: string
  title: string | null
  message_count: number
  created_at: string
  updated_at: string
  messages: MessageOut[]
}

export type Mood = 'great' | 'good' | 'okay' | 'low' | 'struggling'

export interface MoodEntry {
  id: string
  mood: Mood
  note: string | null
  created_at: string
}

export interface Milestone {
  id: string
  title: string
  description: string | null
  source: 'user' | 'ai'
  created_at: string
}

export interface CompanionMemory {
  id: string
  memory_type: 'fact' | 'preference' | 'concern' | 'milestone' | 'goal'
  content: string
  importance: 'low' | 'medium' | 'high' | 'critical'
  created_at: string | null
}

export interface TimelineEntry {
  type: 'mood' | 'milestone'
  date: string
  mood?: Mood
  note?: string | null
  title?: string | null
  description?: string | null
}

export interface WeeklyInsight {
  mood_counts: Record<string, number>
  dominant_mood: Mood | null
  check_in_count: number
  check_in_streak: number
  latest_milestone: Milestone | null
}

export const companionApi = {
  /** Short personal greeting for return visits. `greeting` is null on a brand-new conversation. */
  getWelcome: () =>
    apiClient.get<{ greeting: string | null }>('/companion/welcome').then(r => r.data),

  getConversation: () =>
    apiClient.get<ConversationDetail>('/companion/conversation').then(r => r.data),

  /** Send a message to Your Companion and receive a streaming response. */
  sendMessage: async (
    content: string,
    onChunk: (chunk: string) => void,
    onDone: () => void,
    onError: (err: Error) => void,
  ): Promise<void> => {
    const token = useAuthStore.getState().accessToken
    try {
      const response = await fetch(`${BASE_URL}/api/companion/conversation/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ content }),
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`)
      if (!response.body) throw new Error('No response body')

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
          onChunk(data.replace(/\\n/g, '\n'))
        }
      }
      onDone()
    } catch (err) {
      onError(err instanceof Error ? err : new Error(String(err)))
    }
  },

  createMoodEntry: (mood: Mood, note?: string) =>
    apiClient.post<MoodEntry>('/companion/mood', { mood, note }).then(r => r.data),

  listMoodEntries: (days = 30) =>
    apiClient.get<MoodEntry[]>('/companion/mood', { params: { days } }).then(r => r.data),

  createMilestone: (title: string, description?: string) =>
    apiClient.post<Milestone>('/companion/milestones', { title, description }).then(r => r.data),

  listMilestones: () =>
    apiClient.get<Milestone[]>('/companion/milestones').then(r => r.data),

  deleteMilestone: (id: string) =>
    apiClient.delete(`/companion/milestones/${id}`),

  listMemories: () =>
    apiClient.get<CompanionMemory[]>('/companion/memories').then(r => r.data),

  deleteMemory: (id: string) =>
    apiClient.delete(`/companion/memories/${id}`),

  getTimeline: (days = 60) =>
    apiClient.get<TimelineEntry[]>('/companion/timeline', { params: { days } }).then(r => r.data),

  getInsights: () =>
    apiClient.get<WeeklyInsight>('/companion/insights').then(r => r.data),
}
