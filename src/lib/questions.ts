/* ── The 7-Day Question Engine ────────────────────────────────
 * A curated bank per day: required core questions, rotating
 * alternates, conditional follow-ups and one 🎲 unexpected gem.
 * Selection: core + random rotation → 6–8 questions/session.
 * Users may skip anything that feels too personal. No repeats.
 */
import { Question, UserProfile, DSession } from "./types";

export const DAY_THEMES: { day: number; title: string; theme: string; emoji: string; blurb: string }[] = [
  { day: 1, title: "Meet Yourself", theme: "Your current emotional & lifestyle situation", emoji: "👋", blurb: "A gentle hello. Today we meet the brain behind the screen." },
  { day: 2, title: "Your Emotional World", theme: "Emotional awareness & patterns", emoji: "🌦️", blurb: "Today, feelings get names. Naming is taming." },
  { day: 3, title: "Your Habits & Lifestyle", theme: "How daily behaviour shapes well-being", emoji: "🌿", blurb: "The unglamorous daily stuff quietly runs your day." },
  { day: 4, title: "Relationships & Connections", theme: "Belonging & emotional support", emoji: "🫂", blurb: "Brains are social creatures. Let's look at your pack." },
  { day: 5, title: "Stress & Resilience", theme: "Stress, challenges & coping", emoji: "🛡️", blurb: "Stress isn't the enemy; confusion is. Today we map yours." },
  { day: 6, title: "Dreams, Motivation & Identity", theme: "Purpose, identity & the future", emoji: "🚀", blurb: "Zoom out. What is your brain building toward?" },
  { day: 7, title: "Reflection & Discovery", theme: "Reviewing the whole journey", emoji: "🎓", blurb: "The final five minutes. Your report is a few answers away." },
];

/* ── Emotion set (valence = self-reported wellness indicator 0–100, NOT clinical) ── */
export const EMOTIONS = [
  { value: "Happy", emoji: "😄", score: 88 },
  { value: "Peaceful", emoji: "😌", score: 82 },
  { value: "Excited", emoji: "🤩", score: 90 },
  { value: "Neutral", emoji: "😐", score: 55 },
  { value: "Lonely", emoji: "🫥", score: 38 },
  { value: "Anxious", emoji: "😰", score: 34 },
  { value: "Sad", emoji: "😢", score: 28 },
  { value: "Overwhelmed", emoji: "🫠", score: 30 },
  { value: "Angry", emoji: "😤", score: 32 },
  { value: "Confused", emoji: "🤔", score: 42 },
  { value: "Grateful", emoji: "🥰", score: 92 },
  { value: "Other", emoji: "✨", score: 50 },
];

