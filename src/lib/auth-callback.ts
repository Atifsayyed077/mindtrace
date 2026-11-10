/**
 * Shared logic for the interactive auth-exchange route handlers.
 *
 * Handles both link shapes Supabase sends:
 *  - PKCE `?code=...` links (signup confirmation, recovery, magic links)
 *  - `?token_hash=<hash>&type=<type>` links (token-based flows)
 *
 * The handler never echoes credential material back in redirects — only
 * short, safe error tags.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";

const OTP_TYPES = ["signup", "invite", "magiclink", "recovery", "email", "email_change", "email_change_new", "email_change_current"] as const;
type OtpType = (typeof OTP_TYPES)[number];

function asOtpType(v: string | null): OtpType | null {
  return v && (OTP_TYPES as readonly string[]).includes(v) ? (v as OtpType) : null;
}

function safeNext(sp: URLSearchParams): string {
  const n = sp.get("next") ?? "";
  if (n && n.startsWith("/") && !n.startsWith("//") && !/[<>"']/.test(n)) return n;
  return "/dashboard";
}

/** Redirect target for a failed exchange — same-app only, tag-only error codes. */
function failRedirect(request: NextRequest, tag: string): NextResponse {
  const origin = new URL(request.url).origin;
  const url = new URL("/login", origin);
  url.searchParams.set("e", tag);
  return NextResponse.redirect(url);
}

export async function handleAuthExchange(request: NextRequest): Promise<NextResponse> {
  const sp = new URL(request.url).searchParams;

  try {
    const supabase = await createClient();

    const tokenHash = sp.get("token_hash");
    const code = sp.get("code");
    const otpType = asOtpType(sp.get("type")) ?? (tokenHash ? "email" : null);

    if (tokenHash && otpType) {
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: otpType,
      });
      if (error) {
        const emailNotConfirmed = error.code === "email_not_confirmed";
        return failRedirect(request, emailNotConfirmed ? "email_not_confirmed" : "link_problem");
      }
    } else if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) return failRedirect(request, "link_problem");
    } else {
      return failRedirect(request, "missing_code");
    }

    // Success — go to the intended app page.
    const origin = new URL(request.url).origin;
    return NextResponse.redirect(new URL(safeNext(sp), origin));
  } catch {
    // Client construction/network failure — never swallow silently, but keep
    // the response safe and credential-free.
    return failRedirect(request, "server_error");
  }
}
