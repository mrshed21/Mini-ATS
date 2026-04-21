import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Building2, ShieldAlert, Briefcase, Users, Activity, ArrowUpRight } from 'lucide-react'
import Link from 'next/link'

export default async function AdminDashboard() {
  const supabase = await createClient()

  // Total Customers = number of Companies
  const { count: companiesCount } = await supabase
    .from('companies')
    .select('*', { count: 'exact', head: true })

  // Admin breakdown: system admins + company admins
  const { count: systemAdminsCount } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('role', 'admin')

  const { count: companyAdminsCount } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('role', 'company_admin')

  const totalAdmins = (systemAdminsCount || 0) + (companyAdminsCount || 0)

  const { count: jobsCount } = await supabase
    .from('jobs')
    .select('*', { count: 'exact', head: true })

  const { count: candidatesCount } = await supabase
    .from('candidates')
    .select('*', { count: 'exact', head: true })

  const stats = [
    {
      title: 'Total Customers',
      value: companiesCount || 0,
      description: 'Active client accounts',
      icon: Building2,
      color: 'text-blue-500',
      bgBase: 'bg-blue-500/10',
      href: '/admin/customers',
    },
    {
      title: 'Total Admins',
      value: totalAdmins,
      breakdown: `${systemAdminsCount || 0} System · ${companyAdminsCount || 0} Company`,
      description: 'Platform administrators',
      icon: ShieldAlert,
      color: 'text-amber-500',
      bgBase: 'bg-amber-500/10',
      href: '/admin/customers?tab=users',
    },
    {
      title: 'Active Jobs',
      value: jobsCount || 0,
      description: 'Total job postings',
      icon: Briefcase,
      color: 'text-emerald-500',
      bgBase: 'bg-emerald-500/10',
      href: '/admin/customers',
    },
    {
      title: 'Candidates',
      value: candidatesCount || 0,
      description: 'In the pipeline',
      icon: Users,
      color: 'text-purple-500',
      bgBase: 'bg-purple-500/10',
      href: '/admin/customers',
    }
  ]

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">System Overview</h1>
        <p className="text-muted-foreground">Monitor platform activity and manage key metrics across the ATS.</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <Link key={i} href={stat.href}>
              <Card className="group overflow-hidden border-border/50 hover:border-primary/20 hover:shadow-lg transition-all duration-300 cursor-pointer h-full">
                <CardContent className="p-0">
                  <div className="p-6 relative">
                    <div className="flex justify-between items-start mb-6">
                      <div className={`w-12 h-12 rounded-xl ${stat.bgBase} flex items-center justify-center border border-white/5`}>
                        <Icon className={`w-6 h-6 ${stat.color}`} />
                      </div>
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground">
                        <ArrowUpRight className="w-4 h-4" />
                      </span>
                    </div>
                    <div>
                      <h3 className="text-3xl font-bold tracking-tighter mb-1">{stat.value}</h3>
                      <p className="text-sm font-medium text-foreground">{stat.title}</p>
                      {'breakdown' in stat && stat.breakdown ? (
                        <p className="text-xs text-muted-foreground mt-1">{stat.breakdown}</p>
                      ) : (
                        <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
                      )}
                    </div>
                    <div className="absolute -right-4 -bottom-4 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity pointer-events-none">
                       <Icon className="w-32 h-32" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
        <Card className="col-span-1 lg:col-span-2 border-border/50 hover:shadow-md transition-shadow">
          <CardHeader className="border-b border-border/50 bg-muted/20">
             <div className="flex items-center gap-2">
               <Activity className="w-5 h-5 text-primary" />
               <div>
                  <CardTitle>System Activity Map</CardTitle>
                  <CardDescription>Visualizing candidate flow (Mockup)</CardDescription>
               </div>
             </div>
          </CardHeader>
          <CardContent className="p-8">
            <div className="h-64 w-full rounded-xl bg-gradient-to-br from-muted/50 to-muted/20 border border-border/50 flex flex-col items-center justify-center text-muted-foreground space-y-4">
               <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-primary/10 border border-primary/20">
                 <Activity className="w-8 h-8 text-primary/50" />
               </div>
               <p className="text-sm font-medium">Activity Chart Visualization</p>
               <p className="text-xs w-64 text-center">coming soon...</p>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-1 border-border/50 hover:shadow-md transition-shadow">
          <CardHeader className="border-b border-border/50 bg-muted/20">
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
             <Link href="/admin/customers?create=company" className="group flex items-center justify-between p-4 rounded-xl border border-border/50 hover:border-primary/30 hover:bg-muted/30 transition-all cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center"><Building2 className="w-5 h-5"/></div>
                  <div>
                    <h4 className="text-sm font-medium">Add Company</h4>
                    <p className="text-xs text-muted-foreground">Setup a new workspace</p>
                  </div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
             </Link>
             <Link href="/admin/customers?create=user" className="group flex items-center justify-between p-4 rounded-xl border border-border/50 hover:border-primary/30 hover:bg-muted/30 transition-all cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center"><Users className="w-5 h-5"/></div>
                  <div>
                    <h4 className="text-sm font-medium">Add User</h4>
                    <p className="text-xs text-muted-foreground">Add admins or customers</p>
                  </div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
             </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}