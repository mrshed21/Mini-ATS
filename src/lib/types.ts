export type UserRole = 'admin' | 'customer'

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