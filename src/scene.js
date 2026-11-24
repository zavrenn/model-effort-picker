/* The balance scale in SVG: a beam on a stand, two pans, up to two weights in each pan.
   Left pan = now, right pan = considering. Text lives in HTML on top;
   this module draws the shapes and reports where they are.
   Depth is faked: a camera slightly above (x right, y up, z toward the viewer), toon shading. */
const KEYS = ["now", "next"], TYPES = ["score", "money"];
const SGN = { now: -1, next: 1 };

// Sizes in scene units. The floor is y = 0.
const P = 6.0;                 // pivot height
const LB = 4.6;                // half beam
const L = 4.2;                 // hook to pan rim
const R = 2.0;                 // pan radius
const PD = 0.34;               // pan depth
const WW = 2.3, WT = 1.8, WH = 1.15, WD = 1.25; // weight: bottom width, top width, height, depth
const DEG = Math.PI / 180, MAX = 11 * DEG, MIN = 3 * DEG;
const SE = Math.sin(13 * DEG), CE = Math.cos(13 * DEG); // camera elevation
const LABEL_ROOM = 70;         // px kept under the floor for the pan labels
const BEAM = [[-LB, -0.11], [-0.7, -0.22], [0.7, -0.22], [LB, -0.11], [LB, 0.11], [0.7, 0.26], [-0.7, 0.26], [-LB, 0.11]];

// Toon colours: light, base, dark bands from left to right.
const toon = (id, lt, mid, dk) => `<linearGradient id="${id}"><stop offset=".28" stop-color="${lt}"/>` +
  `<stop offset=".28" stop-color="${mid}"/><stop offset=".74" stop-color="${mid}"/><stop offset=".74" stop-color="${dk}"/></linearGradient>`;
const DEFS = "<defs>" +
  toon("sp", "#9b76ef", "#7b4ce0", "#6237c4") +
  toon("sl", "#dcff86", "#c4f24a", "#a8d62f") +
  toon("sm", "#ece6fd", "#d5cbf6", "#bcaeee") +
  `<linearGradient id="si" x2="0" y2="1"><stop offset="0" stop-color="#55309f"/><stop offset="1" stop-color="#8d64ea"/></linearGradient>` +
  `<radialGradient id="sc" cx=".38" cy=".35" r=".7"><stop offset=".25" stop-color="#e6ff9c"/><stop offset=".26" stop-color="#c4f24a"/></radialGradient>` +
  `<radialGradient id="ss"><stop offset="0" stop-color="#1d1442" stop-opacity=".2"/><stop offset="1" stop-color="#1d1442" stop-opacity="0"/></radialGradient>` +
  "</defs>";
const FRONT = { score: "url(#sl)", money: "url(#sm)" }, TOP = { score: "#e2ff9a", money: "#f1edfe" };

// The net value tips the beam; any gap tips it a little so the winner always shows.
const tiltOf = d => (d ? Math.sign(d) * (MIN + (MAX - MIN) * Math.tanh(Math.abs(d) / 4)) : 0);
// Weight sizes: the heaviest is full size, the rest by value. Two in one pan get smaller to fit.
function sizes(w) {
  const v = (k, t) => (w[k] && w[k][t]) || 0;
  const max = Math.max(...KEYS.flatMap(k => TYPES.map(t => v(k, t))));
  const out = {};
  for (const k of KEYS) {
    const both = v(k, "score") > 0 && v(k, "money") > 0;
    out[k] = {};
    for (const t of TYPES) out[k][t] = v(k, t) > 0 ? (0.5 + 0.5 * v(k, t) / max) * (both ? 0.85 : 1) : 0;
  }
  return out;
}
// Where each pan hangs for a beam angle (positive = right side down).
const hook = (k, a) => ({ x: SGN[k] * LB * Math.cos(a), y: P - SGN[k] * LB * Math.sin(a) });
const n = v => v.toFixed(1);
// SVG path through screen points, with rounded corners.
function rounded(pts, r) {
  const m = pts.length;
  return pts.map((p, i) => {
    const a = pts[(i + m - 1) % m], c = pts[(i + 1) % m];
    const da = Math.hypot(a[0] - p[0], a[1] - p[1]) || 1, dc = Math.hypot(c[0] - p[0], c[1] - p[1]) || 1;
    const ka = Math.min(r, da / 2) / da, kc = Math.min(r, dc / 2) / dc;
    return `${i ? "L" : "M"}${n(p[0] + (a[0] - p[0]) * ka)} ${n(p[1] + (a[1] - p[1]) * ka)}` +
      `Q${n(p[0])} ${n(p[1])} ${n(p[0] + (c[0] - p[0]) * kc)} ${n(p[1] + (c[1] - p[1]) * kc)}`;
  }).join("") + "Z";
}

