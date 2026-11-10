/**
 * Supabase browser client.
 *
 * Used for interactive, client-side operations (autosave, optimistic UI).
 * The publishable key is anonymous-safe and every query is protected by
 * Row Level Security (RLS) policies server-side.
 *
 * Never import secret keys here. RLS is the security boundary.
 */
import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export function assertSupabaseEnv(): { supabaseUrl: string; supabaseKey: string } {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'Supabase is not configured: add NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to .env.local, then restart the dev server.'
    )
  }
  return { supabaseUrl, supabaseKey }
}

/**
 * Returns (and caches) a singleton browser client.
 * createBrowserClient reuses the same instance for identical configuration.
 */
export function createClient() {
  const { supabaseUrl, supabaseKey } = assertSupabaseEnv()
  return createBrowserClient(supabaseUrl, supabaseKey)
}
