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

export interface ConversationSummary {
  id: string
  title: string | null
  context_type: string
  status: string
  message_count: number
  skill_focus?: string | null
  job_context?: Record<string, string> | null
  created_at: string
  updated_at: string
}

export interface ConversationDetail extends ConversationSummary {
  messages: MessageOut[]
}

export const counsellorApi = {
  listConversations: () =>
    apiClient.get<ConversationSummary[]>('/counsellor/conversations').then(r => r.data),

  createConversation: (contextType: string = 'general') =>
    apiClient.post<ConversationSummary>('/counsellor/conversations', {
      context_type: contextType,
    }).then(r => r.data),

  /**
   * Create a skill-learning conversation scoped to one skill + one job.
   * Returns the new conversation (with its id) so the caller can redirect.
   */
  createSkillConversation: (params: {
    skillFocus: string
    jobId?: string
    jobTitle?: string
    company?: string
    sector?: string
  }) =>
    apiClient.post<ConversationSummary>('/counsellor/conversations', {
      context_type: 'skill_learning',
      skill_focus: params.skillFocus,
      job_id: params.jobId,
      job_title: params.jobTitle,
      company: params.company,
      sector: params.sector,
    }).then(r => r.data),

  getConversation: (convId: string) =>
    apiClient.get<ConversationDetail>(`/counsellor/conversations/${convId}`).then(r => r.data),

  archiveConversation: (convId: string) =>
    apiClient.put(`/counsellor/conversations/${convId}/archive`).then(r => r.data),

  /**
   * Send a message and receive a streaming response.
   * The onChunk callback is called for each text chunk received.
   * Returns a Promise that resolves when the stream is complete.
   */
  sendMessage: async (
    convId: string,
    content: string,
    onChunk: (chunk: string) => void,
    onDone: () => void,
    onError: (err: Error) => void,
  ): Promise<void> => {
    const token = useAuthStore.getState().accessToken
    try {
      const response = await fetch(
        `${BASE_URL}/api/counsellor/conversations/${convId}/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ content }),
        }
      )

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
          // Unescape newlines that were escaped for SSE transport
          const chunk = data.replace(/\\n/g, '\n')
          onChunk(chunk)
        }
      }
      onDone()
    } catch (err) {
      onError(err instanceof Error ? err : new Error(String(err)))
    }
  },
}
