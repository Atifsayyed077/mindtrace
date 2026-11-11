import Link from "next/link";
import { Neuro } from "@/components/neuro";
import { Icon } from "@/components/icons";
import { DAY_THEMES } from "@/lib/questions";

export default function LandingPage() {
  return (
    <main className="flex-1">
      <LandingHero />
      <WhyMindTrace />
      <SevenDayCards />
      <WhatYouReceive />
      <PrivacySection />
      <CTASection />
      <FooterMini />
    </main>
  );
}

function LandingHero() {
  return (
    <section className="relative overflow-hidden">
      <div className="max-w-6xl mx-auto px-5 sm:px-8 pt-16 pb-14 md:pt-24 md:pb-20 relative">
        <div className="absolute -left-24 top-24 w-72 h-72 rounded-full bg-lav-200/50 blur-3xl animate-floaty" aria-hidden />
        <div className="absolute right-0 bottom-0 w-80 h-80 rounded-full bg-teal-100 blur-3xl" aria-hidden />

        <div className="relative text-center max-w-3xl mx-auto">
          <span className="chip animate-rise">🧠 a private 7-day journey — everything stays on your device</span>
          <h1 className="font-display font-bold text-4xl sm:text-5xl md:text-[4.2rem] leading-[1.05] tracking-tight text-navy-800 mt-6 animate-rise" style={{ animationDelay: "80ms" }}>
            Seven Days. A Better <span className="relative inline-block">Understanding<svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 220 12" fill="none" aria-hidden><path d="M3 9c40-7 120-9 214-4" stroke="#9adcd6" strokeWidth="6" strokeLinecap="round" /></svg></span> of Yourself.
          </h1>
          <p className="text-ink-muted text-lg md:text-xl leading-relaxed mt-7 animate-rise" style={{ animationDelay: "160ms" }}>
            Your thoughts, emotions, habits and everyday experiences matter. Take five minutes every day to understand yourself a little better.
          </p>

          <div className="flex flex-col sm:flex-row gap-3.5 justify-center mt-9 animate-rise" style={{ animationDelay: "240ms" }}>
            <Link href="/onboarding" className="btn btn-primary text-[1rem] px-7">
              Start My 7-Day Journey <Icon name="chevron-right" size={17} />
            </Link>
            <a href="#how" className="btn btn-ghost text-[1rem] px-7">Discover How It Works</a>
          </div>
          <p className="text-sm text-ink-muted mt-5 animate-rise" style={{ animationDelay: "280ms" }}>
            Already have an account?{" "}
            <Link href="/login" className="text-navy-700 underline hover:text-lav-500">Log in</Link>
            <span className="text-ink-faint"> · </span>
            <Link href="/signup" className="text-navy-700 underline hover:text-lav-500">Sign up</Link>
          </p>

          <div className="mt-12 flex items-center justify-center gap-4 animate-rise" style={{ animationDelay: "330ms" }}>
            <div className="animate-floaty"><Neuro size={140} mood="happy" /></div>
            <p className="text-left text-sm text-ink-muted max-w-[240px] border-l-2 border-lav-200 pl-4">
              <span className="font-semibold text-ink">Neuro here.</span> I&apos;m your reflection companion.
              I ask, I listen, I remember <span className="text-ink-faint">(on your device, not mine — I don&apos;t even have one)</span>.
            </p>
          </div>
        </div>

        <div className="relative mt-16 grid grid-cols-3 gap-3 max-w-2xl mx-auto">
          {[
            { k: "5", v: "minutes a day" },
            { k: "7", v: "tribes of questions" },
            { k: "∞", v: "knows everything, says nothing" },
          ].map((s) => (
            <div key={s.v} className="card p-4 text-center card-lift">
              <div className="font-display text-2xl sm:text-3xl font-bold text-navy-700">{s.k}</div>
              <div className="text-[0.72rem] text-ink-faint mt-1 font-medium">{s.v}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function WhyMindTrace() {
  return (
    <section className="px-5 sm:px-8 py-16 md:py-20" id="why">
      <div className="max-w-6xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <h2 className="font-display font-bold text-3xl md:text-4xl text-navy-800">Why MindTrace?</h2>
          <p className="text-ink-muted mt-3 leading-relaxed">
            Most of us spend the day answering everyone else — messages, deadlines, expectations. The one person we never ask
            anything is ourselves. MindTrace carves out five structured minutes a day to quietly check in.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { e: "🔍", t: "How you actually feel", d: "Beyond the reflexive 'I'm fine.' Small honest answers, tracked kindly." },
            { e: "🌤️", t: "What lifts you up", d: "The moments that made you smile — collected into a 7-day gallery of good." },
            { e: "⚡", t: "What stresses you", d: "You name the weight in your head; the report connects it to your patterns." },
            { e: "🌙", t: "How habits shape days", d: "Sleep, movement, scroll time and outdoors — the quiet drivers of mood." },
            { e: "🫂", t: "How people affect you", d: "Belonging, support, boundaries — the social weather of your week." },
            { e: "🔧", t: "What you want to change", d: "The report turns 'someday' into a plan with one anchor at a time." },
          ].map((c, i) => (
            <div key={i} className="card p-5 card-lift animate-rise" style={{ animationDelay: `${i * 60}ms` }}>
              <div className="text-3xl mb-2.5">{c.e}</div>
              <h3 className="font-semibold text-ink">{c.t}</h3>
              <p className="text-sm text-ink-muted mt-1.5 leading-relaxed">{c.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function SevenDayCards() {
  return (
    <section id="how" className="px-5 sm:px-8 py-16 md:py-20 ornate">
      <div className="max-w-6xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <span className="chip">7 days · 5 min/day · ~1% of your awake time</span>
          <h2 className="font-display font-bold text-3xl md:text-4xl text-navy-800 mt-4">Your Seven-Day Journey</h2>
          <p className="text-ink-muted mt-3">A different theme every day. No repeated questions. One unexpected wildcard per session, on me. 🎲</p>
        </div>

        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          {DAY_THEMES.map((d, i) => (
            <div key={d.day} className={`card p-5 card-lift relative overflow-hidden animate-rise ${i === 6 ? "sm:col-span-2 lg:col-span-4 lg:flex lg:items-center lg:gap-6" : ""}`} style={{ animationDelay: `${i * 70}ms` }}>
              <div className="flex items-start gap-3.5">
                <div className="grid place-items-center w-11 h-11 rounded-2xl bg-navy-800 text-white font-display font-bold text-lg shrink-0">{d.day}</div>
                <div>
                  <div className="font-semibold text-ink">{d.emoji} {d.title}</div>
                  <p className="text-sm text-ink-muted mt-1 leading-relaxed">{d.blurb}</p>
                </div>
              </div>
              {i === 6 && (
                <div className="mt-5 lg:mt-0 lg:ml-auto shrink-0 chip bg-teal-100 text-teal-700">
                  🎓 unlocks: full report + certificate + 30-day continuation
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-8 card p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="text-2xl">🫶</div>
          <p className="text-sm text-ink-muted leading-relaxed">
            <span className="font-semibold text-ink">The Neuro guarantee:</span> you can skip <em>any</em> question you don&apos;t feel like answering —
            boundaries count as answers too. Missed a day? Nothing breaks. Shame is not a feature here.
          </p>
        </div>
      </div>
    </section>
  );
}

function WhatYouReceive() {
  return (
    <section className="px-5 sm:px-8 py-16 md:py-20">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="font-display font-bold text-3xl md:text-4xl text-navy-800">What You Receive</h2>
          <p className="text-ink-muted mt-3 max-w-2xl mx-auto">A complete discovery package at the end of the seven days — generated locally from <em>your</em> answers only.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { i: "chart", t: "Personal wellness report", d: "A full seven-day narrative analyses your emotions, habits, relationships, stress and direction.", tone: "lav" },
            { i: "wave", t: "Emotional pattern visualization", d: "Day-by-day mood line, stress trend and the emotion words you reached for most.", tone: "teal" },
            { i: "leaf", t: "Lifestyle insights", d: "Sleep averages, movement days, outdoor days and screen time — quietly compared.", tone: "gold" },
            { i: "heart", t: "Strengths with evidence", d: "Only patterns your own answers support — never invented traits.", tone: "lav" },
            { i: "sun", t: "Personal wellness action plan", d: "START · REDUCE · CONTINUE · AVOID — matched to your week, plus a daily routine.", tone: "teal" },
            { i: "award", t: "Certificate of completion", d: "A premium downloadable PDF with a unique ID and QR verification. Show it off.", tone: "gold" },
          ].map((c, i) => (
            <div key={i} className="card p-5 card-lift animate-rise" style={{ animationDelay: `${i * 60}ms` }}>
              <span className="grid place-items-center w-10 h-10 rounded-xl bg-lav-100 text-navy-700 mb-3"><Icon name={c.i} size={18} /></span>
              <h3 className="font-semibold text-ink">{c.t}</h3>
              <p className="text-sm text-ink-muted mt-1.5 leading-relaxed">{c.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PrivacySection() {
  return (
    <section className="px-5 sm:px-8 py-16 md:py-20 bg-navy-900 text-white relative overflow-hidden">
      <div className="absolute inset-0 opacity-30" style={{ background: "radial-gradient(600px 300px at 80% 20%, #8a76c9, transparent), radial-gradient(500px 260px at 10% 80%, #35b0a8, transparent)" }} aria-hidden />
      <div className="max-w-6xl mx-auto relative">
        <div className="flex items-start gap-6 flex-col md:flex-row">
          <div className="flex-1">
            <span className="chip bg-white/10 text-white">🔐 privacy first, genuinely</span>
            <h2 className="font-display font-bold text-3xl md:text-4xl mt-4">Your reflections live on your device. Full stop.</h2>
            <p className="text-white/70 mt-4 leading-relaxed max-w-xl">
              MindTrace stores every answer, journal entry and letter in your own browser&apos;s local storage. There is no
              account on some faraway server to leak, no data-broker romance, no ads sniffing your feelings.
              Delete your data and it is <em>gone</em> — not &quot;deleted soon&quot; in someone&apos;s backup drawer.
            </p>
            <div className="grid sm:grid-cols-2 gap-3 mt-7">
              {[
                ["🧠", "Local by design", "Answers, journal and certificates persist only in this browser."],
                ["📤", "Export anytime", "Download your complete journey as a JSON file — it's yours."],
                ["🗑️", "One-click deletion", "Erase the account and every byte of it, instantly, on your word."],
                ["🚫", "No selling, ever", "No ads, no tracking, no feelings-for-hire. Not even a pixel sent out."],
              ].map(([e, t, d]) => (
                <div key={t} className="rounded-2xl bg-white/5 border border-white/10 p-4">
                  <div className="font-semibold flex items-center gap-2 text-sm">{e} {t}</div>
                  <p className="text-white/60 text-[0.83rem] mt-1.5 leading-relaxed">{d}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="w-full md:w-80 shrink-0 space-y-4">
            <div className="rounded-2xl bg-white/95 text-ink p-5 shadow-pop">
              <div className="flex items-center gap-2 text-sm font-bold text-navy-800 mb-2"><Icon name="shield" size={17} /> Not healthcare — and honestly so</div>
              <p className="text-[0.85rem] text-ink-muted leading-relaxed">
                MindTrace is a self-reflection journal, not a clinician. Reports use your own words and never diagnose
                conditions. If your week reported persistent distress, MindTrace does the responsible thing: it shows,
                not hides, real crisis resources — including <strong>Tele-MANAS 14416</strong> (India, 24/7) and <strong>112</strong>.
              </p>
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-lav-100 px-3 py-2.5">
                <Icon name="phone" size={16} />
                <span className="text-[0.83rem] font-semibold text-navy-800">Tele-MANAS 14416 · emergencies 112</span>
              </div>
            </div>
            <div className="rounded-2xl bg-white/10 border border-white/10 p-4 text-[0.8rem] text-white/60 leading-relaxed">
              Certificate verification is public but minimal: a certificate ID reveals a name and completion date only. Nothing else is ever attached.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function CTASection() {
  return (
    <section className="px-5 sm:px-8 py-20 text-center">
      <div className="max-w-xl mx-auto">
        <h2 className="font-display font-bold text-3xl md:text-4xl text-navy-800">Ready for five minutes a day?</h2>
        <p className="text-ink-muted mt-3 leading-relaxed">Seven days from now, you&apos;ll have a map of your own inner weather — drawn by you, interpreted gently, and yours forever.</p>
        <div className="flex flex-col sm:flex-row gap-3.5 justify-center mt-8">
          <Link href="/onboarding" className="btn btn-primary px-8">Start My Journey <Icon name="chevron-right" size={17} /></Link>
          <Link href="/verify" className="btn btn-ghost px-8">Verify a certificate</Link>
        </div>
      </div>
    </section>
  );
}

function FooterMini() {
  return (
    <footer className="border-t border-lav-100 py-8 px-6">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-[0.8rem] text-ink-faint">
        <div className="flex items-center gap-2">
          <span className="grid place-items-center w-7 h-7 rounded-lg bg-navy-800 text-white"><Icon name="brain" size={14} /></span>
          <span className="font-semibold text-ink-muted">MindTrace</span>
          <span>· understand yourself, one day at a time</span>
        </div>
        <nav className="flex gap-4">
          <Link href="/login" className="hover:text-ink transition-colors">Log in</Link>
          <Link href="/signup" className="hover:text-ink transition-colors">Sign up</Link>
          <Link href="/verify" className="hover:text-ink transition-colors">Verify certificate</Link>
          <Link href="/admin" className="hover:text-ink transition-colors">Admin</Link>
          <a href="tel:14416" className="hover:text-ink transition-colors">Help: 14416</a>
        </nav>
      </div>
      <p className="max-w-6xl mx-auto mt-4 text-[0.7rem] text-ink-faint/70">
        Self-reflection tool · not a medical or diagnostic service · all data stored locally in your browser — clear it anytime from Dashboard → Data controls.
      </p>
    </footer>
  );
}
