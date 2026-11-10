/**
 * Supabase server client (Server Components, Server Actions, Route Handlers).
 *
 * Uses the Next.js-cookies adapter of @supabase/ssr so auth state is shared
 * between server and client and sessions are refreshed by the proxy.
 *
 * `cookies()` is async in this Next.js version, so this helper is async.
 */
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export function assertServerSupabaseEnv(): { supabaseUrl: string; supabaseKey: string } {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'Supabase is not configured: add NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to .env.local, then restart the server.'
    )
  }
  return { supabaseUrl, supabaseKey }
}

/**
 * Creates a Supabase client bound to the current request's cookies.
 * Must be awaited, because `cookies()` is async.
 */
export async function createClient() {
  const { supabaseUrl, supabaseKey } = assertServerSupabaseEnv()
  const cookieStore = await cookies()

  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {
          // `setAll` can be invoked from a Server Component render where
          // cookie writes are not allowed. That is safe to ignore here:
          // the proxy refreshes sessions before rendering.
        }
      },
    },
  })
}
