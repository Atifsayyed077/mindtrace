/* ── Crisis detection (local, in-browser, non-diagnostic) ─────
 * Scans free-text answers for distress signals. When triggered:
 *   1. pause the ordinary flow
 *   2. respond with empathy, no judgment
 *   3. show real crisis resources (never claim an alert was sent)
 * Never a substitute for a trained human responder.
 */
const PATTERNS: { re: RegExp; weight: number }[] = [
  { re: /suicid\w*/i, weight: 5 },
  { re: /(kill|end|hurt|harm)[\s\S]{0,24}(myself|my life|me)\b/i, weight: 5 },
  { re: /self[\s-]?harm/i, weight: 5 },
  { re: /self[\s-]?mutilat\w*/i, weight: 5 },
  { re: /(don'?t|not?)\s+(want|feel like)\s+(to\s+)?(live|be alive)/i, weight: 4 },
  { re: /no reason to (live|go on)/i, weight: 4 },
  { re: /(cut|burn)(ting)?\s+myself/i, weight: 5 },
  { re: /take (my|me) (own )?life/i, weight: 5 },
  { re: /\b(overdose|od)\b.{0,30}(pill|tablet)?/i, weight: 4 },
  { re: /want (the )?pain to (stop|end)/i, weight: 3 },
  { re: /better off without me/i, weight: 5 },
  { re: /everyone.{0,15}(better|more happy).{0,15}without me/i, weight: 4 },
  { re: /\b(disappear|vanish|not exist)\b.{0,30}(forever|everywhere|completely)/i, weight: 2 },
  { re: /hopeless|worthless/i, weight: 1 },
  { re: /panic (attack )?(hit|start|happen)/i, weight: 1 },
];

export interface CrisisHit {
  level: "high" | "watch";
  matches: string[];
}

export function detectCrisis(text: string): CrisisHit | null {
  if (!text || text.length < 4) return null;
  const matches: string[] = [];
  let score = 0;
  for (const p of PATTERNS) {
    if (p.re.test(text)) {
      score += p.weight;
      matches.push(p.re.source.slice(0, 40));
    }
  }
  if (score >= 4) return { level: "high", matches };
  if (score >= 1) return { level: "watch", matches };
  return null;
}

export const CRISIS_RESOURCES = [
  {
    region: "India",
    lines: [
      { name: "Tele-MANAS (24/7 mental health support, many languages)", contact: "Call / iCall: 14416", href: "tel:14416" },
      { name: "Emergency assistance (police / ambulance)", contact: "112", href: "tel:112" },
      { name: "AASRA (volunteer helpline)", contact: "+91-9820466726", href: "tel:+919820466726" },
      { name: "iCall counseling helpline (24x7)", contact: "+91-9152987821", href: "tel:+919152987821" },
    ],
  },
  {
    region: "Anywhere",
    lines: [
      { name: "Find International crisis lines (be.friend website directory)", contact: "befrienders.org", href: "https://www.befrienders.org" },
      { name: "Local emergency services", contact: "Your regional emergency number", href: "" },
    ],
  },
];

export const CRISIS_OPENERS = [
  "🧠 Neuro here. I noticed some really heavy words in what you wrote — and I want you to know that stopping everything to check on you is exactly the right use of my entire existence.",
  "What you wrote matters, and it sounds like a lot. I'm just a small piece of software, but you deserve far better than small talk right now.",
  "Some parts of your answer sound heavy. That's not something to carry alone. This is a me-stopping-you moment, on purpose.",
];

export const CRISIS_REASSURE = [
  "You do not have to have a plan. You do not need the 'right words'. Reaching out counts.",
  "Please consider telling one trusted person — a friend, family member, anyone safe — tonight. Not because it's urgent drama; because you shouldn't be the only one holding this.",
  "If things feel overwhelming or unsafe right now, the fastest real help is a voice — the numbers on this screen are people, not robots.",
];
