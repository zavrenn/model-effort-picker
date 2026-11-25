/* Options, their value score, and the "What matters more to you?" choices. */

const EFFORTS = D.efforts;
const effLabel = id => (EFFORTS.find(e => e.id === id) || { label: id }).label;

const combos = [];
D.models.forEach(m => EFFORTS.forEach(e => {
  const r = m.results[e.id];
  if (!r) return;
  combos.push({
    key: `${m.id}:${e.id}`, model: m, effort: e.id,
    I: r.intelligence, C: r.cost, approx: !!r.approx
  });
}));
const byKey = Object.fromEntries(combos.map(c => [c.key, c]));

// K = intelligence points one doubling of cost is worth. Cheapest goes by cost alone and
// Smartest by score alone; the other measure only breaks ties.
let tie = () => 0;
function applyWeight(stop) {
  const w = stop.word;
  combos.forEach(c => {
    c.raw = w === "Cheapest" ? -Math.log2(c.C) : w === "Smartest" ? c.I : c.I - stop.k * Math.log2(c.C);
  });
  tie = w === "Cheapest" ? (p, q) => p.I - q.I : w === "Smartest" ? (p, q) => q.C - p.C : () => 0;
  const raws = combos.map(c => c.raw);
  const lo = Math.min(...raws), hi = Math.max(...raws);
  combos.forEach(c => { c.value = Math.round(100 * (c.raw - lo) / (hi - lo || 1)); });
}

// Only options on the upper edge of the cost/intelligence cloud can ever be the best pick.
function edge() {
  const pts = combos.map(c => ({ c, x: Math.log2(c.C), y: c.I }))
    .sort((p, q) => p.x - q.x || q.y - p.y);
  const h = [];
  pts.forEach(p => {
    if (h.length && h[h.length - 1].x === p.x) return;
    while (h.length >= 2) {
      const o = h[h.length - 2], q = h[h.length - 1];
      if ((q.x - o.x) * (p.y - o.y) - (q.y - o.y) * (p.x - o.x) >= 0) h.pop(); else break;
    }
    h.push(p);
  });
  const top = Math.max(...h.map(p => p.y));
  return h.slice(0, h.findIndex(p => p.y === top) + 1);
}

const WORDS = {
  1: ["Best value"],
  2: ["Cheapest", "Smartest"],
  3: ["Cheapest", "Balanced", "Smartest"],
  4: ["Cheapest", "Low cost", "Smarter", "Smartest"],
  5: ["Cheapest", "Low cost", "Balanced", "Smarter", "Smartest"]
};

// Each choice gets the weight in the middle of the range where its option wins. At most 5.
const stops = (() => {
  const h = edge();
  const s = h.slice(1).map((p, i) => (p.y - h[i].y) / (p.x - h[i].x));
  let all = h.map((p, i) => ({
    c: p.c,
    k: h.length === 1 ? 3
      : i === 0 ? s[0] * 1.5
      : i === h.length - 1 ? s[i - 1] / 1.5
      : Math.sqrt(s[i - 1] * s[i])
  }));
  const n = all.length;
  if (n > 5) all = [0, 1, 2, 3, 4].map(j => all[Math.round(j * (n - 1) / 4)]);
  all.forEach((st, i) => { st.word = WORDS[all.length][i]; });
  return all;
})();
const stopByKey = Object.fromEntries(stops.map(s => [s.c.key, s]));
// > 0 when p is the better pick under the current weight.
const better = (p, q) => p.raw - q.raw || tie(p, q);
const defaultStop = stops[Math.floor((stops.length - 1) / 2)];

/* ---------- Words and numbers ---------- */

const name = c => `${c.model.short || c.model.name} ${effLabel(c.effort)}`;
const fullName = c => `${c.model.name} ${effLabel(c.effort)}`;
const esc = s => String(s).replace(/[&<>"']/g, ch =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
const money = v => "$" + v.toFixed(2);
const iText = c => (c.approx ? "≈" : "") + c.I;
const cText = c => (c.approx ? "≈" : "") + money(c.C);
const ratio = (a, b) => Math.max(a.C, b.C) / Math.min(a.C, b.C);
const sameCost = (a, b) => ratio(a, b) < 1.005;
