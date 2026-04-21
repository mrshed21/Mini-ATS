'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/contexts/auth-context'
import { logActivityAuto } from '@/lib/audit'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Users, Mail, Shield, Trash2, UserPlus, ArrowRightLeft } from 'lucide-react'

interface TeamMember {
  id: string
  email: string
  full_name: string
  role: string
  created_at: string
}

interface CompanyJob {
  id: string
  title: string
  customer_id: string
  created_at: string
}

export default function TeamManagementPage() {
  const { companyId } = useAuth()
  const [members, setMembers] = useState<TeamMember[]>([])
  const [jobs, setJobs] = useState<CompanyJob[]>([])
  const [loading, setLoading] = useState(true)
  const [isInviteOpen, setIsInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteRole, setInviteRole] = useState<'customer' | 'company_admin'>('customer')
  const [inviteError, setInviteError] = useState('')
  const [inviteSending, setInviteSending] = useState(false)

  // Reassignment state
  const [isReassignOpen, setIsReassignOpen] = useState(false)
  const [reassignJobId, setReassignJobId] = useState('')
  const [reassignToUserId, setReassignToUserId] = useState('')
  const [reassignError, setReassignError] = useState('')

  const supabase = createClient()

  useEffect(() => {
    if (companyId) loadData()
  }, [companyId])

  async function loadData() {
    if (!companyId) return
    setLoading(true)
    const [membersRes, jobsRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, email, full_name, role, created_at')
        .eq('company_id', companyId)
        .order('created_at', { ascending: true }),
      supabase
        .from('jobs')
        .select('id, title, customer_id, created_at')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false }),
    ])
    setMembers(membersRes.data || [])
    setJobs(jobsRes.data || [])
    setLoading(false)
  }

  async function handleInvite() {
    setInviteError('')
    if (!inviteEmail) return setInviteError('Email is required')
    if (!companyId) return setInviteError('No company associated')

    setInviteSending(true)
    try {
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', inviteEmail)
        .single()

      if (existing) {
        const { error } = await supabase
          .from('profiles')
          .update({ company_id: companyId, role: inviteRole, full_name: inviteName || undefined })
          .eq('id', existing.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('profiles')
          .insert([{
            email: inviteEmail,
            full_name: inviteName || inviteEmail.split('@')[0],
            role: inviteRole,
            company_id: companyId,
          }])
        if (error) throw error
      }

      setInviteEmail('')
      setInviteName('')
      setInviteRole('customer')
      setIsInviteOpen(false)

      await logActivityAuto(supabase, {
        action: 'update',
        entityType: 'profile',
        entityName: inviteEmail,
        newValue: { role: inviteRole, action: existing ? 'updated' : 'added', company_id: companyId },
        companyId,
      })

      loadData()
    } catch (error) {
      setInviteError(error instanceof Error ? error.message : 'Failed to invite member')
    } finally {
      setInviteSending(false)
    }
  }

  async function handleRemove(id: string) {
    if (!confirm('Remove this member from the company?')) return
    const memberName = members.find(m => m.id === id)?.full_name
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ company_id: null, role: 'customer' })
        .eq('id', id)
      if (error) throw error
      await logActivityAuto(supabase, {
        action: 'update',
        entityType: 'profile',
        entityId: id,
        entityName: memberName,
        newValue: { action: 'removed_from_company' },
        companyId,
      })
      loadData()
    } catch {
      alert('Failed to remove member')
    }
  }

  async function handleReassignJob() {
    setReassignError('')
    if (!reassignJobId || !reassignToUserId) return setReassignError('Select a job and a team member')

    const jobTitle = jobs.find(j => j.id === reassignJobId)?.title
    const toName = members.find(m => m.id === reassignToUserId)?.full_name

    try {
      const { error } = await supabase
        .from('jobs')
        .update({ customer_id: reassignToUserId })
        .eq('id', reassignJobId)
      if (error) throw error
      await logActivityAuto(supabase, {
        action: 'job_reassigned',
        entityType: 'job',
        entityId: reassignJobId,
        entityName: jobTitle,
        newValue: { assigned_to: toName },
        companyId,
      })
      setIsReassignOpen(false)
      setReassignJobId('')
      setReassignToUserId('')
      loadData()
    } catch {
      setReassignError('Failed to reassign job')
    }
  }

  function openReassign(jobId: string) {
    setReassignJobId(jobId)
    setReassignToUserId('')
    setReassignError('')
    setIsReassignOpen(true)
  }

  const getMemberName = (userId: string) => {
    const member = members.find(m => m.id === userId)
    return member?.full_name || member?.email || 'Unknown'
  }

  const getRoleBadge = (memberRole: string) => {
    if (memberRole === 'company_admin') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md bg-emerald-500/10 text-emerald-500 uppercase tracking-wider">
          <Shield className="w-3 h-3" /> Admin
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md bg-blue-500/10 text-blue-500 uppercase tracking-wider">
        <Users className="w-3 h-3" /> Member
      </span>
    )
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Team Management</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Manage your company members, roles, and job assignments.
          </p>
        </div>
        <div className="flex gap-3">
          <Dialog open={isReassignOpen} onOpenChange={setIsReassignOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="h-10 hover:shadow-lg transition-all rounded-lg">
                <ArrowRightLeft className="w-4 h-4 mr-2" />
                Reassign Job
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Reassign Job</DialogTitle>
                <DialogDescription>Transfer a job to another team member.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label>Select Job</Label>
                  <select
                    value={reassignJobId}
                    onChange={(e) => setReassignJobId(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-muted/50 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">Choose a job...</option>
                    {jobs.map(job => (
                      <option key={job.id} value={job.id}>
                        {job.title} (Owner: {getMemberName(job.customer_id)})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Assign To</Label>
                  <select
                    value={reassignToUserId}
                    onChange={(e) => setReassignToUserId(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-muted/50 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">Choose a member...</option>
                    {members.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.full_name || m.email}
                      </option>
                    ))}
                  </select>
                </div>
                {reassignError && <p className="text-sm text-destructive font-medium">{reassignError}</p>}
                <Button onClick={handleReassignJob} className="w-full">
                  Transfer Job
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
            <DialogTrigger asChild>
              <Button className="h-10 hover:shadow-lg transition-all rounded-lg">
                <UserPlus className="w-4 h-4 mr-2" />
                Add Member
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Team Member</DialogTitle>
                <DialogDescription>Add a new member to your company.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    placeholder="John Doe"
                    className="bg-muted/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email <span className="text-destructive">*</span></Label>
                  <Input
                    id="email"
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="john@company.com"
                    className="bg-muted/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <select
                    id="role"
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as 'customer' | 'company_admin')}
                    className="flex h-10 w-full rounded-md border border-input bg-muted/50 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="customer">Member</option>
                    <option value="company_admin">Company Admin</option>
                  </select>
                </div>
                {inviteError && <p className="text-sm text-destructive font-medium">{inviteError}</p>}
                <Button onClick={handleInvite} className="w-full" disabled={inviteSending}>
                  {inviteSending ? 'Adding...' : 'Add Member'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
        </div>
      ) : (
        <>
          {/* Team Members */}
          <Card className="border-border/50 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-border/50 bg-muted/20">
              <h2 className="text-lg font-semibold">Team Members ({members.length})</h2>
            </div>
            {members.length === 0 ? (
              <CardContent className="py-24 text-center">
                <div className="w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-medium text-foreground">No team members</h3>
                <p className="text-muted-foreground mt-2 max-w-sm mx-auto">
                  Add members to your company to start collaborating.
                </p>
              </CardContent>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted/30 text-muted-foreground uppercase text-[10px] font-bold tracking-wider">
                    <tr>
                      <th className="px-6 py-4 rounded-tl-xl border-b border-border/50">Member</th>
                      <th className="px-6 py-4 border-b border-border/50">Role</th>
                      <th className="px-6 py-4 border-b border-border/50">Jobs</th>
                      <th className="px-6 py-4 border-b border-border/50">Joined</th>
                      <th className="px-6 py-4 border-b border-border/50 text-right rounded-tr-xl">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50 bg-card">
                    {members.map((member) => {
                      const memberJobs = jobs.filter(j => j.customer_id === member.id)
                      return (
                        <tr key={member.id} className="hover:bg-muted/10 transition-colors group">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-semibold text-primary border border-primary/20 shrink-0">
                                {(member.full_name || member.email || '?').charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <div className="font-medium text-foreground truncate">{member.full_name || 'No Name'}</div>
                                <div className="text-muted-foreground flex items-center gap-1.5 mt-1 text-xs truncate">
                                  <Mail className="w-3 h-3 shrink-0" /> <span className="truncate">{member.email}</span>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">{getRoleBadge(member.role)}</td>
                          <td className="px-6 py-4">
                            <span className="text-sm font-medium text-foreground">{memberJobs.length}</span>
                            <span className="text-xs text-muted-foreground ml-1">job{memberJobs.length !== 1 ? 's' : ''}</span>
                          </td>
                          <td className="px-6 py-4 text-muted-foreground">
                            {new Date(member.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                onClick={() => handleRemove(member.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Company Jobs with Quick Reassign */}
          <Card className="border-border/50 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-border/50 bg-muted/20">
              <h2 className="text-lg font-semibold">Company Jobs ({jobs.length})</h2>
            </div>
            {jobs.length === 0 ? (
              <CardContent className="py-16 text-center">
                <p className="text-muted-foreground">No jobs created yet.</p>
              </CardContent>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted/30 text-muted-foreground uppercase text-[10px] font-bold tracking-wider">
                    <tr>
                      <th className="px-6 py-4 border-b border-border/50">Job</th>
                      <th className="px-6 py-4 border-b border-border/50">Owner</th>
                      <th className="px-6 py-4 border-b border-border/50 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50 bg-card">
                    {jobs.map((job) => (
                      <tr key={job.id} className="hover:bg-muted/10 transition-colors group">
                        <td className="px-6 py-4 font-medium text-foreground">{job.title}</td>
                        <td className="px-6 py-4 text-muted-foreground">{getMemberName(job.customer_id)}</td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 text-xs text-muted-foreground hover:text-primary hover:bg-primary/10"
                              onClick={() => openReassign(job.id)}
                            >
                              <ArrowRightLeft className="w-3.5 h-3.5 mr-1" /> Reassign
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
        </>
      )}
    </div>
  )
}