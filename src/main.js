const $ = id => document.getElementById(id);
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const wide = matchMedia("(min-width: 901px)");
const slotVar = c => `var(--s${c.model.slot})`;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/* ---------- State, kept in the URL hash ---------- */

const state = { now: "opus:high", next: "opus:xhigh", smarts: defaultStop.c.key };

function readHash() {
  const p = new URLSearchParams(location.hash.slice(1));
  if (byKey[p.get("now")]) state.now = p.get("now");
  if (byKey[p.get("next")]) state.next = p.get("next");
  if (stopByKey[p.get("smarts")]) state.smarts = p.get("smarts");
}
const writeHash = () =>
  history.replaceState(null, "", `#now=${state.now}&next=${state.next}&smarts=${state.smarts}`);

/* ---------- Controls ---------- */

const selNow = $("now"), selNext = $("next"), prio = $("prio");
selNow.innerHTML = selNext.innerHTML = D.models.map(m =>
  `<optgroup label="${esc(m.name)}">${EFFORTS.filter(e => m.results[e.id]).map(e =>
    `<option value="${m.id}:${e.id}">${esc(m.name)} · ${esc(e.label)}</option>`).join("")}</optgroup>`).join("");
selNow.addEventListener("change", () => { state.now = selNow.value; update(); });
selNext.addEventListener("change", () => { state.next = selNext.value; update(); });
$("swap").addEventListener("click", () => { [state.now, state.next] = [state.next, state.now]; update(); });

prio.innerHTML = stops.map((s, i) =>
  `<input class="sr-only" type="radio" name="prio" id="prio-${i}" value="${s.c.key}">` +
  `<label for="prio-${i}">${esc(s.word)}</label>`).join("");
prio.addEventListener("change", e => { state.smarts = e.target.value; update(); });

/* ---------- The scale ---------- */

const stage = $("stage"), sceneEl = $("scene"), tagsEl = $("tags"), boardRow = $("board-row"), rankEl = document.querySelector(".rank");
const E = {
  head: $("v-head"), sub: $("v-sub"),
  wt: {
    now: { score: $("wt-now-score"), money: $("wt-now-money") },
    next: { score: $("wt-next-score"), money: $("wt-next-money") }
  },
  pl: { now: $("pl-now"), next: $("pl-next") },
  link: $("link"), linkA: $("link-a"), linkB: $("link-b")
};
const SIZED = [...KEYS.flatMap(k => TYPES.map(t => E.wt[k][t])), E.pl.now, E.pl.next];
const M = 8;
let SW = 1, SH = 1, cur = null, geo = null;

const measure = () => { for (const el of SIZED) { el._w = el.offsetWidth; el._h = el.offsetHeight; } };
const on = (el, v) => el.classList.toggle("on", !!v);
const moveTo = (el, x, y) => {
  el._x = Math.round(x); el._y = Math.round(y);
  el.style.transform = `translate(${el._x}px, ${el._y}px)`;
};

// Short names for the pair: only what differs.
function shortNames(a, b) {
  if (a.model === b.model) return [effLabel(a.effort), effLabel(b.effort)];
  if (a.effort === b.effort) return [a.model.short, b.model.short];
  return [name(a), name(b)];
}

// What sits in each pan, in score points.
// Score: the points gap, in the pan with more points.
// Money: the cost gap (K points per doubling of cost), in the cheaper pan.
// The beam tips by the difference, which is the value-score gap.
function weights(a, b, k) {
  const w = { now: { score: 0, money: 0 }, next: { score: 0, money: 0 } };
  const dI = b.I - a.I, m = k * Math.log2(b.C / a.C);
  if (dI) w[dI > 0 ? "next" : "now"].score = Math.abs(dI);
  if (!sameCost(a, b)) w[m > 0 ? "now" : "next"].money = Math.abs(m);
  return w;
}

// One short line on why the winning pan is heavier.
// Points and dollars, "about" when a number was read from a chart.
function reason(a, b, win) {
  const W = win === "next" ? b : a, L = win === "next" ? a : b;
  const d = W.I - L.I, eq = sameCost(a, b), cheap = !eq && W.C < L.C;
  const ab = a.approx || b.approx ? "about " : "";
  const pts = ab + points(Math.abs(d)), usd = ab + money(Math.abs(W.C - L.C));
  if (d > 0 && eq) return `You gain ${pts} at the same cost.`;
  if (d > 0) return cheap ? `You gain ${pts} and save ${usd} per task.` : `You gain ${pts} for ${usd} more per task.`;
  if (d === 0) return cheap ? `Same score, you save ${usd} per task.` : "Same score, same cost.";
  return `You save ${usd} per task for ${pts} less.`;
}

