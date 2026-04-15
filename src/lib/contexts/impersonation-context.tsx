'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'

export interface ImpersonationData {
  userId: string
  userEmail: string
  userName: string
  companyId: string
  isAdmin?: boolean
  impersonating?: boolean
}

interface ImpersonationState {
  impersonating: boolean
  data: ImpersonationData | null
  setImpersonation: (data: ImpersonationData) => void
  clearImpersonation: () => void
  isLoaded: boolean
}

const ImpersonationContext = createContext<ImpersonationState | undefined>(undefined)

export function ImpersonationProvider({ children }: { children: React.ReactNode }) {
  const [impersonating, setImpersonating] = useState(false)
  const [data, setData] = useState<ImpersonationData | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  
  useEffect(() => {
    const stored = localStorage.getItem('ats_impersonation')
    if (stored) {
      try {
        const parsedData = JSON.parse(stored)
        setData(parsedData)
        setImpersonating(true)
      } catch (e) {
        localStorage.removeItem('ats_impersonation')
      }
    }
    setIsLoaded(true)
  }, [])

  function setImpersonation(newData: ImpersonationData) {
    const enrichedData = { ...newData, isAdmin: true, impersonating: true }
    localStorage.setItem('ats_impersonation', JSON.stringify(enrichedData))
    setData(enrichedData)
    setImpersonating(true)
  }

  function clearImpersonation() {
    localStorage.removeItem('ats_impersonation')
    setData(null)
    setImpersonating(false)
  }

  // Notice we render children immediately but AuthGuard will wait for isLoaded to be true
  return (
    <ImpersonationContext.Provider value={{ impersonating, data, setImpersonation, clearImpersonation, isLoaded }}>
      {children}
    </ImpersonationContext.Provider>
  )
}

export function useImpersonation() {
  const context = useContext(ImpersonationContext)
  if (context === undefined) {
    throw new Error('useImpersonation must be used within an ImpersonationProvider')
  }
  return context
}

export function getEffectiveUserId(impersonating: boolean, impData: ImpersonationData | null, loggedInUserId: string | undefined): string | undefined {
  return impersonating && impData ? impData.userId : loggedInUserId
}

export function getEffectiveCompanyId(impersonating: boolean, impData: ImpersonationData | null, loggedInCompanyId: string | undefined): string | undefined {
  return impersonating && impData ? impData.companyId : loggedInCompanyId
}
