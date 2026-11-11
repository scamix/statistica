// UI for Lab 6: Riemann vs Lebesgue (Ex. 1) and the normal CDF (Ex. 2).
(function () {
  const el = (id) => document.getElementById(id);
  const I = Lab6Int, Nm = Lab6Normal;
  const MUTED = "#5b6475", GRID = "#e2e6ee", RED = "#d9482b", ACCENT = "#2b5fd9", ORANGE = "#d98a2b";
  const GREEN = "#2b9d6a", PURPLE = "#7a4fd1", GREY = "#8a94a6";
  const fmt = (x, d = 4) => (Number.isNaN(x) ? "—" : !isFinite(x) ? (x > 0 ? "∞" : "−∞") : x === 0 ? "0" : Math.abs(x) >= 1e5 || Math.abs(x) < 1e-3 ? x.toExponential(d - 1) : Number(x.toPrecision(d)).toString());
  const err = (x) => (Number.isNaN(x) ? "—" : !isFinite(x) ? "∞" : x === 0 ? "0" : Math.abs(x).toExponential(1));

  // ---------- canvas helpers (same style as Labs 4–5) ----------
  function setup(canvas) {
    const dpr = window.devicePixelRatio || 1, w = canvas.clientWidth, h = canvas.clientHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.font = "11px sans-serif";
    return { ctx, w, h, pad: { l: 50, r: 10, t: 10, b: 24 } };
  }

  function axes({ ctx, w, h, pad }, x0, x1, y0, y1, xlabel, { logx = false, logy = false } = {}) {
    const tx = logx ? Math.log10 : (v) => v, ty = logy ? Math.log10 : (v) => v;
    const [a0, a1, b0, b1] = [tx(x0), tx(x1), ty(y0), ty(y1)];
    const X = (x) => pad.l + ((tx(x) - a0) / (a1 - a0)) * (w - pad.l - pad.r);
    const Y = (y) => h - pad.b - ((ty(y) - b0) / (b1 - b0)) * (h - pad.t - pad.b);
    ctx.strokeStyle = GRID; ctx.fillStyle = MUTED; ctx.lineWidth = 1;
    ctx.textAlign = "right";
    for (let i = 0; i <= 4; i++) {
      const b = b0 + ((b1 - b0) * i) / 4, y = logy ? 10 ** b : b;
      ctx.beginPath(); ctx.moveTo(pad.l, Y(y)); ctx.lineTo(w - pad.r, Y(y)); ctx.stroke();
      ctx.fillText(logy ? `1e${Math.round(b)}` : fmt(y, 3), pad.l - 4, Y(y) + 4);
    }
    ctx.textAlign = "center";
    for (let i = 0; i <= 4; i++) {
      const a = a0 + ((a1 - a0) * i) / 4, x = logx ? 10 ** a : a;
      ctx.fillText(logx ? fmt(Number(x.toPrecision(2)), 2) : fmt(x, 3), X(x), h - pad.b + 14);
    }
    if (xlabel) { ctx.textAlign = "right"; ctx.fillText(xlabel, w - pad.r, h - 2); }
    return { X, Y };
  }

  function legend(c, items) {
    c.ctx.font = "12px sans-serif"; c.ctx.textAlign = "left";
    items.forEach(([label, color], i) => { c.ctx.fillStyle = color; c.ctx.fillText(`● ${label}`, c.pad.l + 8, c.pad.t + 14 + 15 * i); });
  }

  function curve(c, X, Y, fn, x0, x1, color, steps = 600) {
    c.ctx.strokeStyle = color; c.ctx.lineWidth = 1.8; c.ctx.beginPath();
    let pen = false;
    for (let i = 0; i <= steps; i++) {
      const x = x0 + ((x1 - x0) * i) / steps, y = fn(x);
      if (!isFinite(y)) { pen = false; continue; }
      pen ? c.ctx.lineTo(X(x), Y(y)) : c.ctx.moveTo(X(x), Y(y));
      pen = true;
    }
    c.ctx.stroke();
  }

  // Draw the graph of f. The two pathological functions get a picture of their values at p/q, q ≤ 40.
  function graph(c, X, Y, fn) {
    if (fn.pathological) {
      c.ctx.fillStyle = ACCENT;
      for (let q = 1; q <= 40; q++) for (let p = 0; p <= q; p++) {
        if (I.gcd(p, q) !== 1) continue;
        c.ctx.fillRect(X(p / q) - 1, Y(fn.f(p / q, q)) - 1, 2, 2);
      }
      c.ctx.strokeStyle = ACCENT; c.ctx.lineWidth = 1.8;
      c.ctx.beginPath(); c.ctx.moveTo(X(0), Y(0)); c.ctx.lineTo(X(1), Y(0)); c.ctx.stroke();
      return;
    }
    curve(c, X, Y, (x) => fn.f(x, 0), fn.a, fn.b, ACCENT);
  }

  function yRange(fn) {
    if (fn.id === "invsqrt") return [0, 6];
    if (fn.id === "sin1x") return [-1, 1];
    if (fn.pathological) return [0, 1];
    let lo = 0, hi = 0;
    for (let i = 0; i <= 400; i++) { const v = fn.f(fn.a + ((fn.b - fn.a) * i) / 400, 0); if (isFinite(v)) { lo = Math.min(lo, v); hi = Math.max(hi, v); } }
    return [lo, hi * 1.05];
  }

  // ---------- Ex. 1: pictures ----------
  // Riemann: vertical strips over a partition of the domain, height f(midpoint).
  function drawRiemann(fn, n) {
    const c = setup(el("cv-riemann")), [y0, y1] = yRange(fn);
    const { X, Y } = axes(c, fn.a, fn.b, y0, y1, "x");
    const h = (fn.b - fn.a) / n;
    for (let i = 0; i < n; i++) {
      const p = I.point(fn, 2 * i + 1, 2 * n);
      const v = Math.max(y0, Math.min(y1, fn.f(p.x, p.q)));
      const xa = X(fn.a + i * h), xb = X(fn.a + (i + 1) * h);
      c.ctx.fillStyle = "rgba(43,95,217,0.18)"; c.ctx.strokeStyle = "rgba(43,95,217,0.6)"; c.ctx.lineWidth = 1;
      c.ctx.fillRect(xa, Math.min(Y(v), Y(0)), xb - xa, Math.abs(Y(0) - Y(v)));
      c.ctx.strokeRect(xa, Math.min(Y(v), Y(0)), xb - xa, Math.abs(Y(0) - Y(v)));
    }
    graph(c, X, Y, fn);
  }

  // Lebesgue: horizontal bands over a partition of the range; each band is drawn over its preimage {f > t_j}.
  function drawLebesgue(fn, K) {
    const c = setup(el("cv-lebesgue")), [y0, y1] = yRange(fn);
    const { X, Y } = axes(c, fn.a, fn.b, y0, y1, "x");
    const r = I.lebesgueLevels(fn, K, 2000, true);
    // Base slab y0·L (only if the range starts above 0) and the K bands.
    const slab = (xa, xb, ya, yb, k) => {
      const hue = 25 + (k * 35) % 120;
      c.ctx.fillStyle = `hsla(${hue}, 75%, 55%, 0.35)`;
      c.ctx.fillRect(X(xa), Y(Math.min(yb, y1)), X(xb) - X(xa), Y(Math.max(ya, y0)) - Y(Math.min(yb, y1)));
    };
    if (r.y0 > 0) slab(fn.a, fn.b, 0, r.y0, 0);
    r.bands.forEach((b, j) => {
      for (const [xa, xb] of b.iv) slab(xa, xb, b.t - r.d / 2, b.t + r.d / 2, j + 1);
      c.ctx.strokeStyle = "rgba(91,100,117,0.5)"; c.ctx.lineWidth = 1; c.ctx.setLineDash([3, 3]);
      c.ctx.beginPath(); c.ctx.moveTo(X(fn.a), Y(b.t + r.d / 2)); c.ctx.lineTo(X(fn.b), Y(b.t + r.d / 2)); c.ctx.stroke();
      c.ctx.setLineDash([]);
    });
    graph(c, X, Y, fn);
  }

  // ---------- Ex. 1: convergence and efficiency ----------
  const BUDGETS = [10, 31, 100, 316, 1000, 3162, 10000];
  const METHODS = [
    ["left", "Riemann, left tags", GREY],
    ["mid", "Riemann, midpoints", ACCENT],
    ["random", "Riemann, random tags", PURPLE],
    ["leb", "Lebesgue, level sets", ORANGE],
    ["mc", "Lebesgue, Monte Carlo measure", GREEN],
  ];

  function drawEfficiency(fn, rows) {
    const c = setup(el("cv-conv"));
    const pts = [];
    for (const r of rows) for (const [k] of METHODS) {
      const e = Math.abs(r.res[k].value - fn.exact);
      if (isFinite(e)) pts.push({ k, ev: r.res[k].evals, e: Math.max(e, 1e-16) });
    }
    const evs = pts.map((p) => p.ev), es = pts.map((p) => p.e);
    const { X, Y } = axes(c, Math.min(...evs), Math.max(...evs), 10 ** Math.floor(Math.log10(Math.min(...es))), 10 ** Math.ceil(Math.log10(Math.max(...es)) + 0.01),
      "function evaluations", { logx: true, logy: true });
    for (const [k, , color] of METHODS) {
      const ps = pts.filter((p) => p.k === k);
      c.ctx.strokeStyle = color; c.ctx.fillStyle = color; c.ctx.lineWidth = 1.5;
      c.ctx.beginPath();
      ps.forEach((p, i) => (i ? c.ctx.lineTo(X(p.ev), Y(p.e)) : c.ctx.moveTo(X(p.ev), Y(p.e))));
      c.ctx.stroke();
      ps.forEach((p) => { c.ctx.beginPath(); c.ctx.arc(X(p.ev), Y(p.e), 3, 0, 2 * Math.PI); c.ctx.fill(); });
    }
    c.ctx.font = "12px sans-serif"; c.ctx.textAlign = "right";
    METHODS.forEach(([, label, color], i) => { c.ctx.fillStyle = color; c.ctx.fillText(`${label} ●`, c.w - c.pad.r - 6, c.pad.t + 14 + 15 * i); });
  }

  let conv = null; // last convergence run, kept so a resize only redraws
  function runConvergence() {
    const fn = I.getFunction(el("fn").value);
    const rows = BUDGETS.map((N) => ({ N, res: I.compare(fn, N, 7) }));
    conv = { fn, rows };
    el("tbl-conv").innerHTML = rows.map((r) =>
      `<tr><td>${r.N}</td>` + METHODS.map(([k]) => `<td>${err(r.res[k].value - fn.exact)}</td>`).join("") +
      `<td>${r.res.leb.evals.toLocaleString("en")}</td></tr>`).join("");
    const last = rows.find((r) => r.N === 1000).res;
    el("tbl-cost").innerHTML = METHODS.map(([k, label]) =>
      `<tr><td>${label}</td><td>${fmt(last[k].value, 10)}</td><td>${err(last[k].value - fn.exact)}</td>` +
      `<td>${last[k].evals.toLocaleString("en")}</td><td>${last[k].ms.toFixed(2)}</td></tr>`).join("");
    drawEfficiency(fn, rows);
  }

  function renderPictures() {
    const fn = I.getFunction(el("fn").value);
    const n = Math.min(Math.max(parseInt(el("npic").value, 10) || 8, 1), 60);
    el("fn-info").innerHTML = `<code>f(x) = ${fn.label}</code> on <code>${fn.dom}</code>; exact value of the integral: <code>${fmt(fn.exact, 12)}</code>` +
      (fn.riemann === false ? " (Lebesgue; the Riemann integral does not exist)" : fn.improper ? " (improper Riemann integral)" : "") + ".";
    drawRiemann(fn, n);
    drawLebesgue(fn, n);
  }

  function summaryTable() {
    el("tbl-summary").innerHTML = I.FUNCTIONS.map((fn) => {
      const r = I.compare(fn, 1000, 7);
      return `<tr><td><code>${fn.label}</code></td><td>${fn.dom}</td><td>${fn.riemann === false ? "does not exist" : fmt(fn.exact, 8)}</td><td>${fmt(fn.exact, 8)}</td>` +
        METHODS.map(([k]) => `<td>${fmt(r[k].value, 8)}</td>`).join("") + "</tr>";
    }).join("");
  }

  // ---------- Ex. 2: normal CDF ----------
  const NMETHODS = [
    ["Trapezoid (n)", (x, n) => Nm.cdfTrapezoid(x, n), GREY],
    ["Simpson (n)", (x, n) => Nm.cdfSimpson(x, n), PURPLE],
    ["erf power series", (x) => Nm.cdfSeries(x), RED],
    ["Abramowitz–Stegun 7.1.26", (x) => Nm.cdfAS(x), GREEN],
    ["Marsaglia series", (x) => Nm.cdfMarsaglia(x), ORANGE],
    ["Hybrid: Marsaglia + continued fraction", (x) => Nm.cdf(x), ACCENT],
  ];
  const rel = (v, r) => Math.abs(v - r) / r;
  const refAt = (x) => Nm.REFERENCE.find(([rx]) => rx === x)[1];
  let sink = 0;

  function nInt() { return Math.min(Math.max(parseInt(el("nint").value, 10) || 100, 2), 100000); }

  function runPoint() {
    const x = parseFloat(el("xval").value), n = nInt();
    if (!isFinite(x)) return;
    const ref = Nm.REFERENCE.find(([rx]) => rx === x); // [x, Φ(x)] or undefined
    const best = Nm.cdf(x);
    el("tbl-point").innerHTML = NMETHODS.map(([label, f]) => {
      const v = f(x, n);
      return `<tr><td>${label}</td><td><code>${v.toPrecision(17)}</code></td><td>${ref ? err(v - ref[1]) : err(v - best)}</td><td>${ref ? err(rel(v, ref[1])) : err(rel(v, best))}</td></tr>`;
    }).join("") + (ref ? `<tr><td><strong>Reference (mpmath, 40 digits)</strong></td><td><code>${ref[1].toPrecision(17)}</code></td><td></td><td></td></tr>` : "");
    el("point-note").textContent = ref
      ? "Errors are measured against the trusted reference value."
      : "This x is not in the reference table: errors are measured against the hybrid method (which matches the reference to ~1e-16 at every tabulated point).";
  }

  const SHOW = [-8, -6, -5, -4, -3, -1.96, -1, 0, 1, 1.96, 3, 5, 8];
  function runReference() {
    const n = nInt();
    el("tbl-ref").innerHTML = SHOW.map((x) => {
      const r = refAt(x);
      return `<tr><td>${x}</td><td><code>${r.toPrecision(17)}</code></td>` + NMETHODS.map(([, f]) => `<td>${err(rel(f(x, n), r))}</td>`).join("") + "</tr>";
    }).join("");

    // Accuracy over all tabulated points + timing over 200 000 evaluations in [−6, 6].
    const xs = new Float64Array(200000);
    for (let i = 0; i < xs.length; i++) xs[i] = -6 + 12 * ((i * 0.6180339887498949) % 1);
    el("tbl-bench").innerHTML = NMETHODS.map(([label, f]) => {
      let ma = 0, mr = 0;
      for (const [x, r] of Nm.REFERENCE) { const v = f(x, n); ma = Math.max(ma, Math.abs(v - r)); mr = Math.max(mr, rel(v, r)); }
      const t0 = performance.now();
      let s = 0;
      for (let i = 0; i < xs.length; i++) s += f(xs[i], n);
      const ns = ((performance.now() - t0) * 1e6) / xs.length;
      sink += s; // keep the loop observable so it is not optimised away
      return `<tr><td>${label}</td><td>${err(ma)}</td><td>${err(mr)}</td><td>${ns.toFixed(0)}</td></tr>`;
    }).join("");
    drawRelErr(n);
  }

  function drawRelErr(n) {
    const c = setup(el("cv-relerr"));
    const { X, Y } = axes(c, -8, 8, 1e-17, 10, "x", { logy: true });
    for (const [, f, color] of NMETHODS) {
      c.ctx.strokeStyle = color; c.ctx.fillStyle = color; c.ctx.lineWidth = 1.5; c.ctx.beginPath();
      Nm.REFERENCE.forEach(([x, r], i) => {
        const e = Math.min(10, Math.max(1e-17, rel(f(x, n), r)));
        i ? c.ctx.lineTo(X(x), Y(e)) : c.ctx.moveTo(X(x), Y(e));
      });
      c.ctx.stroke();
    }
    el("relerr-legend").innerHTML = NMETHODS.map(([label, , color]) =>
      `<span style="color:${color};white-space:nowrap">● ${label.replace(" (n)", ` (n = ${n})`)}</span>`).join("&emsp;");
  }

  function drawQuadrature() {
    const c = setup(el("cv-quad")), x = 1.96, r = refAt(x);
    const ns = [];
    for (let n = 2; n <= 4096; n *= 2) ns.push(n);
    const eT = ns.map((n) => Math.max(1e-17, Math.abs(Nm.cdfTrapezoid(x, n) - r)));
    const eS = ns.map((n) => Math.max(1e-17, Math.abs(Nm.cdfSimpson(x, n) - r)));
    const { X, Y } = axes(c, 2, 4096, 1e-17, 1, "n (subintervals)", { logx: true, logy: true });
    for (const [es, color] of [[eT, GREY], [eS, PURPLE]]) {
      c.ctx.strokeStyle = color; c.ctx.fillStyle = color; c.ctx.lineWidth = 1.5; c.ctx.beginPath();
      ns.forEach((n, i) => (i ? c.ctx.lineTo(X(n), Y(es[i])) : c.ctx.moveTo(X(n), Y(es[i]))));
      c.ctx.stroke();
      ns.forEach((n, i) => { c.ctx.beginPath(); c.ctx.arc(X(n), Y(es[i]), 3, 0, 2 * Math.PI); c.ctx.fill(); });
    }
    c.ctx.textAlign = "right"; c.ctx.font = "12px sans-serif";
    c.ctx.fillStyle = GREY; c.ctx.fillText("Trapezoid: error ∝ n⁻² ●", c.w - 16, c.pad.t + 14);
    c.ctx.fillStyle = PURPLE; c.ctx.fillText("Simpson: error ∝ n⁻⁴ ●", c.w - 16, c.pad.t + 29);
  }

  function seriesTable() {
    el("tbl-series").innerHTML = [0.5, 1, 2, 3, 4, 5, 6, 8].map((x) => {
      const s = Nm.erfSeries(x / Math.SQRT2), r = refAt(x), q = refAt(-x), cf = Nm.tailCF(x);
      return `<tr><td>${x}</td><td>${s.terms}</td><td>${fmt(s.maxTerm, 3)}</td><td>${err(Nm.cdfSeries(x) - r)}</td>` +
        `<td>${err(rel(Nm.cdfSeries(-x), q))}</td><td>${cf.iterations}</td><td>${err(rel(cf.value, q))}</td></tr>`;
    }).join("");
  }

  // ---------- wiring ----------
  el("fn").innerHTML = I.FUNCTIONS.map((fn) => `<option value="${fn.id}">${fn.label} on ${fn.dom}</option>`).join("");
  el("fn").addEventListener("change", () => { renderPictures(); runConvergence(); });
  el("npic").addEventListener("input", renderPictures);
  el("point-form").addEventListener("submit", (e) => { e.preventDefault(); runPoint(); runReference(); });
  window.addEventListener("resize", () => { renderPictures(); if (conv) drawEfficiency(conv.fn, conv.rows); drawRelErr(nInt()); drawQuadrature(); });

  renderPictures();
  runConvergence();
  summaryTable();
  runPoint();
  runReference();
  drawQuadrature();
  seriesTable();
})();
