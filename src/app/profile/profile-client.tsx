"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SectionTitle, Badge } from "@/components/ui";
import { Neuro } from "@/components/neuro";
import { Icon } from "@/components/icons";
import { saveProfileAction, type ProfileRow } from "@/app/actions/profile";
import { deleteMyAccountAction, getMyExportAction } from "@/app/actions/account";
import { clearLocalMirror, } from "@/lib/auth";
import { AGE_RANGES } from "@/lib/validation";

export function ProfileClient({
  profile,
  email,
  createdAt,
  schemaMissing = false,
}: {
  profile: ProfileRow | null;
  email: string;
  createdAt: string;
  schemaMissing?: boolean;
}) {
  const nav = useRouter();
  const [name, setName] = useState(profile?.full_name ?? "");
  const [age, setAge] = useState(profile?.age_range ?? "");
  const [lang, setLang] = useState(profile?.preferred_language ?? "English");
  const [tz, setTz] = useState(profile?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<"" | "ok" | "err">("");
  const [msg, setMsg] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function save() {
    setBusy(true);
    setSaved("");
    const res = await saveProfileAction({
      full_name: name,
      age_range: age,
      preferred_language: lang,
      timezone: tz,
      context: (profile?.context ?? {}) as Record<string, string | boolean>,
      consent: (profile?.consent ?? {}) as Record<string, unknown> as {
        accepted: boolean;
        understood_not_medical: boolean;
        understood_storage: boolean;
        at?: string;
      },
    });
    if (res.ok) {
      setSaved("ok");
      setTimeout(() => setSaved(""), 2200);
    } else {
      setSaved("err");
      setMsg(
        res.error === "RATE_LIMITED"
          ? "Too many save attempts — pause a moment, then retry."
          : res.error === "AUTH_REQUIRED"
            ? "Your session expired. Log in again to continue."
            : "Save failed on the server. Your work isn't lost — try again in a moment."
      );
    }
    setBusy(false);
  }

  async function exportAll() {
    setBusy(true);
    const res = await getMyExportAction();
    if (res.ok) {
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `mindtrace-export-${(name || "me").toLowerCase().replace(/\s+/g, "-")}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    } else {
      setMsg("Export failed — try again in a moment.");
    }
    setBusy(false);
  }

  async function deleteAccount() {
    if (confirmText.trim().toUpperCase() !== "DELETE") {
      setMsg("Type DELETE (all caps) to confirm account deletion.");
      return;
    }
    setDeleting(true);
    clearLocalMirror();
    const res = await deleteMyAccountAction();
    if (res.ok) {
      nav.replace("/?farewell=1");
    } else {
      setDeleting(false);
      setMsg(
        res.error === "RATE_LIMITED"
          ? "Too many requests — wait a moment before deleting."
          : "Deletion failed safely. Nothing was erased; try again shortly."
      );
    }
  }

  const created = new Date(createdAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });

  return (
    <main className="flex-1 w-full">
      <div className="max-w-2xl mx-auto px-5 py-10 space-y-8">
        <div className="flex items-center gap-4">
          <div className="animate-floaty shrink-0"><Neuro size={74} mood="wave" /></div>
          <div>
            <h1 className="font-display font-bold text-3xl text-navy-800">Your profile</h1>
            <p className="text-ink-muted text-sm mt-1">
              Private to you. Bits live in your account, protected database-side. 🧠
            </p>
          </div>
        </div>

        {schemaMissing && (
          <section className="card p-6 border-lav-300 bg-lav-50">
            <div className="flex items-start gap-3">
              <span className="grid place-items-center w-9 h-9 shrink-0 rounded-xl bg-gold-100 text-gold-600">
                <Icon name="warning" size={18} />
              </span>
              <div>
                <h2 className="font-bold text-ink">Backend not initialized yet</h2>
                <p className="text-sm text-ink-muted mt-1 leading-relaxed">
                  The Supabase tables don&apos;t exist yet. Run <code className="px-1.5 py-0.5 rounded bg-white border border-lav-100">supabase/MIGRATE.sql</code> once
                  in the Supabase SQL editor (dashboard → SQL Editor → New query → paste → Run). Everything here stays
                  editable meanwhile — nothing is lost.
                </p>
                <button className="btn btn-ghost !py-2 !px-4 text-sm mt-3" onClick={() => nav.refresh()}>
                  I ran it — refresh
                </button>
              </div>
            </div>
          </section>
        )}

        <section className="card p-6">
          <SectionTitle icon="brain" title="Account" sub="Managed by Supabase Auth — passwords never live in this app." />
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <div className="p-3.5 rounded-2xl bg-lav-50">
              <div className="text-xs font-semibold text-ink-faint uppercase tracking-wider">Email</div>
              <div className="text-ink font-medium mt-0.5 break-all">{email}</div>
            </div>
            <div className="p-3.5 rounded-2xl bg-lav-50">
              <div className="text-xs font-semibold text-ink-faint uppercase tracking-wider">Member since</div>
              <div className="text-ink font-medium mt-0.5">{created}</div>
            </div>
          </div>
        </section>

        <section className="card p-6">
          <SectionTitle icon="heart" title="Profile details" sub="Editable anytime. Saved straight to your profiles row." />
          <div className="space-y-4">
            <div>
              <label className="text-sm font-semibold text-ink" htmlFor="pf-name">Full name</label>
              <input id="pf-name" className="field w-full mt-1.5" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold text-ink" htmlFor="pf-age">Age range</label>
                <select id="pf-age" className="field w-full mt-1.5" value={age} onChange={(e) => setAge(e.target.value)}>
                  <option value="">Not shared</option>
                  {AGE_RANGES.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-semibold text-ink" htmlFor="pf-lang">Preferred language</label>
                <input id="pf-lang" className="field w-full mt-1.5" value={lang} maxLength={40} onChange={(e) => setLang(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="text-sm font-semibold text-ink" htmlFor="pf-tz">Timezone (drives day boundaries & streaks)</label>
              <input id="pf-tz" className="field w-full mt-1.5" value={tz} maxLength={80} onChange={(e) => setTz(e.target.value)} />
            </div>
            <div className="flex items-center gap-3 pt-1">
              <button className="btn btn-primary" onClick={save} disabled={busy || !name.trim()}>
                {busy ? "Saving…" : "Save changes"}
              </button>
              {saved === "ok" && <Badge tone="ok">Saved ✓</Badge>}
              {saved === "err" && <Badge tone="danger">Not saved</Badge>}
            </div>
            {msg && <p className="text-danger text-sm">{msg}</p>}
          </div>
        </section>

        <section className="card p-6">
          <SectionTitle icon="sparkle" title="Your data, under your control" sub="Exports contain sensitive reflections — store them carefully." />
          <div className="flex flex-wrap gap-3">
            <button className="btn btn-ghost" onClick={exportAll} disabled={busy}>Export everything (JSON)</button>
          </div>
        </section>

        <section className="card p-6 border-[#f2caca]">
          <SectionTitle icon="warning" title="Delete account & erase data" sub="Removes journeys, answers, journal, reports and certificates for THIS user via secure deletes. The bare sign-in record can only be purged by the project owner in the Supabase dashboard." />
          <input
            className="field w-full max-w-xs"
            placeholder="type DELETE to confirm"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
          />
          <div className="mt-3">
            <button className="btn btn-primary" disabled={deleting} onClick={deleteAccount}>
              {deleting ? "Erasing…" : "Permanently delete my account"}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
