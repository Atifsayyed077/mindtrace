'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';

/**
 * Server action: revoke the Supabase session and clear auth cookies.
 * Client components clean their localStorage draft mirror separately
 * (see clearLocalMirror in src/lib/auth.ts) before invoking this.
 */
export async function signOutAction() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  if (error) {
    // Still kill the local cookies so the browser session is gone.
    redirect('/login');
  }
  redirect('/');
}
