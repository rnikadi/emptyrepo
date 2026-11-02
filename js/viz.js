// d3 visualisations. Each draw call re-animates, so every update feels alive.
const d3 = window.d3;
const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const reduce = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const dur = (ms) => (reduce() ? 0 : ms);
export const hasD3 = () => !!d3;

// Animated count-up for numbers.
export function countUp(el, to) {
  const from = Number(el.dataset.v || 0);
  el.dataset.v = to;
  if (!d3 || from === to) { el.textContent = to; return; }
  d3.select(el).transition().duration(dur(900)).ease(d3.easeCubicOut)
    .tween("text", () => { const i = d3.interpolateRound(from, to); return (t) => (el.textContent = i(t)); });
}

// 7-day focus bars with staggered grow-in, a soft area line and value labels.
export function drawWeek(el, days, todayKey) {
  const w = 560, h = 190, m = { t: 24, r: 8, b: 26, l: 8 };
  el.replaceChildren();
  const svg = d3.select(el).append("svg").attr("viewBox", `0 0 ${w} ${h}`).attr("role", "img")
    .attr("aria-label", "Focus minutes per day for the last 7 days");
  const defs = svg.append("defs");
  const g = defs.append("linearGradient").attr("id", "barg").attr("x1", 0).attr("x2", 0).attr("y1", 0).attr("y2", 1);
  g.append("stop").attr("offset", "0%").attr("stop-color", css("--accent"));
  g.append("stop").attr("offset", "100%").attr("stop-color", css("--accent2"));

  const x = d3.scaleBand().domain(days.map((d) => d.key)).range([m.l, w - m.r]).padding(0.32);
  const max = Math.max(30, d3.max(days, (d) => d.minutes));
  const y = d3.scaleLinear().domain([0, max]).range([h - m.b, m.t]);

  svg.append("g").selectAll("line").data(y.ticks(3)).join("line")
    .attr("x1", m.l).attr("x2", w - m.r).attr("y1", y).attr("y2", y)
    .attr("stroke", css("--line")).attr("stroke-dasharray", "3 5");

  const bars = svg.append("g").selectAll("rect").data(days).join("rect")
    .attr("x", (d) => x(d.key)).attr("width", x.bandwidth()).attr("rx", 9)
    .attr("y", h - m.b).attr("height", 0)
    .attr("fill", (d) => (d.minutes ? "url(#barg)" : css("--line")));
  bars.transition().delay((_, i) => dur(i * 80)).duration(dur(800)).ease(d3.easeBackOut.overshoot(1.2))
    .attr("y", (d) => (d.minutes ? y(d.minutes) : h - m.b - 5))
    .attr("height", (d) => (d.minutes ? h - m.b - y(d.minutes) : 5));

  const line = d3.line().curve(d3.curveCatmullRom).x((d) => x(d.key) + x.bandwidth() / 2).y((d) => y(d.minutes));
  const path = svg.append("path").datum(days).attr("d", line).attr("fill", "none")
    .attr("stroke", css("--ink")).attr("stroke-opacity", 0.35).attr("stroke-width", 2);
  const len = path.node().getTotalLength();
  path.attr("stroke-dasharray", len).attr("stroke-dashoffset", len)
    .transition().delay(dur(300)).duration(dur(1100)).ease(d3.easeCubicInOut).attr("stroke-dashoffset", 0);

  svg.append("g").selectAll("text.v").data(days.filter((d) => d.minutes)).join("text")
    .attr("x", (d) => x(d.key) + x.bandwidth() / 2).attr("y", (d) => y(d.minutes) - 8)
    .attr("text-anchor", "middle").attr("font-size", 12).attr("font-weight", 700).attr("fill", css("--ink")).attr("opacity", 0)
    .text((d) => d.minutes).transition().delay(dur(700)).duration(dur(400)).attr("opacity", 1);

  svg.append("g").selectAll("text.d").data(days).join("text")
    .attr("x", (d) => x(d.key) + x.bandwidth() / 2).attr("y", h - 6).attr("text-anchor", "middle")
    .attr("font-size", 12).attr("fill", (d) => (d.key === todayKey ? css("--accent") : css("--muted")))
    .attr("font-weight", (d) => (d.key === todayKey ? 700 : 400))
    .text((d) => d3.timeFormat("%a")(new Date(d.key + "T00:00:00")));

  // hover tooltip via native <title>
  bars.append("title").text((d) => `${d.key}: ${d.minutes} min, ${d.done}/${d.total} tasks`);
}

