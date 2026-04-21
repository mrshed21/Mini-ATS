'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Profile, Company } from '@/lib/types'
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
import { useImpersonation } from '@/lib/contexts/impersonation-context'
import { 
  Building2, Users, Search, Plus, Trash2, Pencil,
  Mail, ShieldAlert, UserCheck, Building, MapPin, Briefcase, Eye
} from 'lucide-react'

// ─── Validation helpers ───────────────────────────────────
interface FieldErrors {
  [key: string]: string
}

function validateEmail(email: string): string | null {
  if (!email) return 'Email is required'
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!re.test(email)) return 'Invalid email format'
  return null
}

function validatePassword(password: string): string | null {
  if (!password) return 'Password is required'
  if (password.length < 6) return 'Must be at least 6 characters'
  return null
}

function validateRequired(value: string, label: string): string | null {
  if (!value.trim()) return `${label} is required`
  return null
}

function validateUrl(url: string): string | null {
  if (!url) return null // optional field
  try {
    new URL(url)
    return null
  } catch {
    return 'Invalid URL format (e.g. https://example.com)'
  }
}

// ─── Error Input Wrapper ──────────────────────────────────
function FieldWrapper({ error, children }: { error?: string | null; children: React.ReactNode }) {
  return (
    <div>
      {children}
      {error && <p className="text-xs text-destructive mt-1.5 flex items-center gap-1"><span className="inline-block w-1 h-1 rounded-full bg-destructive" />{error}</p>}
    </div>
  )
}

