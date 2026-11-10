/* ── Neuro: your reflection companion. A brain with opinions. ── */
export function Neuro({
  size = 120,
  mood = "happy", // happy | thinking | worried | proud | sleep | party | wave
  className = "",
  blink = true,
}: { size?: number; mood?: string; className?: string; blink?: boolean }) {
  const mouth =
    mood === "happy" ? "M15 24.5q5 5.5 10 0" :
    mood === "party" ? "M14.5 24.5q5.5 6.5 11 0" :
    mood === "thinking" ? "M15 25h10" :
    mood === "worried" ? "M15 26q5 -4 10 0" :
    mood === "sleep" ? "M16 25q4 3 8 0" :
    mood === "wave" ? "M15 24.5q5 5.5 10 0" :
    mood === "proud" ? "M14 24.5q6 6.5 12 0" : "M15 24.5q5 5.5 10 0";

  const brow =
    mood === "worried" ? -3 :
    mood === "proud" ? -5 : 0;

  return (
    <svg width={size} height={size} viewBox="0 0 44 40" className={className} aria-label="Neuro the brain" role="img">
      <defs>
        <linearGradient id="nt-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#c8bded" />
          <stop offset="55%" stopColor="#a99bd6" />
          <stop offset="100%" stopColor="#8a76c9" />
        </linearGradient>
      </defs>
      <g className={blink ? "animate-wobble" : ""} style={{ transformOrigin: "22px 22px" }}>
        {/* head */}
        <path d="M14 6a6.2 6.2 0 0 0-6.2 6.2 6.2 6.2 0 0 0-3.4 9.4C3 23 2.6 25 3.2 27.2c.9 3.2 3.6 5 6.6 5 .4 2.6 2.6 4.6 5.6 4.6 2.6 0 4.6-1.6 5.2-3.8h.8v-20c0-4-2.4-6.6-5.6-7z" fill="url(#nt-g)" />
        <path d="M28 4c4.4 0 8 3.6 8 8a7 7 0 0 1 4 6.6c0 2.4-1.2 4.6-3.2 5.8.9 2 .9 4.3-.1 6.3-1.3 2.7-4 4.1-6.9 3.9-.4 2.4-2.5 4.2-5.2 4.2-2.7 0-4.8-1.8-5.2-4.2V10.6c0-3.7 3.5-6.6 8.6-6.6z" fill="url(#nt-g)" />
        {/* fold lines */}
        <path d="M19 12q3-3 6-1" stroke="#7a68b6" strokeWidth="1.2" fill="none" strokeLinecap="round" />
        <path d="M27 10q3 1 4 4" stroke="#7a68b6" strokeWidth="1.2" fill="none" strokeLinecap="round" />
        <path d="M18 30q2 2 5 2" stroke="#7a68b6" strokeWidth="1.2" fill="none" strokeLinecap="round" />
        {/* eyes */}
        <circle cx="15.6" cy="17.6" r="2.1" fill="#141b34" />
        <circle cx="30.4" cy="17.6" r="2.1" fill="#141b34" />
        <circle cx="16.4" cy="16.9" r="0.7" fill="#fff" />
        <circle cx="31.2" cy="16.9" r="0.7" fill="#fff" />
        {/* brows */}
        <path d={`M12.6 ${12.6 + brow}q3-2 5.6-.6`} stroke="#141b34" strokeWidth="1.1" fill="none" strokeLinecap="round" />
        <path d={`M27.6 ${12 + brow}q3-1.6 5.4.4`} stroke="#141b34" strokeWidth="1.1" fill="none" strokeLinecap="round" />
        {/* mouth */}
        <path d={mouth} stroke="#141b34" strokeWidth="1.4" fill="none" strokeLinecap="round" />
        {/* cheeks */}
        <circle cx="11.5" cy="21.5" r="1.7" fill="#e8a0b4" opacity=".7" />
        <circle cx="34.5" cy="21.5" r="1.7" fill="#e8a0b4" opacity=".7" />
        {/* sparkle */}
        {(mood === "party" || mood === "proud") && (
          <>
            <path d="M36 6l.8 1.9 1.9.8-1.9.8L36 11.4l-.8-1.9-1.9-.8 1.9-.8z" fill="#e9d9ae" />
            <path d="M7 3l.6 1.5L9.1 5l-1.5.6L7 7.1l-.6-1.5L4.9 5l1.5-.5z" fill="#9adcd6" />
          </>
        )}
        {mood === "sleep" && (
          <text x="34" y="7" fontSize="7" fill="#3a4262" fontFamily="monospace">z z</text>
        )}
      </g>
    </svg>
  );
}

export const NEURO_QUOTES = [
  "Your brain called. It wants five minutes — and I already told it you'd come. 🧠",
  "No wrong answers here. Even 'I don't know' is beloved by me personally.",
  "Honesty beats optimism. Brains can tell the difference. Mine surfs meme waves all day.",
  "Treat this like a good coffee: quick, warm, and about you.",
  "I read every answer (locally, on-device). I keep zero secrets and zero receipts.",
  "Streaks are for fun. Missing a day is human. I'm software; I never judge. 🫶",
];