function createScale(el, { reduced, onFrame }) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "scale");
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML = DEFS + "<g></g>";
  const g = svg.lastChild;
  el.prepend(svg);

  let s = 40, cx = 0, cy = 0, cfg = null, fs = null;
  let a = 0, va = 0, goal = 0, last = 0, raf = 0;
  const api = {
    set, ready: true,
    w: { now: { score: null, money: null }, next: { score: null, money: null } },
    pan: { now: null, next: null }
  };

  /* Drawing helpers, in scene units */
  const project = (x, y, z = 0) => ({ x: cx + x * s, y: cy - (y * CE - z * SE) * s });
  const xy = (x, y, z) => { const p = project(x, y, z); return `${n(p.x)} ${n(p.y)}`; };
  const path = (d, fill) => `<path class="o" fill="${fill}" d="${d}"/>`;
  const poly = (pts, fill, r) => path(rounded(pts.map(q => { const p = project(...q); return [p.x, p.y]; }), r * s), fill);
  const oval = (x, y, z, rx, ry, fill, cls = "o") => {
    const p = project(x, y, z);
    return `<ellipse class="${cls}" fill="${fill}" cx="${n(p.x)}" cy="${n(p.y)}" rx="${n(rx * s)}" ry="${n(ry * s)}"/>`;
  };
  const flat = (x, y, z, r, fill, cls) => oval(x, y, z, r, r * SE, fill, cls); // a level circle
  const ball = (x, y, z, r, fill) => oval(x, y, z, r, r, fill);
  const line = (p0, p1) => `<path class="str" d="M${xy(...p0)}L${xy(...p1)}"/>`;
  // A level disc on the floor axis: side, then top.
  const disc = (r, y0, y1) =>
    path(`M${xy(-r, y1)}L${xy(-r, y0)}A${n(r * s)} ${n(r * SE * s)} 0 0 0 ${xy(r, y0)}L${xy(r, y1)}Z`, "url(#sp)") +
    flat(0, y1, 0, r, "#9b76ef");

  function weight(x, y, f, t) {
    const z = WD / 2 * f, b = WW / 2 * f, tp = WT / 2 * f, h = y + WH * f;
    return poly([[x - tp, h, z], [x + tp, h, z], [x + tp, h, -z], [x - tp, h, -z]], TOP[t], 0.08) +
      poly([[x - b, y, z], [x + b, y, z], [x + tp, h, z], [x - tp, h, z]], FRONT[t], 0.12);
  }

  function pan(k, hx, hy) {
    const rim = hy - L, rx = n(R * s), ry = n(R * SE * s), ly = n((PD * CE + 0.55 * R * SE) * s);
    const l = xy(hx - R, rim), r = xy(hx + R, rim), top = [hx, hy - 0.4, 0];
    const at = q => [hx + Math.sin(q) * R * 0.93, rim + 0.02, Math.cos(q) * R * 0.93];
    let o = line(top, at(Math.PI));                                                  // back string
    o += path(`M${l}A${rx} ${ry} 0 0 1 ${r}A${rx} ${ly} 0 0 1 ${l}Z`, "url(#sp)");    // bowl
    o += flat(hx, rim, 0, R - 0.1, "url(#si)", "in");                                 // inside
    let y = rim - PD + 0.08;
    for (const t of TYPES) {
      const f = cfg.same ? 0 : fs[k][t];
      api.w[k][t] = null;
      if (!f) continue;
      o += weight(hx, y, f, t);
      const c = project(hx, y + WH * f / 2, WD / 2 * f);
      api.w[k][t] = { x: c.x, y: c.y, a: 1 };
      y += WH * f;
    }
    o += line(top, at(70 * DEG)) + line(top, at(-70 * DEG));                          // front strings
    o += path(`M${l}A${rx} ${ry} 0 0 0 ${r}A${rx} ${ly} 0 0 1 ${l}Z`, "url(#sp)");    // front lip
    o += ball(hx, hy - 0.26, 0, 0.15, "none");                                        // ring
    api.pan[k] = project(hx, 0, R);
    return o;
  }

  function draw() {
    if (!cfg) return;
    const ca = Math.cos(a), sa = Math.sin(a), hk = { now: hook("now", a), next: hook("next", a) };
    const rot = ([x, y]) => [x * ca + y * sa, P - x * sa + y * ca];
    let o = flat(0.4, 0, -0.4, 2.4, "url(#ss)", "sh");
    for (const k of KEYS) { const r = hk[k].y - L; o += flat(hk[k].x + 0.44 * r, 0, -0.75 * r, R * 1.15, "url(#ss)", "sh"); }
    o += disc(1.7, 0, 0.26) + disc(1.05, 0.26, 0.48);
    for (const k of KEYS) o += pan(k, hk[k].x, hk[k].y);
    o += path(`M${xy(-0.25, 0.48)}L${xy(-0.19, P)}L${xy(0.19, P)}L${xy(0.25, 0.48)}` +
      `A${n(0.25 * s)} ${n(0.25 * SE * s)} 0 0 1 ${xy(-0.25, 0.48)}Z`, "url(#sp)");    // post
    const beam = BEAM.map(rot);
    o += poly(beam.map(([x, y]) => [x, y, -0.15]), "#a07cf2", 0.1) + poly(beam.map(([x, y]) => [x, y, 0.15]), "#7b4ce0", 0.1);
    for (const k of KEYS) o += ball(hk[k].x, hk[k].y, 0.15, 0.2, "#7b4ce0");          // knobs
    o += ball(0, P + 0.66, 0, 0.26, "url(#sc)");                                       // cap
    const hr = n(0.42 * s);
    o += path(`M${xy(-0.42, P, -0.33)}L${xy(-0.42, P, 0.33)}A${hr} ${hr} 0 0 0 ${xy(0.42, P, 0.33)}` +
      `L${xy(0.42, P, -0.33)}A${hr} ${hr} 0 0 0 ${xy(-0.42, P, -0.33)}Z`, "url(#sp)") + ball(0, P, 0.33, 0.42, "#8a5ee8"); // hub
    g.innerHTML = o;
    if (onFrame) onFrame(api);
  }

  function fit() {
    const W = el.clientWidth, H = el.clientHeight;
    const top = (P + 0.95) * CE, bw = 2 * (LB + R + 0.1), bh = top + R * SE;
    const availH = Math.max(1, H - 12 - LABEL_ROOM);
    s = Math.min((W - 28) / bw, availH / bh);
    cx = W / 2;
    cy = 12 + (availH - bh * s) / 2 + top * s;
    draw();
  }

  function set(c) {
    cfg = c;
    fs = sizes(c.w);
    let net = 0;
    for (const k of KEYS) for (const t of TYPES) net += SGN[k] * ((c.w[k] && c.w[k][t]) || 0);
    goal = c.same ? 0 : tiltOf(net);
    if (reduced) { a = goal; draw(); return; }
    if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
  }

  // The beam swings to its new angle on a spring.
  function frame(ms) {
    const dt = Math.min(0.05, Math.max(0, (ms - last) / 1000));
    last = ms;
    va += (30 * (goal - a) - 4.8 * va) * dt;
    a += va * dt;
    if (Math.abs(goal - a) < 1e-4 && Math.abs(va) < 1e-3) { a = goal; va = 0; raf = 0; }
    else raf = requestAnimationFrame(frame);
    draw();
  }

  fit();
  new ResizeObserver(fit).observe(el);
  return api;
}
