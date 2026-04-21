'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useImpersonation } from '@/lib/contexts/impersonation-context'

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { isLoaded, impersonating } = useImpersonation()
  const [authorized, setAuthorized] = useState<boolean | null>(null)
  
  useEffect(() => {
    if (!isLoaded) return // wait for impersonation context to parse localStorage

    async function checkAuth() {
      // Do nothing on public or login routes
      if (pathname === '/login' || pathname === '/') {
        setAuthorized(true)
        return
      }

      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.replace('/login')
        return
      }

      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      const role = profile?.role || user.user_metadata?.role

      if (pathname.startsWith('/admin')) {
        // Admin routes -> Must be admin AND NOT impersonating
        if (role === 'admin' && !impersonating) {
          setAuthorized(true)
        } else {
          router.replace('/dashboard')
        }
      } else if (pathname.startsWith('/dashboard') || pathname.startsWith('/jobs')) {
        // Dashboard routes -> company_admin, customer, or impersonating admin
        if (role === 'company_admin' || role === 'customer' || (role === 'admin' && impersonating)) {
          setAuthorized(true)
        } else {
          router.replace('/admin/customers')
        }
      } else {
        setAuthorized(true)
      }
    }
    
    checkAuth()
  }, [isLoaded, pathname, impersonating, router])

  if (!isLoaded || authorized === null) {
     return (
        <div className="flex items-center justify-center min-h-screen bg-background">
           <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
        </div>
     )
  }

  return <>{children}</>
}