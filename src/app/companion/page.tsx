"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Neuro, NEURO_QUOTES } from "@/components/neuro";
import { Icon } from "@/components/icons";
import { ClientGate, Splash, TopNav } from "@/components/ui";
import { companionAnswer } from "@/lib/analysis";
import { detectCrisis, CRISIS_OPENERS } from "@/lib/crisis";
import { getCurrentUserId, getSessions, getUser } from "@/lib/db";
import { DSession, User } from "@/lib/types";

interface ChatMsg {
  role: "user" | "neuro";
  text: string;
  evidence?: string[];
  caution?: string;
}

export default function CompanionPage() {
  return (
    <div className="flex-1">
      <TopNav />
      <ClientGate>
        <CompanionBody />
      </ClientGate>
    </div>
  );
}

function CompanionBody() {
  const nav = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [sessions, setSessions] = useState<DSession[]>([]);
  const [ready, setReady] = useState(false);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const id = getCurrentUserId();
    if (!id) { nav.replace("/onboarding"); return; }
    const u = getUser(id);
    if (!u) { nav.replace("/onboarding"); return; }
    setUser(u);
    setSessions(getSessions(id).filter((s) => s.completedAt));
    setMsgs([{ role: "neuro", text: NEURO_QUOTES[0] }]);
    setReady(true);
  }, [nav]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs, thinking]);

  const ask = () => {
    const q = input.trim();
    if (!q || !user) return;
    setInput("");

    /* crisis handling first — companion stays honest */
    const hit = detectCrisis(q);
    if (hit) {
      setMsgs((m) => [
        ...m,
        { role: "user", text: q },
        { role: "neuro", text: `${CRISIS_OPENERS[Math.floor(Math.random() * CRISIS_OPENERS.length)]}\n\nPlease take a look at the help numbers: Tele-MANAS 14416 (India, 24/7) and 112 (emergencies). You matter more than this chat.` },
      ]);
      return;
    }

    if (!sessions.length) {
      setMsgs((m) => [
        ...m,
        { role: "user", text: q },
        { role: "neuro", text: "I'd love to dig into this with you — but right now my evidence shelf is empty, because no completed sessions exist yet. Ask me again after you've done a first 5-minute reflection and I'll have real material to work with." },
      ]);
      return;
    }

    setThinking(true);
    setMsgs((m) => [...m, { role: "user", text: q }]);
    /* small deliberate pause sells the "I'm reading your week" moment — excitement, not latency */
    setTimeout(() => {
      const r = companionAnswer(q, user, sessions);
      setMsgs((m) => [...m, { role: "neuro", text: r.answer, evidence: r.evidence, caution: r.caution }]);
      setThinking(false);
    }, 700);
  };

  if (!ready) return <Splash note="Neuro is catching up on your week…" />;

  const suggestions = (
    <>
      <button onClick={() => setInput("Why am I so tired?")} className="chip hover:bg-lav-200/70 transition-colors">Why am I so tired? 😴</button>
      <button onClick={() => setInput("What stresses me out?")} className="chip hover:bg-lav-200/70 transition-colors">What stresses me out? ⚡</button>
      <button onClick={() => setInput("Tell me about my mood patterns")} className="chip hover:bg-lav-200/70 transition-colors">My mood patterns 🌦️</button>
      <button onClick={() => setInput("How is my screen time going?")} className="chip hover:bg-lav-200/70 transition-colors">Screen time 📱</button>
      <button onClick={() => setInput("How's my routine holding up?")} className="chip hover:bg-lav-200/70 transition-colors">My routine 🌿</button>
      <button onClick={() => setInput("What motivates me lately?")} className="chip hover:bg-lav-200/70 transition-colors">Motivation 🚀</button>
    </>
  );
  const showSuggestions = msgs.length <= 1;

  return (
    <main className="flex-1 max-w-2xl mx-auto w-full px-5 pb-28">
      <section className="pt-10 pb-4 text-center">
        <div className="animate-floaty inline-block"><Neuro size={104} mood="happy" /></div>
        <h1 className="font-display font-bold text-3xl text-navy-800 mt-3">Talk to Neuro about <em>your</em> week</h1>
        <p className="text-ink-muted mt-2 text-[0.92rem] leading-relaxed max-w-lg mx-auto">
          I answer only from your completed reflections — quoting your own words back at you, carefully, with evidence.
          I&apos;m not a therapist, I don&apos;t diagnose, and I won&apos;t pretend otherwise.
        </p>
      </section>

      {/* transcript */}
      <section className="card p-5 min-h-[420px] flex flex-col">
        <div className="flex-1 space-y-4 overflow-y-auto pr-1" style={{ maxHeight: "56vh" }}>
          {msgs.map((m, i) => (
            m.role === "user" ? (
              <div key={i} className="flex justify-end animate-rise">
                <div className="max-w-[85%] bg-navy-800 text-white rounded-2xl rounded-br-md px-4 py-3 text-[0.9rem] leading-relaxed shadow-card">{m.text}</div>
              </div>
            ) : (
              <div key={i} className="flex gap-3 animate-rise">
                <div className="shrink-0 mt-0.5"><Neuro size={40} mood="thinking" blink={false} /></div>
                <div className="max-w-[85%]">
                  <div className="bg-lav-50 rounded-2xl rounded-tl-md px-4 py-3 text-[0.9rem] text-ink leading-relaxed border border-lav-100 whitespace-pre-line">{m.text}</div>
                  {m.evidence && m.evidence.length > 0 && (
                    <div className="mt-2 ml-1 space-y-1.5">
                      {m.evidence.map((e, j) => (
                        <div key={j} className="flex gap-1.5 text-[0.75rem] text-ink-faint items-start">
                          <Icon name="search" size={12} className="mt-0.5 shrink-0 text-lav-600" />
                          <span>Evidence from your answers: {e}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {m.caution && <p className="ml-1 mt-1.5 text-[0.66rem] text-ink-faint/90 leading-relaxed">{m.caution}</p>}
                </div>
              </div>
            )
          ))}
          {thinking && (
            <div className="flex gap-3 animate-fade">
              <Neuro size={40} mood="thinking" blink={false} />
              <div className="bg-lav-50 rounded-2xl px-4 py-3 text-ink-faint text-[0.85rem] border border-lav-100 animate-pulse-soft">
                re-reading your week…
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* composer */}
        <div className="pt-4 mt-3 border-t border-lav-100">
          {showSuggestions && (
            <div className="flex flex-wrap gap-2 mb-3">{suggestions}</div>
          )}
          <div className="flex gap-2">
            <input
              className="field"
              placeholder={sessions.length ? "Ask about feelings, sleep, stress, screens, routine, motivation…" : "Complete a reflection first so I have material"}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") ask(); }}
              data-testid="companion-input"
            />
            <button onClick={ask} disabled={!input.trim() || thinking} className="btn btn-primary shrink-0 !px-5" data-testid="companion-send">
              <Icon name="sparkles" size={16} /> Ask
            </button>
          </div>
          <p className="text-[0.66rem] text-ink-faint mt-2">
            Answers quote only your own self-reported data. This is a reflection aid — never a medical opinion. If things feel heavy, real humans: 14416 · 112.
          </p>
        </div>
      </section>
    </main>
  );
}
