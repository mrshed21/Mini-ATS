'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/contexts/auth-context'
import { useImpersonation, getEffectiveUserId, getEffectiveCompanyId } from '@/lib/contexts/impersonation-context'
import { Candidate, Job } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import Link from 'next/link'
import { Search, Mail, Filter, Trash2, Columns, Users, Plus, Pencil } from 'lucide-react'
import CandidateModal from '@/components/candidate-modal'

export default function AllCandidatesPage() {
  const { role, companyId, loading: authLoading } = useAuth()
  const { impersonating, data: impData } = useImpersonation()

  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedJob, setSelectedJob] = useState<string>('all')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCandidate, setEditingCandidate] = useState<Candidate | null>(null)

  const supabase = createClient()

  // ── Load candidates + jobs — wait for auth ────────────────────
  const loadData = useCallback(async () => {
    // Never fetch until auth context is fully loaded
    if (authLoading) return
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    const targetUserId = getEffectiveUserId(impersonating, impData, user?.id)
    const targetCompanyId = getEffectiveCompanyId(impersonating, impData, companyId ?? undefined)

    if (!targetUserId) {
      setCandidates([])
      setJobs([])
      setLoading(false)
      return
    }

    if (role === 'company_admin' && targetCompanyId && !impersonating) {
      // Company Admin: fetch ALL candidates for ALL jobs in their company
      // Uses join to filter only jobs that belong to this company
      const [candidatesRes, jobsRes] = await Promise.all([
        supabase
          .from('candidates')
          .select('*, job:jobs!inner(id, company_id, title)')
          .eq('job.company_id', targetCompanyId)
          .order('created_at', { ascending: false }),
        supabase
          .from('jobs')
          .select('*')
          .eq('company_id', targetCompanyId)
          .order('created_at', { ascending: false }),
      ])

      if (candidatesRes.error) console.error('Candidates error:', candidatesRes.error.message)
      if (jobsRes.error) console.error('Jobs error:', jobsRes.error.message)

      setCandidates(candidatesRes.data || [])
      setJobs(jobsRes.data || [])
    } else {
      // Customer or impersonated: own jobs + group-shared (RLS handles filtering)
      const [candidatesRes, jobsRes] = await Promise.all([
        supabase
          .from('candidates')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('jobs')
          .select('*')
          .eq('customer_id', targetUserId)
          .order('created_at', { ascending: false }),
      ])

      if (candidatesRes.error) console.error('Candidates error:', candidatesRes.error.message)
      if (jobsRes.error) console.error('Jobs error:', jobsRes.error.message)

      setCandidates(candidatesRes.data || [])
      setJobs(jobsRes.data || [])
    }

    setLoading(false)
  }, [authLoading, role, companyId, impersonating, impData])

  useEffect(() => {
    loadData()
  }, [loadData])

  // ── Delete candidate ──────────────────────────────────────────
  async function handleDeleteCandidate(id: string) {
    if (!confirm('Are you sure you want to delete this candidate?')) return
    try {
      const { error } = await supabase.from('candidates').delete().eq('id', id)
      if (error) throw error
      loadData()
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to delete candidate')
    }
  }

  function handleAddClick() {
    setEditingCandidate(null)
    setIsModalOpen(true)
  }

  function handleEditClick(candidate: Candidate) {
    setEditingCandidate(candidate)
    setIsModalOpen(true)
  }

  // ── Filters ───────────────────────────────────────────────────
  const filteredCandidates = candidates.filter((candidate) => {
    const matchesSearch =
      candidate.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      candidate.email.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesJob = selectedJob === 'all' || candidate.job_id === selectedJob
    return matchesSearch && matchesJob
  })

  const getJobTitle = (jobId: string) => {
    const job = jobs.find((j) => j.id === jobId)
    return job?.title || 'Unknown Job'
  }

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { bg: string; text: string; label: string }> = {
      applied: { bg: 'bg-blue-500/10', text: 'text-blue-500', label: 'Applied' },
      screening: { bg: 'bg-amber-500/10', text: 'text-amber-500', label: 'Screening' },
      interview: { bg: 'bg-purple-500/10', text: 'text-purple-500', label: 'Interview' },
      offered: { bg: 'bg-emerald-500/10', text: 'text-emerald-500', label: 'Offered' },
      rejected: { bg: 'bg-destructive/10', text: 'text-destructive', label: 'Rejected' },
    }
    const color = statusMap[status] || { bg: 'bg-muted', text: 'text-muted-foreground', label: status }
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md ${color.bg} ${color.text} uppercase tracking-wider`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${color.text.replace('text-', 'bg-')}`} />
        {color.label}
      </span>
    )
  }

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">
          {role === 'company_admin' && !impersonating ? 'Company Candidates' : 'Talent Pool'}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {role === 'company_admin' && !impersonating
            ? 'All candidates across company job postings.'
            : 'Browse, filter, and manage all your candidates across active jobs.'}
        </p>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-4 bg-card border border-border/50 p-4 rounded-xl shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-10 w-full bg-muted/50 border-transparent focus-visible:ring-1"
          />
        </div>

        <div className="relative min-w-[250px]">
          <Filter className="absolute left-3 top-3 h-4 w-4 text-muted-foreground z-10" />
          <Select value={selectedJob} onValueChange={setSelectedJob}>
            <SelectTrigger className="w-full h-10 pl-9 bg-muted/50 border-transparent">
              <SelectValue placeholder="Filter by job" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Jobs</SelectItem>
              {jobs.map((job) => (
                <SelectItem key={job.id} value={job.id}>
                  {job.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button onClick={handleAddClick} className="h-10 shrink-0">
          <Plus className="w-4 h-4 mr-2" /> Add Candidate
        </Button>
      </div>

      {/* Table or Spinner */}
      {loading || authLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      ) : (
        <Card className="border-border/50 shadow-sm overflow-hidden">
          {filteredCandidates.length === 0 ? (
            <CardContent className="py-24 text-center">
              <div className="w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-medium text-foreground">No candidates found</h3>
              <p className="text-muted-foreground mt-2 max-w-sm mx-auto">
                {candidates.length === 0
                  ? 'Your talent pool is currently empty. Jobs will appear here once candidates apply.'
                  : 'No candidates match your search criteria.'}
              </p>
            </CardContent>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/30 text-muted-foreground uppercase text-[10px] font-bold tracking-wider">
                  <tr>
                    <th className="px-6 py-4 rounded-tl-xl border-b border-border/50">Details</th>
                    <th className="px-6 py-4 border-b border-border/50">Applying For</th>
                    <th className="px-6 py-4 border-b border-border/50">Stage</th>
                    <th className="px-6 py-4 border-b border-border/50 text-right rounded-tr-xl">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50 bg-card">
                  {filteredCandidates.map((candidate) => (
                    <tr key={candidate.id} className="hover:bg-muted/10 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-semibold text-primary border border-primary/20 shrink-0">
                            {(candidate.full_name || candidate.email || '?').charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium text-foreground truncate">
                              {candidate.full_name || 'No Name'}
                            </div>
                            <div className="text-muted-foreground flex items-center gap-1.5 mt-1 text-xs truncate">
                              <Mail className="w-3 h-3 shrink-0" />
                              <span className="truncate">{candidate.email}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-foreground">{getJobTitle(candidate.job_id)}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Applied {new Date(candidate.created_at).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-6 py-4">{getStatusBadge(candidate.status)}</td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Link href={`/jobs/${candidate.job_id}`}>
                            <Button variant="outline" size="sm" className="h-8">
                              <Columns className="w-3.5 h-3.5 mr-1" /> Board
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
                            onClick={() => handleEditClick(candidate)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
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
      )}

      <CandidateModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSaved={loadData}
        candidate={editingCandidate}
      />
    </div>
  )
}