// 12-week calendar heatmap (GitHub-style) with a diagonal ripple-in.
export function drawHeat(el, state, todayKey) {
  const weeks = 12, cell = 15, gap = 4, left = 22, top = 4;
  const end = new Date(todayKey + "T00:00:00");
  const start = d3.timeDay.offset(d3.timeSunday(end), -(weeks - 1) * 7);
  const all = d3.timeDay.range(start, d3.timeDay.offset(end, 1));
  const val = (d) => {
    const day = state.days[d3.timeFormat("%Y-%m-%d")(d)];
    return day ? day.focusMinutes + day.tasks.filter((t) => t.done).length * 10 : 0;
  };
  const maxV = Math.max(30, d3.max(all, val));
  const color = d3.scaleSequential(d3.interpolateRgb(css("--line"), css("--accent"))).domain([0, maxV]);
  const w = left + weeks * (cell + gap), h = top + 7 * (cell + gap);
  el.replaceChildren();
  const svg = d3.select(el).append("svg").attr("viewBox", `0 0 ${w} ${h}`).attr("role", "img")
    .attr("aria-label", "Activity heatmap for the last 12 weeks");
  svg.selectAll("text").data(["M", "W", "F"]).join("text").attr("x", 0).attr("font-size", 10).attr("fill", css("--muted"))
    .attr("y", (_, i) => top + (1 + i * 2) * (cell + gap) + cell - 3).text((d) => d);
  const cells = svg.selectAll("rect").data(all).join("rect")
    .attr("x", (d) => left + d3.timeWeek.count(start, d) * (cell + gap))
    .attr("y", (d) => top + d.getDay() * (cell + gap))
    .attr("width", cell).attr("height", cell).attr("rx", 4)
    .attr("fill", (d) => (val(d) ? color(val(d)) : css("--line")))
    .attr("fill-opacity", (d) => (val(d) ? 1 : 0.55))
    .attr("stroke", (d) => (d3.timeFormat("%Y-%m-%d")(d) === todayKey ? css("--ink") : "none")).attr("stroke-width", 1.5)
    .attr("opacity", 0).attr("transform-origin", "center").attr("transform-box", "fill-box");
  cells.transition().delay((d, i) => dur(i * 6)).duration(dur(500)).ease(d3.easeBackOut).attr("opacity", 1);
  cells.append("title").text((d) => `${d3.timeFormat("%b %-d")(d)}: ${val(d) ? val(d) + " pts" : "nothing logged"}`);
}

// Timer ring: smooth sweep plus a pulse when a session completes.
export function pulse(el) {
  if (!d3 || reduce()) return;
  d3.select(el).transition().duration(300).style("transform", "scale(1.06)")
    .transition().duration(500).ease(d3.easeElasticOut).style("transform", "scale(1)");
}

// Little confetti burst for finishing a session.
export function burst(host) {
  if (!d3 || reduce()) return;
  const r = host.getBoundingClientRect();
  const svg = d3.select(document.body).append("svg").attr("class", "burst")
    .style("left", r.left + r.width / 2 + "px").style("top", r.top + r.height / 2 + "px");
  const cols = [css("--accent"), css("--accent2"), css("--good"), css("--ink")];
  const dots = d3.range(28).map((i) => ({ a: (i / 28) * Math.PI * 2 + Math.random() * 0.4, d: 60 + Math.random() * 90, c: cols[i % 4], s: 3 + Math.random() * 4 }));
  svg.selectAll("circle").data(dots).join("circle").attr("r", (d) => d.s).attr("fill", (d) => d.c)
    .transition().duration(1100).ease(d3.easeCubicOut)
    .attr("cx", (d) => Math.cos(d.a) * d.d).attr("cy", (d) => Math.sin(d.a) * d.d + 30).attr("opacity", 0)
    .on("end", (_, i) => { if (i === 0) svg.remove(); });
  setTimeout(() => svg.remove(), 1500);
}
