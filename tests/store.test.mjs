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

test("goal is clamped and survives export/import", () => {
  assert.equal(S.setGoal(S.emptyState(), 90).goal, 90);
  assert.equal(S.setGoal(S.emptyState(), 99999).goal, 1440);
  assert.equal(S.setGoal(S.emptyState(), "abc").goal, 120);
  assert.equal(S.importJSON(S.exportJSON(S.setGoal(S.emptyState(), 45))).goal, 45);
});

test("carryOver copies only unfinished, non-duplicate tasks from the latest earlier day", () => {
  let s = S.addTask(S.emptyState(), "2026-03-08", "old open", "1");
  s = S.addTask(s, "2026-03-08", "done one", "2");
  s = S.toggleTask(s, "2026-03-08", "2");
  s = S.addTask(s, T, "Old Open", "x"); // already present, case-insensitive
  s = S.addTask(s, "2026-03-08", "second open", "3");
  assert.deepEqual(S.carryable(s, T).map((t) => t.text), ["second open"]);
  s = S.carryOver(s, T);
  assert.deepEqual(S.getDay(s, T).tasks.map((t) => t.text), ["Old Open", "second open"]);
  assert.equal(S.carryable(s, T).length, 0);
});

test("weeklyReview describes the week and compares with the previous one", () => {
  assert.equal(S.weeklyReview(S.emptyState(), T).length, 1);
  let s = S.addFocus(S.emptyState(), "2026-03-09", 40);
  s = S.addFocus(s, "2026-03-02", 30); // previous week
  const lines = S.weeklyReview(s, T);
  assert.match(lines[0], /40 min/);
  assert.match(lines[1], /2026-03-09/);
  assert.match(lines[2], /Up 10 min/);
});