/* Fun / unexpected questions, one guaranteed per session. */
const FUN_POOL: Record<number, Question[]> = {
  1: [
    { id: "f1a", day: 1, type: "text", text: "If your brain had a weather forecast today, what would it say?", fun: true },
    { id: "f1b", day: 1, type: "choice", options: [{ value: "c1", label: "A filing cabinet with too many open tabs" }, { value: "c2", label: "A sleepy cat in a sunbeam" }, { value: "c3", label: "A windmill spinning politely" }, { value: "c4", label: "A drum solo mid-fireworks" }], text: "Your brain is a small animal today. Which one?", fun: true },
  ],
  2: [
    { id: "f2a", day: 2, type: "text", text: "If today were a song, what song would it be?", fun: true },
    { id: "f2b", day: 2, type: "choice", text: "Pick today's invisible accessory:", fun: true, options: [{ value: "v1", label: "Invisible cape 🦸" }, { value: "v2", label: "Invisible umbrella ☔" }, { value: "v3", label: "Invisible slippers 🥿" }, { value: "v4", label: "Invisible helmet 🪖" }] },
  ],
  3: [
    { id: "f3a", day: 3, type: "choice", text: "Which did your phone do more of today: help you, or brain-tickle you into looking one more time?", fun: true, options: [{ value: "friend", label: "Mostly helpful 📱🤝" }, { value: "gremlin", label: "Mostly gremlin 🧌" }, { value: "both", label: "Advocate by day, gremlin by night 🌜" }] },
    { id: "f3b", day: 3, type: "text", text: "Describe your routine as if it were a recipe. (Extra credit for spice suggestions.)", fun: true },
  ],
  4: [
    { id: "f4a", day: 4, type: "choice", text: "Which group chat or animal pack matches your social energy today?", fun: true, options: [{ value: "wolves", label: "Wolf pack 🐺" }, { value: "cats", label: "Independent cat 🐈" }, { value: "penguins", label: "Penguin huddle 🐧" }, { value: "sharks", label: "Solo shark fin 🦈" }] },
    { id: "f4b", day: 4, type: "text", text: "If kindness were currency today, who owes you nothing but owes you good energy?", fun: true },
  ],
  5: [
    { id: "f5a", day: 5, type: "choice", text: "Your stress monster today is…", fun: true, options: [{ value: "m1", label: "chaotic gremlin 🌪️" }, { value: "m2", label: "silent ninja 🥷" }, { value: "m3", label: "loud cat on keyboard 🔔" }, { value: "m4", label: "actually kind of tame 🐢" }] },
    { id: "f5b", day: 5, type: "text", text: "What's the funniest thing that went wrong today? (Zoom out: it's allowed to be funny already.)", fun: true },
  ],
  6: [
    { id: "f6a", day: 6, type: "choice", text: "In one word, your future self is…", fun: true, options: [{ value: "s1", label: "Flourishing 🌱" }, { value: "s2", label: "Strutting 💃" }, { value: "s3", label: "Brewing 🍵" }, { value: "s4", label: "Panicking politely 😬" }] },
    { id: "f6b", day: 6, type: "text", text: "You get one superpower for a week. What do you choose to power what you care about?", fun: true },
  ],
  7: [
    { id: "f7a", day: 7, type: "choice", text: "Rate the journey honestly:", fun: true, options: [{ value: "r1", label: "🧠🔥 unexpectedly great" }, { value: "r2", label: "🧠✨ quietly useful" }, { value: "r3", label: "🧠💤 needed a coffee first" }, { value: "r4", label: "🧠🍳 already looking forward to breakfast" }] },
    { id: "f7b", day: 7, type: "text", text: "Write the one-line review of 'MindTrace: the 7-day brain series'. (This is basically marketing — make us famous.)", fun: true },
  ],
};

