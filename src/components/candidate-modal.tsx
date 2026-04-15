'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useImpersonation, getEffectiveUserId } from '@/lib/contexts/impersonation-context'
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

export default function CandidateModal({ isOpen, onClose, onSaved, candidate, preselectedJobId }: CandidateModalProps) {
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

  useEffect(() => {
    if (isOpen) {
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
    }
  }, [isOpen, candidate, preselectedJobId])

  async function loadJobs() {
    const { data: { user } } = await supabase.auth.getUser()
    const targetUserId = getEffectiveUserId(impersonating, impData, user?.id)
    if (!targetUserId) return

    let query = supabase.from('jobs').select('id, title').order('created_at', { ascending: false })
    
    // Explicitly add customer_id filter. For standard users it matches their own ID, for admins it matches impersonated ID.
    query = query.eq('customer_id', targetUserId)

    const { data } = await query
      
    if (data) {
      setAvailableJobs(data as Job[])
      if (!preselectedJobId && !candidate && data.length > 0 && !jobId) {
        setJobId(data[0].id)
      }
    }
  }

  async function handleSubmit() {
    setError('')
    if (!fullName || !email || !jobId) {
      setError('Name, email, and Job assignment are required.')
      return
    }

    setIsSaving(true)
    try {
      const payload = {
        full_name: fullName,
        email,
        phone: phone || null,
        summary: summary || null,
        resume_url: resumeUrl || null,
        status,
        job_id: jobId,
        updated_at: new Date().toISOString()
      }

      const { error: upsertError } = candidate 
        ? await supabase.from('candidates').update(payload).eq('id', candidate.id)
        : await supabase.from('candidates').insert([{ ...payload, stage_order: 0 }])

      if (upsertError) throw upsertError
      
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
            {candidate ? 'Update applicant details and status.' : 'Insert an applicant manually to the pipeline.'}
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Full Name <span className="text-destructive">*</span></Label>
              <Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Full Name" className="bg-muted/50" />
            </div>
            <div className="space-y-2">
              <Label>Email <span className="text-destructive">*</span></Label>
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@address.com" className="bg-muted/50" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+46 70 123 4567" className="bg-muted/50" />
            </div>
            <div className="space-y-2">
              <Label>LinkedIn / Resume URL</Label>
              <Input type="url" value={resumeUrl} onChange={e => setResumeUrl(e.target.value)} placeholder="https://linkedin.com/in/..." className="bg-muted/50" />
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
                  {availableJobs.map(job => (
                    <SelectItem key={job.id} value={job.id}>{job.title}</SelectItem>
                  ))}
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
                  {STATUS_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Summary / Internal Note</Label>
            <textarea
              value={summary}
              onChange={e => setSummary(e.target.value)}
              placeholder="Brief candidate history or summary..."
              className="w-full px-3 py-2 border border-border bg-muted/50 rounded-md min-h-[100px] text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/50 resize-y"
            />
          </div>

          {error && <p className="text-sm font-medium text-destructive">{error}</p>}
          
          <Button onClick={handleSubmit} disabled={isSaving} className="w-full mt-2">
            {isSaving ? 'Saving...' : candidate ? 'Save Changes' : 'Create Candidate'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
