import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function JobsLayout({
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

  return <>{children}</>
}
