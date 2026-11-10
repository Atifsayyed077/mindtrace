import { type NextRequest } from "next/server";
import { handleAuthExchange } from "@/lib/auth-callback";

export const dynamic = "force-dynamic";

/** Alias route for token_hash-style email links (same behavior as /auth/callback). */
export async function GET(request: NextRequest) {
  return handleAuthExchange(request);
}
