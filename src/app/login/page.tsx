'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sparkles, ArrowLeft, Loader2 } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      if (data.user) {
        // Use user metadata for role
        const userRole = data.user.user_metadata?.role

        if (userRole === 'admin') {
          window.location.href = '/admin'
        } else if (userRole === 'customer') {
          window.location.href = '/dashboard'
        } else {
          // Fallback
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', data.user.id)
            .single()

          if (profile?.role === 'admin') {
            window.location.href = '/admin'
          } else if (profile?.role === 'customer') {
            window.location.href = '/dashboard'
          } else {
            setError('User profile not found or invalid role')
            setLoading(false)
          }
        }
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to login')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-full flex bg-background selection:bg-primary/20">
      {/* Left panel - Decorative */}
      <div className="hidden lg:flex w-1/2 relative bg-zinc-950 flex-col justify-between p-12 overflow-hidden border-r border-border/50">
        <div className="absolute inset-0 z-0">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[120px]" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[120px]" />
        </div>
        
        <div className="relative z-10 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-semibold text-lg text-white tracking-tight">Mini-ATS</span>
        </div>

        <div className="relative z-10 mb-20 text-white max-w-xl text-balance">
          <p className="text-3xl font-medium leading-relaxed tracking-tight mb-6">
            "Mini-ATS has completely transformed how we evaluate candidates. The interface is not just beautiful—it's insanely fast and intuitive."
          </p>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center border border-white/20">
               <span className="font-bold text-lg">AJ</span>
            </div>
            <div>
              <p className="font-medium text-white/90">A. Johansson</p>
              <p className="text-sm text-white/50">Lead Recruiter, TechCorp AB</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right panel - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-6 sm:px-12 relative">
        <Link href="/" className="absolute top-8 left-8 flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors group">
          <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
          Back to Home
        </Link>
        
        <div className="w-full max-w-[400px]">
          <div className="flex flex-col space-y-2 mb-8">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">Welcome back</h1>
            <p className="text-sm text-muted-foreground">
              Enter your email and password to sign in.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">Email address</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11 bg-muted/50 border-border/50 focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary transition-all"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                <Link href="#" className="text-xs text-muted-foreground hover:text-primary transition-colors">Forgot password?</Link>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-11 bg-muted/50 border-border/50 focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary transition-all"
              />
            </div>
            
            {error && (
              <div className="p-3 text-sm text-destructive-foreground bg-destructive/10 border border-destructive/20 rounded-md">
                {error}
              </div>
            )}
            
            <Button 
              type="submit" 
              className="w-full h-11 text-base font-medium rounded-lg" 
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </Button>
          </form>
          
          <div className="mt-8 text-center">
            <p className="text-sm text-muted-foreground">
              Don't have an account?{' '}
              <Link href="#" className="text-primary hover:underline font-medium">
                Request access
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}