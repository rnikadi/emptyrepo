import test from "node:test";
import assert from "node:assert/strict";
import * as S from "../js/store.js";

const T = "2026-03-10";

test("addDays crosses month boundaries", () => {
  assert.equal(S.addDays("2026-03-01", -1), "2026-02-28");
  assert.equal(S.addDays("2026-12-31", 1), "2027-01-01");
});

test("tasks: add, toggle, remove, ignore blanks", () => {
  let s = S.emptyState();
  s = S.addTask(s, T, "  write  ", "a");
  s = S.addTask(s, T, "   ", "b");
  assert.equal(S.getDay(s, T).tasks.length, 1);
  s = S.toggleTask(s, T, "a");
  assert.equal(S.getDay(s, T).tasks[0].done, true);
  s = S.removeTask(s, T, "a");
  assert.equal(S.getDay(s, T).tasks.length, 0);
});

test("state updates do not mutate the previous state", () => {
  const a = S.addTask(S.emptyState(), T, "x", "1");
  const b = S.toggleTask(a, T, "1");
  assert.equal(a.days[T].tasks[0].done, false);
  assert.equal(b.days[T].tasks[0].done, true);
});

test("streak counts consecutive active days, forgiving an idle today", () => {
  let s = S.emptyState();
  s = S.addFocus(s, "2026-03-08", 25);
  s = S.addFocus(s, "2026-03-09", 25);
  assert.equal(S.streak(s, T), 2);
  s = S.addFocus(s, T, 10);
  assert.equal(S.streak(s, T), 3);
  assert.equal(S.streak(S.emptyState(), T), 0);
});

test("weekSummary totals the last seven days", () => {
  let s = S.addFocus(S.emptyState(), "2026-03-04", 30);
  s = S.addFocus(s, T, 20);
  s = S.addFocus(s, "2026-03-03", 99); // outside the window
  const w = S.weekSummary(s, T);
  assert.equal(w.days.length, 7);
  assert.equal(w.minutes, 50);
  assert.equal(w.activeDays, 2);
});

test("export then import round-trips", () => {
  let s = S.setIntention(S.emptyState(), T, "ship it");
  s = S.addTask(s, T, "a", "1");
  s = S.addFocus(s, T, 25);
  assert.deepEqual(S.importJSON(S.exportJSON(s)), s);
});

test("import rejects junk and sanitises bad entries", () => {
  assert.throws(() => S.importJSON("nope"));
  assert.throws(() => S.importJSON('{"x":1}'));
  const s = S.importJSON(JSON.stringify({ days: { bad: {}, [T]: { focusMinutes: -5, tasks: [{ text: "ok" }, { text: "" }, 7] } } }));
  assert.deepEqual(Object.keys(s.days), [T]);
  assert.equal(s.days[T].focusMinutes, 0);
  assert.equal(s.days[T].tasks.length, 1);
});
