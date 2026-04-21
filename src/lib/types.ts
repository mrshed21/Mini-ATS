export type UserRole = 'admin' | 'company_admin' | 'customer'

export type ActivityAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'stage_change'
  | 'note_added'
  | 'group_assigned'
  | 'job_reassigned'
  | 'impersonation_start'
  | 'impersonation_end'

export type EntityType =
  | 'job'
  | 'candidate'
  | 'note'
  | 'profile'
  | 'group'
  | 'job_access'
  | 'session'

export interface Company {
  id: string
  name: string
  website_url?: string
  industry?: string
  location?: string
  description?: string
  company_size?: string
}

export interface Profile {
  id: string
  email: string
  full_name?: string
  company_id?: string
  company?: Company
  phone?: string
  avatar_url?: string
  role: UserRole
  updated_at: string
}

export type JobStatus = 'active' | 'closed'
export type JobType = 'Full-time' | 'Part-time' | 'Contract' | 'Freelance'

export interface Job {
  id: string
  title: string
  description: string
  location?: string
  job_type?: JobType
  salary_range?: string
  status: JobStatus
  customer_id: string
  company_id?: string
  customer?: Profile
  created_at: string
  updated_at: string
}

export type CandidateStatus = 'applied' | 'screening' | 'interview' | 'offered' | 'rejected'

export interface Candidate {
  id: string
  full_name: string
  email: string
  phone?: string
  summary?: string
  status: CandidateStatus
  stage_order: number
  ai_score?: number
  ai_evaluation_notes?: string
  resume_url?: string
  job_id: string
  job?: Job
  created_at: string
  updated_at: string
}

export interface Note {
  id: string
  candidate_id: string
  content: string
  created_at: string
}

export interface JobGroup {
  id: string
  name: string
  company_id: string
  created_by: string
  created_at: string
  members?: JobGroupMember[]
}

export interface JobGroupMember {
  id: string
  group_id: string
  user_id: string
  added_by: string
  added_at: string
  profile?: Profile
}

export interface JobAccess {
  id: string
  job_id: string
  group_id: string
  granted_by: string
  granted_at: string
  group?: JobGroup
}

export interface ActivityLog {
  id: string
  actor_id: string
  actor_name: string
  actor_role: string
  on_behalf_of_id?: string
  on_behalf_of_name?: string
  action: ActivityAction
  entity_type: EntityType
  entity_id?: string
  entity_name?: string
  old_value?: Record<string, unknown>
  new_value?: Record<string, unknown>
  company_id?: string
  created_at: string
}

export interface Database {
  public: {
    Tables: {
      companies: {
        Row: Company
        Insert: Omit<Company, 'id'>
        Update: Partial<Company>
      }
      profiles: {
        Row: Profile
        Insert: Omit<Profile, 'id' | 'updated_at'>
        Update: Partial<Profile>
      }
      jobs: {
        Row: Job
        Insert: Omit<Job, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Job>
      }
      candidates: {
        Row: Candidate
        Insert: Omit<Candidate, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Candidate>
      }
      notes: {
        Row: Note
        Insert: Omit<Note, 'id' | 'created_at'>
        Update: Partial<Note>
      }
    }
  }
}