export default function AdminCustomersPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { setImpersonation } = useImpersonation()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  
  const [activeTab, setActiveTab] = useState<'companies' | 'users'>('companies')
  const [searchQuery, setSearchQuery] = useState('')
  
  const [isCreateUserDialogOpen, setIsCreateUserDialogOpen] = useState(false)
  const [isCreateCompanyDialogOpen, setIsCreateCompanyDialogOpen] = useState(false)
  
  const [isEditUserDialogOpen, setIsEditUserDialogOpen] = useState(false)
  const [editingUserId, setEditingUserId] = useState('')
  const [isEditCompanyDialogOpen, setIsEditCompanyDialogOpen] = useState(false)
  const [editingCompanyId, setEditingCompanyId] = useState('')

  // User creation state
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newFullName, setNewFullName] = useState('')
  const [newRole, setNewRole] = useState<'admin' | 'company_admin' | 'customer'>('customer')
  const [selectedCompanyId, setSelectedCompanyId] = useState('')
  const [userError, setUserError] = useState('')
  const [isCreatingUser, setIsCreatingUser] = useState(false)

  // Per-field validation errors for user form
  const [userFieldErrors, setUserFieldErrors] = useState<FieldErrors>({})
  // Track touched fields for blur-based validation
  const [userTouchedFields, setUserTouchedFields] = useState<Set<string>>(new Set())

  // Company creation state
  const [newCompanyName, setNewCompanyName] = useState('')
  const [newWebsiteUrl, setNewWebsiteUrl] = useState('')
  const [newIndustry, setNewIndustry] = useState('')
  const [newLocation, setNewLocation] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newCompanySize, setNewCompanySize] = useState('1-10')
  const [companyError, setCompanyError] = useState('')
  const [isCreatingCompany, setIsCreatingCompany] = useState(false)

  // Per-field validation errors for company form
  const [companyFieldErrors, setCompanyFieldErrors] = useState<FieldErrors>({})
  const [companyTouchedFields, setCompanyTouchedFields] = useState<Set<string>>(new Set())

  const supabase = createClient()

  // ─── Handle query params ────────────────────────────────
  useEffect(() => {
    const create = searchParams.get('create')
    const tab = searchParams.get('tab')

    if (tab === 'users') {
      setActiveTab('users')
    }

    if (create === 'company') {
      resetCompanyForm()
      setIsCreateCompanyDialogOpen(true)
      // Clean URL without re-render
      window.history.replaceState({}, '', '/admin/customers')
    } else if (create === 'user') {
      resetUserForm()
      setIsCreateUserDialogOpen(true)
      window.history.replaceState({}, '', '/admin/customers')
    }
  }, [searchParams])

  // ─── User field validation on blur ──────────────────────
  function validateUserField(field: string, value: string) {
    let error: string | null = null
    switch (field) {
      case 'email':
        error = validateEmail(value)
        break
      case 'password':
        error = validatePassword(value)
        break
      case 'company':
        if ((newRole === 'customer' || newRole === 'company_admin') && !value) {
          error = 'Please select a company'
        }
        break
    }
    setUserFieldErrors(prev => {
      const next = { ...prev }
      if (error) next[field] = error
      else delete next[field]
      return next
    })
  }

  function handleUserFieldBlur(field: string) {
    setUserTouchedFields(prev => new Set(prev).add(field))
    let value = ''
    switch (field) {
      case 'email': value = newEmail; break
      case 'password': value = newPassword; break
      case 'company': value = selectedCompanyId; break
    }
    validateUserField(field, value)
  }

  // ─── Company field validation on blur ───────────────────
  function validateCompanyField(field: string, value: string) {
    let error: string | null = null
    switch (field) {
      case 'name':
        error = validateRequired(value, 'Company name')
        break
      case 'website_url':
        error = validateUrl(value)
        break
    }
    setCompanyFieldErrors(prev => {
      const next = { ...prev }
      if (error) next[field] = error
      else delete next[field]
      return next
    })
  }

  function handleCompanyFieldBlur(field: string) {
    setCompanyTouchedFields(prev => new Set(prev).add(field))
    let value = ''
    switch (field) {
      case 'name': value = newCompanyName; break
      case 'website_url': value = newWebsiteUrl; break
    }
    validateCompanyField(field, value)
  }

  function handleEditCompanyClick(company: Company) {
    setEditingCompanyId(company.id)
    setNewCompanyName(company.name)
    setNewWebsiteUrl(company.website_url || '')
    setNewIndustry(company.industry || '')
    setNewLocation(company.location || '')
    setNewDescription(company.description || '')
    setNewCompanySize(company.company_size || '1-10')
    setCompanyError('')
    setCompanyFieldErrors({})
    setCompanyTouchedFields(new Set())
    setIsEditCompanyDialogOpen(true)
  }

  function handleEditUserClick(profile: Profile) {
    setEditingUserId(profile.id)
    setNewFullName(profile.full_name || '')
    setNewRole(profile.role)
    setSelectedCompanyId(profile.company_id || '')
    setUserError('')
    setUserFieldErrors({})
    setUserTouchedFields(new Set())
    setIsEditUserDialogOpen(true)
  }

  function resetCompanyForm() {
    setNewCompanyName(''); setNewWebsiteUrl(''); setNewIndustry(''); 
    setNewLocation(''); setNewDescription(''); setNewCompanySize('1-10');
    setCompanyFieldErrors({})
    setCompanyTouchedFields(new Set())
  }

  function resetUserForm() {
    setNewEmail(''); setNewPassword(''); setNewFullName(''); 
    setNewRole('customer'); setSelectedCompanyId('');
    setUserFieldErrors({})
    setUserTouchedFields(new Set())
  }

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    const [profilesData, companiesData] = await Promise.all([
      supabase
        .from('profiles')
        .select('*, company:companies(*)')
        .order('updated_at', { ascending: false }),
      supabase
        .from('companies')
        .select('*')
        .order('name', { ascending: true })
    ])
    setProfiles(profilesData.data || [])
    setCompanies(companiesData.data || [])
    setLoading(false)
  }

  // ─── Full validation before submit ──────────────────────
  function validateAllUserFields(): boolean {
    const errors: FieldErrors = {}
    
    const emailErr = validateEmail(newEmail)
    if (emailErr) errors.email = emailErr

    const passErr = validatePassword(newPassword)
    if (passErr) errors.password = passErr

    // Reject system admin when a company is assigned
    if (newRole === 'admin' && selectedCompanyId) {
      errors.company = 'System admin cannot be assigned to a company. Use company_admin instead.'
    }

    if ((newRole === 'customer' || newRole === 'company_admin') && !selectedCompanyId) {
      errors.company = 'Please select a company'
    }

    setUserFieldErrors(errors)
    setUserTouchedFields(new Set(['email', 'password', 'company']))
    return Object.keys(errors).length === 0
  }

  function validateAllCompanyFields(): boolean {
    const errors: FieldErrors = {}

    const nameErr = validateRequired(newCompanyName, 'Company name')
    if (nameErr) errors.name = nameErr

    const urlErr = validateUrl(newWebsiteUrl)
    if (urlErr) errors.website_url = urlErr

    setCompanyFieldErrors(errors)
    setCompanyTouchedFields(new Set(['name', 'website_url']))
    return Object.keys(errors).length === 0
  }

  // ─── Handlers ───────────────────────────────────────────
  async function handleCreateCompany() {
    setCompanyError('')
    if (!validateAllCompanyFields()) return

    setIsCreatingCompany(true)
    try {
      const { error } = await supabase.from('companies').insert([{ 
        name: newCompanyName,
        website_url: newWebsiteUrl || null,
        industry: newIndustry || null,
        location: newLocation || null,
        description: newDescription || null,
        company_size: newCompanySize || null
      }])
      if (error) throw error
      resetCompanyForm()
      setIsCreateCompanyDialogOpen(false)
      loadData()
    } catch (error: unknown) {
      setCompanyError(error instanceof Error ? error.message : 'Failed to create company')
    } finally {
      setIsCreatingCompany(false)
    }
  }

  async function handleUpdateCompany() {
    setCompanyError('')
    if (!validateAllCompanyFields()) return

    setIsCreatingCompany(true)
    try {
      const { error } = await supabase.from('companies').update({ 
        name: newCompanyName,
        website_url: newWebsiteUrl || null,
        industry: newIndustry || null,
        location: newLocation || null,
        description: newDescription || null,
        company_size: newCompanySize || null
      }).eq('id', editingCompanyId)
      if (error) throw error
      resetCompanyForm()
      setIsEditCompanyDialogOpen(false)
      loadData()
    } catch (error: unknown) {
      setCompanyError(error instanceof Error ? error.message : 'Failed to update company')
    } finally {
      setIsCreatingCompany(false)
    }
  }

  async function handleCreateUser() {
    setUserError('')
    if (!validateAllUserFields()) return

    setIsCreatingUser(true)
    try {
      // Workaround: Prevent Supabase from overwriting the admin's session by using a temporary client
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

      if (authError) {
        if (authError.message.includes('already registered')) {
          setUserFieldErrors(prev => ({ ...prev, email: 'Email already exists' }))
          setIsCreatingUser(false)
          return
        }
        throw authError
      }

      if (authData.user) {
        const profileData: Partial<Profile> = {
          id: authData.user.id,
          email: newEmail,
          role: newRole,
          full_name: newFullName
        }
        if ((newRole === 'customer' || newRole === 'company_admin') && selectedCompanyId) {
          profileData.company_id = selectedCompanyId
        }

        // A Database trigger automatically inserts the public.profiles row.
        // So we must UPDATE the existing row instead of trying to INSERT a new one!
        const { error: profileError } = await supabase
          .from('profiles')
          .update(profileData)
          .eq('id', authData.user.id)
        
        if (profileError) throw profileError

        resetUserForm()
        setIsCreateUserDialogOpen(false)
        loadData()
      }
    } catch (error: unknown) {
      setUserError(error instanceof Error ? error.message : 'Failed to create user')
    } finally {
      setIsCreatingUser(false)
    }
  }

  async function handleUpdateUser() {
    setUserError('')
    // Validate company selection for update
    const errors: FieldErrors = {}
    if ((newRole === 'customer' || newRole === 'company_admin') && !selectedCompanyId) {
      errors.company = 'Please select a company'
    }
    setUserFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    setIsCreatingUser(true)
    try {
      const profileData: Partial<Profile> = {
        role: newRole,
        full_name: newFullName,
        company_id: (newRole === 'customer' || newRole === 'company_admin') ? selectedCompanyId || undefined : undefined,
      }

      const { error } = await supabase.from('profiles').update(profileData).eq('id', editingUserId)
      if (error) throw error

      resetUserForm()
      setIsEditUserDialogOpen(false)
      loadData()
    } catch (error: unknown) {
      setUserError(error instanceof Error ? error.message : 'Failed to update user')
    } finally {
      setIsCreatingUser(false)
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

  async function handleDeleteCompany(id: string) {
    if (!confirm('Are you sure? This will affect linked users.')) return
    try {
      await supabase.from('companies').delete().eq('id', id)
      loadData()
    } catch (error) {
      alert('Failed to delete company')
    }
  }

  const filteredCompanies = useMemo(() => 
    companies.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase())), 
    [companies, searchQuery]
  )

  const filteredProfiles = useMemo(() => 
    profiles.filter(p => 
      (p.email || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
      (p.full_name && p.full_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (p.company?.name && p.company.name.toLowerCase().includes(searchQuery.toLowerCase()))
    ), 
    [profiles, searchQuery]
  )

  // Helper for input error styling
  const inputErrorClass = (field: string, errors: FieldErrors) =>
    errors[field] ? 'border-destructive focus-visible:ring-destructive/30' : ''

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Organization Directory</h1>
          <p className="text-muted-foreground mt-1 text-sm">Manage companies and access controls across your platform.</p>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <Dialog open={isCreateCompanyDialogOpen} onOpenChange={(open) => { setIsCreateCompanyDialogOpen(open); if (!open) { resetCompanyForm(); setCompanyError(''); } }}>
            <DialogTrigger asChild>
              <Button variant="outline" className="h-10 hover:bg-muted/50 transition-colors">
                <Building2 className="w-4 h-4 mr-2" />
                New Company
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add a New Company</DialogTitle>
                <DialogDescription>Create a comprehensive company workspace profile.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-6 pt-4">
                <FieldWrapper error={companyTouchedFields.has('name') ? companyFieldErrors.name : null}>
                  <Label>Company Name <span className="text-destructive">*</span></Label>
                  <Input 
                    value={newCompanyName} 
                    onChange={e => setNewCompanyName(e.target.value)} 
                    onBlur={() => handleCompanyFieldBlur('name')}
                    placeholder="e.g. Spotify AB" 
                    className={`bg-muted/50 ${inputErrorClass('name', companyFieldErrors)}`} 
                  />
                </FieldWrapper>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Industry</Label>
                    <Input value={newIndustry} onChange={e => setNewIndustry(e.target.value)} placeholder="e.g. Audio Streaming" className="bg-muted/50" />
                  </div>
                  <div className="space-y-2">
                    <Label>Company Size</Label>
                    <select
                      value={newCompanySize}
                      onChange={(e) => setNewCompanySize(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-muted/50 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="1-10">1-10 employees</option>
                      <option value="11-50">11-50 employees</option>
                      <option value="51-200">51-200 employees</option>
                      <option value="200+">200+ employees</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Location</Label>
                    <Input value={newLocation} onChange={e => setNewLocation(e.target.value)} placeholder="e.g. Stockholm, Sweden" className="bg-muted/50" />
                  </div>
                  <FieldWrapper error={companyTouchedFields.has('website_url') ? companyFieldErrors.website_url : null}>
                    <Label>Website URL</Label>
                    <Input 
                      value={newWebsiteUrl} 
                      onChange={e => setNewWebsiteUrl(e.target.value)} 
                      onBlur={() => handleCompanyFieldBlur('website_url')}
                      placeholder="e.g. https://spotify.com" 
                      className={`bg-muted/50 ${inputErrorClass('website_url', companyFieldErrors)}`} 
                    />
                  </FieldWrapper>
                </div>

                <div className="space-y-2">
                  <Label>Description</Label>
                  <textarea
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="Brief description of the company..."
                    className="w-full px-3 py-2 border border-input rounded-md min-h-[100px] bg-muted/50 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
                
                {companyError && <p className="text-sm text-destructive font-medium bg-destructive/10 px-3 py-2 rounded-md">{companyError}</p>}
                <Button onClick={handleCreateCompany} className="w-full" disabled={isCreatingCompany}>
                  {isCreatingCompany ? 'Creating...' : 'Create Company'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isEditCompanyDialogOpen} onOpenChange={(open) => { setIsEditCompanyDialogOpen(open); if (!open) { resetCompanyForm(); setCompanyError(''); } }}>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Edit Company</DialogTitle>
                <DialogDescription>Update the profile for this company.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-6 pt-4">
                <FieldWrapper error={companyTouchedFields.has('name') ? companyFieldErrors.name : null}>
                  <Label>Company Name <span className="text-destructive">*</span></Label>
                  <Input 
                    value={newCompanyName} 
                    onChange={e => setNewCompanyName(e.target.value)} 
                    onBlur={() => handleCompanyFieldBlur('name')}
                    className={`bg-muted/50 ${inputErrorClass('name', companyFieldErrors)}`} 
                  />
                </FieldWrapper>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Industry</Label>
                    <Input value={newIndustry} onChange={e => setNewIndustry(e.target.value)} className="bg-muted/50" />
                  </div>
                  <div className="space-y-2">
                    <Label>Company Size</Label>
                    <select
                      value={newCompanySize}
                      onChange={(e) => setNewCompanySize(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-muted/50 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="1-10">1-10 employees</option>
                      <option value="11-50">11-50 employees</option>
                      <option value="51-200">51-200 employees</option>
                      <option value="200+">200+ employees</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Location</Label>
                    <Input value={newLocation} onChange={e => setNewLocation(e.target.value)} className="bg-muted/50" />
                  </div>
                  <FieldWrapper error={companyTouchedFields.has('website_url') ? companyFieldErrors.website_url : null}>
                    <Label>Website URL</Label>
                    <Input 
                      value={newWebsiteUrl} 
                      onChange={e => setNewWebsiteUrl(e.target.value)} 
                      onBlur={() => handleCompanyFieldBlur('website_url')}
                      className={`bg-muted/50 ${inputErrorClass('website_url', companyFieldErrors)}`} 
                    />
                  </FieldWrapper>
                </div>

                <div className="space-y-2">
                  <Label>Description</Label>
                  <textarea
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    className="w-full px-3 py-2 border border-input rounded-md min-h-[100px] bg-muted/50 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
                
                {companyError && <p className="text-sm text-destructive font-medium bg-destructive/10 px-3 py-2 rounded-md">{companyError}</p>}
                <Button onClick={handleUpdateCompany} className="w-full" disabled={isCreatingCompany}>
                  {isCreatingCompany ? 'Updating...' : 'Save Changes'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isCreateUserDialogOpen} onOpenChange={(open) => { setIsCreateUserDialogOpen(open); if (!open) { resetUserForm(); setUserError(''); } }}>
            <DialogTrigger asChild>
              <Button className="h-10 shadow-sm">
                <Plus className="w-4 h-4 mr-2" />
                Add User
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Invite New User</DialogTitle>
                <DialogDescription>Set up a new access profile for a member.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Full Name (Optional)</Label>
                  <Input value={newFullName} onChange={e => setNewFullName(e.target.value)} placeholder="John Doe" className="bg-muted/50" />
                </div>
                <FieldWrapper error={userTouchedFields.has('email') ? userFieldErrors.email : null}>
                  <Label>Email <span className="text-destructive">*</span></Label>
                  <Input 
                    type="email" 
                    value={newEmail} 
                    onChange={e => setNewEmail(e.target.value)} 
                    onBlur={() => handleUserFieldBlur('email')}
                    placeholder="name@company.com" 
                    className={`bg-muted/50 ${inputErrorClass('email', userFieldErrors)}`} 
                  />
                </FieldWrapper>
                <FieldWrapper error={userTouchedFields.has('password') ? userFieldErrors.password : null}>
                  <Label>Password <span className="text-destructive">*</span></Label>
                  <Input 
                    type="password" 
                    value={newPassword} 
                    onChange={e => setNewPassword(e.target.value)} 
                    onBlur={() => handleUserFieldBlur('password')}
                    placeholder="•••••••••" 
                    className={`bg-muted/50 ${inputErrorClass('password', userFieldErrors)}`} 
                  />
                </FieldWrapper>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <select
                    value={newRole}
                    onChange={(e) => {
                      const role = e.target.value as 'admin' | 'company_admin' | 'customer'
                      setNewRole(role)
                      // Re-validate company field when role changes
                      if (role === 'admin') {
                        setUserFieldErrors(prev => { const n = {...prev}; delete n.company; return n })
                      } else if (userTouchedFields.has('company')) {
                        validateUserField('company', selectedCompanyId)
                      }
                    }}
                    className="flex h-10 w-full rounded-md border border-input bg-muted/50 px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="customer">Customer</option>
                    <option value="company_admin">Company Admin</option>
                    <option value="admin">Admin (Full Control)</option>
                  </select>
                </div>
                {(newRole === 'customer' || newRole === 'company_admin') && (
                  <FieldWrapper error={userTouchedFields.has('company') ? userFieldErrors.company : null}>
                    <Label>Assign to Company <span className="text-destructive">*</span></Label>
                    <select
                      value={selectedCompanyId}
                      onChange={(e) => {
                        setSelectedCompanyId(e.target.value)
                        if (userTouchedFields.has('company')) {
                          validateUserField('company', e.target.value)
                        }
                      }}
                      onBlur={() => handleUserFieldBlur('company')}
                      className={`flex h-10 w-full rounded-md border border-input bg-muted/50 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${inputErrorClass('company', userFieldErrors)}`}
                    >
                      <option value="">Select a company...</option>
                      {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </FieldWrapper>
                )}
                {userError && <p className="text-sm text-destructive font-medium bg-destructive/10 px-3 py-2 rounded-md">{userError}</p>}
                <Button onClick={handleCreateUser} className="w-full" disabled={isCreatingUser}>
                  {isCreatingUser ? 'Creating...' : 'Send Invitation'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isEditUserDialogOpen} onOpenChange={(open) => { setIsEditUserDialogOpen(open); if (!open) { resetUserForm(); setUserError(''); } }}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Edit User Profile</DialogTitle>
                <DialogDescription>Update access profile and roles.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input value={newFullName} onChange={e => setNewFullName(e.target.value)} placeholder="John Doe" className="bg-muted/50" />
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as 'admin' | 'company_admin' | 'customer')}
                    className="flex h-10 w-full rounded-md border border-input bg-muted/50 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="customer">Customer</option>
                    <option value="company_admin">Company Admin</option>
                    <option value="admin">Admin (Full Control)</option>
                  </select>
                </div>
                {(newRole === 'customer' || newRole === 'company_admin') && (
                  <FieldWrapper error={userTouchedFields.has('company') ? userFieldErrors.company : null}>
                    <Label>Assign to Company <span className="text-destructive">*</span></Label>
                    <select
                      value={selectedCompanyId}
                      onChange={(e) => {
                        setSelectedCompanyId(e.target.value)
                        if (userTouchedFields.has('company')) {
                          validateUserField('company', e.target.value)
                        }
                      }}
                      onBlur={() => handleUserFieldBlur('company')}
                      className={`flex h-10 w-full rounded-md border border-input bg-muted/50 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${inputErrorClass('company', userFieldErrors)}`}
                    >
                      <option value="">Select a company...</option>
                      {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </FieldWrapper>
                )}
                {userError && <p className="text-sm text-destructive font-medium bg-destructive/10 px-3 py-2 rounded-md">{userError}</p>}
                <Button onClick={handleUpdateUser} className="w-full" disabled={isCreatingUser}>
                  {isCreatingUser ? 'Updating...' : 'Save Changes'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between p-1 bg-muted/30 rounded-xl border border-border/50 backdrop-blur-sm">
        <div className="flex w-full sm:w-auto p-1 bg-background/50 rounded-lg">
          <button 
            onClick={() => setActiveTab('companies')}
            className={`flex-1 sm:flex-none px-6 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'companies' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <div className="flex items-center justify-center gap-2"><Building className="w-4 h-4"/> Companies</div>
          </button>
          <button 
            onClick={() => setActiveTab('users')}
            className={`flex-1 sm:flex-none px-6 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'users' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <div className="flex items-center justify-center gap-2"><Users className="w-4 h-4"/> Members</div>
          </button>
        </div>
        
        <div className="relative w-full sm:w-96 px-2 sm:px-0 sm:pr-2">
          <Search className="absolute left-5 sm:left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder={`Search ${activeTab}...`}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-10 h-10 bg-background/50 border-border/50 focus-visible:ring-1"
          />
        </div>
      </div>

      {loading ? (
         <div className="flex items-center justify-center h-64">
           <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
         </div>
      ) : (
        <div className="mt-6">
          {/* Companies View */}
          {activeTab === 'companies' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredCompanies.length === 0 ? (
                <div className="col-span-1 md:col-span-2 lg:col-span-3 py-20 text-center flex flex-col items-center">
                  <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mb-4"><Building2 className="w-8 h-8 text-muted-foreground" /></div>
                  <h3 className="text-lg font-medium">No companies found</h3>
                  <p className="text-muted-foreground">Get started by creating your first company workspace.</p>
                </div>
              ) : (
                filteredCompanies.map(company => {
                  const companyUsersCount = profiles.filter(p => p.company_id === company.id).length;
                  return (
                    <Card 
                      key={company.id} 
                      className="group overflow-hidden border-border/50 hover:shadow-md transition-all duration-300 hover:border-primary/20 cursor-pointer"
                      onClick={() => router.push(`/admin/companies/${company.id}`)}
                    >
                      <CardContent className="p-0">
                        <div className="p-6 bg-gradient-to-br from-background to-muted/20">
                          <div className="flex justify-between items-start mb-4">
                            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/10">
                              <Building2 className="w-6 h-6 text-primary" />
                            </div>
                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary hover:bg-primary/10" onClick={(e) => { e.stopPropagation(); handleEditCompanyClick(company); }}>
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={(e) => { e.stopPropagation(); handleDeleteCompany(company.id); }}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                          <h3 className="text-xl font-semibold tracking-tight mb-1">{company.name}</h3>
                          
                          {(company.industry || company.location) && (
                            <div className="flex flex-wrap text-sm text-muted-foreground gap-3 mb-3">
                              {company.industry && <span className="flex items-center gap-1"><Briefcase className="w-3.5 h-3.5" />{company.industry}</span>}
                              {company.location && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{company.location}</span>}
                            </div>
                          )}

                          <div className="flex items-center text-xs font-medium text-foreground bg-foreground/5 w-fit px-2 py-1 rounded-md mb-2">
                            <Users className="w-3 h-3 mr-1.5" />
                            {companyUsersCount} Member{companyUsersCount !== 1 ? 's' : ''}
                            {company.company_size && <span className="ml-1 opacity-60"> ({company.company_size})</span>}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })
              )}
            </div>
          )}

          {/* Users View */}
          {activeTab === 'users' && (
            <div className="overflow-hidden rounded-xl border border-border/50 bg-background shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-medium border-b border-border/50">
                    <tr>
                      <th className="px-6 py-4">User</th>
                      <th className="px-6 py-4">Role / Company</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {filteredProfiles.length === 0 ? (
                       <tr>
                         <td colSpan={4} className="py-20 text-center">
                            <div className="flex flex-col items-center">
                              <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mb-4"><Users className="w-8 h-8 text-muted-foreground" /></div>
                              <h3 className="text-lg font-medium">No users found</h3>
                              <p className="text-muted-foreground">Adjust your search or add a new user.</p>
                            </div>
                         </td>
                       </tr>
                    ) : (
                      filteredProfiles.map(profile => (
                        <tr key={profile.id} className="hover:bg-muted/20 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-semibold text-primary">
                                {profile.full_name ? profile.full_name.charAt(0).toUpperCase() : (profile.email || '?').charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className="font-medium text-foreground">{profile.full_name || 'No Name'}</div>
                                <div className="text-muted-foreground flex items-center gap-1.5 mt-0.5 text-xs">
                                  <Mail className="w-3 h-3" /> {profile.email || 'No Email provided'}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col gap-1">
                              <span className={`inline-flex items-center gap-1.5 w-fit px-2.5 py-1 text-xs font-medium rounded-full ${profile.role === 'admin' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : profile.role === 'company_admin' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-blue-500/10 text-blue-500 border border-blue-500/20'}`}>
                                {profile.role === 'admin' ? <ShieldAlert className="w-3 h-3" /> : <UserCheck className="w-3 h-3"/>}
                                {profile.role === 'company_admin' ? 'company_admin' : profile.role}
                              </span>
                              {profile.company && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
                                  <Building2 className="w-3 h-3" />
                                  {profile.company.name}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-500 font-medium">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                              Active
                            </span>
                            <div className="text-xs text-muted-foreground mt-1">
                              Updated {new Date(profile.updated_at).toLocaleDateString()}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                             <div className="flex justify-end gap-2">
                               {profile.role !== 'admin' && (
                                 <Button
                                   variant="ghost"
                                   size="icon"
                                   className="text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10"
                                   title={`Impersonate ${profile.full_name || profile.email}`}
                                   onClick={() => {
                                     setImpersonation({
                                       userId: profile.id,
                                       userEmail: profile.email || '',
                                       userName: profile.full_name || profile.email || '',
                                       companyId: profile.company_id || '',
                                       role: profile.role,
                                     })
                                     router.push('/dashboard')
                                   }}
                                 >
                                   <Eye className="w-4 h-4" />
                                 </Button>
                               )}
                               <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary hover:bg-primary/10" onClick={() => handleEditUserClick(profile)}>
                                 <Pencil className="w-4 h-4" />
                               </Button>
                               <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => handleDeleteProfile(profile.id)}>
                                 <Trash2 className="w-4 h-4" />
                               </Button>
                             </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}