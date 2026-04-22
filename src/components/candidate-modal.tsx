'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/contexts/auth-context'
import { useImpersonation, getEffectiveUserId, getEffectiveCompanyId } from '@/lib/contexts/impersonation-context'
import { Candidate, CandidateStatus, Job } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface CandidateModalProps {
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
  candidate?: Candidate | null
  preselectedJobId?: string
}

const STATUS_OPTIONS: { value: CandidateStatus; label: string }[] = [
  { value: 'applied', label: 'Applied' },
  { value: 'screening', label: 'Screening' },
  { value: 'interview', label: 'Interview' },
  { value: 'offered', label: 'Offered' },
  { value: 'rejected', label: 'Rejected' },
]

export default function CandidateModal({
  isOpen,
  onClose,
  onSaved,
  candidate,
  preselectedJobId,
}: CandidateModalProps) {
  const { role, companyId, loading: authLoading } = useAuth()
  const { impersonating, data: impData } = useImpersonation()

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [summary, setSummary] = useState('')
  const [resumeUrl, setResumeUrl] = useState('')
  const [jobId, setJobId] = useState('')
  const [status, setStatus] = useState<CandidateStatus>('applied')

  const [availableJobs, setAvailableJobs] = useState<Job[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  const supabase = createClient()

  // ── Populate form when modal opens ───────────────────────────
  useEffect(() => {
    if (!isOpen) return
    loadJobs()

    if (candidate) {
      setFullName(candidate.full_name)
      setEmail(candidate.email)
      setPhone(candidate.phone || '')
      setSummary(candidate.summary || '')
      setResumeUrl(candidate.resume_url || '')
      setJobId(candidate.job_id)
      setStatus(candidate.status)
    } else {
      setFullName('')
      setEmail('')
      setPhone('')
      setSummary('')
      setResumeUrl('')
      setJobId(preselectedJobId || '')
      setStatus('applied')
    }
    setError('')
  }, [isOpen, candidate, preselectedJobId])

  // ── Load available jobs based on role ────────────────────────
  async function loadJobs() {
    if (authLoading) return

    const { data: { user } } = await supabase.auth.getUser()
    const effectiveUserId = getEffectiveUserId(impersonating, impData, user?.id)
    const effectiveCompanyId = getEffectiveCompanyId(impersonating, impData, companyId ?? undefined)

    if (!effectiveUserId) return

    let data: Job[] | null = null

    if (role === 'company_admin' && effectiveCompanyId && !impersonating) {
      // Company Admin sees ALL jobs in their company
      const res = await supabase
        .from('jobs')
        .select('id, title, customer_id, company_id, status, description, created_at, updated_at, job_type, location, salary_range')
        .eq('company_id', effectiveCompanyId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
      data = res.data as Job[] | null
    } else {
      // Customer: only their own jobs
      const res = await supabase
        .from('jobs')
        .select('id, title, customer_id, company_id, status, description, created_at, updated_at, job_type, location, salary_range')
        .eq('customer_id', effectiveUserId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
      data = res.data as Job[] | null
    }

    if (data) {
      setAvailableJobs(data)
      // Auto-select first job if none selected and no preselected
      if (!preselectedJobId && !candidate && data.length > 0 && !jobId) {
        setJobId(data[0].id)
      }
    }
  }

  // ── Save candidate ────────────────────────────────────────────
  async function handleSubmit() {
    setError('')

    if (!fullName.trim() || !email.trim() || !jobId) {
      setError('Name, email, and job assignment are required.')
      return
    }

    if (authLoading) {
      setError('Please wait — loading your profile...')
      return
    }

    // Verify authenticated session
    const { data: { user } } = await supabase.auth.getUser()
    const effectiveUserId = getEffectiveUserId(impersonating, impData, user?.id)
    if (!effectiveUserId) {
      setError('Authentication error. Please refresh the page and try again.')
      return
    }

    // Verify the selected job is actually in our available list (prevents forged job_ids)
    const selectedJob = availableJobs.find((j) => j.id === jobId)
    if (!selectedJob) {
      setError('Invalid job selection. Please choose a valid job from the list.')
      return
    }

    setIsSaving(true)
    try {
      // NOTE: candidates table has NO company_id column.
      // RLS is enforced via job_id → jobs (company_id / customer_id).
      // stage_order and ai_score must be valid integers.
      const payload = {
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim() || null,
        summary: summary.trim() || null,
        resume_url: resumeUrl.trim() || null,
        status,
        job_id: jobId,                 // ← validated UUID from availableJobs
        updated_at: new Date().toISOString(),
      }

      if (candidate) {
        // UPDATE
        const { error: updateErr } = await supabase
          .from('candidates')
          .update(payload)
          .eq('id', candidate.id)
        if (updateErr) throw updateErr
      } else {
        // INSERT — include required integer defaults
        const { error: insertErr } = await supabase
          .from('candidates')
          .insert([{
            ...payload,
            stage_order: 0,   // ← integer (NOT null, NOT undefined)
            ai_score: 0,      // ← integer (satisfies CHECK constraint 0-100)
          }])
        if (insertErr) {
          const code = (insertErr as { code?: string }).code
          if (code === '42501') throw new Error('Permission denied. You may not have access to this job.')
          if (code === '23503') throw new Error('The selected job no longer exists.')
          throw insertErr
        }
      }

      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while saving the candidate.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{candidate ? 'Edit Candidate' : 'Add New Candidate'}</DialogTitle>
          <DialogDescription>
            {candidate
              ? 'Update applicant details and status.'
              : 'Insert an applicant manually to the pipeline.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Full Name <span className="text-destructive">*</span></Label>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Full Name"
                className="bg-muted/50"
              />
            </div>
            <div className="space-y-2">
              <Label>Email <span className="text-destructive">*</span></Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@address.com"
                className="bg-muted/50"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+46 70 123 4567"
                className="bg-muted/50"
              />
            </div>
            <div className="space-y-2">
              <Label>LinkedIn / Resume URL</Label>
              <Input
                type="url"
                value={resumeUrl}
                onChange={(e) => setResumeUrl(e.target.value)}
                placeholder="https://linkedin.com/in/..."
                className="bg-muted/50"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Job <span className="text-destructive">*</span></Label>
              <Select value={jobId} onValueChange={setJobId}>
                <SelectTrigger className="bg-muted/50">
                  <SelectValue placeholder="Select Job..." />
                </SelectTrigger>
                <SelectContent>
                  {availableJobs.length === 0 ? (
                    <SelectItem value="_none" disabled>No active jobs found</SelectItem>
                  ) : (
                    availableJobs.map((job) => (
                      <SelectItem key={job.id} value={job.id}>
                        {job.title}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(val) => setStatus(val as CandidateStatus)}>
                <SelectTrigger className="bg-muted/50 capitalize">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Summary / Internal Note</Label>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Brief candidate history or summary..."
              className="w-full px-3 py-2 border border-border bg-muted/50 rounded-md min-h-[100px] text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/50 resize-y"
            />
          </div>

          {error && <p className="text-sm font-medium text-destructive">{error}</p>}

          <Button
            onClick={handleSubmit}
            disabled={isSaving || authLoading}
            className="w-full mt-2"
          >
            {isSaving ? 'Saving...' : candidate ? 'Save Changes' : 'Create Candidate'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
