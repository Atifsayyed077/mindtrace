"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Neuro } from "@/components/neuro";
import { Icon } from "@/components/icons";
import { ProgressRing } from "@/components/ui";
import { setCurrentUserId, saveUser } from "@/lib/db";
import { UserProfile } from "@/lib/types";
import { createClient } from "@/utils/supabase/client";
import { saveProfileAction } from "@/app/actions/profile";

type Field =
  | { k: string; label: string; sub?: string; type: "text" | "textarea"; placeholder?: string; optional?: boolean }
  | { k: string; label: string; sub?: string; type: "choice"; options: string[]; optional?: boolean };

const FIELDS: Field[] = [
  { k: "name", label: "What should we call you?", sub: "Just a name or nickname. I genuinely cannot pronounce anything more complicated.", type: "text", placeholder: "e.g. Sam" },
  { k: "ageRange", label: "What is your age range?", type: "choice", options: ["Under 18", "18–25", "26–35", "36–45", "46–55", "56+"] },
  { k: "language", label: "What is your preferred language?", sub: "Used for small nudges. Reflections stay language-agnostic.", type: "choice", options: ["English", "हिंदी", "Español", "Français", "Others"] },
  { k: "typicalDay", label: "What does your typical day look like?", sub: "Two honest lines beat a polished essay.", type: "textarea", placeholder: "e.g. Classes till 2, magazine till 5, doom-scrolling till my eyes file a complaint…" },
  { k: "occupation", label: "Are you studying, working, running something — or something else?", type: "choice", options: ["Student", "Working full-time", "Working part-time", "Running a business", "Freelancing", "Home & family care", "Between things", "Other"] },
  { k: "sleepSchedule", label: "How would you describe your sleep schedule?", type: "choice", options: ["Excellent", "Good", "Fair", "Poor", "Very Poor"] },
  { k: "exercise", label: "How often do you exercise?", type: "choice", options: ["Daily", "3–4 times/week", "1–2 times/week", "Rarely", "Never"] },
  { k: "socialLife", label: "How would you describe your social life?", type: "choice", options: ["Very active", "Somewhat active", "Moderate", "Limited", "Mostly solo"] },
  { k: "stressed", label: "Do you currently feel stressed?", sub: "Honesty helps the report more than bravery does.", type: "choice", options: ["Yes", "Not really"] },
  { k: "motivation", label: "What's the main reason you want to understand yourself better?", type: "textarea", placeholder: "e.g. everyone keeps saying I seem off, and I want to know what they see" },
  { k: "previousSupport", label: "Have you ever had any form of mental health support?", sub: "Optional and respected, never judged.", type: "choice", options: ["Yes", "No", "Prefer not to say"], optional: true },
  { k: "concerns", label: "Anything currently on your mind? (optional)", type: "textarea", optional: true },
  { k: "accessibility", label: "Any accessibility needs we should respect? (optional)", sub: "The calm visuals are already the default here.", type: "text", optional: true },
];

