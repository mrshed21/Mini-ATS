import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/sidebar'
import { ImpersonationBanner } from '@/components/impersonation-banner'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Only check if user is authenticated
  if (!user) {
    redirect('/login')
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <ImpersonationBanner />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 md:p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