// Runs every frame: tags follow the weights, names sit under the pans.
function place(api) {
  if (!cur || !api.ready) return;
  tagsEl.classList.add("ready");
  const py = Math.max(api.pan.now ? api.pan.now.y : 0, api.pan.next ? api.pan.next.y : 0) + 10;
  for (const k of KEYS) {
    for (const t of TYPES) {
      const el = E.wt[k][t], p = api.w[k][t];
      el.style.opacity = p ? p.a.toFixed(3) : "0";
      if (p) moveTo(el, clamp(p.x - el._w / 2, M, SW - M - el._w), p.y - el._h / 2);
    }
    const el = E.pl[k], p = api.pan[k];
    if (p) moveTo(el, clamp(p.x - el._w / 2, M, SW - M - el._w), Math.min(py, SH - M - el._h));
  }
  placeLink();
}

// Purple elbow from the "Considering" row in the ranking to its pan (wide screens only).
function placeLink() {
  const pl = E.pl.next;
  let ok = wide.matches && !cur.same && geo && geo.row && pl._x != null;
  if (ok) {
    const x0 = geo.row.x - 3, y0 = geo.row.y;
    const x1 = geo.sx + pl._x + pl._w + 3, y1 = geo.sy + pl._y + 13;
    const gx = (geo.sr + geo.rl) / 2;
    ok = x1 < gx - 12;
    if (ok) {
      const dy = y1 - y0, s = Math.sign(dy) || 1, rr = Math.min(12, Math.abs(dy) / 2);
      E.link.setAttribute("d", Math.abs(dy) < 1 ? `M${x0} ${y0} H${x1}`
        : `M${x0} ${y0} H${gx + rr} Q${gx} ${y0} ${gx} ${y0 + s * rr} V${y1 - s * rr} Q${gx} ${y1} ${gx - rr} ${y1} H${x1}`);
      E.linkA.setAttribute("cx", x0); E.linkA.setAttribute("cy", y0);
      E.linkB.setAttribute("cx", x1); E.linkB.setAttribute("cy", y1);
    }
  }
  for (const el of [E.link, E.linkA, E.linkB]) on(el, ok);
}

function measureGeo() {
  const li = liByKey.get(state.next);
  geo = {
    sx: stage.offsetLeft + stage.clientLeft + sceneEl.offsetLeft,
    sy: stage.offsetTop + stage.clientTop + sceneEl.offsetTop,
    sr: stage.offsetLeft + stage.offsetWidth, rl: rankEl.offsetLeft,
    row: li && li.isConnected ? { x: li.offsetLeft, y: li.offsetTop + li.offsetHeight / 2 } : null
  };
}

/* ---------- Ranking ---------- */

const list = $("rank-list"), more = $("more"), liByKey = new Map();
let expanded = false;

more.addEventListener("click", () => { expanded = !expanded; renderRank(); measureGeo(); });
list.addEventListener("click", e => {
  const btn = e.target.closest("button.row");
  if (!btn || btn.getAttribute("aria-disabled") === "true") return;
  state.next = btn.closest("li").dataset.key;
  update();
});

function rowFor(c) {
  let li = liByKey.get(c.key);
  if (!li) {
    li = document.createElement("li");
    li.dataset.key = c.key;
    li.innerHTML = `<button class="row" type="button"><span class="rk"></span>` +
      `<span class="dot" style="--c:${slotVar(c)}"></span>` +
      `<span class="nm"><span class="t">${esc(name(c))}</span><em class="tag"></em></span>` +
      `<span class="bar"><i></i></span><span class="val"></span></button>`;
    liByKey.set(c.key, li);
  }
  const isNow = c.key === state.now, isNext = c.key === state.next && !isNow;
  const tag = isNow ? "Now" : isNext ? "Considering" : "";
  li.className = [c.rank === 1 && "first", isNow && "is-now", isNext && "is-next"].filter(Boolean).join(" ");
  const btn = li.firstChild;
  btn.querySelector(".rk").textContent = c.rank;
  btn.querySelector(".tag").textContent = tag;
  btn.querySelector(".bar i").style.width = `${c.value}%`;
  btn.querySelector(".val").textContent = c.value;
  btn.setAttribute("aria-label", `${c.rank}. ${fullName(c)}, value ${c.value} of 100${tag ? `, ${tag.toLowerCase()}` : ""}`);
  if (isNow) btn.setAttribute("aria-disabled", "true"); else btn.removeAttribute("aria-disabled");
  return li;
}

