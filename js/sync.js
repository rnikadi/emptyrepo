// Optional PostgreSQL sync. If the API is not reachable (static hosting), everything stays local.
export async function detect() {
  try {
    const r = await fetch("api/health", { cache: "no-store" });
    return r.ok && (await r.json()).db === true;
  } catch { return false; }
}

export async function pull() {
  const r = await fetch("api/days", { cache: "no-store" });
  if (!r.ok) throw new Error("pull failed");
  return r.json();
}

const timers = new Map();
// Debounced per-day push so typing in the intention box doesn't spam the server.
export function pushDay(key, day, onError) {
  clearTimeout(timers.get(key));
  timers.set(key, setTimeout(async () => {
    try {
      const r = await fetch(`api/days/${key}`, { method: "PUT", body: JSON.stringify(day) });
      if (!r.ok) throw new Error();
    } catch { onError?.(); }
  }, 400));
}
