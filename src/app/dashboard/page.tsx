'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Briefcase, Users, Plus, ArrowRight, UserPlus, FileText, CalendarDays } from 'lucide-react'
import { useImpersonation, getEffectiveUserId } from '@/lib/contexts/impersonation-context'

export default function CustomerDashboard() {
  const [jobsCount, setJobsCount] = useState(0)
  const [candidatesCount, setCandidatesCount] = useState(0)
  const [recentJobs, setRecentJobs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const supabase = createClient()
  const { impersonating, data: impData, isLoaded } = useImpersonation()

  useEffect(() => {
    if (!isLoaded) return;

    async function loadStats() {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      const targetUserId = getEffectiveUserId(impersonating, impData, user?.id)

      if (targetUserId) {
        const [{ count: jCount }, { count: cCount }, { data: rJobs }] = await Promise.all([
          supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('customer_id', targetUserId),
          supabase.from('candidates').select('*', { count: 'exact', head: true }),
          supabase.from('jobs').select('*').eq('customer_id', targetUserId).order('created_at', { ascending: false }).limit(5)
        ])

        setJobsCount(jCount || 0)
        setCandidatesCount(cCount || 0)
        setRecentJobs(rJobs || [])
      }
      setLoading(false)
    }

    loadStats()
  }, [isLoaded, impersonating, impData])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
         <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Welcome to your Workspace</h1>
          <p className="text-muted-foreground mt-1 text-sm">Here is a quick overview of your recruitment pipeline.</p>
        </div>
        <Link href="/dashboard/jobs">
          <Button className="h-10 hover:shadow-lg transition-all rounded-lg bg-primary text-primary-foreground">
            <Plus className="w-4 h-4 mr-2" />
            Create Job Post
          </Button>
        </Link>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="group border-border/50 hover:border-primary/20 hover:shadow-lg transition-all duration-300 overflow-hidden">
          <CardContent className="p-0">
            <div className="p-6 relative bg-gradient-to-br from-background to-blue-500/5">
              <div className="flex justify-between items-start mb-4">
                 <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                   <Briefcase className="w-6 h-6 text-blue-500" />
                 </div>
              </div>
              <div>
                <h3 className="text-4xl font-bold tracking-tighter mb-1">{jobsCount || 0}</h3>
                <p className="text-sm font-medium text-foreground">Active Job Postings</p>
                <p className="text-xs text-muted-foreground mt-1">Manage your open positions.</p>
              </div>
              <div className="absolute -right-4 -bottom-4 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity pointer-events-none">
                 <Briefcase className="w-32 h-32" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="group border-border/50 hover:border-primary/20 hover:shadow-lg transition-all duration-300 overflow-hidden">
          <CardContent className="p-0">
             <div className="p-6 relative bg-gradient-to-br from-background to-purple-500/5">
              <div className="flex justify-between items-start mb-4">
                 <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
                   <Users className="w-6 h-6 text-purple-500" />
                 </div>
              </div>
              <div>
                <h3 className="text-4xl font-bold tracking-tighter mb-1">{candidatesCount || 0}</h3>
                <p className="text-sm font-medium text-foreground">Total Candidates</p>
                <p className="text-xs text-muted-foreground mt-1">Review your talent pipeline.</p>
              </div>
              <div className="absolute -right-4 -bottom-4 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity pointer-events-none">
                 <Users className="w-32 h-32" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="col-span-1 lg:col-span-2 border-border/50 shadow-sm flex flex-col">
          <CardHeader className="border-b border-border/50 bg-muted/20">
            <CardTitle>Recent Job Postings</CardTitle>
            <CardDescription>Your latest recruitment activities</CardDescription>
          </CardHeader>
          <CardContent className="p-0 flex-1 flex flex-col">
            {recentJobs && recentJobs.length > 0 ? (
              <div className="divide-y divide-border/50 flex-1">
                {recentJobs.map((job) => (
                  <div key={job.id} className="group flex flex-col sm:flex-row justify-between items-start sm:items-center p-6 bg-background hover:bg-muted/10 transition-colors">
                    <div className="flex gap-4 items-center">
                       <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center hidden sm:flex">
                          <FileText className="w-5 h-5 text-primary" />
                       </div>
                       <div>
                          <p className="font-semibold text-lg hover:text-primary transition-colors cursor-pointer">{job.title}</p>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                             <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" /> {new Date(job.created_at).toLocaleDateString()}</span>
                             <span className="inline-block w-1 h-1 rounded-full bg-border"></span>
                             <span className={`px-2 py-0.5 rounded-full font-medium ${job.status === 'active' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-muted text-muted-foreground'}`}>
                               {job.status === 'active' ? 'Active' : 'Closed'}
                             </span>
                          </div>
                       </div>
                    </div>
                    <Link href={`/jobs/${job.id}`} className="mt-4 sm:mt-0 w-full sm:w-auto">
                      <Button variant="outline" size="sm" className="w-full bg-background group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-all">
                        View Pipeline
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center flex-1 py-16 text-center">
                 <div className="w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mb-4">
                   <Briefcase className="w-8 h-8 text-muted-foreground" />
                 </div>
                 <h3 className="text-lg font-medium text-foreground">No active jobs</h3>
                 <p className="text-muted-foreground max-w-sm mt-1">You haven't posted any jobs yet. Create a new posting to start hiring top talent.</p>
              </div>
            )}
            <div className="mt-auto border-t border-border/50 p-4 bg-muted/20 text-center">
               <Link href="/dashboard/jobs" className="text-sm font-medium text-primary hover:underline">
                 View all job postings
               </Link>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm h-fit">
          <CardHeader className="border-b border-border/50 bg-muted/20">
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
             <Link href="/dashboard/jobs" className="group flex items-center gap-3 p-4 rounded-xl border border-border/50 hover:border-primary/30 hover:bg-muted/30 transition-all cursor-pointer">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                   <Plus className="w-5 h-5 text-blue-500" />
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">Post a Job</h4>
                  <p className="text-xs text-muted-foreground">Start recruiting</p>
                </div>
             </Link>
             
             <Link href="/dashboard/candidates" className="group flex items-center gap-3 p-4 rounded-xl border border-border/50 hover:border-primary/30 hover:bg-muted/30 transition-all cursor-pointer">
                <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                   <UserPlus className="w-5 h-5 text-purple-500" />
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">Candidate Pool</h4>
                  <p className="text-xs text-muted-foreground">Browse all applications</p>
                </div>
             </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}