import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { safeNext } from "@/lib/auth";
import { LoginForm } from "./login-form";

/**
 * Login page (server-rendered).
 * - Reads ?next= / ?e= server-side (Next 16: searchParams is a Promise) and
 *   passes them as props — no useSearchParams, so the form is in the HTML.
 * - Already signed in? Skip the form entirely and go straight to where the
 *   user was heading (or the dashboard) — the app "knows you already have
 *   an account".
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const rawNext = Array.isArray(sp.next) ? sp.next[0] : sp.next;
  const rawTag = Array.isArray(sp.e) ? sp.e[0] : sp.e;
  const next = safeNext(rawNext ?? "");

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (data?.user) redirect(next);

  return <LoginForm next={next} tag={rawTag ?? ""} />;
}