function renderRank() {
  const sorted = [...combos].sort((p, q) => q.value - p.value || q.I - p.I || p.C - q.C);
  sorted.forEach((c, i) => { c.rank = i + 1; });
  const keep = new Set(expanded ? sorted : sorted.slice(0, 5));
  keep.add(byKey[state.now]).add(byKey[state.next]);
  const shown = sorted.filter(c => keep.has(c));

  const focusKey = document.activeElement && list.contains(document.activeElement)
    ? document.activeElement.closest("li").dataset.key : null;
  const before = new Map();
  liByKey.forEach((li, k) => { if (li.isConnected) before.set(k, li.getBoundingClientRect().top); });

  const items = [];
  let prev = 0;
  for (const c of shown) {
    if (c.rank !== prev + 1) {
      const gap = document.createElement("li");
      gap.className = "gap";
      gap.setAttribute("aria-hidden", "true");
      items.push(gap);
    }
    prev = c.rank;
    items.push(rowFor(c));
  }
  list.replaceChildren(...items);
  if (focusKey && liByKey.get(focusKey).isConnected) liByKey.get(focusKey).firstChild.focus({ preventScroll: true });

  if (!reduced) for (const c of shown) {
    const li = liByKey.get(c.key), b = before.get(c.key);
    if (b == null) {
      li.animate([{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }],
        { duration: 300, easing: "ease-out" });
    } else {
      const dy = b - li.getBoundingClientRect().top;
      if (Math.abs(dy) > 1) li.animate([{ transform: `translateY(${dy}px)` }, { transform: "none" }],
        { duration: 450, easing: "cubic-bezier(.2,.8,.2,1)" });
    }
  }
  more.textContent = expanded ? "Show less" : `See all ${sorted.length}`;
  more.setAttribute("aria-expanded", String(expanded));
}

/* ---------- Update ---------- */

function update() {
  const st = stopByKey[state.smarts];
  applyWeight(st.k);
  const a = byKey[state.now], b = byKey[state.next], same = a === b;
  const win = same ? null : b.raw > a.raw ? "next" : "now";
  cur = { a, b, same, win };

  selNow.value = state.now;
  selNext.value = state.next;
  $("dot-now").style.setProperty("--c", slotVar(a));
  $("dot-next").style.setProperty("--c", slotVar(b));
  const radio = prio.querySelector(`input[value="${state.smarts}"]`);
  if (radio) radio.checked = true;

  const [na, nb] = shortNames(a, b);
  const act = { now: `Stay on ${na}`, next: `Switch to ${nb}` };
  let head, sub;
  if (same) {
    head = "Same choice.";
    sub = "Pick another to compare.";
    E.head.textContent = head;
  } else {
    const word = win === "next" ? "Yes." : "No.";
    head = `${word} ${act[win]}.`;
    sub = reason(a, b, win);
    E.head.innerHTML = `<span class="${win === "next" ? "yes" : "no"}">${word}</span> ${esc(act[win])}.`;
  }
  E.sub.textContent = sub;

  const gap = Math.abs(b.I - a.I), cheaper = sameCost(a, b) ? "" : cheaperText(a, b);
  for (const k of KEYS) {
    const c = k === "now" ? a : b;
    E.wt[k].score.innerHTML = `<b>★ Higher score</b><span>+${points(gap)}</span>`;
    E.wt[k].money.innerHTML = `<b>$ Saves money</b><span>${cheaper}</span>`;
    E.pl[k].innerHTML = `<strong><i class="cdot" style="--c:${slotVar(c)}"></i><span>${esc(act[k])}</span></strong>` +
      `<span class="meta">${iText(c)} points · ${c.approx ? "≈" : ""}${money(c.C)} / task</span>`;
    E.pl[k].classList.toggle("win", win === k);
    on(E.pl[k], !same);
  }
  measure();

  scale.set({ same, w: same ? {} : weights(a, b, st.k) });
  renderRank();
  measureGeo();
  writeHash();

  const sentence = `${head} ${sub}`;
  sceneEl.setAttribute("aria-label", `Balance scale. ${sentence} ` +
    `${fullName(a)}: ${a.I} points, ${money(a.C)} per task. ${fullName(b)}: ${b.I} points, ${money(b.C)} per task.`);
  $("live").textContent = sentence;
}

/* ---------- Start ---------- */

readHash();
$("updated").textContent = D.updated;
SW = sceneEl.clientWidth; SH = sceneEl.clientHeight;
const scale = createScale(sceneEl, { reduced, onFrame: place });
const ro = new ResizeObserver(() => {
  SW = sceneEl.clientWidth; SH = sceneEl.clientHeight;
  measure(); measureGeo();
});
ro.observe(boardRow);
ro.observe(sceneEl);
addEventListener("hashchange", () => { readHash(); update(); });
update();
