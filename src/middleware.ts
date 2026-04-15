import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
          })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const isProtectedRoute = 
    request.nextUrl.pathname.startsWith('/admin') ||
    request.nextUrl.pathname.startsWith('/dashboard') ||
    request.nextUrl.pathname.startsWith('/jobs');

  // If not logged in and requesting a protected route, redirect to login
  if (!user && isProtectedRoute) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user) {
    // 1. Logged in users visiting /login or / get redirected to their default dashboard
    if (request.nextUrl.pathname === '/login' || request.nextUrl.pathname === '/') {
       // We'll let the application redirect appropriately via client-side or we can fetch role here just for initial login routing
       const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
       const role = profile?.role || user.user_metadata?.role;
       if (role === 'admin') {
         return NextResponse.redirect(new URL('/admin', request.url))
       } else {
         return NextResponse.redirect(new URL('/dashboard', request.url))
       }
    }
  }

  // Let the application handle everything else
  return NextResponse.next({
    request: {
      headers: request.headers,
    },
  })
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
