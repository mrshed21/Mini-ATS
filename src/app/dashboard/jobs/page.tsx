'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useImpersonation, getEffectiveUserId } from '@/lib/contexts/impersonation-context'
import { Job, JobType } from '@/lib/types'
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
  DialogTrigger,
} from '@/components/ui/dialog'
import Link from 'next/link'
import { 
  Plus, MoreVertical, MapPin, Banknote, Clock, 
  Briefcase, Trash2, ArrowRight, Columns, PlayCircle
} from 'lucide-react'

export default function JobsPage() {
  const router = useRouter()
  const { impersonating, data: impData } = useImpersonation()
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  
  const [newTitle, setNewTitle] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newLocation, setNewLocation] = useState('')
  const [newJobType, setNewJobType] = useState<JobType>('Full-time')
  const [newSalaryRange, setNewSalaryRange] = useState('')
  const [error, setError] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    loadJobs()
  }, [])

  async function loadJobs() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const targetUserId = getEffectiveUserId(impersonating, impData, user?.id)
    
    if (targetUserId) {
      const { data } = await supabase
        .from('jobs')
        .select('*, customer:profiles(*)')
        .eq('customer_id', targetUserId)
        .order('created_at', { ascending: false })
      setJobs(data || [])
    }
    setLoading(false)
  }

  async function handleCreateJob() {
    setError('')
    if (!newTitle || !newDescription) return setError('Title and description are required')

    setIsCreating(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const targetUserId = getEffectiveUserId(impersonating, impData, user?.id)
      if (!targetUserId) throw new Error('User not authenticated')

      const { error } = await supabase.from('jobs').insert([{
        title: newTitle,
        description: newDescription,
        location: newLocation || undefined,
        job_type: newJobType,
        salary_range: newSalaryRange || undefined,
        customer_id: targetUserId,
      }])

      if (error) throw error

      setNewTitle(''); setNewDescription(''); setNewLocation(''); setNewJobType('Full-time'); setNewSalaryRange('');
      setIsCreateDialogOpen(false)
      loadJobs()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to create job')
    } finally {
      setIsCreating(false)
    }
  }

  async function handleDeleteJob(id: string) {
    if (!confirm('Are you sure you want to delete this job and all associated candidates?')) return
    try {
      await supabase.from('jobs').delete().eq('id', id)
      loadJobs()
    } catch (error) {
      alert('Failed to delete job')
    }
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Job Postings</h1>
          <p className="text-muted-foreground mt-1 text-sm">Create, manage, and track your active recruitment campaigns.</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="h-10 hover:shadow-lg transition-all rounded-lg">
              <Plus className="w-4 h-4 mr-2" />
              Create Job
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Job Posting</DialogTitle>
              <DialogDescription>Define the role and start attracting top talent.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-6 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">Job Title <span className="text-destructive">*</span></Label>
                <Input id="title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="e.g. Senior Frontend Developer" className="bg-muted/50" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <Input id="location" value={newLocation} onChange={(e) => setNewLocation(e.target.value)} placeholder="e.g. Stockholm, Remote" className="bg-muted/50" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="salaryRange">Salary Range</Label>
                  <Input id="salaryRange" value={newSalaryRange} onChange={(e) => setNewSalaryRange(e.target.value)} placeholder="e.g. €80,000 - €120,000" className="bg-muted/50" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="jobType">Job Type</Label>
                <select id="jobType" value={newJobType} onChange={(e) => setNewJobType(e.target.value as JobType)} className="flex h-10 w-full rounded-md border border-input bg-muted/50 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <option value="Full-time">Full-time</option>
                  <option value="Part-time">Part-time</option>
                  <option value="Contract">Contract</option>
                  <option value="Freelance">Freelance</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Job Description <span className="text-destructive">*</span></Label>
                <textarea id="description" value={newDescription} onChange={(e) => setNewDescription(e.target.value)} placeholder="Describe the role, responsibilities, and requirements..." className="w-full px-3 py-2 border border-input rounded-md min-h-[150px] bg-muted/50 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
              </div>
              {error && <p className="text-sm text-destructive font-medium">{error}</p>}
              <Button onClick={handleCreateJob} className="w-full" disabled={isCreating}>
                {isCreating ? 'Publishing...' : 'Publish Job Posting'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
           <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 mt-6">
          {jobs.length === 0 ? (
            <div className="col-span-1 lg:col-span-2 xl:col-span-3 py-24 text-center border-2 border-dashed border-border rounded-xl">
              <div className="w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Briefcase className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-medium text-foreground">No active postings</h3>
              <p className="text-muted-foreground mt-2 max-w-sm mx-auto">Click "Create Job" to set up your first requisition and begin recruiting.</p>
            </div>
          ) : (
            jobs.map((job) => (
              <Card 
                key={job.id} 
                className="group flex flex-col overflow-hidden border-border/50 hover:border-primary/30 hover:shadow-xl transition-all duration-300 cursor-pointer"
                onClick={() => router.push(`/dashboard/jobs/${job.id}`)}
              >
                <CardContent className="p-0 flex-1 flex flex-col bg-card">
                  {/* Card Header Area */}
                  <div className="p-6 pb-4 bg-gradient-to-br from-muted/30 to-background border-b border-border/50 relative">
                    <div className="flex justify-between items-start mb-4">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/10">
                        <Briefcase className="w-6 h-6 text-primary" />
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                         <Button variant="ghost" size="icon" className="w-8 h-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={(e) => { e.stopPropagation(); handleDeleteJob(job.id); }}>
                            <Trash2 className="w-4 h-4" />
                         </Button>
                      </div>
                    </div>
                    <Link href={`/dashboard/jobs/${job.id}`} onClick={e => e.stopPropagation()} className="block group/title">
                      <h3 className="text-xl font-bold tracking-tight mb-2 group-hover/title:text-primary transition-colors line-clamp-1" title={job.title}>
                         {job.title}
                      </h3>
                    </Link>
                    <div className="flex flex-wrap items-center gap-2 mt-3">
                       <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-primary bg-primary/10 rounded-md">
                         <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                         {job.status}
                       </span>
                       <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-muted-foreground bg-muted rounded-md border border-border/50">
                          <Clock className="w-3 h-3" />
                          {job.job_type}
                       </span>
                    </div>
                  </div>

                  {/* Card Body Details */}
                  <div className="flex-1 p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      {job.location && (
                        <div className="flex items-start gap-2 text-sm text-muted-foreground">
                           <MapPin className="w-4 h-4 mt-0.5 text-foreground/40" />
                           <span className="line-clamp-2">{job.location}</span>
                        </div>
                      )}
                      {job.salary_range && (
                        <div className="flex items-start gap-2 text-sm text-muted-foreground">
                           <Banknote className="w-4 h-4 mt-0.5 text-foreground/40" />
                           <span className="line-clamp-2">{job.salary_range}</span>
                        </div>
                      )}
                    </div>
                    
                    <p className="text-sm text-foreground/70 line-clamp-3 leading-relaxed">
                      {job.description}
                    </p>
                  </div>

                  {/* Card Footer */}
                  <div className="mt-auto p-4 bg-muted/20 border-t border-border/50 flex gap-3">
                    <Link href={`/jobs/${job.id}`} onClick={e => e.stopPropagation()} className="flex-1">
                      <Button className="w-full bg-background hover:bg-primary hover:text-primary-foreground border border-border/50 hover:primary shadow-sm transition-all text-sm group-hover:shadow-md">
                        <Columns className="w-4 h-4 mr-2 text-primary group-hover:text-primary-foreground" />
                        Board
                      </Button>
                    </Link>
                    <Link href={`/dashboard/candidates?job=${job.id}`} onClick={e => e.stopPropagation()} className="flex-1">
                      <Button variant="secondary" className="w-full text-sm">
                        Candidates
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  )
}