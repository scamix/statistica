// UI for Lab 5: Welford trace (Ex. 1) and the sampling-distribution experiment (Ex. 2).
(function () {
  const el = (id) => document.getElementById(id);
  const { trace, distribution, moments, simulate, summarise, varMean, varS2, CHECKPOINTS } = Lab5;
  const MUTED = "#5b6475", GRID = "#e2e6ee", RED = "#d9482b", ACCENT = "#2b5fd9", ORANGE = "#d98a2b";
  const fmt = (x, d = 4) => (!isFinite(x) ? "—" : Math.abs(x) >= 1e6 ? x.toExponential(3) : Number(x.toPrecision(d)).toString());
  const full = (x) => (!isFinite(x) ? "—" : String(x));

  // ---------- Ex. 1: step-by-step Welford ----------
  function runTrace() {
    const xs = el("xs").value.split(/[\s,;]+/).filter(Boolean).map(Number).filter(isFinite);
    const off = Number(el("offset").value) || 0;
    if (xs.length < 2) { el("trace-out").innerHTML = "<tr><td colspan=5>Enter at least two numbers.</td></tr>"; return; }
    const t = trace(xs.map((x) => x + off));
    el("trace-out").innerHTML = t.steps.map((s) =>
      `<tr><td>${s.k}</td><td>${full(s.x)}</td><td>${fmt(s.mean, 12)}</td><td>${fmt(s.ss, 12)}</td><td>${fmt(s.s2, 12)}</td></tr>`).join("");
    el("cmp-out").innerHTML =
      `<tr><td>Two-pass <code>Σ(x−x̄)²/(n−1)</code></td><td>${full(t.twoPass)}</td></tr>` +
      `<tr><td>Welford (one pass)</td><td>${full(t.welford)}</td></tr>` +
      `<tr><td>Naive one pass <code>(Σx² − (Σx)²/n)/(n−1)</code></td><td>${full(t.naive)}</td></tr>`;
  }

  // ---------- canvas helpers (same style as Lab 4) ----------
  function setup(canvas) {
    const dpr = window.devicePixelRatio || 1, w = canvas.clientWidth, h = canvas.clientHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.font = "11px sans-serif";
    return { ctx, w, h, pad: { l: 50, r: 10, t: 10, b: 24 } };
  }

  // Linear or log10 axes; tick labels are shown in data units.
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
      ctx.fillText(fmt(y, 3), pad.l - 4, Y(y) + 4);
    }
    ctx.textAlign = "center";
    for (let i = 0; i <= 4; i++) {
      const a = a0 + ((a1 - a0) * i) / 4, x = logx ? 10 ** a : a;
      ctx.fillText(fmt(x, 3), X(x), h - pad.b + 14);
    }
    if (xlabel) { ctx.textAlign = "right"; ctx.fillText(xlabel, w - pad.r, h - 2); }
    return { X, Y };
  }

  function vline(c, X, Y, x, y0, y1, color, dash = [5, 4]) {
    c.ctx.strokeStyle = color; c.ctx.lineWidth = 2; c.ctx.setLineDash(dash);
    c.ctx.beginPath(); c.ctx.moveTo(X(x), Y(y0)); c.ctx.lineTo(X(x), Y(y1)); c.ctx.stroke();
    c.ctx.setLineDash([]);
  }

  // Running statistic of a few hackers, with a reference level and optional ±2 sd band.
  function drawRunning(canvas, paths, key, n, level, band, xlabel) {
    const c = setup(canvas), k0 = key === "s2" ? 2 : 1;
    let lo = Infinity, hi = -Infinity;
    for (const p of paths) for (let k = k0; k <= n; k++) { lo = Math.min(lo, p[key][k]); hi = Math.max(hi, p[key][k]); }
    lo = Math.min(lo, level); hi = Math.max(hi, level);
    const { X, Y } = axes(c, k0, n, lo, hi, xlabel, { logx: true });
    paths.forEach((p, i) => {
      c.ctx.strokeStyle = `hsla(${(i * 47 + 215) % 360}, 65%, 45%, 0.8)`; c.ctx.lineWidth = 1.2;
      c.ctx.beginPath();
      for (let k = k0; k <= n; k++) (k === k0 ? c.ctx.moveTo(X(k), Y(p[key][k])) : c.ctx.lineTo(X(k), Y(p[key][k])));
      c.ctx.stroke();
    });
    c.ctx.strokeStyle = RED; c.ctx.lineWidth = 1.5;
    c.ctx.beginPath(); c.ctx.moveTo(X(k0), Y(level)); c.ctx.lineTo(X(n), Y(level)); c.ctx.stroke();
    if (band) {
      c.ctx.setLineDash([5, 4]);
      for (const sgn of [-1, 1]) {
        c.ctx.beginPath();
        for (let k = k0; k <= n; k++) {
          const y = Y(Math.min(hi, Math.max(lo, level + sgn * band(k))));
          k === k0 ? c.ctx.moveTo(X(k), y) : c.ctx.lineTo(X(k), y);
        }
        c.ctx.stroke();
      }
      c.ctx.setLineDash([]);
    }
  }

  // Density histogram; red dashed line at the true parameter, orange solid at the average of the m estimates.
  function drawHist(canvas, values, truth, avg, xlabel, normal) {
    const c = setup(canvas), m = values.length;
    let lo = Infinity, hi = -Infinity;
    for (const v of values) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
    if (hi - lo < 1e-12) { lo -= 0.5; hi += 0.5; }
    const nb = 40, wbin = (hi - lo) / nb, counts = new Array(nb).fill(0);
    for (const v of values) counts[Math.min(nb - 1, Math.floor((v - lo) / wbin))]++;
    const dens = counts.map((k) => k / (m * wbin));
    const pdf = normal ? (x) => Math.exp(-((x - normal.mean) ** 2) / (2 * normal.sd ** 2)) / (normal.sd * Math.sqrt(2 * Math.PI)) : null;
    const top = Math.max(...dens, pdf ? pdf(normal.mean) : 0) * 1.08;
    const { X, Y } = axes(c, Math.min(lo, truth), Math.max(hi, truth), 0, top, xlabel);
    c.ctx.fillStyle = "rgba(43,95,217,0.55)";
    dens.forEach((d, i) => c.ctx.fillRect(X(lo + i * wbin), Y(d), Math.max(1, X(lo + (i + 1) * wbin) - X(lo + i * wbin) - 1), Y(0) - Y(d)));
    if (pdf) {
      c.ctx.strokeStyle = MUTED; c.ctx.lineWidth = 1.5; c.ctx.beginPath();
      for (let i = 0; i <= 200; i++) {
        const x = lo + ((hi - lo) * i) / 200;
        i ? c.ctx.lineTo(X(x), Y(pdf(x))) : c.ctx.moveTo(X(x), Y(pdf(x)));
      }
      c.ctx.stroke();
    }
    vline(c, X, Y, truth, 0, top, RED);
    vline(c, X, Y, avg, 0, top, ORANGE, []);
  }

  // Log-log: empirical SD of x̄ and s² across hackers vs n, with the exact curves.
  function drawSd(canvas, sim, rows) {
    const c = setup(canvas), ns = rows.map((r) => r.n);
    const sdM = rows.map((r) => Math.sqrt(r.varMean)), sdV = rows.map((r) => Math.sqrt(r.varS2));
    const nn = [];
    for (let n = ns[0]; n <= ns[ns.length - 1]; n *= 1.05) nn.push(n);
    const thM = nn.map((n) => Math.sqrt(varMean(sim.mom, n))), thV = nn.map((n) => Math.sqrt(varS2(sim.mom, n)));
    const all = [...sdM, ...sdV, ...thM, ...thV].filter((v) => v > 0);
    const { X, Y } = axes(c, ns[0], ns[ns.length - 1], Math.min(...all) / 1.3, Math.max(...all) * 1.3, "n (systems per hacker)", { logx: true, logy: true });
    for (const [th, emp, color] of [[thM, sdM, ACCENT], [thV, sdV, ORANGE]]) {
      c.ctx.strokeStyle = color; c.ctx.lineWidth = 1.5; c.ctx.beginPath();
      nn.forEach((n, i) => (i ? c.ctx.lineTo(X(n), Y(th[i])) : c.ctx.moveTo(X(n), Y(th[i]))));
      c.ctx.stroke();
      c.ctx.fillStyle = color;
      emp.forEach((v, i) => { c.ctx.beginPath(); c.ctx.arc(X(ns[i]), Y(v), 4, 0, 2 * Math.PI); c.ctx.fill(); });
    }
    c.ctx.textAlign = "left"; c.ctx.font = "12px sans-serif";
    c.ctx.fillStyle = ACCENT; c.ctx.fillText("● SD(x̄)  — σ/√n", c.w - 170, 22);
    c.ctx.fillStyle = ORANGE; c.ctx.fillText("● SD(s²)  — exact", c.w - 170, 38);
  }

  // ---------- Ex. 2 ----------
  let sim = null;

  function updateTheory() {
    const name = el("dist").value, p = Math.min(Math.max(parseFloat(el("p").value) || 0.3, 0.01), 0.99);
    el("p-wrap").style.display = name === "uniform" ? "none" : "";
    const d = distribution(name, p), mom = moments(d);
    el("theory").innerHTML = `${d.label}: <code>μ = ${fmt(mom.mu)}</code>, <code>σ² = ${fmt(mom.s2)}</code>, <code>μ₄ = ${fmt(mom.mu4)}</code>`;
    return { d, p };
  }

  function run() {
    const { d } = updateTheory();
    const m = Math.min(Math.max(parseInt(el("m").value, 10) || 2000, 50), 10000);
    const seed = parseInt(el("seed").value, 10) || 1;
    sim = simulate(d, m, seed);
    render();
  }

  function render() {
    if (!sim) return;
    const { mu, s2 } = sim.mom, m = sim.m, ci = Number(el("n").value), n = sim.checkpoints[ci];
    const rows = sim.checkpoints.map((_, c) => summarise(sim, c));
    el("tbl-avg").innerHTML = rows.map((r) =>
      `<tr><td>${r.n}</td><td>${fmt(r.avgMean)}</td><td>${fmt(mu)}</td><td>${fmt(r.zMean, 2)}</td>` +
      `<td>${fmt(r.avgS2)}</td><td>${fmt(s2)}</td><td>${fmt(r.zS2, 2)}</td>` +
      `<td>${fmt(r.avgPop)} / ${fmt(r.theoryPop)}</td></tr>`).join("");
    el("tbl-var").innerHTML = rows.map((r) =>
      `<tr><td>${r.n}</td><td>${fmt(r.varMean)} / ${fmt(r.theoryVarMean)}</td><td>${fmt(Math.sqrt(r.varMean))}</td>` +
      `<td>${fmt(r.varS2)} / ${fmt(r.theoryVarS2)}</td><td>${fmt(Math.sqrt(r.varS2))}</td></tr>`).join("");

    const r = rows[ci];
    drawHist(el("cv-mean"), sim.means[ci], mu, r.avgMean, "x̄", { mean: mu, sd: Math.sqrt(varMean(sim.mom, n)) });
    drawHist(el("cv-var"), sim.vars[ci], s2, r.avgS2, "s²", null);
    drawRunning(el("cv-run-mean"), sim.paths, "mean", 1000, mu, (k) => 2 * Math.sqrt(s2 / k), "k (log scale)");
    drawRunning(el("cv-run-var"), sim.paths, "s2", 1000, s2, null, "k (log scale)");
    drawSd(el("cv-sd"), sim, rows);
    el("plot-note").textContent =
      `${sim.dist.label}, n = ${n}, m = ${m}. Red dashed = true parameter (μ or σ²); orange = average of the m estimates; ` +
      `grey curve = N(μ, σ²/n).`;
  }

  el("n").innerHTML = CHECKPOINTS.map((n, i) => `<option value="${i}"${n === 10 ? " selected" : ""}>n = ${n}</option>`).join("");
  el("trace-form").addEventListener("submit", (e) => { e.preventDefault(); runTrace(); });
  el("sim-form").addEventListener("submit", (e) => { e.preventDefault(); run(); });
  el("dist").addEventListener("change", updateTheory);
  el("p").addEventListener("input", updateTheory);
  el("n").addEventListener("change", render);
  window.addEventListener("resize", render);
  runTrace();
  run();
})();
