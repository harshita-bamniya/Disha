import { apiClient } from './client'

export interface TicketEntry {
  id: string
  subject: string
  status: string
  priority: string
  category: string
  entity_type: string
  entity_id: string | null
  reporter_id: string | null
  reporter_name: string | null
  assigned_to: string | null
  assignee_name: string | null
  sla_deadline: string | null
  message_count: number
  created_at: string
  updated_at: string
  resolved_at: string | null
  closed_at: string | null
}

export interface TicketMessage {
  id: string
  sender_id: string | null
  sender_name: string | null
  body: string
  is_internal: boolean
  created_at: string
}

export interface TicketDetail extends TicketEntry {
  body: string | null
  messages: TicketMessage[]
  attachments: unknown[]
}

export interface TicketListResponse {
  total: number
  items: TicketEntry[]
}

export interface CreateTicketPayload {
  subject: string
  body?: string
  priority?: string
  category?: string
  context_job_id?: string
  context_application_id?: string
}

export interface AddMessagePayload {
  body: string
}

// ── Employer support API ──────────────────────────────────────────────────────

export const employerSupportApi = {
  createTicket: (data: CreateTicketPayload) =>
    apiClient.post<TicketEntry>('/employer/support/tickets', data),

  listTickets: () =>
    apiClient.get<TicketListResponse>('/employer/support/tickets'),

  getTicket: (ticketId: string) =>
    apiClient.get<TicketDetail>(`/employer/support/tickets/${ticketId}`),

  addMessage: (ticketId: string, data: AddMessagePayload) =>
    apiClient.post<TicketMessage>(`/employer/support/tickets/${ticketId}/messages`, data),
}

// ── Candidate support API ─────────────────────────────────────────────────────

export const candidateSupportApi = {
  createTicket: (data: CreateTicketPayload) =>
    apiClient.post<TicketEntry>('/me/support/tickets', data),

  listTickets: () =>
    apiClient.get<TicketListResponse>('/me/support/tickets'),

  getTicket: (ticketId: string) =>
    apiClient.get<TicketDetail>(`/me/support/tickets/${ticketId}`),

  addMessage: (ticketId: string, data: AddMessagePayload) =>
    apiClient.post<TicketMessage>(`/me/support/tickets/${ticketId}/messages`, data),
}
