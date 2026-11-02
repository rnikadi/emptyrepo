// Pure data logic for Focus Journal. No DOM access, so it can be unit tested in Node.

export const STORAGE_KEY = "focus-journal:v1";

export function dateKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key, n) {
  const d = parseKey(key);
  d.setDate(d.getDate() + n);
  return dateKey(d);
}

export function emptyState() {
  return { version: 1, days: {} };
}

export function getDay(state, key) {
  return state.days[key] || { intention: "", tasks: [], focusMinutes: 0 };
}

function updateDay(state, key, fn) {
  const day = structuredClone(getDay(state, key));
  fn(day);
  return { ...state, days: { ...state.days, [key]: day } };
}

export function setIntention(state, key, text) {
  return updateDay(state, key, (d) => { d.intention = String(text).slice(0, 200); });
}

export function addTask(state, key, text, id = String(Date.now()) + Math.random().toString(36).slice(2, 6)) {
  const clean = String(text).trim().slice(0, 200);
  if (!clean) return state;
  return updateDay(state, key, (d) => { d.tasks.push({ id, text: clean, done: false }); });
}

export function toggleTask(state, key, id) {
  return updateDay(state, key, (d) => {
    const t = d.tasks.find((t) => t.id === id);
    if (t) t.done = !t.done;
  });
}

export function removeTask(state, key, id) {
  return updateDay(state, key, (d) => { d.tasks = d.tasks.filter((t) => t.id !== id); });
}

export function addFocus(state, key, minutes) {
  const m = Math.max(0, Math.round(minutes));
  if (!m) return state;
  return updateDay(state, key, (d) => { d.focusMinutes += m; });
}

// A day "counts" if the person did something: finished a task or focused.
export function isActive(day) {
  return !!day && (day.focusMinutes > 0 || day.tasks.some((t) => t.done));
}

// Consecutive active days ending today. If today is not active yet, a streak
// ending yesterday still counts so it isn't shown as lost mid-day.
export function streak(state, todayKey) {
  let key = isActive(state.days[todayKey]) ? todayKey : addDays(todayKey, -1);
  let n = 0;
  while (isActive(state.days[key])) {
    n++;
    key = addDays(key, -1);
  }
  return n;
}

// Last 7 days ending today, oldest first.
export function weekSummary(state, todayKey) {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const key = addDays(todayKey, -i);
    const d = getDay(state, key);
    days.push({
      key,
      minutes: d.focusMinutes,
      done: d.tasks.filter((t) => t.done).length,
      total: d.tasks.length,
      active: isActive(state.days[key]),
    });
  }
  return {
    days,
    minutes: days.reduce((a, d) => a + d.minutes, 0),
    done: days.reduce((a, d) => a + d.done, 0),
    activeDays: days.filter((d) => d.active).length,
  };
}

export function exportJSON(state) {
  return JSON.stringify(state, null, 2);
}

// Validates untrusted JSON; returns a clean state or throws.
export function importJSON(text) {
  let raw;
  try { raw = JSON.parse(text); } catch { throw new Error("That file is not valid JSON."); }
  if (!raw || typeof raw !== "object" || typeof raw.days !== "object" || raw.days === null) {
    throw new Error("That file is not a Focus Journal export.");
  }
  const out = emptyState();
  for (const [key, d] of Object.entries(raw.days)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || !d || typeof d !== "object") continue;
    out.days[key] = {
      intention: typeof d.intention === "string" ? d.intention.slice(0, 200) : "",
      focusMinutes: Number.isFinite(d.focusMinutes) ? Math.max(0, Math.round(d.focusMinutes)) : 0,
      tasks: (Array.isArray(d.tasks) ? d.tasks : [])
        .filter((t) => t && typeof t.text === "string" && t.text.trim())
        .map((t, i) => ({ id: String(t.id ?? `i${i}`), text: t.text.slice(0, 200), done: !!t.done })),
    };
  }
  return out;
}

export function load(storage) {
  try {
    const text = storage.getItem(STORAGE_KEY);
    return text ? importJSON(text) : emptyState();
  } catch {
    return emptyState();
  }
}

export function save(storage, state) {
  try { storage.setItem(STORAGE_KEY, JSON.stringify(state)); return true; } catch { return false; }
}
