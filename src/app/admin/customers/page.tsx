'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
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
import { 
  Building2, Users, Search, Plus, Trash2, Pencil,
  Mail, Phone, ShieldAlert, LayoutGrid, LayoutList,
  UserCheck, Building, Globe, MapPin, Briefcase
} from 'lucide-react'

export default function AdminCustomersPage() {
  const router = useRouter()
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
  const [newRole, setNewRole] = useState<'admin' | 'customer'>('customer')
  const [selectedCompanyId, setSelectedCompanyId] = useState('')
  const [userError, setUserError] = useState('')
  const [isCreatingUser, setIsCreatingUser] = useState(false)

  // Company creation state
  const [newCompanyName, setNewCompanyName] = useState('')
  const [newWebsiteUrl, setNewWebsiteUrl] = useState('')
  const [newIndustry, setNewIndustry] = useState('')
  const [newLocation, setNewLocation] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newCompanySize, setNewCompanySize] = useState('1-10')
  const [companyError, setCompanyError] = useState('')
  const [isCreatingCompany, setIsCreatingCompany] = useState(false)

  const supabase = createClient()

  function handleEditCompanyClick(company: Company) {
    setEditingCompanyId(company.id)
    setNewCompanyName(company.name)
    setNewWebsiteUrl(company.website_url || '')
    setNewIndustry(company.industry || '')
    setNewLocation(company.location || '')
    setNewDescription(company.description || '')
    setNewCompanySize(company.company_size || '1-10')
    setCompanyError('')
    setIsEditCompanyDialogOpen(true)
  }

  function handleEditUserClick(profile: Profile) {
    setEditingUserId(profile.id)
    setNewFullName(profile.full_name || '')
    setNewRole(profile.role)
    setSelectedCompanyId(profile.company_id || '')
    setUserError('')
    setIsEditUserDialogOpen(true)
  }

  function resetCompanyForm() {
    setNewCompanyName(''); setNewWebsiteUrl(''); setNewIndustry(''); 
    setNewLocation(''); setNewDescription(''); setNewCompanySize('1-10');
  }

  function resetUserForm() {
    setNewEmail(''); setNewPassword(''); setNewFullName(''); 
    setNewRole('customer'); setSelectedCompanyId('');
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

  async function handleCreateCompany() {
    setCompanyError('')
    if (!newCompanyName) return setCompanyError('Company name is required')

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
    } catch (error: any) {
      setCompanyError(error?.message || 'Failed to create company')
    } finally {
      setIsCreatingCompany(false)
    }
  }

  async function handleUpdateCompany() {
    setCompanyError('')
    if (!newCompanyName) return setCompanyError('Company name is required')

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
    } catch (error: any) {
      setCompanyError(error?.message || 'Failed to update company')
    } finally {
      setIsCreatingCompany(false)
    }
  }

  async function handleCreateUser() {
    setUserError('')
    if (!newEmail || !newPassword) return setUserError('Email and password are required')
    if (newRole === 'customer' && !selectedCompanyId) return setUserError('Please select a company')

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
          setUserError('Email already exists.')
          setIsCreatingUser(false)
          return
        }
        throw authError
      }

      if (authData.user) {
        const profileData: Partial<Profile> = {
          id: authData.user.id,
          email: newEmail, // Ensure this column is added to Supabase DB!
          role: newRole,
          full_name: newFullName
        }
        if (newRole === 'customer' && selectedCompanyId) {
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
    } catch (error: any) {
      setUserError(error?.message || 'Failed to create user')
    } finally {
      setIsCreatingUser(false)
    }
  }

  async function handleUpdateUser() {
    setUserError('')
    if (newRole === 'customer' && !selectedCompanyId) return setUserError('Please select a company')

    setIsCreatingUser(true)
    try {
      const profileData: Partial<Profile> = {
        role: newRole,
        full_name: newFullName,
        company_id: newRole === 'customer' ? selectedCompanyId : null
      }

      const { error } = await supabase.from('profiles').update(profileData).eq('id', editingUserId)
      if (error) throw error

      resetUserForm()
      setIsEditUserDialogOpen(false)
      loadData()
    } catch (error: any) {
      setUserError(error?.message || 'Failed to update user')
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

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Organization Directory</h1>
          <p className="text-muted-foreground mt-1 text-sm">Manage companies and access controls across your platform.</p>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <Dialog open={isCreateCompanyDialogOpen} onOpenChange={setIsCreateCompanyDialogOpen}>
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
                <div className="space-y-2">
                  <Label>Company Name <span className="text-destructive">*</span></Label>
                  <Input value={newCompanyName} onChange={e => setNewCompanyName(e.target.value)} placeholder="e.g. Spotify AB" className="bg-muted/50" />
                </div>
                
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
                  <div className="space-y-2">
                    <Label>Website URL</Label>
                    <Input value={newWebsiteUrl} onChange={e => setNewWebsiteUrl(e.target.value)} placeholder="e.g. https://spotify.com" className="bg-muted/50" />
                  </div>
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
                
                {companyError && <p className="text-sm text-destructive font-medium">{companyError}</p>}
                <Button onClick={handleCreateCompany} className="w-full" disabled={isCreatingCompany}>
                  {isCreatingCompany ? 'Creating...' : 'Create Company'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isEditCompanyDialogOpen} onOpenChange={setIsEditCompanyDialogOpen}>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Edit Company</DialogTitle>
                <DialogDescription>Update the profile for this company.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-6 pt-4">
                <div className="space-y-2">
                  <Label>Company Name <span className="text-destructive">*</span></Label>
                  <Input value={newCompanyName} onChange={e => setNewCompanyName(e.target.value)} className="bg-muted/50" />
                </div>
                
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
                  <div className="space-y-2">
                    <Label>Website URL</Label>
                    <Input value={newWebsiteUrl} onChange={e => setNewWebsiteUrl(e.target.value)} className="bg-muted/50" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Description</Label>
                  <textarea
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    className="w-full px-3 py-2 border border-input rounded-md min-h-[100px] bg-muted/50 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
                
                {companyError && <p className="text-sm text-destructive font-medium">{companyError}</p>}
                <Button onClick={handleUpdateCompany} className="w-full" disabled={isCreatingCompany}>
                  {isCreatingCompany ? 'Updating...' : 'Save Changes'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isCreateUserDialogOpen} onOpenChange={setIsCreateUserDialogOpen}>
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
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="name@company.com" className="bg-muted/50" />
                </div>
                <div className="space-y-2">
                  <Label>Password</Label>
                  <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="•••••••••" className="bg-muted/50" />
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as 'admin' | 'customer')}
                    className="flex h-10 w-full rounded-md border border-input bg-muted/50 px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="customer">Customer (Limited Access)</option>
                    <option value="admin">Admin (Full Control)</option>
                  </select>
                </div>
                {newRole === 'customer' && (
                  <div className="space-y-2">
                    <Label>Assign to Company</Label>
                    <select
                      value={selectedCompanyId}
                      onChange={(e) => setSelectedCompanyId(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-muted/50 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="">Select a company...</option>
                      {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                )}
                {userError && <p className="text-sm text-destructive font-medium">{userError}</p>}
                <Button onClick={handleCreateUser} className="w-full" disabled={isCreatingUser}>
                  {isCreatingUser ? 'Creating...' : 'Send Invitation'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isEditUserDialogOpen} onOpenChange={setIsEditUserDialogOpen}>
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
                    onChange={(e) => setNewRole(e.target.value as 'admin' | 'customer')}
                    className="flex h-10 w-full rounded-md border border-input bg-muted/50 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="customer">Customer (Limited Access)</option>
                    <option value="admin">Admin (Full Control)</option>
                  </select>
                </div>
                {newRole === 'customer' && (
                  <div className="space-y-2">
                    <Label>Assign to Company</Label>
                    <select
                      value={selectedCompanyId}
                      onChange={(e) => setSelectedCompanyId(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-muted/50 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="">Select a company...</option>
                      {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                )}
                {userError && <p className="text-sm text-destructive font-medium">{userError}</p>}
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
                              <span className={`inline-flex items-center gap-1.5 w-fit px-2.5 py-1 text-xs font-medium rounded-full ${profile.role === 'admin' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 'bg-blue-500/10 text-blue-500 border border-blue-500/20'}`}>
                                {profile.role === 'admin' ? <ShieldAlert className="w-3 h-3" /> : <UserCheck className="w-3 h-3"/>}
                                {profile.role}
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