// STATISTICAL EXPLORATION of the toy public keys Q = kG.
// Uses p, add() and show() from keygen.js (loaded first).
(function () {
  "use strict";

  const BITS = 5; // coordinates are 0..16, so 5 bits each

  // ------------------------------------------------------------ helpers

  const $ = (id) => document.getElementById(id);
  const sum = (xs) => xs.reduce((s, v) => s + v, 0);
  const mean = (xs) => sum(xs) / xs.length;
  const pct = (v) => `${(100 * v).toFixed(1)}%`;
  const ones = (n) => n.toString(2).split("1").length - 1;

  function pearson(xs, ys) {
    const mx = mean(xs);
    const my = mean(ys);
    let sxy = 0, sxx = 0, syy = 0;
    for (let i = 0; i < xs.length; i++) {
      sxy += (xs[i] - mx) * (ys[i] - my);
      sxx += (xs[i] - mx) ** 2;
      syy += (ys[i] - my) ** 2;
    }
    return sxy / Math.sqrt(sxx * syy);
  }

  // Chi-square statistic against a uniform distribution over `counts`.
  function chiSquare(counts) {
    const expected = sum(counts) / counts.length;
    return sum(counts.map((c) => (c - expected) ** 2 / expected));
  }

  // 95% critical value of chi-square (Wilson–Hilferty approximation).
  function chiCritical(df) {
    const h = 2 / (9 * df);
    return df * (1 - h + 1.645 * Math.sqrt(h)) ** 3;
  }

  function curvePoints() {
    const points = [];
    for (let x = 0; x < p; x++) {
      for (let y = 0; y < p; y++) {
        if ((y * y - (x ** 3 + 7)) % p === 0) points.push({ x, y });
      }
    }
    return points;
  }

  // [O, G, 2G, ..., (n-1)G]: kG is then cycle[k % n].
  function cycleOf(G) {
    const cycle = [null];
    for (let Q = G; Q !== null; Q = add(Q, G)) cycle.push(Q);
    return cycle;
  }

  const encode = (Q) => (Q.x << BITS) | Q.y; // 10-bit string x || y

  // ------------------------------------------------------------ experiment

  function runExperiment(kMax, bases) {
    const results = []; // {G, n, k, Q}
    const cycles = bases.map((G) => ({ G, cycle: cycleOf(G) }));
    for (const { G, cycle } of cycles) {
      const n = cycle.length;
      for (let k = 1; k <= kMax; k++) results.push({ G, n, k, Q: cycle[k % n] });
    }
    return { results, cycles };
  }

  function analyse(kMax, bases) {
    const { results, cycles } = runExperiment(kMax, bases);
    const points = results.filter((r) => r.Q !== null);

    // Distribution of coordinates and frequency of individual points.
    const xCounts = new Array(p).fill(0);
    const yCounts = new Array(p).fill(0);
    const pointCounts = new Map();
    for (const { Q } of points) {
      xCounts[Q.x]++;
      yCounts[Q.y]++;
      const key = show(Q);
      pointCounts.set(key, (pointCounts.get(key) || 0) + 1);
    }

    // Distribution of bits: share of 1s at each bit position.
    const bitShare = (coord) =>
      Array.from({ length: BITS }, (_, b) => mean(points.map(({ Q }) => (Q[coord] >> b) & 1)));

    // Correlation between input k and output coordinates.
    const ks = points.map((r) => r.k);
    const corr = {
      x: pearson(ks, points.map((r) => r.Q.x)),
      y: pearson(ks, points.map((r) => r.Q.y)),
    };

    // Structure checks over every base point and every k in 1..n-1.
    let mirrorHolds = 0, mirrorTotal = 0, linearHolds = 0, linearTotal = 0;
    for (const { cycle } of cycles) {
      const n = cycle.length;
      for (let k = 1; k < n; k++) {
        const A = cycle[k], B = cycle[n - k]; // kG and (n-k)G = -kG
        mirrorTotal++;
        if (A.x === B.x && (A.y + B.y) % p === 0) mirrorHolds++;
        for (let j = 1; j < n; j++) { // (k + j)G = kG + jG
          linearTotal++;
          const lhs = cycle[(k + j) % n], rhs = add(cycle[k], cycle[j]);
          if (show(lhs) === show(rhs)) linearHolds++;
        }
      }
    }

    // Avalanche: flip one bit of k, count how many of the 10 output bits change.
    const kBits = kMax.toString(2).length;
    const flips = [];
    const perBit = Array.from({ length: kBits }, () => []);
    for (const { cycle } of cycles) {
      const n = cycle.length;
      for (let k = 1; k <= kMax; k++) {
        for (let b = 0; b < kBits; b++) {
          const k2 = k ^ (1 << b);
          const A = cycle[k % n], B = cycle[k2 % n];
          if (k2 === 0 || A === null || B === null) continue;
          const changed = ones(encode(A) ^ encode(B)) / (2 * BITS);
          flips.push(changed);
          perBit[b].push(changed);
        }
      }
    }

    return {
      total: results.length,
      infinity: results.length - points.length,
      xCounts,
      yCounts,
      pointCounts,
      bitShare: { x: bitShare("x"), y: bitShare("y") },
      corr,
      mirror: mirrorHolds / mirrorTotal,
      linear: linearHolds / linearTotal,
      avalanche: { mean: mean(flips), perBit: perBit.map(mean), pairs: flips.length },
      orders: cycles.map(({ G, cycle }) => `${show(G)}: n = ${cycle.length}`),
    };
  }

  // SHA-256 avalanche for comparison: hash k (4 bytes) and k with one bit flipped.
  async function shaAvalanche(kMax) {
    if (!(window.crypto && crypto.subtle)) return null;
    const hash = async (k) => {
      const buf = new ArrayBuffer(4);
      new DataView(buf).setUint32(0, k);
      return new Uint8Array(await crypto.subtle.digest("SHA-256", buf));
    };
    const kBits = kMax.toString(2).length;
    const flips = [];
    for (let k = 1; k <= Math.min(kMax, 200); k++) {
      const h1 = await hash(k);
      for (let b = 0; b < kBits; b++) {
        const h2 = await hash(k ^ (1 << b));
        flips.push(sum(h1.map((byte, i) => ones(byte ^ h2[i]))) / 256);
      }
    }
    return mean(flips);
  }

  // ------------------------------------------------------------ rendering

  function columnChart(el, counts, label) {
    const max = Math.max(...counts, 1);
    const total = sum(counts);
    el.innerHTML = "";
    counts.forEach((c, v) => {
      const col = document.createElement("div");
      col.className = "col";
      col.dataset.tip = `${label} = ${v}: ${c} (${pct(c / total)})`;
      col.innerHTML = `<div class="bar" style="height:${(100 * c) / max}%"></div><span>${v}</span>`;
      if (c === 0) col.classList.add("empty");
      el.appendChild(col);
    });
    const used = counts.filter((c) => c > 0).length;
    return { used, chi: chiSquare(counts), df: counts.length - 1 };
  }

  function shareBar(v) {
    return `<span class="share"><span style="width:${100 * v}%"></span></span> ${pct(v)}`;
  }

  async function render() {
    const kMax = Math.min(Math.max(Number($("st-kmax").value) || 1, 2), 1000);
    const allBases = $("st-all").checked;
    const bases = allBases ? curvePoints().filter((P) => P.y !== 0) : [{ x: 1, y: 5 }];
    const r = analyse(kMax, bases);

    $("st-summary").textContent =
      `${r.total} experiments: k = 1…${kMax} for ${bases.length} base point${bases.length > 1 ? "s" : ""}. ` +
      `${r.infinity} results were O (k a multiple of the order of G) and are left out below.`;
    $("st-orders").textContent = r.orders.join("   ·   ");

    const xs = columnChart($("st-x"), r.xCounts, "x");
    const ys = columnChart($("st-y"), r.yCounts, "y");
    const pointCounts = [...r.pointCounts.values()];
    const uniformRow = (name, s) =>
      `<tr><td>${name}</td><td>${s.used} of ${s.df + 1}</td><td>${s.chi.toFixed(1)}</td>` +
      `<td>${chiCritical(s.df).toFixed(1)}</td><td>${s.chi > chiCritical(s.df) ? "<b>not uniform</b>" : "looks uniform"}</td></tr>`;
    const pointsStat = { used: pointCounts.length, df: pointCounts.length - 1, chi: chiSquare(pointCounts) };
    $("st-uniform").innerHTML =
      uniformRow("x over 0…16", xs) + uniformRow("y over 0…16", ys) +
      (pointsStat.df > 0 ? uniformRow("points that occur", pointsStat) : "");

    $("st-points").innerHTML = [...r.pointCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([pt, c]) => `<tr><td>${pt}</td><td>${c}</td><td>${pct(c / (r.total - r.infinity))}</td></tr>`)
      .join("");

    $("st-bits").innerHTML = r.bitShare.x
      .map((_, b) => `<tr><td>bit ${b} (value ${1 << b})</td><td>${shareBar(r.bitShare.x[b])}</td><td>${shareBar(r.bitShare.y[b])}</td></tr>`)
      .join("");

    $("st-corr").innerHTML = `
      <tr><td>Pearson correlation r(k, x)</td><td>${r.corr.x.toFixed(3)}</td></tr>
      <tr><td>Pearson correlation r(k, y)</td><td>${r.corr.y.toFixed(3)}</td></tr>
      <tr><td>kG and (n − k)G have the same x and opposite y</td><td>${pct(r.mirror)} of cases</td></tr>
      <tr><td>(k + j)G = kG + jG for all k, j</td><td>${pct(r.linear)} of cases</td></tr>`;

    $("st-aval").innerHTML =
      r.avalanche.perBit
        .map((v, b) => `<tr><td>flip bit ${b} of k</td><td>${Number.isNaN(v) ? "—" : shareBar(v)}</td></tr>`)
        .join("") +
      `<tr class="total"><td>toy curve, average over ${r.avalanche.pairs} pairs</td><td>${shareBar(r.avalanche.mean)}</td></tr>` +
      `<tr class="total"><td>SHA-256 of k, for comparison</td><td id="st-sha">computing…</td></tr>`;

    const sha = await shaAvalanche(kMax);
    $("st-sha").innerHTML = sha === null ? "not available (needs https or localhost)" : shareBar(sha);
  }

  $("st-form").addEventListener("submit", (event) => {
    event.preventDefault();
    render();
  });
  render();
})();
