'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/contexts/auth-context'
import { useImpersonation } from '@/lib/contexts/impersonation-context'
import { Button } from '@/components/ui/button'
import { 
  Building2, Users, LayoutDashboard, Briefcase, 
  LogOut, Sparkles, User, UserCog, ShieldAlert, Activity, ShieldCheck
} from 'lucide-react'

export default function Sidebar() {
  const pathname = usePathname()
  const supabase = createClient()
  const { profile, loading } = useAuth()
  const { impersonating, data: impData } = useImpersonation()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  if (loading) return (
    <div className="w-72 bg-card border-r border-border flex flex-col min-h-screen p-6 animate-pulse">
       <div className="h-8 bg-muted rounded w-1/2 mb-10"></div>
       <div className="space-y-4">
         <div className="h-10 bg-muted rounded w-full"></div>
         <div className="h-10 bg-muted rounded w-full"></div>
       </div>
    </div>
  )

  // --- Navigation links per role ---
  const adminLinks = [
    { name: 'Overview', href: '/admin', icon: LayoutDashboard },
    { name: 'Directory', href: '/admin/customers', icon: Users },
    { name: 'Activity Log', href: '/admin/activity', icon: Activity },
  ]

  const companyAdminLinks = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Team', href: '/dashboard/team', icon: UserCog },
    { name: 'Job Groups', href: '/dashboard/groups', icon: ShieldCheck },
    { name: 'Company Jobs', href: '/dashboard/jobs', icon: Briefcase },
    { name: 'All Candidates', href: '/dashboard/candidates', icon: Users },
    { name: 'Activity Log', href: '/dashboard/activity', icon: Activity },
  ]

  const customerLinks = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'My Jobs', href: '/dashboard/jobs', icon: Briefcase },
    { name: 'My Candidates', href: '/dashboard/candidates', icon: Users },
  ]

  // When impersonating, use the impersonated user's role
  const effectiveRole = impersonating ? impData?.role : profile?.role
  const links = effectiveRole === 'admin'
    ? adminLinks
    : effectiveRole === 'company_admin'
      ? companyAdminLinks
      : customerLinks

  // --- Display info ---
  const displayName = impersonating ? impData?.userName : profile?.full_name || 'No Name'
  const displayEmail = impersonating ? impData?.userEmail : profile?.email
  const displayRole = impersonating ? impData?.role : profile?.role
  const displayCompany = impersonating ? impData?.companyId : profile?.company?.name

  const roleBadgeColor = displayRole === 'admin'
    ? 'bg-amber-500/10 text-amber-500'
    : displayRole === 'company_admin'
      ? 'bg-emerald-500/10 text-emerald-500'
      : 'bg-blue-500/10 text-blue-500'

  return (
    <div className="w-50 md:w-72 bg-card/50 backdrop-blur-3xl border-r border-border/50 min-h-screen flex flex-col relative z-20">
      {/* Brand */}
      <div className="p-6">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center transition-transform group-hover:scale-105">
            <Sparkles className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-semibold text-lg tracking-tight">Mini-ATS</span>
        </Link>
      </div>
      
      {/* Navigation */}
      <nav className="flex-1 px-4 py-2 space-y-1">
        <p className="px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Menu</p>
        
        {links.map((link) => {
          const isActive = pathname === link.href;
          const Icon = link.icon;
          return (
            <Link
              key={link.name}
              href={link.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-medium ${
                isActive 
                  ? 'bg-primary/10 text-primary' 
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-primary' : ''}`} />
              {link.name}
            </Link>
          )
        })}
      </nav>

      {/* User Profile */}
      <div className="p-4 mt-auto">
        <div className="p-3 rounded-xl bg-muted/40 border border-border/50 backdrop-blur-sm relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
          
          <div className="relative z-10 flex flex-col gap-3">
             <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center border border-primary/20">
                   <User className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 overflow-hidden">
                  <p className="text-sm font-medium text-foreground truncate">
                    {displayName}
                  </p>
                  <p className="text-xs text-muted-foreground truncate" title={displayEmail}>
                    {displayEmail}
                  </p>
                </div>
             </div>
             
             <div className="flex items-center gap-2 pt-2 border-t border-border/50">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] uppercase font-bold tracking-wider ${roleBadgeColor}`}>
                   {displayRole === 'admin' && <ShieldAlert className="w-3 h-3" />}
                   {displayRole}
                </span>
                {displayCompany && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                    <Building2 className="w-3 h-3" />
                    {displayCompany}
                  </span>
                )}
             </div>

             <Button
                variant="ghost" 
                size="sm" 
                className="w-full mt-1 justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors h-8"
                onClick={handleLogout}
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign out
              </Button>
          </div>
        </div>
      </div>
    </div>
  )
}