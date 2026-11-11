import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { SignupForm } from "./signup-form";

/**
 * Signup page (server-rendered). If the visitor already has a live session,
 * there's nothing to sign up for — send them straight to the dashboard.
 */
export default async function SignupPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (data?.user) redirect("/dashboard");

  return <SignupForm />;
}
