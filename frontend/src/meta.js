// Lightweight persistent state + game meta (achievements, daily challenge, prefs)

const LS_KEY = "wff:meta:v1";

function read() {
    try {
        const raw = localStorage.getItem(LS_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
}

function write(obj) {
    try {
        localStorage.setItem(LS_KEY, JSON.stringify(obj));
    } catch {
        /* no-op */
    }
}

// ---------- Loading tips ----------
export const LOADING_TIPS = [
    "Fries are temporary. Tickets are forever.",
    "Please drive responsibly around potatoes.",
    "The brake pedal exists for a reason.",
    "Police dislike fry-related stunt driving.",
    "No fry left behind. Especially not the last one.",
    "Swipe left or right to switch lanes. Quickly.",
    "Tap and hold dignity. Then release it for fries.",
    "Golden fries trigger slow-motion AND turbo.",
    "Collect 10 fries fast to enter Fry Frenzy.",
    "Officer Mendez sees you. Officer Mendez judges you.",
];

export const pickTip = () =>
    LOADING_TIPS[Math.floor(Math.random() * LOADING_TIPS.length)];

// ---------- Achievements ----------
export const ACHIEVEMENTS = {
    first_fry:     { title: "First Fry!",         emoji: "🍟", desc: "Saved your first fry." },
    combo_master:  { title: "Combo Master",       emoji: "⚡", desc: "Hit a x5 fry combo." },
    frenzy_start:  { title: "Frenzy Unleashed",   emoji: "🔥", desc: "Entered Fry Frenzy mode." },
    golden_hour:   { title: "Golden Hour",        emoji: "⭐", desc: "Collected a Golden Fry." },
    dist_100:      { title: "100m Club",          emoji: "🏁", desc: "Outran the law for 100m." },
    dist_500:      { title: "Half-K Hero",        emoji: "🏎️", desc: "Reached 500m." },
    dist_1000:     { title: "Marathon Driver",    emoji: "🚀", desc: "Reached 1000m." },
    wanted:        { title: "Wanted",             emoji: "🚨", desc: "Took your first hit." },
    bus_dodger:    { title: "Bus Dodger",         emoji: "🚌", desc: "Survived the crossing bus." },
    radio_existential: { title: "Existentially Wanted", emoji: "🌀", desc: "Reached the existential radio stage." },
};

export function unlockAchievement(key) {
    const m = read();
    m.achievements = m.achievements || {};
    if (m.achievements[key]) return null; // already unlocked
    m.achievements[key] = Date.now();
    write(m);
    return ACHIEVEMENTS[key] || null;
}

export function getUnlocked() {
    const m = read();
    return m.achievements || {};
}

// ---------- Daily Challenge ----------
const CHALLENGES = [
    { id: "fries25",   text: "Collect 25 fries in one run", target: 25, kind: "fries"    },
    { id: "dist800",   text: "Travel 800 m in one run",     target: 800, kind: "distance" },
    { id: "frenzy1",   text: "Trigger Fry Frenzy once",     target: 1,   kind: "frenzy"   },
    { id: "golden1",   text: "Collect a Golden Fry",        target: 1,   kind: "golden"   },
    { id: "dodge15",   text: "Dodge 15 civilian cars",      target: 15,  kind: "dodge"    },
    { id: "combo5",    text: "Hit a x5 fry combo",          target: 5,   kind: "combo"    },
];

function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

// Deterministic by date
export function getDailyChallenge() {
    const key = todayKey();
    // hash date string → index
    let h = 0;
    for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
    const c = CHALLENGES[Math.abs(h) % CHALLENGES.length];
    const m = read();
    const done = m.daily && m.daily.key === key && m.daily.completed;
    return { ...c, dayKey: key, completed: !!done };
}

export function reportChallengeProgress(kind, value) {
    const m = read();
    const c = getDailyChallenge();
    if (c.completed) return false;
    if (c.kind !== kind) return false;
    if (value >= c.target) {
        m.daily = { key: c.dayKey, completed: true };
        write(m);
        return true; // newly completed
    }
    return false;
}

// ---------- Haptics ----------
export function vibrate(pattern) {
    try {
        if (navigator && typeof navigator.vibrate === "function") {
            navigator.vibrate(pattern);
        }
    } catch {
        /* no-op */
    }
}

// ---------- Best score ----------
export function recordRun({ distance, fries }) {
    const m = read();
    m.best = m.best || { distance: 0, fries: 0 };
    if (distance > m.best.distance) m.best.distance = distance;
    if (fries > m.best.fries) m.best.fries = fries;
    m.runs = (m.runs || 0) + 1;
    write(m);
    return m.best;
}

export function getBest() {
    return read().best || { distance: 0, fries: 0 };
}
