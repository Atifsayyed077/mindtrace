/**
 * Next.js 16 request proxy (the `middleware.ts` convention is deprecated
 * and has been renamed to `proxy` in this version).
 *
 * Its only job is to keep Supabase auth sessions refreshed with every
 * request so Server Components always read valid cookies.
 */
import { type NextRequest } from 'next/server'
import { updateSession } from '@/utils/supabase/middleware'

export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|api|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|woff|woff2|txt)$).*)',
  ],
}
