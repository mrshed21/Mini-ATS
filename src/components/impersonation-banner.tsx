'use client'

import { useImpersonation } from '@/lib/contexts/impersonation-context'
import { useRouter, usePathname } from 'next/navigation'
import { AlertTriangle, LogOut } from 'lucide-react'

export function ImpersonationBanner() {
  const { impersonating, data, clearImpersonation, isLoaded } = useImpersonation()
  const router = useRouter()
  const pathname = usePathname()

  if (!isLoaded || !impersonating || !data) return null

  // Only show inside dashboard
  if (!pathname.startsWith('/dashboard')) return null

  const handleExit = () => {
    clearImpersonation()
    router.push('/admin/customers')
  }

  return (
    <div className="fixed bottom-6 inset-x-0 mx-auto w-max px-4 py-3 bg-amber-500/90 text-amber-950 backdrop-blur-md rounded-full shadow-2xl border border-amber-400 flex items-center justify-center space-x-3 z-50 animate-in slide-in-from-bottom-5 fade-in duration-500">
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-950/10 shrink-0">
        <AlertTriangle className="w-4 h-4 animate-pulse text-amber-950" />
      </div>
      <div className="flex flex-col">
        <span className="font-bold text-sm leading-none mb-0.5">
          Impersonating {data.role === 'company_admin' ? 'Company Admin' : 'User'}
        </span>
        <span className="text-xs font-medium opacity-80 leading-none">
          {data.userName || data.userEmail}
        </span>
      </div>
      <div className="w-[1px] h-8 bg-amber-950/20 mx-2"></div>
      <button 
        onClick={handleExit}
        className="flex items-center space-x-1.5 bg-amber-950 text-amber-50 px-4 py-2 rounded-full shadow-sm hover:bg-amber-900 hover:shadow-md transition-all text-xs font-bold uppercase tracking-wider"
      >
        <LogOut className="w-3.5 h-3.5" />
        <span>End Session</span>
      </button>
    </div>
  )
}
