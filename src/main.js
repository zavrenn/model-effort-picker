const $ = id => document.getElementById(id);
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const slotVar = c => `var(--s${c.model.slot})`;

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

/* ---------- The bars ---------- */

const NUM = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
const say = n => NUM[n] || String(n);

// One sentence on what switching changes; the bars show the before-and-after numbers.
function reason(a, b) {
  const dI = b.I - a.I, n = Math.abs(dI), eq = sameCost(a, b), up = b.C > a.C, r = b.C / a.C;
  const ab = a.approx || b.approx ? "about " : "";
  if (!dI && eq) return "Both have the same score and cost.";
  const pts = dI ? `${dI > 0 ? "gain" : "lose"} ${ab}${n} benchmark point${n === 1 ? "" : "s"}` : "keep the same score";
  const pct = up && r >= 2 ? `${ab ? "about" : "over"} ${say(ab ? Math.round(r) : Math.floor(r))} times the price`
    : `${Math.round(Math.abs(r - 1) * 100)}% ${up ? "more" : "less"}`;
  const usd = ab + money(Math.abs(b.C - a.C));
  return `You ${pts} ${eq ? "at the same cost" : up ? `for ${usd} more per task (${pct})` : `and save ${usd} per task (${pct})`}.`;
}

const BARS = [
  { id: "score", v: c => c.I, text: iText },
  { id: "cost", v: c => c.C, text: cText }
];
let shownPair = "";

// Both values on one zero-based scale. Pale up to the smaller one; the change itself is colored
// (striped when it goes down). A thin mark stays at Now. Names sit above Now and below Considering,
// ending at their value. Only a new pair moves the bars.
function drawBars(a, b) {
  const pair = `${a.key}|${b.key}`;
  if (pair === shownPair) return;
  shownPair = pair;
  for (const m of BARS) {
    const max = Math.max(m.v(a), m.v(b));
    const f = 100 * m.v(a) / max, t = 100 * m.v(b) / max, lo = Math.min(f, t) + "%";
    const base = $(`${m.id}-base`), delta = $(`${m.id}-delta`), mark = $(`${m.id}-mark`);
    $(`${m.id}-val`).textContent = a === b ? m.text(a) : `${m.text(a)} → ${m.text(b)}`;
    mark.style.left = f + "%";
    mark.hidden = a === b;
    $(`${m.id}-now`).textContent = a === b ? "" : name(a);
    $(`${m.id}-now`).style.width = f + "%";
    $(`${m.id}-next`).textContent = a === b ? "" : name(b);
    $(`${m.id}-next`).style.width = t + "%";
    base.style.width = lo;
    delta.style.left = lo;
    delta.style.width = Math.abs(t - f) + "%";
    delta.classList.toggle("down", t < f);
    if (reduced || a === b) continue;
    const o = { duration: 1100, delay: 250, easing: "cubic-bezier(.3,.7,.2,1)", fill: "backwards" };
    base.animate([{ width: f + "%" }, { width: lo }], o);
    delta.animate([{ clipPath: t < f ? "inset(0 0 0 100%)" : "inset(0 100% 0 0)" }, { clipPath: "inset(0)" }], o);
  }
}

/* ---------- Ranking ---------- */

const list = $("rank-list"), more = $("more"), liByKey = new Map();
let expanded = false;

more.addEventListener("click", () => { expanded = !expanded; renderRank(); });
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
  // Order by the unrounded score the verdict uses; the rounded value is only for display.
  const sorted = [...combos].sort((p, q) => q.raw - p.raw);
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
  applyWeight(stopByKey[state.smarts].k);
  const a = byKey[state.now], b = byKey[state.next], same = a === b;
  const win = same ? null : b.raw > a.raw ? "next" : "now";

  selNow.value = state.now;
  selNext.value = state.next;
  $("dot-now").style.setProperty("--c", slotVar(a));
  $("dot-next").style.setProperty("--c", slotVar(b));
  const radio = prio.querySelector(`input[value="${state.smarts}"]`);
  if (radio) radio.checked = true;

  const head = $("v-head");
  let sub;
  if (same) {
    head.textContent = "Same choice.";
    sub = "Pick another to compare.";
  } else {
    const yes = win === "next", [w, l] = yes ? [b, a] : [a, b];
    head.innerHTML = `<span class="${yes ? "yes" : "no"}">${yes ? "Yes." : "No."}</span> ` +
      esc(`${yes ? "Choose" : "Keep"} ${name(w)} over ${name(l)}.`);
    sub = reason(a, b);
  }
  $("v-sub").textContent = sub;
  $("rank-title").textContent = `All models · ${stopByKey[state.smarts].word}`;

  drawBars(a, b);
  renderRank();
  writeHash();

  const sentence = `${head.textContent} ${sub}`;
  $("bars").setAttribute("aria-label", `${sentence} ` +
    `${fullName(a)}: ${a.I} points, ${money(a.C)} per task. ${fullName(b)}: ${b.I} points, ${money(b.C)} per task.`);
  $("live").textContent = sentence;
}

/* ---------- Start ---------- */

readHash();
$("updated").textContent = D.updated;
addEventListener("hashchange", () => { readHash(); update(); });
update();
