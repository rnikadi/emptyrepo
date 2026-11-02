// Optional backend: serves the static app and syncs days to PostgreSQL.
import http from "node:http";
import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { importJSON } from "../js/store.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.PORT || 8000);
export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL || "postgres://localhost:5432/focus" });

const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript" };
const STATIC = new Set(["index.html", "css/style.css", "js/app.js", "js/store.js", "js/viz.js", "js/sync.js", "vendor/d3.min.js"]);

const json = (res, code, body) => {
  res.writeHead(code, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
};

async function readBody(req) {
  let size = 0; const chunks = [];
  for await (const c of req) { size += c.length; if (size > 100_000) throw new Error("too large"); chunks.push(c); }
  return Buffer.concat(chunks).toString();
}

export async function init() {
  await pool.query(readFileSync(path.join(root, "server/schema.sql"), "utf8"));
}

export const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://x");
    if (url.pathname === "/api/health") {
      await pool.query("select 1");
      return json(res, 200, { ok: true, db: true });
    }
    if (url.pathname === "/api/days" && req.method === "GET") {
      const { rows } = await pool.query(
        "select to_char(day,'YYYY-MM-DD') as day, intention, focus_minutes, tasks from days order by day desc limit 400");
      const days = {};
      for (const r of rows) days[r.day] = { intention: r.intention, focusMinutes: r.focus_minutes, tasks: r.tasks };
      return json(res, 200, { version: 1, days });
    }
    const m = url.pathname.match(/^\/api\/days\/(\d{4}-\d{2}-\d{2})$/);
    if (m && req.method === "PUT") {
      const clean = importJSON(JSON.stringify({ days: { [m[1]]: JSON.parse(await readBody(req)) } })).days[m[1]];
      if (!clean) return json(res, 400, { error: "invalid day" });
      await pool.query(
        `insert into days (day,intention,focus_minutes,tasks) values ($1,$2,$3,$4)
         on conflict (day) do update set intention=$2, focus_minutes=$3, tasks=$4, updated_at=now()`,
        [m[1], clean.intention, clean.focusMinutes, JSON.stringify(clean.tasks)]);
      return json(res, 200, clean);
    }
    if (url.pathname.startsWith("/api/")) return json(res, 404, { error: "not found" });

    const rel = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
    if (!STATIC.has(rel)) return json(res, 404, { error: "not found" });
    res.writeHead(200, { "content-type": TYPES[path.extname(rel)] });
    res.end(await readFile(path.join(root, rel)));
  } catch (e) {
    console.error(e.message);
    json(res, e instanceof SyntaxError ? 400 : 500, { error: "request failed" });
  }
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await init();
  server.listen(PORT, () => console.log(`Focus Journal on http://localhost:${PORT}`));
}
