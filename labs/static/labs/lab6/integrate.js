// Lab 6, Ex. 1: Riemann (partition the domain) vs Lebesgue (partition the range) numerical integration.
//
// Every sample point carries a tag q: q > 0 means the point is the rational p/q in lowest terms,
// q = 0 means a "generic" real number (irrational with probability 1). A double is always a dyadic
// rational, so the Dirichlet and Thomae functions cannot be evaluated on raw doubles; the tag records
// what the point *is* mathematically. Ordinary functions simply ignore it.
(function (root) {
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const gcd = (a, b) => { while (b) [a, b] = [b, a % b]; return a; };

  // exact: value of the integral (Lebesgue; equal to the Riemann one when that exists).
  // riemann: false when the function is not Riemann integrable (not even as an improper integral).
  const FUNCTIONS = [
    { id: "sin", label: "sin(x)", dom: "[0, π]", a: 0, b: Math.PI, exact: 2, f: (x) => Math.sin(x) },
    { id: "sq", label: "x²", dom: "[0, 1]", a: 0, b: 1, exact: 1 / 3, f: (x) => x * x },
    { id: "step13", label: "1 if x < 0.5, 3 if x ≥ 0.5", dom: "[0, 1]", a: 0, b: 1, exact: 2, f: (x) => (x < 0.5 ? 1 : 3) },
    { id: "abs", label: "|x − 0.5|", dom: "[0, 1]", a: 0, b: 1, exact: 0.25, f: (x) => Math.abs(x - 0.5) },
    { id: "invsqrt", label: "1/√x", dom: "(0, 1]", a: 0, b: 1, exact: 2, improper: true, f: (x) => (x > 0 ? 1 / Math.sqrt(x) : Infinity) },
    { id: "step10", label: "1 if x < 0.5, 0 if x ≥ 0.5", dom: "[0, 1]", a: 0, b: 1, exact: 0.5, f: (x) => (x < 0.5 ? 1 : 0) },
    { id: "sinc", label: "sin(x)/x", dom: "[0, π]", a: 0, b: Math.PI, exact: 1.8519370519824662, f: (x) => (x === 0 ? 1 : Math.sin(x) / x) },
    { id: "sin1x", label: "sin(1/x)", dom: "(0, 1]", a: 0, b: 1, exact: 0.50406706190692837, f: (x) => (x > 0 ? Math.sin(1 / x) : 0) },
    { id: "dirichlet", label: "Dirichlet: 1 on ℚ, 0 elsewhere", dom: "[0, 1]", a: 0, b: 1, exact: 0, riemann: false, pathological: true, f: (x, q) => (q > 0 ? 1 : 0) },
    { id: "thomae", label: "Thomae: 1/q at p/q, 0 elsewhere", dom: "[0, 1]", a: 0, b: 1, exact: 0, pathological: true, f: (x, q) => (q > 0 ? 1 / q : 0) },
  ];
  const getFunction = (id) => FUNCTIONS.find((fn) => fn.id === id);

  // Point a + (b − a)·num/den. On [0, 1] it is the rational num/den, so it gets the tag den/gcd.
  function point(fn, num, den) {
    const x = fn.a + ((fn.b - fn.a) * num) / den;
    const q = fn.a === 0 && fn.b === 1 ? den / gcd(num, den) : 0;
    return { x, q };
  }

  // ---------- Riemann: partition the DOMAIN into n subintervals, one tag per subinterval ----------
  // rule: "left" (x_i), "mid" (x_i + h/2) or "random" (x_i + U·h, a generic real).
  function riemann(fn, n, rule = "mid", seed = 1) {
    const h = (fn.b - fn.a) / n, rand = mulberry32(seed);
    let s = 0;
    for (let i = 0; i < n; i++) {
      let p;
      if (rule === "left") p = point(fn, i, n);
      else if (rule === "mid") p = point(fn, 2 * i + 1, 2 * n);
      else p = { x: fn.a + (i + rand()) * h, q: 0 };
      s += fn.f(p.x, p.q);
    }
    return { value: s * h, evals: n };
  }

  // ---------- Lebesgue: partition the RANGE into K bands, measure the preimages ----------
  // Layer-cake form of the Lebesgue integral:  ∫ f dμ = y0·μ(E) + ∫_{y0}^{y1} μ{x : f(x) > t} dt,
  // approximated by  y0·L + Δ·Σ_j μ{f > t_j}  with t_j the centres of K equal bands of width Δ.
  // Equivalently Σ_j t_j·μ{t_j − Δ/2 < f ≤ t_j + Δ/2}: value of the band × measure of its preimage.
  function levels(y0, y1, K) {
    const d = (y1 - y0) / K, t = [];
    for (let j = 0; j < K; j++) t.push(y0 + (j + 0.5) * d);
    return { d, t };
  }

  // (L1) Deterministic: tabulate f on a grid of G cells, then find the set {f > t} exactly by locating
  // the crossings f = t with bisection. Returns the measure and (optionally) the intervals.
  function superLevel(fn, xs, vs, t, wantIntervals, counter) {
    let mu = 0;
    const iv = wantIntervals ? [] : null;
    let open = null;
    const cross = (xa, va, xb) => {
      // f(xa) = va on one side of t; bisect to the crossing.
      let lo = xa, hi = xb;
      const above = va > t;
      for (let it = 0; it < 60 && hi - lo > 1e-14 * (1 + Math.abs(lo)); it++) {
        const m = 0.5 * (lo + hi);
        counter.n++;
        if ((fn.f(m, 0) > t) === above) lo = m; else hi = m;
      }
      return 0.5 * (lo + hi);
    };
    for (let i = 0; i < xs.length - 1; i++) {
      const xa = xs[i], xb = xs[i + 1], a = vs[i] > t, b = vs[i + 1] > t;
      if (a && b) { mu += xb - xa; if (iv && open === null) open = xa; continue; }
      if (!a && !b) continue;
      const c = cross(xa, vs[i], xb);
      if (a) { mu += c - xa; if (iv) { iv.push([open === null ? xa : open, c]); open = null; } }
      else { mu += xb - c; if (iv) open = c; }
    }
    if (iv && open !== null) iv.push([open, xs[xs.length - 1]]);
    return { mu, iv };
  }

  function grid(fn, G) {
    const xs = new Float64Array(G + 1), vs = new Float64Array(G + 1);
    for (let i = 0; i <= G; i++) {
      const p = point(fn, i, G);
      xs[i] = p.x; vs[i] = fn.f(p.x, p.q);
    }
    return { xs, vs };
  }

  // Range of the finite values. An unbounded f (1/√x) is truncated at the largest finite sample.
  function range(vs) {
    let y0 = Infinity, y1 = -Infinity;
    for (const v of vs) if (isFinite(v)) { y0 = Math.min(y0, v); y1 = Math.max(y1, v); }
    return { y0, y1 };
  }

  function lebesgueLevels(fn, K, G = K, wantIntervals = false) {
    const { xs, vs } = grid(fn, G), L = fn.b - fn.a;
    const counter = { n: G + 1 };
    const { y0, y1 } = range(vs);
    const { d, t } = levels(y0, y1, K);
    let s = y0 * L;
    const bands = [];
    for (const tj of t) {
      const r = superLevel(fn, xs, vs, tj, wantIntervals, counter);
      s += d * r.mu;
      if (wantIntervals) bands.push({ t: tj, mu: r.mu, iv: r.iv });
    }
    return { value: s, evals: counter.n, y0, y1, d, bands };
  }

  // (L2) Monte Carlo measure: M uniform random points (generic reals); μ{f > t} ≈ L·#{f(U_i) > t}/M.
  // Sorting the M values once lets every level be measured by a binary search.
  function lebesgueMC(fn, K, M, seed = 1) {
    const rand = mulberry32(seed), L = fn.b - fn.a, vs = new Float64Array(M);
    for (let i = 0; i < M; i++) vs[i] = fn.f(fn.a + rand() * L, 0);
    vs.sort();
    const { y0, y1 } = range(vs);
    if (!(y1 > y0)) return { value: isFinite(y0) ? y0 * L : NaN, evals: M };
    const { d, t } = levels(y0, y1, K);
    let s = y0 * L;
    for (const tj of t) {
      let lo = 0, hi = M; // first index with vs[i] > tj
      while (lo < hi) { const m = (lo + hi) >> 1; if (vs[m] > tj) hi = m; else lo = m + 1; }
      s += (d * L * (M - lo)) / M;
    }
    return { value: s, evals: M };
  }

  // All four methods at the same "budget" N (subintervals / levels / grid cells / random points).
  function compare(fn, N, seed = 1) {
    const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
    const run = (f) => { const t0 = now(); const r = f(); r.ms = now() - t0; return r; };
    return {
      left: run(() => riemann(fn, N, "left")),
      mid: run(() => riemann(fn, N, "mid")),
      random: run(() => riemann(fn, N, "random", seed)),
      leb: run(() => lebesgueLevels(fn, N, N)),
      mc: run(() => lebesgueMC(fn, N, N, seed)),
    };
  }

  root.Lab6Int = { FUNCTIONS, getFunction, mulberry32, gcd, point, riemann, lebesgueLevels, lebesgueMC, compare };
  if (typeof module !== "undefined") module.exports = root.Lab6Int;
})(typeof globalThis !== "undefined" ? globalThis : this);
