'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { logActivityAuto } from '@/lib/audit'
import { Job, Candidate, JobStatus, JobType } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
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
import Link from 'next/link'
import { 
  ArrowLeft, MapPin, Briefcase, DollarSign, Edit, 
  Columns, Users, Mail, Pencil, Trash2, Plus, 
  ExternalLink , Calendar, CheckCircle
} from 'lucide-react'
import CandidateModal from '@/components/candidate-modal'

export default function JobDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const jobId = params.id as string

  const [job, setJob] = useState<Job | null>(null)
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [loading, setLoading] = useState(true)

  // Edit Job Modal State
  const [isEditJobOpen, setIsEditJobOpen] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editLocation, setEditLocation] = useState('')
  const [editJobType, setEditJobType] = useState<JobType>('Full-time')
  const [editSalary, setEditSalary] = useState('')
  const [editStatus, setEditStatus] = useState<JobStatus>('active')
  const [isSavingJob, setIsSavingJob] = useState(false)
  const [jobError, setJobError] = useState('')

  // Candidate Modal State
  const [isCandidateModalOpen, setIsCandidateModalOpen] = useState(false)
  const [editingCandidate, setEditingCandidate] = useState<Candidate | null>(null)

  const supabase = createClient()

  useEffect(() => {
    loadData()
  }, [jobId])

  async function loadData() {
    setLoading(true)
    
    const [jobRes, candidatesRes] = await Promise.all([
      supabase.from('jobs').select('*').eq('id', jobId).single(),
      supabase.from('candidates').select('*').eq('job_id', jobId).order('created_at', { ascending: false })
    ])
    
    if (jobRes.data) setJob(jobRes.data as Job)
    if (candidatesRes.data) setCandidates(candidatesRes.data as Candidate[])
    
    setLoading(false)
  }

  function openEditJobModal() {
    if (!job) return
    setEditTitle(job.title)
    setEditDescription(job.description || '')
    setEditLocation(job.location || '')
    setEditJobType((job.job_type as JobType) || 'Full-time')
    setEditSalary(job.salary_range || '')
    setEditStatus(job.status || 'active')
    setJobError('')
    setIsEditJobOpen(true)
  }

  async function handleUpdateJob() {
    if (!editTitle) return setJobError('Job title is required')
    setIsSavingJob(true)
    try {
      const { error } = await supabase
        .from('jobs')
        .update({
          title: editTitle,
          description: editDescription,
          location: editLocation || null,
          job_type: editJobType || null,
          salary_range: editSalary || null,
          status: editStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', jobId)

      if (error) throw error

      await logActivityAuto(supabase, {
        action: 'update',
        entityType: 'job',
        entityId: jobId,
        entityName: editTitle,
        oldValue: { title: job?.title, status: job?.status },
        newValue: { title: editTitle, status: editStatus },
        companyId: job?.company_id,
      })

      setIsEditJobOpen(false)
      loadData()
    } catch (error) {
      setJobError(error instanceof Error ? error.message : 'Failed to update job')
    } finally {
      setIsSavingJob(false)
    }
  }

  async function handleDeleteCandidate(id: string) {
    if (!confirm('Are you sure you want to delete this candidate?')) return
    const candidateName = candidates.find(c => c.id === id)?.full_name
    try {
      const { error } = await supabase.from('candidates').delete().eq('id', id)
      if (error) throw error
      await logActivityAuto(supabase, {
        action: 'delete',
        entityType: 'candidate',
        entityId: id,
        entityName: candidateName,
        companyId: job?.company_id,
      })
      loadData()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  function handleAddCandidate() {
    setEditingCandidate(null)
    setIsCandidateModalOpen(true)
  }

  function handleEditCandidate(candidate: Candidate) {
    setEditingCandidate(candidate)
    setIsCandidateModalOpen(true)
  }

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { bg: string, text: string, label: string }> = {
      applied: { bg: 'bg-blue-500/10', text: 'text-blue-500', label: 'Applied' },
      screening: { bg: 'bg-amber-500/10', text: 'text-amber-500', label: 'Screening' },
      interview: { bg: 'bg-purple-500/10', text: 'text-purple-500', label: 'Interview' },
      offered: { bg: 'bg-emerald-500/10', text: 'text-emerald-500', label: 'Offered' },
      rejected: { bg: 'bg-destructive/10', text: 'text-destructive', label: 'Rejected' },
    }
    const color = statusMap[status] || { bg: 'bg-muted', text: 'text-muted-foreground', label: status }
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md ${color.bg} ${color.text} uppercase tracking-wider`}>
          <span className={`w-1.5 h-1.5 rounded-full ${color.text.replace('text-', 'bg-')}`}></span>
          {color.label}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
      </div>
    )
  }

  if (!job) return <div className="p-8"><p>Job not found</p></div>

  const stats = {
    total: candidates.length,
    applied: candidates.filter(c => c.status === 'applied').length,
    screening: candidates.filter(c => c.status === 'screening').length,
    interview: candidates.filter(c => c.status === 'interview').length,
    offered: candidates.filter(c => c.status === 'offered').length,
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Header Actions */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => router.push('/dashboard/jobs')} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Jobs
        </Button>
        <Link href={`/jobs/${job.id}`}>
          <Button variant="default" className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-xl transition-all">
            <Columns className="w-4 h-4 mr-2" /> Open Kanban Board
          </Button>
        </Link>
      </div>

      {/* Job Details Card */}
      <Card className="border-border/50 shadow-sm bg-card overflow-hidden">
        <CardContent className="p-8">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div className="space-y-4 flex-1">
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold tracking-tight text-foreground">{job.title}</h1>
                <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${job.status === 'active' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-muted text-muted-foreground border-border/50'} uppercase`}>
                  {job.status}
                </span>
              </div>
              
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                {job.location && (
                  <div className="flex items-center gap-1.5"><MapPin className="w-4 h-4" /> {job.location}</div>
                )}
                {job.job_type && (
                  <div className="flex items-center gap-1.5"><Briefcase className="w-4 h-4" /> {job.job_type}</div>
                )}
                {job.salary_range && (
                  <div className="flex items-center gap-1.5"><DollarSign className="w-4 h-4" /> {job.salary_range}</div>
                )}
                <div className="flex items-center gap-1.5"><Calendar className="w-4 h-4" /> Posted {new Date(job.created_at).toLocaleDateString()}</div>
              </div>

              {job.description && (
                <div className="mt-6 pt-6 border-t border-border/50">
                  <h3 className="text-sm font-semibold mb-2">Job Description</h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{job.description}</p>
                </div>
              )}
            </div>
            
            <div className="shrink-0 flex gap-3">
              <Button variant="outline" onClick={openEditJobModal} className="shrink-0">
                <Edit className="w-4 h-4 mr-2" /> Edit Job
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="bg-primary/5 border-primary/20 shadow-none">
          <CardContent className="p-4 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-primary">{stats.total}</span>
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider mt-1">Total Candidates</span>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-border/50">
          <CardContent className="p-4 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold">{stats.applied}</span>
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider mt-1">Applied</span>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-border/50">
          <CardContent className="p-4 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold">{stats.screening}</span>
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider mt-1">Screening</span>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-border/50">
          <CardContent className="p-4 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold">{stats.interview}</span>
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider mt-1">Interviewing</span>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-border/50">
          <CardContent className="p-4 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold">{stats.offered}</span>
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider mt-1">Offered</span>
          </CardContent>
        </Card>
      </div>

      {/* Candidates List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" /> Candidates List
          </h2>
          <Button onClick={handleAddCandidate} className="shadow-sm">
            <Plus className="w-4 h-4 mr-2" /> Add Candidate
          </Button>
        </div>

        <Card className="border-border/50 shadow-sm overflow-hidden">
          {candidates.length === 0 ? (
             <CardContent className="py-20 text-center">
               <div className="w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mx-auto mb-4">
                 <Users className="w-8 h-8 text-muted-foreground" />
               </div>
               <h3 className="text-lg font-medium">No candidates yet</h3>
               <p className="text-sm text-muted-foreground mt-1 mb-6">Get started by adding your first applicant manually.</p>
               <Button onClick={handleAddCandidate} variant="outline"><Plus className="w-4 h-4 mr-2"/> Add Candidate</Button>
             </CardContent>
          ) : (
             <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted/30 text-muted-foreground uppercase text-[10px] font-bold tracking-wider">
                    <tr>
                      <th className="px-6 py-4 border-b border-border/50">Candidate</th>
                      <th className="px-6 py-4 border-b border-border/50">Status</th>
                      <th className="px-6 py-4 border-b border-border/50 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50 bg-card">
                    {candidates.map((candidate) => (
                      <tr key={candidate.id} className="hover:bg-muted/20 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-semibold text-primary border border-primary/20 shrink-0">
                              {candidate.full_name ? candidate.full_name.charAt(0).toUpperCase() : '?'}
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-foreground truncate">{candidate.full_name || 'No Name'}</div>
                              <div className="text-muted-foreground flex gap-3 mt-1 text-xs truncate">
                                <span className="flex items-center gap-1"><Mail className="w-3 h-3"/> {candidate.email}</span>
                                {candidate.resume_url && (
                                  <a href={candidate.resume_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[#0a66c2] hover:underline" onClick={e => e.stopPropagation()}>
                                    <ExternalLink className="w-3 h-3"/> Resume
                                  </a>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {getStatusBadge(candidate.status)}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
                              onClick={() => handleEditCandidate(candidate)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              onClick={() => handleDeleteCandidate(candidate.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
             </div>
          )}
        </Card>
      </div>

      {/* Edit Job Modal */}
      <Dialog open={isEditJobOpen} onOpenChange={setIsEditJobOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit Job Details</DialogTitle>
            <DialogDescription>Update your job posting information.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Job Title <span className="text-destructive">*</span></Label>
              <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} placeholder="e.g. Senior Frontend Engineer" />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Location</Label>
                <Input value={editLocation} onChange={e => setEditLocation(e.target.value)} placeholder="e.g. Remote, Sweden" />
              </div>
              <div className="space-y-2">
                <Label>Job Type</Label>
                <Select value={editJobType} onValueChange={(val) => setEditJobType(val as JobType)}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Full-time">Full-time</SelectItem>
                    <SelectItem value="Part-time">Part-time</SelectItem>
                    <SelectItem value="Contract">Contract</SelectItem>
                    <SelectItem value="Freelance">Freelance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Salary Range</Label>
                <Input value={editSalary} onChange={e => setEditSalary(e.target.value)} placeholder="e.g. $80k - $120k" />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={editStatus} onValueChange={(val) => setEditStatus(val as JobStatus)}>
                  <SelectTrigger className="capitalize"><SelectValue/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <textarea
                value={editDescription}
                onChange={e => setEditDescription(e.target.value)}
                placeholder="Job requirements and description..."
                className="w-full px-3 py-2 border border-border bg-background rounded-md min-h-[120px] text-sm focus-visible:outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>
            {jobError && <p className="text-sm font-medium text-destructive">{jobError}</p>}
            <Button onClick={handleUpdateJob} disabled={isSavingJob} className="w-full mt-2">
              {isSavingJob ? 'Saving Overview...' : 'Save Changes'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reused Candidate Modal */}
      <CandidateModal
        isOpen={isCandidateModalOpen}
        onClose={() => setIsCandidateModalOpen(false)}
        onSaved={loadData}
        candidate={editingCandidate}
        preselectedJobId={jobId}
      />
    </div>
  )
}
