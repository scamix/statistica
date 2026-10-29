// UI for Lab 4: runs the simulation, fills the summary table and draws trajectories and histograms.
(function () {
  const el = (id) => document.getElementById(id);
  const { simulate, summarise, Phi, CHECKPOINTS } = Lab4;
  const ACCENT = "#2b5fd9", MUTED = "#5b6475", GRID = "#e2e6ee", RED = "#d9482b";
  const fmt = (x, d = 3) => (Math.abs(x) >= 1000 ? x.toFixed(0) : Number(x.toPrecision(d)).toString());

  function setup(canvas) {
    const dpr = window.devicePixelRatio || 1, w = canvas.clientWidth, h = canvas.clientHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.font = "11px sans-serif";
    return { ctx, w, h, pad: { l: 46, r: 10, t: 10, b: 24 } };
  }

  function axes({ ctx, w, h, pad }, x0, x1, y0, y1, xlabel) {
    const X = (x) => pad.l + ((x - x0) / (x1 - x0)) * (w - pad.l - pad.r);
    const Y = (y) => h - pad.b - ((y - y0) / (y1 - y0)) * (h - pad.t - pad.b);
    ctx.strokeStyle = GRID; ctx.fillStyle = MUTED; ctx.lineWidth = 1;
    ctx.textAlign = "right";
    for (let i = 0; i <= 4; i++) {
      const y = y0 + ((y1 - y0) * i) / 4;
      ctx.beginPath(); ctx.moveTo(pad.l, Y(y)); ctx.lineTo(w - pad.r, Y(y)); ctx.stroke();
      ctx.fillText(fmt(y, 3), pad.l - 4, Y(y) + 4);
    }
    ctx.textAlign = "center";
    for (let i = 0; i <= 4; i++) {
      const x = x0 + ((x1 - x0) * i) / 4;
      ctx.fillText(fmt(x, 3), X(x), h - pad.b + 14);
    }
    if (xlabel) { ctx.textAlign = "right"; ctx.fillText(xlabel, w - pad.r, h - 2); }
    return { X, Y };
  }

  // Trajectories S_k of the first few attackers with the +-2 sd envelope around the mean n*mu.
  function drawPaths(canvas, sim, n) {
    const c = setup(canvas), { mu, var: s2 } = sim.mod;
    const band = (k) => 2 * Math.sqrt(k * s2);
    let lo = Infinity, hi = -Infinity;
    for (const p of sim.paths) for (let k = 0; k <= n; k++) { lo = Math.min(lo, p[k]); hi = Math.max(hi, p[k]); }
    lo = Math.min(lo, mu * n - band(n)); hi = Math.max(hi, mu * n + band(n));
    const { X, Y } = axes(c, 0, n, lo, hi, "step k (system)");
    const step = Math.max(1, Math.floor(n / 600));
    c.ctx.lineWidth = 1.2;
    sim.paths.forEach((p, i) => {
      c.ctx.strokeStyle = `hsla(${(i * 47 + 215) % 360}, 65%, 45%, 0.8)`;
      c.ctx.beginPath();
      for (let k = 0; k <= n; k += step) (k ? c.ctx.lineTo(X(k), Y(p[k])) : c.ctx.moveTo(X(0), Y(p[0])));
      c.ctx.stroke();
    });
    c.ctx.strokeStyle = RED; c.ctx.setLineDash([5, 4]); c.ctx.lineWidth = 1.5;
    for (const sign of [-1, 1]) {
      c.ctx.beginPath();
      for (let k = 0; k <= n; k += step) {
        const y = Y(mu * k + sign * band(k));
        k ? c.ctx.lineTo(X(k), y) : c.ctx.moveTo(X(0), y);
      }
      c.ctx.stroke();
    }
    c.ctx.setLineDash([]);
  }

  // Histogram (as density) of `values`, with the normal density of mean/sd overlaid.
  function drawHist(canvas, values, mean, sd, xlabel) {
    const c = setup(canvas), m = values.length;
    const distinct = [...new Set(values)].sort((a, b) => a - b);
    let lo, hi, nb;
    if (distinct.length <= 40) {
      const gap = distinct.length > 1 ? Math.min(...distinct.slice(1).map((v, i) => v - distinct[i])) : 1;
      lo = distinct[0] - gap / 2; hi = distinct[distinct.length - 1] + gap / 2; nb = Math.round((hi - lo) / gap);
    } else {
      lo = distinct[0]; hi = distinct[distinct.length - 1]; nb = 40;
    }
    const wbin = (hi - lo) / nb, counts = new Array(nb).fill(0);
    for (const v of values) counts[Math.min(nb - 1, Math.floor((v - lo) / wbin))]++;
    const dens = counts.map((k) => k / (m * wbin));
    const xlo = Math.min(lo, mean - 3.5 * sd), xhi = Math.max(hi, mean + 3.5 * sd);
    const pdf = (x) => Math.exp(-((x - mean) ** 2) / (2 * sd * sd)) / (sd * Math.sqrt(2 * Math.PI));
    const { X, Y } = axes(c, xlo, xhi, 0, Math.max(...dens, pdf(mean)) * 1.08, xlabel);
    c.ctx.fillStyle = "rgba(43,95,217,0.55)";
    dens.forEach((d, i) => c.ctx.fillRect(X(lo + i * wbin), Y(d), Math.max(1, X(lo + (i + 1) * wbin) - X(lo + i * wbin) - 1), Y(0) - Y(d)));
    c.ctx.strokeStyle = RED; c.ctx.lineWidth = 2; c.ctx.beginPath();
    for (let i = 0; i <= 200; i++) {
      const x = xlo + ((xhi - xlo) * i) / 200;
      i ? c.ctx.lineTo(X(x), Y(pdf(x))) : c.ctx.moveTo(X(x), Y(pdf(x)));
    }
    c.ctx.stroke();
  }

  let sims = null;

  function run() {
    const m = Math.min(Math.max(parseInt(el("m").value, 10) || 1000, 100), 10000);
    const p = Math.min(Math.max(parseFloat(el("p").value) || 0.3, 0.01), 0.99);
    const seed = parseInt(el("seed").value, 10) || 1;
    sims = { rademacher: simulate("rademacher", 0.5, m, seed), bernoulli: simulate("bernoulli", p, m, seed + 1) };
    render();
  }

  function render() {
    if (!sims) return;
    const eps = Math.max(parseFloat(el("eps").value) || 0.1, 0.01);
    const name = el("model").value, ci = Number(el("n").value);
    const sim = sims[name], n = sim.checkpoints[ci], { mu, var: s2 } = sim.mod;
    const m = sim.m;

    const rows = (nm) => sims[nm].checkpoints.map((_, c) => summarise(sims[nm], c, eps));
    el("tbl-var").innerHTML = ["rademacher", "bernoulli"].map((nm) =>
      rows(nm).map((r) => `<tr><td>${nm === "rademacher" ? "Rademacher" : "Bernoulli p=" + sims.bernoulli.mod.mu}</td><td>${r.n}</td>` +
        `<td>${fmt(r.varS)} / ${fmt(r.theoryVarS)}</td><td>${fmt(r.varAvg)} / ${fmt(r.theoryVarAvg)}</td>` +
        `<td>${fmt(r.varNorm)} / ${fmt(r.theoryVarNorm)}</td></tr>`).join("")).join("");
    el("tbl-lln").innerHTML = ["rademacher", "bernoulli"].map((nm) =>
      rows(nm).map((r) => `<tr><td>${nm === "rademacher" ? "Rademacher" : "Bernoulli p=" + sims.bernoulli.mod.mu}</td><td>${r.n}</td>` +
        `<td>${fmt(r.meanAvg)}</td><td>${fmt(r.exceed)}</td><td>${fmt(r.chebyshev)}</td></tr>`).join("")).join("");
    el("tbl-clt").innerHTML = ["rademacher", "bernoulli"].map((nm) =>
      rows(nm).map((r) => `<tr><td>${nm === "rademacher" ? "Rademacher" : "Bernoulli p=" + sims.bernoulli.mod.mu}</td><td>${r.n}</td>` +
        `<td>${fmt(r.meanNorm)}</td><td>${fmt(r.ks)}</td></tr>`).join("")).join("");
    el("ks-crit").textContent = (1.36 / Math.sqrt(m)).toFixed(3);
    el("eps-lbl").textContent = eps;

    drawPaths(el("cv-paths"), sim, n);
    const S = sim.S[ci];
    drawHist(el("cv-sum"), S, n * mu, Math.sqrt(n * s2), "S_n");
    drawHist(el("cv-avg"), S.map((s) => s / n), mu, Math.sqrt(s2 / n), "S_n / n");
    drawHist(el("cv-norm"), S.map((s) => s / Math.sqrt(n)), Math.sqrt(n) * mu, Math.sqrt(s2), "S_n / √n");
    drawHist(el("cv-std"), S.map((s) => (s - n * mu) / Math.sqrt(n * s2)), 0, 1, "(S_n − nμ) / (σ√n)");
    el("plot-note").textContent =
      `${name === "rademacher" ? "Rademacher" : "Bernoulli p=" + mu}, n = ${n} systems, m = ${m} attackers. ` +
      `Red curves: dashed = μk ± 2σ√k envelope; solid = normal density with the theoretical mean and variance.`;
  }

  el("n").innerHTML = CHECKPOINTS.map((n, i) => `<option value="${i}"${i === 2 ? " selected" : ""}>n = ${n}</option>`).join("");
  el("sim-form").addEventListener("submit", (e) => { e.preventDefault(); run(); });
  for (const id of ["model", "n", "eps"]) el(id).addEventListener("change", render);
  window.addEventListener("resize", render);
  run();
})();
