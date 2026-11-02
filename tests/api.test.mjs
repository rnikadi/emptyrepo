// Runs only when TEST_DATABASE_URL is set (CI/local Postgres); otherwise skipped.
import test from "node:test";
import assert from "node:assert/strict";

const url = process.env.TEST_DATABASE_URL;
test("API round-trips a day through PostgreSQL", { skip: !url }, async () => {
  process.env.DATABASE_URL = url;
  const { server, init, pool } = await import("../server/index.js");
  await init();
  await new Promise((r) => server.listen(0, r));
  const base = `http://localhost:${server.address().port}`;
  try {
    assert.equal((await (await fetch(`${base}/api/health`)).json()).db, true);
    const put = await fetch(`${base}/api/days/2026-03-10`, {
      method: "PUT",
      body: JSON.stringify({ intention: "x", focusMinutes: 25, tasks: [{ id: "a", text: "t", done: true }, { text: "" }] }),
    });
    assert.equal(put.status, 200);
    const all = await (await fetch(`${base}/api/days`)).json();
    assert.equal(all.days["2026-03-10"].focusMinutes, 25);
    assert.equal(all.days["2026-03-10"].tasks.length, 1);
    assert.equal((await fetch(`${base}/api/days/bad`, { method: "PUT", body: "{}" })).status, 404);
    assert.equal((await fetch(`${base}/secret`)).status, 404);
  } finally {
    server.close();
    await pool.end();
  }
});
