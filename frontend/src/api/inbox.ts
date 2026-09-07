import { apiClient } from './client'

export interface NotificationOut {
  id: string
  type: string
  title: string
  body: string | null
  link_url: string | null
  is_read: boolean
  created_at: string
}

export interface NotificationListResponse {
  unread_count: number
  notifications: NotificationOut[]
}

export interface TaskOut {
  id: string
  title: string
  due_at: string | null
  is_done: boolean
  application_id: string | null
  candidate_name: string | null
  job_title: string | null
  created_at: string
}

export const inboxApi = {
  listNotifications: (limit = 30) =>
    apiClient.get<NotificationListResponse>('/employer/notifications', { params: { limit } }).then(r => r.data),

  markNotificationRead: (id: string) =>
    apiClient.patch(`/employer/notifications/${id}/read`).then(r => r.data),

  markAllRead: () =>
    apiClient.post('/employer/notifications/read-all').then(r => r.data),

  listTasks: (includeDone = false) =>
    apiClient.get<TaskOut[]>('/employer/tasks', { params: { include_done: includeDone } }).then(r => r.data),

  createTask: (title: string, dueAt?: string, applicationId?: string) =>
    apiClient.post<TaskOut>('/employer/tasks', { title, due_at: dueAt || null, application_id: applicationId || null }).then(r => r.data),

  updateTask: (id: string, payload: { title?: string; due_at?: string; is_done?: boolean }) =>
    apiClient.patch<TaskOut>(`/employer/tasks/${id}`, payload).then(r => r.data),

  deleteTask: (id: string) =>
    apiClient.delete(`/employer/tasks/${id}`).then(r => r.data),
}

// ── Aspirant notifications — same Notification table/shape, different prefix ──
export const aspirantInboxApi = {
  listNotifications: (limit = 30) =>
    apiClient.get<NotificationListResponse>('/notifications', { params: { limit } }).then(r => r.data),

  markNotificationRead: (id: string) =>
    apiClient.patch(`/notifications/${id}/read`).then(r => r.data),

  markAllRead: () =>
    apiClient.post('/notifications/read-all').then(r => r.data),
}
