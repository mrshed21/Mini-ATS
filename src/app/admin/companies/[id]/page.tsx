'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useImpersonation } from '@/lib/contexts/impersonation-context'
import { Profile, Company, Job, Candidate, CandidateStatus } from '@/lib/types'
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
  Building2, Users, Search, Plus, Trash2, Pencil,
  Mail, ArrowLeft, Briefcase, Globe, MapPin, Building,
  ChevronDown, ChevronUp, CheckCircle, ShieldAlert
} from 'lucide-react'

export default function CompanyDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const { setImpersonation } = useImpersonation()
  const companyId = params.id as string

  const [company, setCompany] = useState<Company | null>(null)
  const [users, setUsers] = useState<Profile[]>([])
  const [jobs, setJobs] = useState<Job[]>([])
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [loading, setLoading] = useState(true)

  const [activeSection, setActiveSection] = useState<string | null>('users')

  // Edit Company State
  const [isEditCompanyOpen, setIsEditCompanyOpen] = useState(false)
  const [editCompName, setEditCompName] = useState('')
  const [editCompWeb, setEditCompWeb] = useState('')
  const [editCompInd, setEditCompInd] = useState('')
  const [editCompLoc, setEditCompLoc] = useState('')
  const [editCompDesc, setEditCompDesc] = useState('')
  const [editCompSize, setEditCompSize] = useState('1-10')
  const [compError, setCompError] = useState('')

  // User Modals State
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false)
  const [isEditUserOpen, setIsEditUserOpen] = useState(false)
  const [editingUserId, setEditingUserId] = useState('')
  
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newFullName, setNewFullName] = useState('')
  const [newRole, setNewRole] = useState<'admin' | 'customer'>('customer')
  const [userError, setUserError] = useState('')
  const [isSavingUser, setIsSavingUser] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    loadData()
  }, [companyId])

  async function loadData() {
    setLoading(true)
    
    // 1. Fetch Company
    const { data: cData } = await supabase.from('companies').select('*').eq('id', companyId).single()
    if (cData) setCompany(cData as Company)

    // 2. Fetch Users associated with Company
    const { data: uData } = await supabase.from('profiles').select('*').eq('company_id', companyId)
    setUsers((uData as Profile[]) || [])

    // 3. Fetch Jobs and Candidates if users exist
    if (uData && uData.length > 0) {
      const userIds = uData.map(u => u.id)
      const { data: jData } = await supabase.from('jobs').select('*').in('customer_id', userIds)
      setJobs((jData as Job[]) || [])

      if (jData && jData.length > 0) {
        const jobIds = jData.map(j => j.id)
        const { data: candData } = await supabase.from('candidates').select('*').in('job_id', jobIds)
        setCandidates((candData as Candidate[]) || [])
      } else {
        setCandidates([])
      }
    } else {
      setJobs([])
      setCandidates([])
    }
    
    setLoading(false)
  }

  function openEditCompany() {
    if (!company) return
    setEditCompName(company.name)
    setEditCompWeb(company.website_url || '')
    setEditCompInd(company.industry || '')
    setEditCompLoc(company.location || '')
    setEditCompDesc(company.description || '')
    setEditCompSize(company.company_size || '1-10')
    setCompError('')
    setIsEditCompanyOpen(true)
  }

  async function handleUpdateCompany() {
    setCompError('')
    if (!editCompName) return setCompError('Company name is required')

    try {
      const { error } = await supabase.from('companies').update({
        name: editCompName,
        website_url: editCompWeb || null,
        industry: editCompInd || null,
        location: editCompLoc || null,
        description: editCompDesc || null,
        company_size: editCompSize || null
      }).eq('id', companyId)

      if (error) throw error
      setIsEditCompanyOpen(false)
      loadData()
    } catch (e: any) {
      setCompError(e?.message || 'Failed to update company')
    }
  }

  function openCreateUser() {
    setNewEmail('')
    setNewPassword('')
    setNewFullName('')
    setNewRole('customer')
    setUserError('')
    setIsCreateUserOpen(true)
  }

  function openEditUser(user: Profile) {
    setEditingUserId(user.id)
    setNewFullName(user.full_name || '')
    setNewRole(user.role)
    setUserError('')
    setIsEditUserOpen(true)
  }

  async function handleCreateUser() {
    setUserError('')
    if (!newEmail || !newPassword) return setUserError('Email and password required')

    setIsSavingUser(true)
    try {
      const { createClient: createSupabaseJs } = await import('@supabase/supabase-js')
      const tempSupabase = createSupabaseJs(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false } }
      )

      const { data: authData, error: authError } = await tempSupabase.auth.signUp({
        email: newEmail,
        password: newPassword,
        options: { data: { role: newRole } },
      })

      if (authError) throw authError

      if (authData.user) {
        const { error: profileError } = await supabase.from('profiles').update({
          email: newEmail,
          role: newRole,
          full_name: newFullName,
          company_id: companyId
        }).eq('id', authData.user.id)
        
        if (profileError) throw profileError
        
        setIsCreateUserOpen(false)
        loadData()
      }
    } catch (e: any) {
      setUserError(e?.message || 'Failed to create user')
    } finally {
      setIsSavingUser(false)
    }
  }

  async function handleUpdateUser() {
    setUserError('')
    setIsSavingUser(true)
    try {
      const { error } = await supabase.from('profiles').update({
        role: newRole,
        full_name: newFullName,
        company_id: companyId 
      }).eq('id', editingUserId)

      if (error) throw error
      setIsEditUserOpen(false)
      loadData()
    } catch (e: any) {
      setUserError(e?.message || 'Failed to update user')
    } finally {
      setIsSavingUser(false)
    }
  }

  async function handleDeleteProfile(id: string) {
    if (!confirm('Are you sure? This action cannot be undone.')) return
    try {
      await supabase.from('profiles').delete().eq('id', id)
      loadData()
    } catch (error) {
      alert('Failed to delete user')
    }
  }

  const getStatusBadge = (status: CandidateStatus) => {
    const statusMap: Record<CandidateStatus, { bg: string, text: string, label: string }> = {
      applied: { bg: 'bg-blue-500/10', text: 'text-blue-500', label: 'Applied' },
      screening: { bg: 'bg-amber-500/10', text: 'text-amber-500', label: 'Screening' },
      interview: { bg: 'bg-purple-500/10', text: 'text-purple-500', label: 'Interview' },
      offered: { bg: 'bg-emerald-500/10', text: 'text-emerald-500', label: 'Offered' },
      rejected: { bg: 'bg-destructive/10', text: 'text-destructive', label: 'Rejected' },
    }
    const color = statusMap[status] || { bg: 'bg-muted', text: 'text-muted-foreground', label: status };
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

  if (!company) {
    return <div className="p-8 text-center text-muted-foreground">Company not found.</div>
  }

  const toggleSection = (section: string) => {
     setActiveSection(prev => prev === section ? null : section)
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" onClick={() => router.push('/admin/customers')} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Companies
        </Button>
        <Button onClick={openEditCompany} variant="outline" className="shadow-sm">
          <Pencil className="w-4 h-4 mr-2" /> Edit Company
        </Button>
      </div>

      <Card className="border-border/50 shadow-sm overflow-hidden mb-8">
         <div className="p-8 bg-card relative">
            <div className="flex justify-between items-start">
               <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                     <Building2 className="w-8 h-8 text-primary" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">{company.name}</h1>
                    <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-muted-foreground">
                       {company.location && <span className="flex items-center gap-1"><MapPin className="w-4 h-4" />{company.location}</span>}
                       {company.industry && <span className="flex items-center gap-1"><Building className="w-4 h-4" />{company.industry}</span>}
                       {company.website_url && <a href={company.website_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-primary hover:underline"><Globe className="w-4 h-4" />Website</a>}
                       {company.company_size && <span className="flex items-center gap-1"><Users className="w-4 h-4" />{company.company_size} emp.</span>}
                    </div>
                  </div>
               </div>
            </div>
            {company.description && (
               <div className="mt-6 pt-6 border-t border-border/50">
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{company.description}</p>
               </div>
            )}
         </div>
      </Card>

      {/* Accordions */}
      <div className="space-y-4">
        
        {/* Users Section */}
        <Card className="border border-border/50 shadow-sm overflow-hidden bg-card">
          <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-muted/10 transition-colors" onClick={() => toggleSection('users')}>
             <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-lg">System Users</h3>
                <span className="ml-2 px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-xs font-semibold">{users.length}</span>
             </div>
             <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                {activeSection === 'users' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
             </Button>
          </div>
          {activeSection === 'users' && (
            <div className="p-4 border-t border-border/50 bg-background/50">
               <div className="flex justify-end mb-4">
                 <Button size="sm" onClick={openCreateUser}><Plus className="w-4 h-4 mr-2" /> Add User</Button>
               </div>
               
               {users.length === 0 ? (
                 <p className="text-sm text-center text-muted-foreground py-8">No users associated with this company yet.</p>
               ) : (
                 <div className="overflow-x-auto rounded-lg border border-border/50">
                   <table className="w-full text-sm text-left">
                     <thead className="bg-muted/30 text-muted-foreground uppercase text-[10px] font-bold tracking-wider">
                       <tr>
                         <th className="px-4 py-3">User</th>
                         <th className="px-4 py-3">Role</th>
                         <th className="px-4 py-3 text-right">Actions</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y divide-border/50 bg-card">
                       {users.map((profile) => (
                         <tr key={profile.id} className="hover:bg-muted/20">
                           <td className="px-4 py-3">
                             <div className="font-semibold">{profile.full_name || 'No Name'}</div>
                             <div className="text-muted-foreground text-xs">{profile.email}</div>
                           </td>
                           <td className="px-4 py-3">
                             {profile.role === 'admin' ? (
                               <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive"><ShieldAlert className="w-3 h-3"/> Admin</span>
                             ) : (
                               <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600"><CheckCircle className="w-3 h-3"/> Customer</span>
                             )}
                           </td>
                           <td className="px-4 py-3 text-right">
                             <Button variant="ghost" size="sm" className="mr-2 h-8 text-muted-foreground hover:text-amber-600 hover:bg-amber-500/10" onClick={() => {
                                setImpersonation({
                                  userId: profile.id,
                                  userEmail: profile.email,
                                  userName: profile.full_name || 'User',
                                  companyId: profile.company_id || ''
                                })
                                router.push('/dashboard')
                             }}>
                               Login as
                             </Button>
                             <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-primary" onClick={() => openEditUser(profile)}>
                                <Pencil className="w-3.5 h-3.5" />
                             </Button>
                             <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-destructive" onClick={() => handleDeleteProfile(profile.id)}>
                                <Trash2 className="w-3.5 h-3.5" />
                             </Button>
                           </td>
                         </tr>
                       ))}
                     </tbody>
                   </table>
                 </div>
               )}
            </div>
          )}
        </Card>

        {/* Jobs Section */}
        <Card className="border border-border/50 shadow-sm overflow-hidden bg-card">
          <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-muted/10 transition-colors" onClick={() => toggleSection('jobs')}>
             <div className="flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-lg">Active Jobs</h3>
                <span className="ml-2 px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-xs font-semibold">{jobs.length}</span>
             </div>
             <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                {activeSection === 'jobs' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
             </Button>
          </div>
          {activeSection === 'jobs' && (
            <div className="p-4 border-t border-border/50 bg-background/50">
               {jobs.length === 0 ? (
                 <p className="text-sm text-center text-muted-foreground py-8">No jobs created by this company yet.</p>
               ) : (
                 <div className="overflow-x-auto rounded-lg border border-border/50">
                   <table className="w-full text-sm text-left">
                     <thead className="bg-muted/30 text-muted-foreground uppercase text-[10px] font-bold tracking-wider">
                       <tr>
                         <th className="px-4 py-3">Job Title</th>
                         <th className="px-4 py-3">Location</th>
                         <th className="px-4 py-3">Status</th>
                         <th className="px-4 py-3">Created</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y divide-border/50 bg-card">
                       {jobs.map((job) => (
                         <tr key={job.id} className="hover:bg-muted/20">
                           <td className="px-4 py-3 font-semibold">{job.title}</td>
                           <td className="px-4 py-3 text-muted-foreground text-xs">{job.location || '-'}</td>
                           <td className="px-4 py-3">
                             <span className={`px-2 py-0.5 text-[10px] rounded uppercase font-bold tracking-wider ${job.status === 'active' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground'}`}>
                               {job.status}
                             </span>
                           </td>
                           <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(job.created_at).toLocaleDateString()}</td>
                         </tr>
                       ))}
                     </tbody>
                   </table>
                 </div>
               )}
            </div>
          )}
        </Card>

        {/* Candidates Section */}
        <Card className="border border-border/50 shadow-sm overflow-hidden bg-card">
          <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-muted/10 transition-colors" onClick={() => toggleSection('candidates')}>
             <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-lg">Candidates</h3>
                <span className="ml-2 px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-xs font-semibold">{candidates.length}</span>
             </div>
             <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                {activeSection === 'candidates' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
             </Button>
          </div>
          {activeSection === 'candidates' && (
            <div className="p-4 border-t border-border/50 bg-background/50">
               {candidates.length === 0 ? (
                 <p className="text-sm text-center text-muted-foreground py-8">No candidates applied to this company yet.</p>
               ) : (
                 <div className="overflow-x-auto rounded-lg border border-border/50">
                   <table className="w-full text-sm text-left">
                     <thead className="bg-muted/30 text-muted-foreground uppercase text-[10px] font-bold tracking-wider">
                       <tr>
                         <th className="px-4 py-3">Candidate</th>
                         <th className="px-4 py-3">Applied To (Job ID)</th>
                         <th className="px-4 py-3">Status</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y divide-border/50 bg-card">
                       {candidates.map((cand) => (
                         <tr key={cand.id} className="hover:bg-muted/20">
                           <td className="px-4 py-3">
                             <div className="font-semibold">{cand.full_name}</div>
                             <div className="text-muted-foreground text-xs">{cand.email}</div>
                           </td>
                           <td className="px-4 py-3 text-xs font-mono text-muted-foreground" title={cand.job_id}>
                             ...{cand.job_id.substring(cand.job_id.length - 8)}
                           </td>
                           <td className="px-4 py-3">
                             {getStatusBadge(cand.status as CandidateStatus)}
                           </td>
                         </tr>
                       ))}
                     </tbody>
                   </table>
                 </div>
               )}
            </div>
          )}
        </Card>

      </div>

      {/* Edit Company Modal */}
      <Dialog open={isEditCompanyOpen} onOpenChange={setIsEditCompanyOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Company</DialogTitle>
            <DialogDescription>Update the profile for this company.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 pt-4">
            <div className="space-y-2">
              <Label>Company Name <span className="text-destructive">*</span></Label>
              <Input value={editCompName} onChange={e => setEditCompName(e.target.value)} className="bg-muted/50" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Industry</Label>
                <Input value={editCompInd} onChange={e => setEditCompInd(e.target.value)} className="bg-muted/50" />
              </div>
              <div className="space-y-2">
                <Label>Company Size</Label>
                <select value={editCompSize} onChange={e => setEditCompSize(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-muted/50 px-3 py-2 text-sm focus-visible:outline-none focus:ring-1 focus:ring-primary/50">
                  <option value="1-10">1-10 emp</option>
                  <option value="11-50">11-50 emp</option>
                  <option value="51-200">51-200 emp</option>
                  <option value="200+">200+ emp</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Location</Label>
                <Input value={editCompLoc} onChange={e => setEditCompLoc(e.target.value)} className="bg-muted/50" />
              </div>
              <div className="space-y-2">
                <Label>Website URL</Label>
                <Input value={editCompWeb} onChange={e => setEditCompWeb(e.target.value)} className="bg-muted/50" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <textarea value={editCompDesc} onChange={e => setEditCompDesc(e.target.value)} className="w-full px-3 py-2 border border-input rounded-md min-h-[100px] bg-muted/50 text-sm focus-visible:outline-none focus:ring-1 focus:ring-primary/50" />
            </div>
            {compError && <p className="text-sm text-destructive">{compError}</p>}
            <Button onClick={handleUpdateCompany} className="w-full">Save Changes</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reused User Modals embedded inline for simplicity & full control */}
      <Dialog open={isCreateUserOpen} onOpenChange={setIsCreateUserOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Add User to {company?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2"><Label>Full Name</Label><Input value={newFullName} onChange={e => setNewFullName(e.target.value)} placeholder="John Doe" /></div>
            <div className="space-y-2"><Label>Email</Label><Input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="name@company.com" /></div>
            <div className="space-y-2"><Label>Password</Label><Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="•••••••••" /></div>
            <div className="space-y-2">
              <Label>Role</Label>
              <select value={newRole} onChange={e => setNewRole(e.target.value as any)} className="flex h-10 w-full rounded-md border border-input bg-muted/50 px-3 py-2 text-sm focus:ring-1 focus:ring-primary/50">
                <option value="customer">Customer</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            {userError && <p className="text-sm text-destructive">{userError}</p>}
            <Button onClick={handleCreateUser} className="w-full" disabled={isSavingUser}>{isSavingUser ? 'Saving...' : 'Add User'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditUserOpen} onOpenChange={setIsEditUserOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Edit User Profile</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2"><Label>Full Name</Label><Input value={newFullName} onChange={e => setNewFullName(e.target.value)} /></div>
            <div className="space-y-2">
              <Label>Role</Label>
              <select value={newRole} onChange={e => setNewRole(e.target.value as any)} className="flex h-10 w-full rounded-md border border-input bg-muted/50 px-3 py-2 text-sm focus:ring-1 focus:ring-primary/50">
                <option value="customer">Customer</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            {userError && <p className="text-sm text-destructive">{userError}</p>}
            <Button onClick={handleUpdateUser} className="w-full" disabled={isSavingUser}>{isSavingUser ? 'Saving...' : 'Save Changes'}</Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  )
}