export default function OnboardingPage() {
  const nav = useRouter();
  const [step, setStep] = useState(-1); // -1 welcome · 0..N-1 fields · N consent
  const [name, setName] = useState("");
  const [answers, setAnswers] = useState<Partial<UserProfile>>({});
  const [consent, setConsent] = useState({ data: false, mind: false });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const total = FIELDS.length;

  /* draft persistence — refresh-proof onboarding */
  useEffect(() => {
    try {
      const draft = localStorage.getItem("mindtrace:ob-draft");
      if (draft) { const d = JSON.parse(draft); setName(d.name ?? ""); setAnswers(d.answers ?? {}); }
    } catch { /* fresh */ }
  }, []);
  useEffect(() => {
    window.localStorage.setItem("mindtrace:ob-draft", JSON.stringify({ name, answers }));
  }, [name, answers]);

  const value = (k: string): string => (k === "name" ? name : (answers as Record<string, string>)[k] ?? "");
  const setValue = (k: string, v: string) => (k === "name" ? setName(v) : setAnswers((a) => ({ ...a, [k]: v })));

  const field = step >= 0 && step < total ? FIELDS[step] : null;

  const next = async () => {
    if (field) {
      if (field.type === "choice" && !value(field.k)) { setError("Pick one — it keeps the journey honest."); return; }
      if (field.k === "name" && !name.trim()) { setError("I need something to call you. 'Brainy McReflects' is acceptable too."); return; }
      setError("");
      setStep(step + 1);
      return;
    }
    if (step === total) {
      setBusy(true);
      setError("");
      try {
        const supabase = createClient();
        const { data: ud } = await supabase.auth.getUser();
        if (!ud.user) {
          setError("Your session slipped away. Log in again and I'll pick up right here.");
          setBusy(false);
          return;
        }
        const uid = ud.user.id;
        const p = answers as Partial<UserProfile>;
        /* Local mirror (this browser) — kept for offline drafts; the DB is the source of truth. */
        saveUser({
          id: uid,
          name: name.trim(),
          createdAt: new Date().toISOString(),
          consent: { accepted: true, at: new Date().toISOString(), understoodNotMedical: consent.mind, understoodStorageLocal: consent.data },
          profile: {
            ageRange: (p.ageRange as UserProfile["ageRange"]) ?? "",
            language: p.language ?? "English",
            typicalDay: p.typicalDay ?? "",
            occupation: p.occupation ?? "",
            sleepSchedule: p.sleepSchedule ?? "",
            exercise: p.exercise ?? "",
            socialLife: p.socialLife ?? "",
            stressed: (p.stressed as UserProfile["stressed"]) ?? "",
            motivation: p.motivation ?? "",
            previousSupport: (p.previousSupport as UserProfile["previousSupport"]) ?? "",
            concerns: p.concerns ?? "",
            accessibility: p.accessibility ?? "",
            reminderTime: "20:00",
          },
          councilLegend: false,
        });
        setCurrentUserId(uid);
        /* Source of truth: profiles row (RLS-scoped to this user). */
        const saved = await saveProfileAction({
          full_name: name.trim(),
          age_range: (p.ageRange as string) ?? "",
          preferred_language: p.language ?? "English",
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
          context: { ...answers, name: name.trim() } as Record<string, string>,
          consent: {
            accepted: true,
            at: new Date().toISOString(),
            understood_not_medical: consent.mind,
            understood_storage: consent.data,
          },
        });
        if (!saved.ok) {
          const why =
            saved.error === "RATE_LIMITED"
              ? " — too many attempts, wait half a minute"
              : saved.error === "AUTH_REQUIRED"
                ? " — your session ended"
                : " — the database is away";
          setError(
            `Your answers live safely in this browser, but binding them to your account failed${why}. Press again to retry — nothing is lost.`
          );
          setBusy(false);
          return;
        }
        localStorage.removeItem("mindtrace:ob-draft");
        nav.replace("/journey");
      } catch {
        setError("A network hiccup interrupted the binding. Again? Nothing is lost.");
        setBusy(false);
      }
    }
  };

  const pct = step < 0 ? 4 : step >= total ? 97 : Math.round(((step + 0.5) / (total + 1)) * 92);
  const consentOpen = step >= total;

  return (
    <main className="flex-1 flex flex-col">
      <div className="max-w-xl w-full mx-auto px-5 py-8 flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => (step > -1 ? setStep(step - 1) : nav.push("/"))}
            className="btn btn-ghost !px-4 !py-2 text-sm"
          >
            <Icon name="chevron-left" size={16} /> {step > -1 ? "Back" : "Exit"}
          </button>
          <ProgressRing pct={Math.max(4, pct)} size={72} />
        </div>

        {step === -1 && (
          <div className="text-center animate-pop-in">
            <div className="animate-floaty inline-block"><Neuro size={150} mood="wave" /></div>
            <h1 className="font-display font-bold text-3xl text-navy-800 mt-4">Hi. I&apos;m Neuro. 🧠</h1>
            <p className="text-ink-muted leading-relaxed mt-3 max-w-md mx-auto">
              Think of this as a friendly chat in installments — <strong>{total} small questions</strong>, then one consent page.
              Everything you say stays in your own private account — readable only by you. Difficult questions can be skipped — even I can&apos;t read minds,
              and I&apos;m literally a brain mascot.
            </p>
            <button onClick={() => setStep(0)} className="btn btn-primary mt-8 px-8">
              Okay, let&apos;s talk <Icon name="chevron-right" size={17} />
            </button>
          </div>
        )}

        {field && (
          <div key={step} className="animate-rise">
            <div className="text-[0.7rem] font-bold tracking-wider uppercase text-lav-600 mb-2">
              {step + 1} of {total}{field.optional ? " · optional" : ""}
            </div>
            <h1 className="font-display font-bold text-[1.65rem] leading-snug text-navy-800">{field.label}</h1>
            {field.sub && <p className="text-ink-muted text-sm mt-2">{field.sub}</p>}

            {field.type === "text" && (
              <input
                autoFocus
                className="field mt-6"
                placeholder={field.placeholder ?? "Type here…"}
                maxLength={140}
                value={value(field.k)}
                onChange={(e) => { setValue(field.k, e.target.value); setError(""); }}
              />
            )}
            {field.type === "textarea" && (
              <textarea
                autoFocus
                className="field mt-6"
                placeholder={field.placeholder ?? "Take your time…"}
                value={value(field.k)}
                onChange={(e) => setValue(field.k, e.target.value)}
              />
            )}
            {field.type === "choice" && (
              <div className="grid gap-2.5 mt-6">
                {field.options.map((o) => {
                  const sel = value(field.k) === o;
                  return (
                    <button
                      key={o}
                      onClick={() => { setValue(field.k, o); setError(""); }}
                      className={`text-left px-4 py-3.5 rounded-2xl border-2 transition-all duration-200 font-medium text-[0.93rem] ${
                        sel
                          ? "border-lav-600 bg-lav-100 text-navy-800 translate-x-1 shadow-card"
                          : "border-lav-100 bg-white text-ink-muted hover:border-lav-400 hover:translate-x-0.5"
                      }`}
                    >
                      {o}
                    </button>
                  );
                })}
              </div>
            )}

            {error && <p className="text-danger text-sm mt-3">{error}</p>}
            <button onClick={next} className="btn btn-primary w-full mt-7">
              {step === total - 1 ? "Next — last field ⏳" : "Next"} <Icon name="chevron-right" size={17} />
            </button>
            {field.optional || field.type === "textarea" ? (
              <button
                onClick={() => { setValue(field.k, ""); setStep(step + 1); }}
                className="text-xs text-ink-faint mt-3 hover:text-ink-muted underline underline-offset-2"
              >
                skip this one
              </button>
            ) : null}
          </div>
        )}

        {consentOpen && (
          <div className="animate-rise">
            <div className="text-[0.7rem] font-bold tracking-wider uppercase text-teal-700 mb-2">Consent — read once, click twice</div>
            <h1 className="font-display font-bold text-[1.6rem] text-navy-800">Two promises to agree with proudly.</h1>

            <div className="space-y-3.5 mt-6">
              <button
                onClick={() => setConsent((c) => ({ ...c, data: !c.data }))}
                className={`text-left w-full p-4 rounded-2xl border-2 transition-all ${consent.data ? "border-teal-500 bg-teal-100" : "border-lav-100 bg-white"}`}
              >
                <div className="flex items-start gap-3">
                  <span className={`grid place-items-center w-6 h-6 shrink-0 rounded-lg border-2 ${consent.data ? "bg-teal-500 border-teal-500 text-white" : "border-lav-300"}`}>
                    <Icon name={consent.data ? "check" : "minus"} size={15} />
                  </span>
                  <span className="text-[0.92rem] leading-relaxed text-ink-muted">
                    <strong className="text-ink">My answers stay in my private account.</strong> I understand data is stored
                    in my own encrypted database row, I can export or delete it anytime, and no one else — not even
                    MindTrace&apos;s operators — can read it.
                  </span>
                </div>
              </button>

              <button
                onClick={() => setConsent((c) => ({ ...c, mind: !c.mind }))}
                className={`text-left w-full p-4 rounded-2xl border-2 transition-all ${consent.mind ? "border-teal-500 bg-teal-100" : "border-lav-100 bg-white"}`}
              >
                <div className="flex items-start gap-3">
                  <span className={`grid place-items-center w-6 h-6 shrink-0 rounded-lg border-2 ${consent.mind ? "bg-teal-500 border-teal-500 text-white" : "border-lav-300"}`}>
                    <Icon name={consent.mind ? "check" : "minus"} size={15} />
                  </span>
                  <span className="text-[0.92rem] leading-relaxed text-ink-muted">
                    <strong className="text-ink">MindTrace is self-reflection, not medicine.</strong> It doesn&apos;t diagnose, treat or
                    replace professional care; if I need a human, 14416 / 112 are real people ready to listen.
                  </span>
                </div>
              </button>
            </div>

            <div className="mt-6 p-4 rounded-2xl bg-lav-50 flex gap-3">
              <div className="shrink-0"><Neuro size={46} mood="thinking" blink={false} /></div>
              <p className="text-[0.85rem] text-ink-muted leading-relaxed">
                One sensitive note: if a message you write later looks like it&apos;s about self-harm, I&apos;ll pause the flow and show
                real help lines. That&apos;s not me being a snitch — it&apos;s me being a friend with excellent referrals.
              </p>
            </div>

            <button onClick={next} disabled={!(consent.data && consent.mind) || busy} className="btn btn-primary w-full mt-7">
              {busy ? "Binding your journey to your account…" : "Create my journey & go 🚀"} <Icon name="chevron-right" size={17} />
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
