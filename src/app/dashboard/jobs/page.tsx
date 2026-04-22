'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/contexts/auth-context'
import { useImpersonation, getEffectiveUserId, getEffectiveCompanyId } from '@/lib/contexts/impersonation-context'
import { logActivityAuto } from '@/lib/audit'
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
  Plus, MapPin, Banknote, Clock,
  Briefcase, Trash2, Columns, Users2, Pencil, Search
} from 'lucide-react'

export default function JobsPage() {
  const router = useRouter()
  const { role, companyId, profile, loading: authLoading } = useAuth()
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
  const [companies, setCompanies] = useState<{ id: string, name: string }[]>([])
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('')

  // Search & filter
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'closed'>('all')

  // Edit dialog
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editJobId, setEditJobId] = useState('')
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editLocation, setEditLocation] = useState('')
  const [editJobType, setEditJobType] = useState<JobType>('Full-time')
  const [editSalaryRange, setEditSalaryRange] = useState('')
  const [editStatus, setEditStatus] = useState<'active' | 'closed'>('active')
  const [editError, setEditError] = useState('')
  const [isUpdating, setIsUpdating] = useState(false)

  // Track logged-in user id for shared-job detection badge
  const [myUserId, setMyUserId] = useState<string | null>(null)

  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setMyUserId(user?.id ?? null))
    
    // Fetch companies if admin
    if (role === 'admin') {
      supabase.from('companies').select('id, name').order('name').then(({ data }) => {
        if (data) setCompanies(data)
      })
    }
  }, [role])

  useEffect(() => {
    if (companyId) setSelectedCompanyId(companyId)
  }, [companyId])

  // ── Load jobs — wait for auth to finish ──────────────────────
  const loadJobs = useCallback(async () => {
    // Never fetch until auth context is ready AND companyId is available
    if (authLoading || !companyId) return
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    const targetUserId = getEffectiveUserId(impersonating, impData, user?.id)
    const targetCompanyId = getEffectiveCompanyId(impersonating, impData, companyId)

    if (!targetUserId || !targetCompanyId) {
      setJobs([])
      setLoading(false)
      return
    }

    // Single flat query — no joins, explicit company_id filter (UUID)
    // This matches the new RLS policy using auth.jwt() for zero recursion
    let query = supabase
      .from('jobs')
      .select('id, title, description, location, job_type, salary_range, status, created_at, company_id, customer_id')

    // If not super admin, filter by company_id
    if (role !== 'admin') {
      const targetCompanyId = getEffectiveCompanyId(impersonating, impData, companyId)
      if (targetCompanyId) {
        query = query.eq('company_id', targetCompanyId)
      } else {
        setJobs([])
        setLoading(false)
        return
      }
    }

    const { data, error: fetchErr } = await query.order('created_at', { ascending: false })

    if (fetchErr) console.error('Jobs fetch error:', fetchErr.message)
    setJobs(data || [])
    setLoading(false)
  }, [authLoading, companyId, impersonating, impData, role])

  useEffect(() => {
    loadJobs()
  }, [loadJobs])

  // ── Create Job ────────────────────────────────────────────────
  async function handleCreateJob() {
    setError('')
    if (!newTitle.trim() || !newDescription.trim()) {
      return setError('Title and description are required')
    }

    // Guard: auth must be ready
    if (authLoading) return setError('Please wait — loading your profile...')

    setIsCreating(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated. Please log in again.')

      // Resolve effective IDs (supports impersonation)
      const effectiveUserId = getEffectiveUserId(impersonating, impData, user.id)
      if (!effectiveUserId) throw new Error('Unable to determine user identity.')

      // Use selected company (for admin) or context company
      const finalCompanyId = role === 'admin' ? selectedCompanyId : companyId

      if (!finalCompanyId) {
        throw new Error(
          'No company selected or associated with your account.'
        )
      }

      // Build payload — all required fields explicit, no undefined
      const jobPayload = {
        title: newTitle.trim(),
        description: newDescription.trim(),
        location: newLocation.trim() || null,
        job_type: newJobType,
        salary_range: newSalaryRange.trim() || null,
        status: 'active' as const,
        customer_id: effectiveUserId,   // ← UUID صريح
        company_id: finalCompanyId,      // ← UUID صريح
      }

      const { data: created, error: insertErr } = await supabase
        .from('jobs')
        .insert([jobPayload])
        .select()
        .single()

      if (insertErr) {
        const code = (insertErr as { code?: string }).code
        if (code === '23503') throw new Error('Foreign key error: check user/company setup.')
        if (code === '23502') throw new Error('A required field is missing.')
        if (code === '42501') throw new Error('Permission denied. Check your account role.')
        throw new Error(insertErr.message || 'Failed to create job posting.')
      }

      await logActivityAuto(supabase, {
        action: 'create',
        entityType: 'job',
        entityId: created?.id,
        entityName: newTitle.trim(),
        companyId: finalCompanyId,
        impersonating,
        impersonatedId: impData?.userId,
        impersonatedName: impData?.userName,
      })

      // Reset form
      setNewTitle(''); setNewDescription(''); setNewLocation('')
      setNewJobType('Full-time'); setNewSalaryRange('')
      setIsCreateDialogOpen(false)
      loadJobs()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create job')
    } finally {
      setIsCreating(false)
    }
  }

  // ── Filtered jobs ──────────────────────────────────────────────
  const filteredJobs = jobs.filter((job) => {
    const matchesStatus = statusFilter === 'all' || job.status === statusFilter
    const q = searchQuery.toLowerCase().trim()
    const matchesSearch =
      !q ||
      job.title.toLowerCase().includes(q) ||
      (job.description || '').toLowerCase().includes(q) ||
      (job.location || '').toLowerCase().includes(q) ||
      (job.salary_range || '').toLowerCase().includes(q)
    return matchesStatus && matchesSearch
  })

  // ── Open Edit Dialog ───────────────────────────────────────────
  function openEditDialog(job: Job) {
    setEditJobId(job.id)
    setEditTitle(job.title)
    setEditDescription(job.description || '')
    setEditLocation(job.location || '')
    setEditJobType(job.job_type || 'Full-time')
    setEditSalaryRange(job.salary_range || '')
    setEditStatus(job.status || 'active')
    setEditError('')
    setIsEditDialogOpen(true)
  }

  // ── Update Job ─────────────────────────────────────────────────
  async function handleUpdateJob() {
    setEditError('')
    if (!editTitle.trim()) return setEditError('Title is required')
    if (authLoading) return setEditError('Please wait — loading your profile...')
    if (!companyId) return setEditError('No company associated with your account.')

    setIsUpdating(true)
    try {
      const payload = {
        title: editTitle.trim(),
        description: editDescription.trim(),
        location: editLocation.trim() || null,
        job_type: editJobType,
        salary_range: editSalaryRange.trim() || null,
        status: editStatus,
      }

      const { error: updateErr } = await supabase
        .from('jobs')
        .update(payload)
        .eq('id', editJobId)
        .eq('company_id', companyId)

      if (updateErr) {
        console.error('[Jobs] Update error:', updateErr.message)
        throw updateErr
      }

      await logActivityAuto(supabase, {
        action: 'update',
        entityType: 'job',
        entityId: editJobId,
        entityName: editTitle.trim(),
        companyId,
        impersonating,
        impersonatedId: impData?.userId,
        impersonatedName: impData?.userName,
      })

      setIsEditDialogOpen(false)
      loadJobs()
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to update job')
    } finally {
      setIsUpdating(false)
    }
  }

  // ── Delete Job ────────────────────────────────────────────────
  async function handleDeleteJob(id: string, title?: string) {
    if (!confirm(`Are you sure you want to delete "${title || 'this job'}" and all associated candidates?`)) return
    try {
      const { error: delErr } = await supabase.from('jobs').delete().eq('id', id).eq('company_id', companyId!)
      if (delErr) throw delErr
      await logActivityAuto(supabase, {
        action: 'delete',
        entityType: 'job',
        entityId: id,
        entityName: title,
        companyId: companyId,
        impersonating,
        impersonatedId: impData?.userId,
        impersonatedName: impData?.userName,
      })
      loadJobs()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete job'
      console.error('[Jobs] Delete error:', msg)
      alert(msg)
    }
  }

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {role === 'company_admin' && !impersonating ? 'Company Jobs' : 'Job Postings'}
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              {role === 'company_admin' && !impersonating
                ? 'All jobs across your organization.'
                : 'Create, manage, and track your active recruitment campaigns.'}
            </p>
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
                <Label htmlFor="job-title">Job Title <span className="text-destructive">*</span></Label>
                <Input
                  id="job-title"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Senior Frontend Developer"
                  className="bg-muted/50"
                />
              </div>

              {role === 'admin' && (
                <div className="space-y-2">
                  <Label htmlFor="company-select">Assign to Company <span className="text-destructive">*</span></Label>
                  <select
                    id="company-select"
                    value={selectedCompanyId}
                    onChange={(e) => setSelectedCompanyId(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-muted/50 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">Select a company...</option>
                    {companies.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="job-location">Location</Label>
                  <Input
                    id="job-location"
                    value={newLocation}
                    onChange={(e) => setNewLocation(e.target.value)}
                    placeholder="e.g. Stockholm, Remote"
                    className="bg-muted/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="job-salary">Salary Range</Label>
                  <Input
                    id="job-salary"
                    value={newSalaryRange}
                    onChange={(e) => setNewSalaryRange(e.target.value)}
                    placeholder="e.g. €80,000 - €120,000"
                    className="bg-muted/50"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="job-type">Job Type</Label>
                <select
                  id="job-type"
                  value={newJobType}
                  onChange={(e) => setNewJobType(e.target.value as JobType)}
                  className="flex h-10 w-full rounded-md border border-input bg-muted/50 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="Full-time">Full-time</option>
                  <option value="Part-time">Part-time</option>
                  <option value="Contract">Contract</option>
                  <option value="Freelance">Freelance</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="job-desc">Job Description <span className="text-destructive">*</span></Label>
                <textarea
                  id="job-desc"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Describe the role, responsibilities, and requirements..."
                  className="w-full px-3 py-2 border border-input rounded-md min-h-[150px] bg-muted/50 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              {error && <p className="text-sm text-destructive font-medium">{error}</p>}
              <Button onClick={handleCreateJob} className="w-full" disabled={isCreating || authLoading}>
                {isCreating ? 'Publishing...' : 'Publish Job Posting'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search jobs by title, location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-muted/50 h-10"
            />
          </div>
          <div className="flex gap-2">
            {(['all', 'active', 'closed'] as const).map((s) => (
              <Button
                key={s}
                variant={statusFilter === s ? 'default' : 'outline'}
                size="sm"
                className="h-10 capitalize"
                onClick={() => setStatusFilter(s)}
              >
                {s === 'all' ? 'All' : s}
                {s !== 'all' && (
                  <span className="ml-1.5 text-xs opacity-60">
                    ({jobs.filter((j) => j.status === s).length})
                  </span>
                )}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Edit Job Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Job Posting</DialogTitle>
            <DialogDescription>Update the job details below.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-title">Job Title <span className="text-destructive">*</span></Label>
              <Input
                id="edit-title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="bg-muted/50"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-location">Location</Label>
                <Input
                  id="edit-location"
                  value={editLocation}
                  onChange={(e) => setEditLocation(e.target.value)}
                  className="bg-muted/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-salary">Salary Range</Label>
                <Input
                  id="edit-salary"
                  value={editSalaryRange}
                  onChange={(e) => setEditSalaryRange(e.target.value)}
                  className="bg-muted/50"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-type">Job Type</Label>
                <select
                  id="edit-type"
                  value={editJobType}
                  onChange={(e) => setEditJobType(e.target.value as JobType)}
                  className="flex h-10 w-full rounded-md border border-input bg-muted/50 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="Full-time">Full-time</option>
                  <option value="Part-time">Part-time</option>
                  <option value="Contract">Contract</option>
                  <option value="Freelance">Freelance</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-status">Status</Label>
                <select
                  id="edit-status"
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as 'active' | 'closed')}
                  className="flex h-10 w-full rounded-md border border-input bg-muted/50 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="active">Active</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-desc">Job Description <span className="text-destructive">*</span></Label>
              <textarea
                id="edit-desc"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-md min-h-[150px] bg-muted/50 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            {editError && <p className="text-sm text-destructive font-medium">{editError}</p>}
            <Button onClick={handleUpdateJob} className="w-full" disabled={isUpdating || authLoading}>
              {isUpdating ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Jobs Grid */}
      {loading || authLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 mt-6">
          {filteredJobs.length === 0 ? (
            <div className="col-span-1 lg:col-span-2 xl:col-span-3 py-24 text-center border-2 border-dashed border-border rounded-xl">
              <div className="w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Briefcase className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-medium text-foreground">
                {jobs.length === 0 ? 'No active postings' : 'No matching jobs'}
              </h3>
              <p className="text-muted-foreground mt-2 max-w-sm mx-auto">
                {jobs.length === 0
                  ? 'Click "Create Job" to set up your first requisition and begin recruiting.'
                  : 'Try adjusting your search or filter criteria.'}
              </p>
            </div>
          ) : (
            filteredJobs.map((job) => (
              <Card
                key={job.id}
                className="group flex flex-col overflow-hidden border-border/50 hover:border-primary/30 hover:shadow-xl transition-all duration-300 cursor-pointer"
                onClick={() => router.push(`/dashboard/jobs/${job.id}`)}
              >
                <CardContent className="p-0 flex-1 flex flex-col bg-card">
                  {/* Card Header */}
                  <div className="p-6 pb-4 bg-gradient-to-br from-muted/30 to-background border-b border-border/50 relative">
                    <div className="flex justify-between items-start mb-4">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/10">
                        <Briefcase className="w-6 h-6 text-primary" />
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-8 h-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
                          onClick={(e) => { e.stopPropagation(); openEditDialog(job) }}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-8 h-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          onClick={(e) => { e.stopPropagation(); handleDeleteJob(job.id, job.title) }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    <Link
                      href={`/dashboard/jobs/${job.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="block group/title"
                    >
                      <h3
                        className="text-xl font-bold tracking-tight mb-2 group-hover/title:text-primary transition-colors line-clamp-1"
                        title={job.title}
                      >
                        {job.title}
                      </h3>
                    </Link>
                    <div className="flex flex-wrap items-center gap-2 mt-3">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-primary bg-primary/10 rounded-md">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                        {job.status}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-muted-foreground bg-muted rounded-md border border-border/50">
                        <Clock className="w-3 h-3" />
                        {job.job_type}
                      </span>
                      {myUserId && job.customer_id !== myUserId && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-cyan-600 bg-cyan-500/10 rounded-md border border-cyan-500/20">
                          <Users2 className="w-3 h-3" /> Shared
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card Body */}
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
                    <Link
                      href={`/jobs/${job.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1"
                    >
                      <Button className="w-full bg-background hover:bg-primary hover:text-primary-foreground border border-border/50 shadow-sm transition-all text-sm group-hover:shadow-md">
                        <Columns className="w-4 h-4 mr-2 text-primary group-hover:text-primary-foreground" />
                        Board
                      </Button>
                    </Link>
                    <Link
                      href={`/dashboard/candidates?job=${job.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1"
                    >
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