/* Core bank per day. `followedBy` chains context-aware follow-ups. */
export const CORE: Question[] = [
  /* ── DAY 1 · Meet Yourself ── */
  { id: "d1q1", day: 1, type: "text", text: "If your current life were a movie, what would its title be?", tags: ["identity", "mood"], optional: false },
  { id: "d1q2", day: 1, type: "emotion", text: "How are you genuinely feeling today?", tags: ["mood"] },
  { id: "d1q3", day: 1, type: "text", text: "What was the best thing that happened today?", tags: ["positivity"] },
  { id: "d1q4", day: 1, type: "choice", text: "Did you wake up feeling refreshed — or already exhausted way before your day started?", options: [{ value: "refreshed", label: "Refreshed ☀️", score: 2 }, { value: "half", label: "Half and half 🌥️", score: 1 }, { value: "exhausted", label: "Already tired 🥱", score: 0 }], tags: ["sleep"] },
  { id: "d1q5", day: 1, type: "time", text: "How much time did you spend doing something you genuinely enjoyed?", options: [{ value: "0", label: "0 minutes 😞", score: 0 }, { value: "0.5", label: "~30 min", score: 1 }, { value: "1", label: "1–2 hours", score: 2 }, { value: "2+", label: "More than 2 hours 🎉", score: 3 }], tags: ["enjoyment"] },
  { id: "d1q6", day: 1, type: "choice", text: "Did you have a meaningful conversation with someone today?", options: [{ value: "yes", label: "Yes 🫂", score: 2 }, { value: "sorta", label: "Small talk only", score: 1 }, { value: "no", label: "Not really 😶", score: 0 }], tags: ["social"], followedBy: "d1q2b" },
  { id: "d1q2b", day: 1, type: "text", text: "What made it meaningful — or what's missing from most conversations you have?", optional: true, tags: ["social", "depth"] },
  { id: "d1q7", day: 1, type: "text", text: "If you could change one thing about today, what would it be?", tags: ["changes"] },
  { id: "d1q8", day: 1, type: "text", text: "What is one thing you wish people understood about you?", tags: ["identity", "depth"] },
  { id: "d1q9", day: 1, type: "text", text: "💌 Write a short private letter to your future self. Day 7 you will re-open it.", hint: "Locked-in vault, only you can read it in-app.", optional: true, tags: ["identity", "future"] },

  /* ── DAY 2 · Emotional World ── */
  { id: "d2q1", day: 2, type: "emotion", text: "Which emotion visited you most frequently today?", tags: ["mood"] },
  { id: "d2q2", day: 2, type: "text", text: "What made you smile today, even for a few seconds?", tags: ["positivity"] },
  { id: "d2q3", day: 2, type: "text", text: "Did anything unexpectedly hurt your feelings?", optional: true, tags: ["challenges"], followedBy: "d2q3b" },
  { id: "d2q3b", day: 2, type: "choice", text: "How did your brain handle that moment?", options: [{ value: "talked", label: "Talked it through 🗣️", score: 2 }, { value: "processed", label: "Processed it later in my head 🧠", score: 1 }, { value: "swallowed", label: "Swallowed it whole 🫙", score: 0 }], tags: ["coping"], optional: true },
  { id: "d2q4", day: 2, type: "choice", text: "When something goes wrong, what's my first move?", options: [{ value: "solve", label: "I immediately try to solve it 🧩", score: 2 }, { value: "overthink", label: "I overthink everything 🔁", score: 1 }, { value: "anger", label: "I get angry 🔥", score: 0 }, { value: "withdraw", label: "I withdraw from people 🕳️", score: 0 }, { value: "distract", label: "I distract myself 🎮", score: 1 }, { value: "other", label: "Something else ✨" }], tags: ["coping"] },
  { id: "d2q5", day: 2, type: "choice", text: "Do you feel comfortable expressing your emotions?", options: [{ value: "yes", label: "Comfortable ✅", score: 2 }, { value: "some", label: "With a few people 👥", score: 1 }, { value: "hard", label: "Rarely 🤐", score: 0 }], tags: ["openness"] },
  { id: "d2q6", day: 2, type: "text", text: "When was the last time you felt genuinely proud of yourself?", tags: ["pride"] },
  { id: "d2q7", day: 2, type: "text", text: "What have you been keeping inside but wish you could express?", optional: true, tags: ["depth"] },
  { id: "d2q8", day: 2, type: "text", text: "If your emotions could send you one message today, what would they say?", tags: ["identity"] },

  /* ── DAY 3 · Habits & Lifestyle ── */
  { id: "d3q1", day: 3, type: "time", text: "How many hours did you sleep last night?", options: [{ value: "<5", label: "Under 5 🧟", score: 0 }, { value: "5-6", label: "5–6 😴", score: 1 }, { value: "6-7", label: "6–7 🙂", score: 2 }, { value: "7-8", label: "7–8 💤", score: 3 }, { value: "8+", label: "8+ 🏆", score: 3 }], tags: ["sleep"] },
  { id: "d3q2", day: 3, type: "time", text: "Time spent scrolling social media today?", options: [{ value: "<1", label: "Under 1 hour ✨", score: 3 }, { value: "1-2", label: "1–2 hours 🙂", score: 2 }, { value: "2-4", label: "2–4 hours 😬", score: 1 }, { value: "4+", label: "More than 4 🧌", score: 0 }], tags: ["screen"] },
  { id: "d3q3", day: 3, type: "multi", text: "Did you eat nutritious food and drink enough water?", options: [{ value: "water", label: "Drank enough water 💧" }, { value: "meals", label: "Ate proper meals 🥗" }, { value: "snacks", label: "Mostly snacks 🍿" }, { value: "skipped", label: "Skipped meals 🫤" }], tags: ["nutrition"] },
  { id: "d3q4", day: 3, type: "choice", text: "Did you move your body today (walk, stretch, gym, dance badly in the kitchen…)?", options: [{ value: "yes", label: "Yes 💪", score: 2 }, { value: "little", label: "A little 🚶", score: 1 }, { value: "no", label: "Not at all 🛋️", score: 0 }], tags: ["movement"] },
  { id: "d3q5", day: 3, type: "choice", text: "Did you procrastinate on something important?", options: [{ value: "no", label: "No, handled it ✅", score: 2 }, { value: "some", label: "A little bit ⏳", score: 1 }, { value: "yes", label: "Procrastination champion 🏅", score: 0 }], tags: ["habits"] },
  { id: "d3q6", day: 3, type: "text", text: "What was your biggest distraction today?", tags: ["focus"] },
  { id: "d3q7", day: 3, type: "choice", text: "Did you spend time outdoors?", options: [{ value: "yes", label: "Yes 🌳", score: 2 }, { value: "little", label: "A peek outside 🪟", score: 1 }, { value: "no", label: "Indoor crypt 🏠", score: 0 }], tags: ["outdoors"] },
  { id: "d3q8", day: 3, type: "text", text: "Which one habit would you most like to change?", tags: ["wants"] },
  { id: "d3q9", day: 3, type: "choice", text: "If you repeated today's routine every day for the next year, would you be happy with your life?", options: [{ value: "yes", label: "Yes, gladly 🌈", score: 2 }, { value: "fixable", label: "Happy with fixes 🔧", score: 1 }, { value: "no", label: "Absolutely not ✋", score: 0 }], tags: ["satisfaction"] },

  /* ── DAY 4 · Relationships ── */
  { id: "d4q1", day: 4, type: "choice", text: "Did you feel connected to someone today?", options: [{ value: "yes", label: "Yes 🤝", score: 2 }, { value: "some", label: "Somewhat ☁️", score: 1 }, { value: "no", label: "Not at all 🌑", score: 0 }], tags: ["connection"] },
  { id: "d4q2", day: 4, type: "choice", text: "Do you have someone you can talk openly with?", options: [{ value: "yes", label: "Yes 🗣️", score: 2 }, { value: "some", label: "Partly, mostly murmurs 🕳️", score: 1 }, { value: "no", label: "No one 🫥", score: 0 }], tags: ["support"] },
  { id: "d4q3", day: 4, type: "text", text: "Did someone make your day better today?", tags: ["positivity"] },
  { id: "d4q4", day: 4, type: "choice", text: "Do you sometimes feel lonely even when surrounded by people?", options: [{ value: "yes", label: "Yes 🫂", score: 0 }, { value: "some", label: "Sometimes 🌫️", score: 1 }, { value: "no", label: "No 🙂", score: 2 }], tags: ["loneliness"], followedBy: "d4q4b" },
  { id: "d4q4b", day: 4, type: "text", text: "What usually makes that feeling stronger?", optional: true, tags: ["loneliness", "depth"] },
  { id: "d4q5", day: 4, type: "scale", text: "How comfortable are you saying NO to others? (1 = never, 10 = effortless)", tags: ["boundaries"] },
  { id: "d4q6", day: 4, type: "choice", text: "Are you spending enough time with people who make you feel appreciated?", options: [{ value: "yes", label: "Very much 💛", score: 2 }, { value: "some", label: "Not enough ⏳", score: 1 }, { value: "no", label: "Not at all 🫥", score: 0 }], tags: ["connection"] },
  { id: "d4q7", day: 4, type: "text", text: "What kind of relationship makes you feel emotionally safe?", tags: ["support", "depth"] },
  { id: "d4q8", day: 4, type: "text", text: "If you could send one honest message to someone without worrying about their reaction, what would you say?", optional: true, tags: ["depth"] },

  /* ── DAY 5 · Stress & Resilience ── */
  { id: "d5q1", day: 5, type: "text", text: "What's currently taking up the most space in your mind?", tags: ["stressor"] },
  { id: "d5q2", day: 5, type: "scale", text: "How stressed did you feel today? (1 = zen monk, 10 = kettle boiling)", tags: ["stress"] },
  { id: "d5q3", day: 5, type: "choice", text: "What usually happens when you face unexpected problems?", options: [{ value: "solve", label: "I get practical 🧰", score: 2 }, { value: "freeze", label: "I freeze briefly then adapt 🧊", score: 1 }, { value: "panic", label: "Panic first 🚨", score: 0 }, { value: "ask", label: "Ask for help 🙋", score: 2 }], tags: ["coping"] },
  { id: "d5q4", day: 5, type: "choice", text: "Do you find yourself worrying about things that haven't happened yet?", options: [{ value: "lots", label: "A lot 🔮", score: 0 }, { value: "some", label: "Sometimes ☁️", score: 1 }, { value: "rarely", label: "Rarely 🌇", score: 2 }], tags: ["stress"] },
  { id: "d5q5", day: 5, type: "text", text: "What did you do today to relax?", tags: ["relax"] },
  { id: "d5q6", day: 5, type: "choice", text: "Are your current responsibilities manageable?", options: [{ value: "yes", label: "Mostly, yes 🪴", score: 2 }, { value: "some", label: "Buried but breathing 😮‍💨", score: 1 }, { value: "no", label: "Drowning politely 🌊", score: 0 }], tags: ["load"], followedBy: "d5q6b" },
  { id: "d5q6b", day: 5, type: "text", text: "Which responsibility weighs the most right now?", optional: true, tags: ["stressor", "depth"] },
  { id: "d5q7", day: 5, type: "text", text: "What's something you need to stop putting pressure on yourself about?", tags: ["wants"] },
  { id: "d5q8", day: 5, type: "text", text: "If your best friend were living your current situation, what advice would you give them?", tags: ["identity"] },

  /* ── DAY 6 · Dreams & Identity ── */
  { id: "d6q1", day: 6, type: "text", text: "What are you most excited about in your future?", tags: ["motivation"] },
  { id: "d6q2", day: 6, type: "scale", text: "How satisfied are you with the direction your life is taking? (1 = lost at sea, 10 = lighthouse)", tags: ["satisfaction"] },
  { id: "d6q3", day: 6, type: "text", text: "What makes you feel most alive?", tags: ["motivation", "identity"] },
  { id: "d6q4", day: 6, type: "choice", text: "Are you living by your own expectations, or other people's?", options: [{ value: "mine", label: "My own 🚗", score: 2 }, { value: "mix", label: "A mix 🌓", score: 1 }, { value: "theirs", label: "Mostly theirs 🧾", score: 0 }], tags: ["identity"] },
  { id: "d6q5", day: 6, type: "text", text: "What is one dream you have postponed?", tags: ["wants"] },
  { id: "d6q6", day: 6, type: "text", text: "When do you feel most confident?", tags: ["confidence"] },
  { id: "d6q7", day: 6, type: "text", text: "Name one thing you genuinely like about yourself.", tags: ["confidence"] },
  { id: "d6q8", day: 6, type: "text", text: "Imagine yourself five years from now. What do you want that person to thank you for?", tags: ["future"] },

  /* ── DAY 7 · Reflection ── */
  { id: "d7q1", day: 7, type: "emotion", text: "Compared with Day 1, how do you feel today?", tags: ["mood"] },
  { id: "d7q2", day: 7, type: "scale", text: "How stressed do you feel overall right now? (1–10)", tags: ["stress"] },
  { id: "d7q3", day: 7, type: "time", text: "How did you sleep last night? (last box of the week)", options: [{ value: "<5", label: "Under 5 🧟", score: 0 }, { value: "5-6", label: "5–6 😴", score: 1 }, { value: "6-7", label: "6–7 🙂", score: 2 }, { value: "7-8", label: "7–8 💤", score: 3 }, { value: "8+", label: "8+ 🏆", score: 3 }], tags: ["sleep"] },
  { id: "d7q4", day: 7, type: "text", text: "What did you discover about yourself during these seven days?", tags: ["identity"] },
  { id: "d7q5", day: 7, type: "choice", text: "Which day made you think the most?", options: DAY_THEMES.slice(0, 7).map((t) => ({ value: `${t.day}`, label: `Day ${t.day}: ${t.title} ${t.emoji}` })), tags: ["identity"] },
  { id: "d7q6", day: 7, type: "text", text: "Did you notice any repeated emotional patterns?", tags: ["mood"] },
  { id: "d7q7", day: 7, type: "text", text: "What was the happiest moment of your 7-day journey?", tags: ["positivity"] },
  { id: "d7q8", day: 7, type: "text", text: "What is one thing you learned about your habits?", tags: ["habits"] },
  { id: "d7q9", day: 7, type: "text", text: "What would you like to improve over the next 30 days?", tags: ["wants"] },
  { id: "d7q10", day: 7, type: "text", text: "If you could give yourself one sentence of advice, what would it be?", tags: ["identity"] },
  { id: "d7q11", day: 7, type: "choice", text: "How would you describe your current emotional state?", options: EMOTIONS.slice(0, 10).map((e) => ({ value: e.value, label: `${e.emoji} ${e.value}`, score: e.score as number })), tags: ["mood"] },
  { id: "d7q12", day: 7, type: "text", text: "What is one thing you're grateful for today?", tags: ["positivity"] },
];

