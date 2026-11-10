import { type NextRequest } from "next/server";
import { handleAuthExchange } from "@/lib/auth-callback";

export const dynamic = "force-dynamic";

/** PKCE code exchange + OTP token exchanges arrive here from email links. */
export async function GET(request: NextRequest) {
  return handleAuthExchange(request);
}
