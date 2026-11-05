// Lab 5: Welford's online mean/variance and the sampling distribution of (x̄, s²).
// m hackers each attack n systems; every attempt gets a score in [0, 10] from a fixed distribution.
(function (root) {
  const CHECKPOINTS = [2, 5, 10, 30, 100, 1000];

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

  // --- Welford -------------------------------------------------------------------------------
  // State {k, mean, ss}. The core logic is the three lines inside push().
  const welford = () => ({ k: 0, mean: 0, ss: 0 });
  function push(w, x) {
    w.k += 1;
    const d = x - w.mean;          // deviation from the OLD mean
    w.mean += d / w.k;             // Knuth:   M_k  = M_{k-1} + (x_k − M_{k-1}) / k
    w.ss += d * (x - w.mean);      // Welford: SS_k = SS_{k-1} + (x_k − M_{k-1})(x_k − M_k)
    return w;
  }
  const sampleVar = (w) => (w.k > 1 ? w.ss / (w.k - 1) : NaN); // unbiased s²
  const popVar = (w) => (w.k > 0 ? w.ss / w.k : NaN);          // biased, divides by n

  // Step-by-step trace, plus the two-pass and the naive "sum of squares" formulas for comparison.
  function trace(xs) {
    const w = welford(), steps = [];
    for (const x of xs) {
      push(w, x);
      steps.push({ k: w.k, x, mean: w.mean, ss: w.ss, s2: sampleVar(w) });
    }
    const n = xs.length, mean = xs.reduce((a, b) => a + b, 0) / n;
    const twoPass = xs.reduce((a, x) => a + (x - mean) ** 2, 0) / (n - 1);
    const sum = xs.reduce((a, b) => a + b, 0), sumSq = xs.reduce((a, x) => a + x * x, 0);
    const naive = (sumSq - (sum * sum) / n) / (n - 1);
    return { steps, mean, twoPass, naive, welford: sampleVar(w) };
  }

  // --- Score distributions on [0, 10] ----------------------------------------------------------
  // Each has draw(u) (inverse cdf, one uniform per score) and raw moments E[X^r], r = 1..4.
  function binomialPmf(N, p) {
    const pmf = [];
    let c = 1;
    for (let k = 0; k <= N; k++) {
      pmf.push(c * p ** k * (1 - p) ** (N - k));
      c = (c * (N - k)) / (k + 1);
    }
    return pmf;
  }

  function distribution(name, p) {
    if (name === "binomial") {
      const pmf = binomialPmf(10, p), cdf = [];
      pmf.reduce((a, q, i) => (cdf[i] = a + q), 0);
      return {
        name, label: `Binomial(10, ${p})`, discrete: true,
        draw(u) { let k = 0; while (k < 10 && u >= cdf[k]) k++; return k; },
        raw: (r) => pmf.reduce((a, q, k) => a + q * k ** r, 0),
      };
    }
    if (name === "zeroinf") {
      // Penetration fails with prob 1−p (score 0); on success the score is Uniform(0, 10).
      return {
        name, label: `Bernoulli(${p}) × Uniform(0, 10)`, discrete: false,
        draw: (u) => (u < p ? (u / p) * 10 : 0),
        raw: (r) => (p * 10 ** r) / (r + 1),
      };
    }
    return {
      name: "uniform", label: "Uniform(0, 10)", discrete: false,
      draw: (u) => 10 * u,
      raw: (r) => 10 ** r / (r + 1),
    };
  }

  // μ, σ² and the 4th central moment μ4 from the raw moments.
  function moments(dist) {
    const [m1, m2, m3, m4] = [1, 2, 3, 4].map(dist.raw);
    const mu = m1, s2 = m2 - m1 * m1;
    const mu4 = m4 - 4 * m1 * m3 + 6 * m1 * m1 * m2 - 3 * m1 ** 4;
    return { mu, s2, mu4 };
  }

  // Exact sampling variances of x̄ and s² for an i.i.d. sample of size n.
  const varMean = (mom, n) => mom.s2 / n;
  const varS2 = (mom, n) => (mom.mu4 - (mom.s2 ** 2 * (n - 3)) / (n - 1)) / n;

  // Each hacker draws max(checkpoints) scores; Welford's state is read at every checkpoint,
  // so the same trajectories serve every n (exactly what an online algorithm is for).
  // The running (x̄_k, s²_k) of the first `keep` hackers is stored for plotting.
  function simulate(dist, m, seed, checkpoints = CHECKPOINTS, keep = 8) {
    const rand = mulberry32(seed), nmax = checkpoints[checkpoints.length - 1];
    const means = checkpoints.map(() => new Float64Array(m));
    const vars = checkpoints.map(() => new Float64Array(m));
    const paths = [];
    for (let h = 0; h < m; h++) {
      const w = welford();
      const path = h < keep ? { mean: new Float64Array(nmax + 1), s2: new Float64Array(nmax + 1) } : null;
      let c = 0;
      for (let i = 1; i <= nmax; i++) {
        push(w, dist.draw(rand()));
        if (path) { path.mean[i] = w.mean; path.s2[i] = sampleVar(w); }
        if (i === checkpoints[c]) { means[c][h] = w.mean; vars[c][h] = sampleVar(w); c++; }
      }
      if (path) paths.push(path);
    }
    return { dist, mom: moments(dist), m, checkpoints, means, vars, paths };
  }

  // Across-hacker summaries are themselves computed with Welford.
  function across(xs) {
    const w = welford();
    for (const x of xs) push(w, x);
    return { mean: w.mean, var: sampleVar(w) };
  }

  function summarise(sim, c) {
    const n = sim.checkpoints[c], { mu, s2 } = sim.mom, m = sim.m;
    const M = across(sim.means[c]), V = across(sim.vars[c]);
    const vm = varMean(sim.mom, n), vs = varS2(sim.mom, n);
    return {
      n,
      avgMean: M.mean, zMean: (M.mean - mu) / Math.sqrt(vm / m),
      avgS2: V.mean, zS2: (V.mean - s2) / Math.sqrt(vs / m),
      avgPop: (V.mean * (n - 1)) / n, theoryPop: (s2 * (n - 1)) / n,
      varMean: M.var, theoryVarMean: vm,
      varS2: V.var, theoryVarS2: vs,
    };
  }

  root.Lab5 = { CHECKPOINTS, mulberry32, welford, push, sampleVar, popVar, trace, distribution, moments, varMean, varS2, simulate, summarise };
  if (typeof module !== "undefined") module.exports = root.Lab5;
})(typeof globalThis !== "undefined" ? globalThis : this);
