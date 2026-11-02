import * as S from "./store.js";
import * as V from "./viz.js";
import * as Sync from "./sync.js";

const $ = (id) => document.getElementById(id);
const CIRC = 2 * Math.PI * 54;
let state = S.load(localStorage);
let today = S.dateKey();

// timer state
let minutes = 25;
let total = minutes * 60;
let remaining = total;
let endAt = null;
let tick = null;
let remote = false;

function persist(next) {
  const changed = Object.keys(next.days).filter((k) => next.days[k] !== state.days[k]);
  state = next;
  S.save(localStorage, state);
  if (remote) changed.forEach((k) => Sync.pushDay(k, state.days[k], () => say("Could not reach the database. Saved locally.")));
}

function commit(next) {
  persist(next);
  render();
}

function say(text) {
  $("msg").textContent = text;
  clearTimeout(say.t);
  say.t = setTimeout(() => ($("msg").textContent = ""), 4000);
}

function fmt(sec) {
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function renderTimer() {
  $("time").textContent = fmt(remaining);
  $("bar").style.strokeDashoffset = String(CIRC * (1 - remaining / total));
  document.querySelector(".dial").classList.toggle("running", !!endAt);
  $("start").textContent = endAt ? "Pause" : remaining < total ? "Resume" : "Start focus";
  document.title = endAt ? `${fmt(remaining)} · Focus Journal` : "Focus Journal";
}

function render() {
  const day = S.getDay(state, today);
  $("today-label").textContent = S.parseKey(today).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  const st = S.streak(state, today);
  V.countUp($("streak-count"), st);
  document.querySelector(".streak").classList.toggle("hot", st >= 3);
  if (document.activeElement !== $("intention")) $("intention").value = day.intention;
  $("today-minutes").textContent = `${day.focusMinutes} min focused today`;
  if (document.activeElement !== $("goal")) $("goal").value = state.goal;
  const pct = Math.min(100, Math.round((day.focusMinutes / state.goal) * 100));
  $("goal-fill").style.width = pct + "%";
  $("goal-fill").classList.toggle("met", pct >= 100);
  const carry = S.carryable(state, today);
  $("carry").hidden = carry.length === 0;
  $("carry").textContent = `Carry over ${carry.length} unfinished task${carry.length === 1 ? "" : "s"}`;

  const ul = $("tasks");
  ul.replaceChildren(...day.tasks.map((t) => {
    const li = document.createElement("li");
    li.className = t.done ? "done" : "";
    const cb = document.createElement("input");
    cb.type = "checkbox"; cb.checked = t.done; cb.setAttribute("aria-label", `Done: ${t.text}`);
    cb.onchange = () => commit(S.toggleTask(state, today, t.id));
    const span = document.createElement("span");
    span.textContent = t.text; // textContent: user text is never parsed as HTML
    const x = document.createElement("button");
    x.className = "x"; x.textContent = "×"; x.setAttribute("aria-label", `Delete: ${t.text}`);
    x.onclick = () => commit(S.removeTask(state, today, t.id));
    li.append(cb, span, x);
    return li;
  }));
  $("tasks-empty").hidden = day.tasks.length > 0;

  const w = S.weekSummary(state, today);
  if (V.hasD3()) { V.drawWeek($("week"), w.days, today); V.drawHeat($("heat"), state, today); }
  $("review").replaceChildren(...S.weeklyReview(state, today).map((l) => Object.assign(document.createElement("li"), { textContent: l })));
  renderTimer();
}

// Soft two-note chime generated with Web Audio (no audio files needed).
function chime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [660, 880].forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = f; o.connect(g); g.connect(ctx.destination);
      const t = ctx.currentTime + i * 0.18;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.15, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      o.start(t); o.stop(t + 0.65);
    });
    setTimeout(() => ctx.close(), 1500);
  } catch {}
}

function finish() {
  clearInterval(tick); tick = null; endAt = null;
  commit(S.addFocus(state, today, minutes));
  remaining = total;
  renderTimer();
  say(`Nice work. ${minutes} minutes logged.`);
  V.pulse(document.querySelector(".dial")); V.burst(document.querySelector(".dial"));
  try { if (navigator.vibrate) navigator.vibrate(200); } catch {}
  chime();
}

function onTick() {
  remaining = Math.max(0, Math.round((endAt - Date.now()) / 1000));
  if (remaining === 0) finish(); else renderTimer();
}

$("start").onclick = () => {
  if (endAt) { clearInterval(tick); tick = null; endAt = null; renderTimer(); return; }
  endAt = Date.now() + remaining * 1000;
  tick = setInterval(onTick, 500);
  renderTimer();
};
$("reset").onclick = () => { clearInterval(tick); tick = null; endAt = null; remaining = total; renderTimer(); };
document.querySelectorAll(".chip").forEach((c) => (c.onclick = () => {
  if (endAt) return;
  document.querySelectorAll(".chip").forEach((o) => o.classList.toggle("active", o === c));
  minutes = Number(c.dataset.min); total = minutes * 60; remaining = total; renderTimer();
}));

$("intention").oninput = (e) => persist(S.setIntention(state, today, e.target.value));
$("goal").onchange = (e) => commit(S.setGoal(state, e.target.value));
$("carry").onclick = () => commit(S.carryOver(state, today));
document.addEventListener("keydown", (e) => {
  if (e.code === "Space" && !e.repeat && !/^(INPUT|TEXTAREA|BUTTON|SELECT)$/.test(document.activeElement.tagName)) {
    e.preventDefault(); $("start").click();
  }
});
$("task-form").onsubmit = (e) => {
  e.preventDefault();
  commit(S.addTask(state, today, $("task-input").value));
  $("task-input").value = "";
};

$("export").onclick = () => {
  const url = URL.createObjectURL(new Blob([S.exportJSON(state)], { type: "application/json" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: `focus-journal-${today}.json` });
  a.click(); URL.revokeObjectURL(url);
};
$("import").onchange = async (e) => {
  const file = e.target.files[0]; e.target.value = "";
  if (!file) return;
  try { commit(S.importJSON(await file.text())); say("Imported."); } catch (err) { say(err.message); }
};

function applyTheme(t) {
  if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme;
}
try { applyTheme(localStorage.getItem("focus-journal:theme")); } catch {}
$("theme").onclick = () => {
  const dark = document.documentElement.dataset.theme === "dark" ||
    (!document.documentElement.dataset.theme && matchMedia("(prefers-color-scheme: dark)").matches);
  const next = dark ? "light" : "dark";
  applyTheme(next);
  try { localStorage.setItem("focus-journal:theme", next); } catch {}
  render(); // charts read theme colours when drawn
};
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => render());

// roll over at midnight / when the tab regains focus
document.addEventListener("visibilitychange", () => {
  const k = S.dateKey();
  if (k !== today) { today = k; render(); }
});

render();

// If the PostgreSQL-backed server is running, merge its days (server wins per day) and sync from now on.
(async () => {
  if (!(await Sync.detect())) return;
  try {
    const server = await Sync.pull();
    state = { ...state, days: { ...state.days, ...S.importJSON(JSON.stringify(server)).days } };
    // push any local-only days up so first-time users keep their history
    Object.keys(state.days).filter((k) => !server.days[k]).forEach((k) => Sync.pushDay(k, state.days[k]));
    S.save(localStorage, state);
    remote = true;
    $("mode").textContent = "Synced to PostgreSQL.";
    render();
  } catch { /* stay local */ }
})();
