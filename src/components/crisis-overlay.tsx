"use client";

import { Icon } from "./icons";
import { Neuro } from "./neuro";
import { CRISIS_OPENERS, CRISIS_REASSURE, CRISIS_RESOURCES } from "@/lib/crisis";
import { rid, saveSafety } from "@/lib/db";

/* ── Crisis overlay: pauses the flow, shows real help ──────── */
export function CrisisOverlay({ day, qid, onClose }: { day: number; qid?: string; onClose: () => void }) {
  const opener = CRISIS_OPENERS[Math.floor(Math.random() * CRISIS_OPENERS.length)];
  const reassure = CRISIS_REASSURE;
  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-navy-900/80 backdrop-blur-sm animate-fade" onClick={(e) => e.stopPropagation()} />
      <div className="relative card max-w-2xl w-full max-h-[92vh] overflow-y-auto p-7 shadow-pop animate-pop-in">
        <div className="flex items-start gap-5">
          <div className="shrink-0 animate-floaty">
            <Neuro size={86} mood="worried" blink={false} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-navy-800 mb-2">Before we continue — you matter more than any question 🫂</h2>
            <p className="text-ink-muted leading-relaxed">{opener}</p>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {reassure.map((r, i) => (
            <div key={i} className="flex gap-3 items-start bg-lav-50 rounded-xl p-3.5 text-[0.95rem] text-ink-muted">
              <span className="text-lav-600 mt-0.5"><Icon name="heart" size={18} /></span>
              <p>{r}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 rounded-2xl border border-lav-200 overflow-hidden">
          <div className="bg-navy-800 text-white px-4 py-2.5 text-sm font-semibold flex items-center gap-2">
            <Icon name="phone" size={16} /> Real humans, available right now
          </div>
          <div className="divide-y divide-lav-100">
            {CRISIS_RESOURCES.flatMap((group) =>
              group.lines.map((line, i) => (
                <a key={i} href={line.href || "#"} target={line.href?.startsWith("http") ? "_blank" : undefined}
                  rel="noreferrer"
                  className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-lav-50 transition-colors">
                  <span className="text-sm text-ink-muted">
                    <span className="font-semibold text-ink">{line.contact}</span>
                    <span className="mx-1.5 text-lav-600">·</span>{line.name}
                  </span>
                  <Icon name="chevron-right" size={16} />
                </a>
              )),
            )}
          </div>
        </div>

        <p className="mt-4 text-xs text-ink-faint">
          MindTrace cannot provide emergency care and does not contact anyone for you — no alerts are sent on your behalf. The numbers above connect you to trained people directly.
          This pause was triggered locally by words you wrote, stored only on your device.
        </p>

        <div className="mt-5 grid gap-3">
          <a href="tel:14416" className="btn btn-primary w-full"><Icon name="phone" size={18} /> Call Tele-MANAS 14416 (India, 24/7)</a>
          <button onClick={() => { onClose(); }} className="btn btn-ghost w-full">
            I'm safe for right now — continue my reflection
          </button>
          <button onClick={() => { if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("mindtrace:skip-remaining")); onClose(); }}
            className="btn btn-ghost w-full text-ink-muted">
            End today's session early (one click, no questions asked)
          </button>
        </div>
      </div>
    </div>
  );
}

/* helper used by any page that shows free text */
export function makeSafetyEvent(day: number, qid?: string, resourcesShown: string[] = ["Tele-MANAS 14416", "112"]) {
  return { id: rid("safe"), ts: new Date().toISOString(), day, qid, wordCount: resourcesShown.length, resourcesShown };
}
export function logSafety(userId: string | null, day: number, qid?: string) {
  if (!userId) return;
  saveSafety(userId, { id: rid("safe"), ts: new Date().toISOString(), day, qid, wordCount: 2, resourcesShown: ["Tele-MANAS 14416", "112"] });
}