export function allBank(): Question[] { return [...CORE, ...Object.values(FUN_POOL).flat()]; }

/* synthesized context questions (generated per-user at runtime) register here */
const EXTRA: Record<string, Question> = {};
export function byId(id: string): Question | undefined {
  return allBank().find((q) => q.id === id) ?? EXTRA[id];
}
const registerExtra = (x: Question): Question => { EXTRA[x.id] = x; return x; };

/* ── Selection algorithm ──────────────────────────────────────
 * core requirements for the day (always included)
 * → conditional follow-ups when previous answers trigger them
 * → 1 🎲 fun question (never repeats within the journey)
 * → optional-depth extras only fill to the 8-question cap
 */
export function buildDaySession(user: UserProfile, day: number, previous: DSession[], chosenFuns: Set<string>): Question[] {
  const q = (id: string) => CORE.find((x) => x.id === id)!;
  const core = CORE.filter((x) => x.day === day);

  const session = [...core];

  // Cap to 8 (day 7 may run to 9 since reflection is the finale)
  const cap = day === 7 ? 9 : 8;
  const answers = (d: number): Map<string, string> => {
    const s = previous.find((x) => x.day === d);
    return new Map(Object.entries(s?.answers ?? {}).map(([k, v]) => [k, typeof v.value === "string" ? v.value : String(v.value)]));
  };

  /* context-aware follow-ups (only insert if cap allows) */
  const a1 = answers(1);
  const a2 = answers(2);
  const a4 = answers(4);
  if (a4.get("d4q4") === "no" && a4.size > 0 && day === 5 && session.length < cap) {
    // deep loneliness signal surfaced on day 4 → gentle day-5 bridge
    session.push(registerExtra({ ...q("d2q7"), id: "d5x1", text: "Loneliness showed up on your relationship day. What feels hardest to talk about lately?" }));
  }
  if ((a1.get("d1q2") === "Overwhelmed" || a1.get("d1q2") === "Sad" || a1.get("d1q2") === "Anxious") && day === 2 && session.length < cap) {
    session.push(registerExtra({ ...q("d2q8"), id: "d2x1", text: "You've had a heavier start to your week. If today's emotions knocked on your door and you actually LET them in, what would they want?" }));
  }
  if (a2.get("d2q4") === "overthink" && day === 5 && session.length < cap) {
    session.push(registerExtra({ ...q("d5q3"), id: "d5x2", text: "Your days have a taste of overthinking. What tiny decision did your brain chew on today like gum?" }));
  }
  if (user.sleepSchedule === "Very Poor" && (day === 3 || day === 4) && session.length < cap) {
    session.push(registerExtra({ ...q("d3q1"), id: day === 3 ? "d3x1" : "d4x1", text: `Sleep looked rough in your onboarding. What's one thing stealing your sleep, honestly?` }));
  }

  /* one unexpected fun question, not yet used */
  const pool = (FUN_POOL[day] ?? []).filter((f) => !chosenFuns.has(f.id));
  const fun = pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
  if (fun) session.push(fun);

  // dedupe, then trim to cap keeping the essential ones (mood/emotion + fun + non-optional)
  const seen = new Set<string>();
  const dedup = session.filter((x) => { if (seen.has(x.id)) return false; seen.add(x.id); return true; });
  if (dedup.length <= cap) return dedup;
  const keepFirst = dedup.filter((x) => x.type === "emotion" || x.id === fun?.id || !x.optional);
  const fillers = dedup.filter((x) => !keepFirst.includes(x));
  return [...keepFirst, ...fillers].slice(0, cap);
}

/* small helpers used by UI */
export const qById = byId;
export const options = (qid: string) => CORE.find((x) => x.id === qid)?.options ?? [];
