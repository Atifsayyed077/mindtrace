import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { getMyProfileAction, type ProfileRow } from "@/app/actions/profile";
import { ProfileClient } from "./profile-client";
import { TopNav } from "@/components/ui";

/**
 * Profile page (server-rendered, then interactive client editing).
 * Defense in depth: the proxy already gates this route, and the component
 * re-verifies auth before touching data.
 */
export default async function ProfilePage() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect("/login?next=/profile");

  let profile: ProfileRow | null = null;
  let schemaMissing = false;
  const res = await getMyProfileAction();
  if (res.ok) {
    profile = res.data;
  } else if (res.detail === "schema-missing") {
    schemaMissing = true;
  }

  return (
    <>
      <TopNav />
      <ProfileClient
        profile={profile}
        email={data.user.email ?? "(unknown)"}
        createdAt={data.user.created_at ?? new Date().toISOString()}
        schemaMissing={schemaMissing}
      />
    </>
  );
}
