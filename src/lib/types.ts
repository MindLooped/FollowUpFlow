export type Priority = 'high' | 'medium' | 'low'
export type FollowUpStatus = 'pending' | 'completed' | 'overdue'

export interface Client {
  id: string
  name: string
  company: string
  email: string
  phone: string
  project_details: string
  notes: string
  created_at: string
  updated_at: string
  followup_count?: number
  pending_count?: number
}

export interface FollowUp {
  id: string
  client_id: string
  client_name: string
  company: string
  title: string
  description: string
  due_date: string
  priority: Priority
  status: 'pending' | 'completed'
  effective_status: FollowUpStatus
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface ClientDetail extends Client {
  followups: FollowUp[]
}

export interface Activity {
  id: string
  action: string
  description: string
  client_name: string | null
  followup_title: string | null
  created_at: string
}

export interface DashboardStats {
  total_clients: number
  pending_followups: number
  completed_followups: number
  overdue_followups: number
  upcoming_reminders: number
  total_followups: number
  upcoming_followups: FollowUp[]
  recent_activity: Activity[]
}

export interface ServerSettings {
  demo_mode: boolean
  auth_required: boolean
  database: string
  api_base_url: string
}

export interface ClientInput {
  name: string
  company?: string
  email?: string
  phone?: string
  project_details?: string
  notes?: string
}

export interface FollowUpInput {
  client_id: string
  title: string
  description?: string
  due_date: string
  priority?: Priority
  status?: 'pending' | 'completed'
}

export interface FollowUpUpdate extends Partial<FollowUpInput> {}

export interface ApiErrorShape {
  error: string
  details?: Record<string, string>
}
