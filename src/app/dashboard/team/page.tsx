'use client'

import { useState, useEffect, useCallback } from 'react'
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
import { Users, Mail, Shield, Trash2, UserPlus, ArrowRightLeft, Copy, Check, KeyRound, X } from 'lucide-react'

// ── Helper: Generate a strong random password ──────────────────
function generateStrongPassword(length = 14): string {
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const lower = 'abcdefghijklmnopqrstuvwxyz'
  const digits = '0123456789'
  const symbols = '!@#$%&*?'
  const all = upper + lower + digits + symbols

  // Guarantee at least one of each category
  const picks = [
    upper[Math.floor(Math.random() * upper.length)],
    lower[Math.floor(Math.random() * lower.length)],
    digits[Math.floor(Math.random() * digits.length)],
    symbols[Math.floor(Math.random() * symbols.length)],
  ]

  for (let i = picks.length; i < length; i++) {
    picks.push(all[Math.floor(Math.random() * all.length)])
  }

  // Shuffle
  for (let i = picks.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [picks[i], picks[j]] = [picks[j], picks[i]]
  }

  return picks.join('')
}

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
  const { companyId, profile, loading: authLoading } = useAuth()

  const [members, setMembers] = useState<TeamMember[]>([])
  const [jobs, setJobs] = useState<CompanyJob[]>([])
  const [loading, setLoading] = useState(true)

  // Invite state
  const [isInviteOpen, setIsInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteRole, setInviteRole] = useState<'customer' | 'company_admin'>('customer')
  const [invitePassword, setInvitePassword] = useState('')
  const [inviteError, setInviteError] = useState('')
  const [inviteSending, setInviteSending] = useState(false)
  const [showPasswordResult, setShowPasswordResult] = useState(false)
  const [passwordCopied, setPasswordCopied] = useState(false)

  // Reassign state
  const [isReassignOpen, setIsReassignOpen] = useState(false)
  const [reassignJobId, setReassignJobId] = useState('')
  const [reassignToUserId, setReassignToUserId] = useState('')
  const [reassignError, setReassignError] = useState('')
  const [reassignSending, setReassignSending] = useState(false)

  const supabase = createClient()

  // ── Load data — wait for auth ─────────────────────────────────
  const loadData = useCallback(async () => {
    if (authLoading || !companyId) return
    setLoading(true)

    const [membersRes, jobsRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, email, full_name, role, updated_at')
        .eq('company_id', companyId)
        .order('updated_at', { ascending: true }),
      supabase
        .from('jobs')
        .select('id, title, customer_id, created_at')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false }),
    ])

    if (membersRes.error) console.error('[Team] Members fetch error:', membersRes.error.message)
    if (jobsRes.error) console.error('[Team] Jobs fetch error:', jobsRes.error.message)

    const mappedMembers = (membersRes.data || []).map((m) => ({
      ...m,
      created_at: m.updated_at || new Date().toISOString(),
    }))

    setMembers(mappedMembers)
    setJobs(jobsRes.data || [])
    setLoading(false)
  }, [authLoading, companyId])

  useEffect(() => {
    loadData()
  }, [loadData])

  // ── Open invite dialog — generate password ────────────────────
  function openInviteDialog() {
    setInviteEmail('')
    setInviteName('')
    setInviteRole('customer')
    setInvitePassword(generateStrongPassword())
    setInviteError('')
    setShowPasswordResult(false)
    setPasswordCopied(false)
    setIsInviteOpen(true)
  }

  // ── Regenerate password ───────────────────────────────────────
  function regeneratePassword() {
    setInvitePassword(generateStrongPassword())
    setPasswordCopied(false)
  }

  // ── Copy password to clipboard ────────────────────────────────
  async function copyPassword() {
    try {
      await navigator.clipboard.writeText(invitePassword)
      setPasswordCopied(true)
      setTimeout(() => setPasswordCopied(false), 2000)
    } catch {
      // Fallback
      const el = document.createElement('textarea')
      el.value = invitePassword
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setPasswordCopied(true)
      setTimeout(() => setPasswordCopied(false), 2000)
    }
  }

  // ── Add Member (using signUp + trigger) ───────────────────────
  async function handleInvite() {
    setInviteError('')
    if (authLoading) return setInviteError('Authentication is still loading. Please wait.')
    if (!inviteEmail.trim()) return setInviteError('Email is required')
    if (!companyId) return setInviteError('No company associated with your account')
    if (!profile?.id) return setInviteError('Profile not loaded. Please refresh.')
    if (!invitePassword || invitePassword.length < 6) return setInviteError('Password must be at least 6 characters')

    setInviteSending(true)
    try {
      // ── Step 1: Check if email already exists in profiles ──
      const { data: existing, error: existingErr } = await supabase
        .from('profiles')
        .select('id, company_id, role')
        .eq('email', inviteEmail.trim().toLowerCase())
        .maybeSingle()

      if (existingErr) {
        console.error('[Team] Error checking existing profile:', existingErr.message)
      }

      if (existing) {
        // Profile exists — update their company + role
        if (existing.company_id && existing.company_id !== companyId) {
          throw new Error('This user already belongs to another company. They must leave it first.')
        }

        const { error } = await supabase
          .from('profiles')
          .update({
            company_id: companyId,
            role: inviteRole,
            ...(inviteName.trim() ? { full_name: inviteName.trim() } : {}),
          })
          .eq('id', existing.id)

        if (error) {
          console.error('[Team] Profile update error:', error.message)
          throw error
        }

        await logActivityAuto(supabase, {
          action: 'update',
          entityType: 'profile',
          entityName: inviteEmail.trim(),
          newValue: { role: inviteRole, action: 'updated', company_id: companyId },
          companyId,
        })

        // Success — reset and close
        setIsInviteOpen(false)
        loadData()
        return
      }

      // ── Step 2: Create auth user via temporary Supabase client ──
      // This avoids overwriting the current admin's session
      const { createClient: createSupabaseJs } = await import('@supabase/supabase-js')
      const tempSupabase = createSupabaseJs(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false } }
      )

      const { data: authData, error: authError } = await tempSupabase.auth.signUp({
        email: inviteEmail.trim().toLowerCase(),
        password: invitePassword,
        options: {
          data: {
            full_name: inviteName.trim() || inviteEmail.split('@')[0],
            role: inviteRole,
            company_id: companyId,
          },
        },
      })

      if (authError) {
        console.error('[Team] signUp error:', authError.message)
        if (
          authError.message.includes('already registered') ||
          authError.message.includes('already been registered') ||
          authError.message.includes('User already registered')
        ) {
          throw new Error('This email is already registered. Try updating the existing member instead.')
        }
        throw new Error(`Failed to create account: ${authError.message}`)
      }

      if (!authData.user) {
        throw new Error('User creation returned no data. Please try again.')
      }

      // ── Step 3: The trigger `handle_new_user` already created the profile ──
      // Update it to ensure correct data (the trigger may have set defaults)
      const { error: profileUpdateErr } = await supabase
        .from('profiles')
        .update({
          full_name: inviteName.trim() || inviteEmail.split('@')[0],
          role: inviteRole,
          company_id: companyId,
        })
        .eq('id', authData.user.id)

      if (profileUpdateErr) {
        console.error('[Team] Profile update after signUp error:', profileUpdateErr.message)
        throw new Error(`Account created but profile update failed: ${profileUpdateErr.message}`)
      }

      await logActivityAuto(supabase, {
        action: 'create',
        entityType: 'profile',
        entityId: authData.user.id,
        entityName: inviteEmail.trim(),
        newValue: { role: inviteRole, action: 'created', company_id: companyId },
        companyId,
      })

      // Show success with password info
      setShowPasswordResult(true)
      loadData()
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to add member'
      console.error('[Team] handleInvite error:', msg)
      setInviteError(msg)
    } finally {
      setInviteSending(false)
    }
  }

  // ── Success / info toast state ────────────────────────────────
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 5000)
    return () => clearTimeout(timer)
  }, [toast])

  // ── Remove member from company (soft-delete) ──────────────────
  async function handleRemove(memberId: string) {
    if (authLoading) return
    if (memberId === profile?.id) {
      setToast({ type: 'error', message: 'You cannot remove yourself from the company.' })
      return
    }
    if (!companyId || !profile?.id) {
      setToast({ type: 'error', message: 'Missing company or profile data. Please refresh.' })
      return
    }

    const member = members.find((m) => m.id === memberId)
    const memberName = member?.full_name || member?.email || 'this member'
    const memberJobs = jobs.filter((j) => j.customer_id === memberId)

    const confirmMsg = memberJobs.length > 0
      ? `Remove "${memberName}" from the company?\n\nThey own ${memberJobs.length} job(s). Those jobs will be transferred to you.\n\nThis action removes their company access.`
      : `Remove "${memberName}" from the company?\n\nThis action removes their company access.`

    if (!confirm(confirmMsg)) return

    try {
      // Step 1: Transfer jobs owned by this member to the current admin
      if (memberJobs.length > 0) {
        const { error: transferError } = await supabase
          .from('jobs')
          .update({ customer_id: profile.id })
          .in('id', memberJobs.map((j) => j.id))
          .eq('company_id', companyId)

        if (transferError) {
          console.error('[Team] Job transfer error:', transferError.message)
          throw new Error(`Failed to transfer jobs: ${transferError.message}`)
        }
        console.log(`[Team] Transferred ${memberJobs.length} job(s) from ${memberName} to admin`)
      }

      // Step 2: Soft-delete — remove company_id and reset role
      const { error } = await supabase
        .from('profiles')
        .update({ company_id: null, role: 'customer' })
        .eq('id', memberId)
      if (error) {
        console.error('[Team] Remove member error:', error.message)
        throw error
      }

      // Step 3: Log activity
      await logActivityAuto(supabase, {
        action: 'update',
        entityType: 'profile',
        entityId: memberId,
        entityName: memberName,
        newValue: { action: 'removed_from_company', jobs_transferred: memberJobs.length },
        companyId,
      })

      // Step 4: Show success + reload
      const msg = memberJobs.length > 0
        ? `"${memberName}" removed. ${memberJobs.length} job(s) transferred to you.`
        : `"${memberName}" has been removed from the company.`

      setToast({ type: 'success', message: msg })
      loadData()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to remove member.'
      console.error('[Team] handleRemove:', msg)
      setToast({ type: 'error', message: msg })
    }
  }

  // ── Reassign job to another team member ───────────────────────
  async function handleReassignJob() {
    setReassignError('')
    if (authLoading) return setReassignError('Authentication is still loading. Please wait.')
    if (!companyId) return setReassignError('No company associated with your account')
    if (!reassignJobId || !reassignToUserId) {
      return setReassignError('Please select both a job and a team member')
    }

    // Ensure the target user is in the same company
    const targetMember = members.find((m) => m.id === reassignToUserId)
    if (!targetMember) {
      return setReassignError('Selected member is not in your company')
    }

    const jobTitle = jobs.find((j) => j.id === reassignJobId)?.title
    const toName = targetMember.full_name || targetMember.email

    setReassignSending(true)
    try {
      const { error } = await supabase
        .from('jobs')
        .update({ customer_id: reassignToUserId })
        .eq('id', reassignJobId)
        .eq('company_id', companyId)

      if (error) {
        console.error('[Team] Reassign job error:', error.message)
        throw error
      }

      await logActivityAuto(supabase, {
        action: 'job_reassigned',
        entityType: 'job',
        entityId: reassignJobId,
        entityName: jobTitle,
        newValue: { assigned_to: toName, assigned_to_id: reassignToUserId },
        companyId,
      })

      setIsReassignOpen(false)
      setReassignJobId('')
      setReassignToUserId('')
      loadData()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to reassign job.'
      console.error('[Team] handleReassignJob:', msg)
      setReassignError(msg)
    } finally {
      setReassignSending(false)
    }
  }

  function openReassign(jobId: string) {
    setReassignJobId(jobId)
    setReassignToUserId('')
    setReassignError('')
    setIsReassignOpen(true)
  }

  const getMemberName = (userId: string) => {
    const member = members.find((m) => m.id === userId)
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

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 relative">
      {/* ── Toast Notification ── */}
      {toast && (
        <div
          className={`fixed top-6 right-6 z-50 max-w-md flex items-start gap-3 px-4 py-3 rounded-lg border shadow-lg transition-all animate-in slide-in-from-top-2 ${
            toast.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600'
              : 'bg-destructive/10 border-destructive/20 text-destructive'
          }`}
        >
          <span className="text-sm font-medium flex-1">{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            className="shrink-0 p-0.5 rounded hover:bg-black/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Team Management</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Manage your company members, roles, and job assignments.
          </p>
        </div>

        <div className="flex gap-3">
          {/* Reassign Job Dialog */}
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
                <DialogDescription>Transfer a job to another team member in your company.</DialogDescription>
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
                    {jobs.map((job) => (
                      <option key={job.id} value={job.id}>
                        {job.title} — Owner: {getMemberName(job.customer_id)}
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
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.full_name || m.email} ({m.role === 'company_admin' ? 'Admin' : 'Member'})
                      </option>
                    ))}
                  </select>
                </div>
                {reassignError && (
                  <p className="text-sm text-destructive font-medium">{reassignError}</p>
                )}
                <Button onClick={handleReassignJob} className="w-full" disabled={reassignSending || authLoading}>
                  {reassignSending ? 'Transferring...' : 'Transfer Job'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Add Member Dialog */}
          <Dialog open={isInviteOpen} onOpenChange={(open) => {
            if (!open && !showPasswordResult) {
              setIsInviteOpen(open)
            } else if (!open && showPasswordResult) {
              // Allow closing after password is shown
              setIsInviteOpen(false)
              setShowPasswordResult(false)
            }
          }}>
            <DialogTrigger asChild>
              <Button className="h-10 hover:shadow-lg transition-all rounded-lg" onClick={openInviteDialog}>
                <UserPlus className="w-4 h-4 mr-2" />
                Add Member
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Team Member</DialogTitle>
                <DialogDescription>
                  Create a new account for a team member in your company.
                </DialogDescription>
              </DialogHeader>

              {showPasswordResult ? (
                /* ── Success View — show credentials ── */
                <div className="grid gap-4 py-4">
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4 text-center">
                    <p className="text-emerald-500 font-semibold text-lg">✓ Member Added Successfully</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Share these credentials with the new member.
                    </p>
                  </div>

                  <div className="space-y-3 bg-muted/50 rounded-lg p-4 border border-border/50">
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground">Email</span>
                      <p className="text-sm font-medium font-mono">{inviteEmail}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground">Password</span>
                      <div className="flex items-center gap-2">
                        <code className="text-sm font-mono bg-background px-3 py-1.5 rounded border border-border/50 flex-1 select-all">
                          {invitePassword}
                        </code>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 shrink-0"
                          onClick={copyPassword}
                        >
                          {passwordCopied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground">Role</span>
                      <p className="text-sm font-medium">{inviteRole === 'company_admin' ? 'Company Admin' : 'Member'}</p>
                    </div>
                  </div>

                  <p className="text-xs text-amber-500 flex items-start gap-2">
                    <KeyRound className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>
                      Copy the password now. The member should change it after their first login.
                    </span>
                  </p>

                  <Button
                    onClick={() => {
                      setIsInviteOpen(false)
                      setShowPasswordResult(false)
                    }}
                    className="w-full"
                  >
                    Done
                  </Button>
                </div>
              ) : (
                /* ── Form View ── */
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="invite-name">Full Name</Label>
                    <Input
                      id="invite-name"
                      value={inviteName}
                      onChange={(e) => setInviteName(e.target.value)}
                      placeholder="John Doe"
                      className="bg-muted/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="invite-email">
                      Email <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="invite-email"
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="john@company.com"
                      className="bg-muted/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="invite-password">
                        Password <span className="text-destructive">*</span>
                      </Label>
                      <button
                        type="button"
                        onClick={regeneratePassword}
                        className="text-xs text-primary hover:underline"
                      >
                        Regenerate
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        id="invite-password"
                        type="text"
                        value={invitePassword}
                        onChange={(e) => setInvitePassword(e.target.value)}
                        className="bg-muted/50 font-mono text-sm"
                        placeholder="Auto-generated password"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-10 w-10 shrink-0"
                        onClick={copyPassword}
                        type="button"
                      >
                        {passwordCopied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Auto-generated strong password. You can change it or regenerate.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="invite-role">Role</Label>
                    <select
                      id="invite-role"
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value as 'customer' | 'company_admin')}
                      className="flex h-10 w-full rounded-md border border-input bg-muted/50 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="customer">Member</option>
                      <option value="company_admin">Company Admin</option>
                    </select>
                  </div>
                  {inviteError && (
                    <p className="text-sm text-destructive font-medium">{inviteError}</p>
                  )}
                  <Button onClick={handleInvite} className="w-full" disabled={inviteSending || authLoading}>
                    {inviteSending ? 'Creating Account...' : 'Add Member'}
                  </Button>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Content */}
      {loading || authLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      ) : (
        <>
          {/* Team Members Table */}
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
                      <th className="px-6 py-4 border-b border-border/50 text-right rounded-tr-xl">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50 bg-card">
                    {members.map((member) => {
                      const memberJobs = jobs.filter((j) => j.customer_id === member.id)
                      const isSelf = member.id === profile?.id
                      return (
                        <tr key={member.id} className="hover:bg-muted/10 transition-colors group">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-semibold text-primary border border-primary/20 shrink-0">
                                {(member.full_name || member.email || '?').charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <div className="font-medium text-foreground truncate">
                                  {member.full_name || 'No Name'}
                                  {isSelf && (
                                    <span className="ml-2 text-[10px] text-muted-foreground font-normal">(you)</span>
                                  )}
                                </div>
                                <div className="text-muted-foreground flex items-center gap-1.5 mt-1 text-xs truncate">
                                  <Mail className="w-3 h-3 shrink-0" />
                                  <span className="truncate">{member.email}</span>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">{getRoleBadge(member.role)}</td>
                          <td className="px-6 py-4">
                            <span className="text-sm font-medium text-foreground">
                              {memberJobs.length}
                            </span>
                            <span className="text-xs text-muted-foreground ml-1">
                              job{memberJobs.length !== 1 ? 's' : ''}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              {!isSelf && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => handleRemove(member.id)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
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

          {/* Company Jobs + Quick Reassign */}
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
                        <td className="px-6 py-4 text-muted-foreground">
                          {getMemberName(job.customer_id)}
                        </td>
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