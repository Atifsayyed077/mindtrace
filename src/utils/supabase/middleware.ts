/**
 * Proxy (formerly "middleware") helper that:
 *   1. keeps Supabase auth sessions fresh on every request, and
 *   2. enforces route protection (redirects instead of relying only on
 *      component-level checks).
 *
 * Next.js 16 renamed the `middleware.ts` convention to `proxy.ts` —
 * see src/proxy.ts, which calls this module.
 */
import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

/** Pages that require a signed-in user. */
const PROTECTED = [
  '/dashboard',
  '/journey',
  '/report',
  '/certificate',
  '/onboarding',
  '/companion',
  '/admin',
  '/profile',
  '/reset-password',
]

/** Pages reserved for signed-out visitors. */
const GUEST_ONLY = ['/login', '/signup', '/forgot-password']

function unauthTarget(path: string): string {
  return path === '/reset-password' ? '/forgot-password' : '/login'
}

export async function updateSession(request: NextRequest): Promise<NextResponse> {
  const url = request.nextUrl

  // Email-confirmation links can land on the app root as /?code=... when the
  // Supabase dashboard "Site URL" is the bare app origin. Hand these to the
  // exchange route instead of rendering the landing page with a stray param.
  if (url.pathname === '/' && url.searchParams.has('code')) {
    const ex = new URL('/auth/callback', url.origin)
    ex.searchParams.set('code', url.searchParams.get('code') ?? '')
    return NextResponse.redirect(ex)
  }

  // Start with an unmodified response that carries the request through.
  let supabaseResponse = NextResponse.next({ request })

  if (!supabaseUrl || !supabaseKey) {
    // Fail loudly but without revealing credential values. Pages will render,
    // but protected routes cannot be authorized without a client.
    console.error(
      'Supabase is not configured: proxy session refresh skipped. ' +
        'Check NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.'
    )
    return supabaseResponse
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        supabaseResponse = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        )
      },
    },
  })

  // getUser() revalidates the token server-side (getSession() would trust
  // cookie contents without verification).
  let userId: string | null = null
  try {
    const { data, error } = await supabase.auth.getUser()
    if (!error && data.user) userId = data.user.id
  } catch (error) {
    // Network/other failures must not break page loads. RLS still prevents
    // unauthorized data access; session refresh will be retried next request.
    console.error('[proxy] Supabase session refresh failed:', error)
  }

  const isFirstSegmentProtected = PROTECTED.some(
    (p) => url.pathname === p || url.pathname.startsWith(p + '/')
  )

  if (isFirstSegmentProtected && !userId) {
    const target = new URL(unauthTarget(url.pathname), url.origin)
    target.searchParams.set('next', url.pathname)
    return NextResponse.redirect(target)
  }

  const isFirstSegmentGuestOnly = GUEST_ONLY.some(
    (p) => url.pathname === p || url.pathname.startsWith(p + '/')
  )
  if (isFirstSegmentGuestOnly && userId) {
    return NextResponse.redirect(new URL('/dashboard', url.origin))
  }

  return supabaseResponse
}
