'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/contexts/auth-context'
import { logActivityAuto } from '@/lib/audit'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import {
  Users, Plus, Trash2, UserPlus, UserMinus, Briefcase, Link2, Link2Off, ShieldCheck,
} from 'lucide-react'

interface Group {
  id: string
  name: string
  company_id: string
  created_by: string
  created_at: string
}

interface GroupMember {
  id: string
  group_id: string
  user_id: string
  added_by: string
  added_at: string
  user_profile?: { full_name: string; email: string; role: string }
}

interface CompanyMember {
  id: string
  full_name: string
  email: string
  role: string
}

interface JobAccessRow {
  id: string
  job_id: string
  group_id: string
  job?: { title: string; status: string }
}

interface CompanyJob {
  id: string
  title: string
  status: string
  customer_id: string
}

export default function GroupsPage() {
  const { companyId, profile, loading: authLoading } = useAuth()
  const supabase = createClient()

  const [groups, setGroups] = useState<Group[]>([])
  const [members, setMembers] = useState<CompanyMember[]>([])
  const [jobs, setJobs] = useState<CompanyJob[]>([])
  const [groupMembers, setGroupMembers] = useState<Record<string, GroupMember[]>>({})
  const [jobAccess, setJobAccess] = useState<Record<string, JobAccessRow[]>>({})
  const [loading, setLoading] = useState(true)

  // Create group dialog
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [createError, setCreateError] = useState('')
  const [creating, setCreating] = useState(false)

  // Add member dialog
  const [addMemberGroupId, setAddMemberGroupId] = useState<string | null>(null)
  const [addMemberUserId, setAddMemberUserId] = useState('')
  const [addMemberError, setAddMemberError] = useState('')

  // Assign job dialog
  const [assignJobGroupId, setAssignJobGroupId] = useState<string | null>(null)
  const [assignJobId, setAssignJobId] = useState('')
  const [assignJobError, setAssignJobError] = useState('')

  // ── Load all data — wait for auth ────────────────────────────
  const loadAll = useCallback(async () => {
    if (authLoading || !companyId) return
    setLoading(true)

    const [groupsRes, membersRes, jobsRes] = await Promise.all([
      supabase
        .from('job_groups')
        .select('*')
        .eq('company_id', companyId)   // ← strict company filter
        .order('created_at'),
      supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .eq('company_id', companyId)   // ← only this company's members
        .order('full_name'),
      supabase
        .from('jobs')
        .select('id, title, status, customer_id')
        .eq('company_id', companyId)   // ← only this company's jobs
        .order('created_at', { ascending: false }),
    ])

    if (groupsRes.error) console.error('Groups error:', groupsRes.error.message)
    if (membersRes.error) console.error('Members error:', membersRes.error.message)
    if (jobsRes.error) console.error('Jobs error:', jobsRes.error.message)

    const fetchedGroups: Group[] = groupsRes.data || []
    setGroups(fetchedGroups)
    setMembers(membersRes.data || [])
    setJobs(jobsRes.data || [])

    if (fetchedGroups.length > 0) {
      const groupIds = fetchedGroups.map((g) => g.id)

      const [gMembersRes, jAccessRes] = await Promise.all([
        supabase
          .from('job_group_members')
          .select('*, user_profile:profiles!job_group_members_user_id_fkey(full_name, email, role)')
          .in('group_id', groupIds),
        supabase
          .from('job_access')
          .select('*, job:jobs(title, status)')
          .in('group_id', groupIds),
      ])

      const gmMap: Record<string, GroupMember[]> = {}
      const jaMap: Record<string, JobAccessRow[]> = {}

      ;(gMembersRes.data || []).forEach((m: GroupMember) => {
        if (!gmMap[m.group_id]) gmMap[m.group_id] = []
        gmMap[m.group_id].push(m)
      })
      ;(jAccessRes.data || []).forEach((a: JobAccessRow) => {
        if (!jaMap[a.group_id]) jaMap[a.group_id] = []
        jaMap[a.group_id].push(a)
      })

      setGroupMembers(gmMap)
      setJobAccess(jaMap)
    }

    setLoading(false)
  }, [authLoading, companyId])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  // ── Create Group ─────────────────────────────────────────────
  async function handleCreateGroup() {
    setCreateError('')
    if (!newGroupName.trim()) return setCreateError('Group name is required')
    if (!companyId || !profile?.id) return setCreateError('Profile not loaded. Please refresh.')

    setCreating(true)
    try {
      const { data, error } = await supabase
        .from('job_groups')
        .insert([{
          name: newGroupName.trim(),
          company_id: companyId,     // ← explicit UUID
          created_by: profile.id,   // ← explicit UUID
        }])
        .select()
        .single()

      if (error) throw error

      await logActivityAuto(supabase, {
        action: 'create',
        entityType: 'group',
        entityId: data.id,
        entityName: data.name,
        companyId,
      })

      setNewGroupName('')
      setIsCreateOpen(false)
      loadAll()
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create group')
    } finally {
      setCreating(false)
    }
  }

  // ── Delete Group ─────────────────────────────────────────────
  async function handleDeleteGroup(group: Group) {
    if (!confirm(`Delete group "${group.name}"? This will remove all member links and job access.`)) return

    // Safety: only delete groups in this company
    if (group.company_id !== companyId) {
      alert('Cannot delete a group from another company.')
      return
    }

    try {
      const { error } = await supabase
        .from('job_groups')
        .delete()
        .eq('id', group.id)
        .eq('company_id', companyId)   // ← double safety

      if (error) throw error

      await logActivityAuto(supabase, {
        action: 'delete',
        entityType: 'group',
        entityId: group.id,
        entityName: group.name,
        companyId,
      })

      loadAll()
    } catch {
      alert('Failed to delete group')
    }
  }

  // ── Add Member to Group ──────────────────────────────────────
  async function handleAddMember(groupId: string) {
    setAddMemberError('')
    if (!addMemberUserId) return setAddMemberError('Select a member')
    if (!profile?.id) return setAddMemberError('Profile not loaded. Please refresh.')

    // Verify the selected user is in this company
    const isCompanyMember = members.some((m) => m.id === addMemberUserId)
    if (!isCompanyMember) {
      return setAddMemberError('Selected user is not a member of your company.')
    }

    try {
      const { error } = await supabase
        .from('job_group_members')
        .insert([{
          group_id: groupId,              // ← explicit UUID
          user_id: addMemberUserId,       // ← explicit UUID (validated above)
          added_by: profile.id,           // ← explicit UUID
        }])

      if (error) {
        if (error.code === '23505') throw new Error('Member already in this group')
        throw error
      }

      const memberName = members.find((m) => m.id === addMemberUserId)?.full_name || addMemberUserId
      const groupName = groups.find((g) => g.id === groupId)?.name

      await logActivityAuto(supabase, {
        action: 'update',
        entityType: 'group',
        entityId: groupId,
        entityName: groupName,
        newValue: { added_member: memberName },
        companyId,
      })

      setAddMemberGroupId(null)
      setAddMemberUserId('')
      loadAll()
    } catch (err) {
      setAddMemberError(err instanceof Error ? err.message : 'Failed to add member')
    }
  }

  // ── Remove Member from Group ─────────────────────────────────
  async function handleRemoveMember(memberId: string, groupId: string, userName: string) {
    if (!confirm(`Remove "${userName}" from this group?`)) return
    try {
      const { error } = await supabase
        .from('job_group_members')
        .delete()
        .eq('id', memberId)
      if (error) throw error

      const groupName = groups.find((g) => g.id === groupId)?.name
      await logActivityAuto(supabase, {
        action: 'update',
        entityType: 'group',
        entityId: groupId,
        entityName: groupName,
        newValue: { removed_member: userName },
        companyId,
      })

      loadAll()
    } catch {
      alert('Failed to remove member')
    }
  }

  // ── Assign Job to Group ──────────────────────────────────────
  async function handleAssignJob(groupId: string) {
    setAssignJobError('')
    if (!assignJobId) return setAssignJobError('Select a job')
    if (!profile?.id) return setAssignJobError('Profile not loaded. Please refresh.')

    // Verify the selected job belongs to this company
    const isCompanyJob = jobs.some((j) => j.id === assignJobId)
    if (!isCompanyJob) {
      return setAssignJobError('Selected job does not belong to your company.')
    }

    try {
      const { error } = await supabase
        .from('job_access')
        .insert([{
          job_id: assignJobId,    // ← validated UUID
          group_id: groupId,      // ← explicit UUID
          granted_by: profile.id, // ← explicit UUID
        }])

      if (error) {
        if (error.code === '23505') throw new Error('Job already linked to this group')
        throw error
      }

      const jobTitle = jobs.find((j) => j.id === assignJobId)?.title
      const groupName = groups.find((g) => g.id === groupId)?.name

      await logActivityAuto(supabase, {
        action: 'group_assigned',
        entityType: 'job_access',
        entityId: assignJobId,
        entityName: jobTitle,
        newValue: { group: groupName },
        companyId,
      })

      setAssignJobGroupId(null)
      setAssignJobId('')
      loadAll()
    } catch (err) {
      setAssignJobError(err instanceof Error ? err.message : 'Failed to assign job')
    }
  }

  // ── Revoke Job Access ────────────────────────────────────────
  async function handleRevokeJob(accessId: string, groupId: string, jobTitle?: string) {
    if (!confirm('Remove job access from this group?')) return
    try {
      const { error } = await supabase.from('job_access').delete().eq('id', accessId)
      if (error) throw error

      const groupName = groups.find((g) => g.id === groupId)?.name
      await logActivityAuto(supabase, {
        action: 'update',
        entityType: 'job_access',
        entityId: groupId,
        entityName: groupName,
        newValue: { removed_job: jobTitle },
        companyId,
      })

      loadAll()
    } catch {
      alert('Failed to remove job access')
    }
  }

  // ── Helpers ──────────────────────────────────────────────────
  function getAvailableMembers(groupId: string) {
    const existing = (groupMembers[groupId] || []).map((m) => m.user_id)
    return members.filter((m) => !existing.includes(m.id))
  }

  function getAvailableJobs(groupId: string) {
    const existing = (jobAccess[groupId] || []).map((a) => a.job_id)
    return jobs.filter((j) => !existing.includes(j.id))
  }

  // ── Render ────────────────────────────────────────────────────
  if (loading || authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Job Groups</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Create groups to give multiple team members shared access to the same jobs.
          </p>
        </div>

        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="h-10 rounded-lg">
              <Plus className="w-4 h-4 mr-2" /> New Group
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Job Group</DialogTitle>
              <DialogDescription>
                A group allows multiple team members to collaborate on the same job postings.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="group-name">
                  Group Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="group-name"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateGroup()}
                  placeholder="e.g. Engineering Team, HR Squad..."
                  className="bg-muted/50"
                />
              </div>
              {createError && (
                <p className="text-sm text-destructive font-medium">{createError}</p>
              )}
              <Button onClick={handleCreateGroup} disabled={creating || !companyId} className="w-full">
                {creating ? 'Creating...' : 'Create Group'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Groups List */}
      {groups.length === 0 ? (
        <Card className="border-border/50">
          <CardContent className="py-24 text-center">
            <div className="w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-medium">No groups yet</h3>
            <p className="text-muted-foreground mt-2 max-w-sm mx-auto">
              Create a group to allow multiple team members to access the same job postings.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => {
            const gMembers = groupMembers[group.id] || []
            const gAccess = jobAccess[group.id] || []
            const availableMembers = getAvailableMembers(group.id)
            const availableJobs = getAvailableJobs(group.id)

            return (
              <Card key={group.id} className="border-border/50 shadow-sm overflow-hidden">
                {/* Group Header */}
                <div className="px-6 py-4 bg-muted/20 border-b border-border/50 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
                      <ShieldCheck className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <h2 className="text-base font-semibold">{group.name}</h2>
                      <p className="text-xs text-muted-foreground">
                        {gMembers.length} member{gMembers.length !== 1 ? 's' : ''} ·{' '}
                        {gAccess.length} job{gAccess.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    onClick={() => handleDeleteGroup(group)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>

                <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border/50">
                  {/* Members Column */}
                  <div className="p-5 space-y-3">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                        Members
                      </h3>
                      <Dialog
                        open={addMemberGroupId === group.id}
                        onOpenChange={(open) => {
                          setAddMemberGroupId(open ? group.id : null)
                          setAddMemberUserId('')
                          setAddMemberError('')
                        }}
                      >
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            disabled={availableMembers.length === 0}
                          >
                            <UserPlus className="w-3 h-3 mr-1" /> Add
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Add Member to &quot;{group.name}&quot;</DialogTitle>
                            <DialogDescription>
                              Select a team member to add to this group.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="grid gap-4 py-4">
                            <div className="space-y-2">
                              <Label>Team Member</Label>
                              <select
                                value={addMemberUserId}
                                onChange={(e) => setAddMemberUserId(e.target.value)}
                                className="flex h-10 w-full rounded-md border border-input bg-muted/50 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              >
                                <option value="">Choose a member...</option>
                                {availableMembers.map((m) => (
                                  <option key={m.id} value={m.id}>
                                    {m.full_name || m.email} ({m.role})
                                  </option>
                                ))}
                              </select>
                            </div>
                            {addMemberError && (
                              <p className="text-sm text-destructive">{addMemberError}</p>
                            )}
                            <Button onClick={() => handleAddMember(group.id)} className="w-full">
                              Add to Group
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>

                    {gMembers.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">No members yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {gMembers.map((m) => (
                          <div
                            key={m.id}
                            className="flex items-center justify-between group p-2 rounded-lg hover:bg-muted/30 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-xs font-semibold text-primary">
                                {(m.user_profile?.full_name || m.user_profile?.email || '?').charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="text-sm font-medium leading-none">
                                  {m.user_profile?.full_name || 'Unknown'}
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {m.user_profile?.email}
                                </p>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                              onClick={() =>
                                handleRemoveMember(m.id, group.id, m.user_profile?.full_name || 'Member')
                              }
                            >
                              <UserMinus className="w-3 h-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Jobs Column */}
                  <div className="p-5 space-y-3">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                        Job Access
                      </h3>
                      <Dialog
                        open={assignJobGroupId === group.id}
                        onOpenChange={(open) => {
                          setAssignJobGroupId(open ? group.id : null)
                          setAssignJobId('')
                          setAssignJobError('')
                        }}
                      >
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            disabled={availableJobs.length === 0}
                          >
                            <Link2 className="w-3 h-3 mr-1" /> Link Job
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Link Job to &quot;{group.name}&quot;</DialogTitle>
                            <DialogDescription>
                              All group members will be able to view and manage candidates for this
                              job.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="grid gap-4 py-4">
                            <div className="space-y-2">
                              <Label>Job Posting</Label>
                              <select
                                value={assignJobId}
                                onChange={(e) => setAssignJobId(e.target.value)}
                                className="flex h-10 w-full rounded-md border border-input bg-muted/50 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              >
                                <option value="">Choose a job...</option>
                                {availableJobs.map((j) => (
                                  <option key={j.id} value={j.id}>
                                    {j.title} ({j.status})
                                  </option>
                                ))}
                              </select>
                            </div>
                            {assignJobError && (
                              <p className="text-sm text-destructive">{assignJobError}</p>
                            )}
                            <Button
                              onClick={() => handleAssignJob(group.id)}
                              className="w-full"
                            >
                              Grant Access
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>

                    {gAccess.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">No jobs linked yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {gAccess.map((a) => (
                          <div
                            key={a.id}
                            className="flex items-center justify-between group p-2 rounded-lg hover:bg-muted/30 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                                <Briefcase className="w-3 h-3 text-blue-500" />
                              </div>
                              <div>
                                <p className="text-sm font-medium leading-none">
                                  {a.job?.title || 'Unknown Job'}
                                </p>
                                <p
                                  className={`text-xs mt-0.5 ${
                                    a.job?.status === 'active'
                                      ? 'text-emerald-500'
                                      : 'text-muted-foreground'
                                  }`}
                                >
                                  {a.job?.status}
                                </p>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                              onClick={() => handleRevokeJob(a.id, group.id, a.job?.title)}
                            >
                              <Link2Off className="w-3 h-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
