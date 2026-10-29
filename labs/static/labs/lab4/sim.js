// Random-walk simulation: m attackers, each facing n systems in sequence with i.i.d. scores X_i.
// Bernoulli: X in {0,1}, P(X=1)=p.  Rademacher: X in {-1,+1} with probability 1/2 each.
(function (root) {
  const CHECKPOINTS = [10, 100, 1000, 10000];

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

  const model = (name, p) =>
    name === "bernoulli"
      ? { name, mu: p, var: p * (1 - p), draw: (u) => (u < p ? 1 : 0) }
      : { name, mu: 0, var: 1, draw: (u) => (u < 0.5 ? 1 : -1) };

  // Standard normal cdf (Abramowitz-Stegun 7.1.26, error < 1.5e-7).
  function Phi(z) {
    const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
    const poly = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
    const erf = 1 - poly * Math.exp(-(z * z) / 2);
    return 0.5 * (1 + (z >= 0 ? erf : -erf));
  }

  // Simulate m trajectories of length max(checkpoints); keep S_n at each checkpoint for all
  // attackers and the full path of the first `keep` attackers.
  function simulate(name, p, m, seed, checkpoints = CHECKPOINTS, keep = 8) {
    const mod = model(name, p);
    const rand = mulberry32(seed);
    const nmax = checkpoints[checkpoints.length - 1];
    const S = checkpoints.map(() => new Float64Array(m));
    const paths = [];
    for (let a = 0; a < m; a++) {
      const path = a < keep ? new Float64Array(nmax + 1) : null;
      let s = 0, c = 0;
      for (let i = 1; i <= nmax; i++) {
        s += mod.draw(rand());
        if (path) path[i] = s;
        if (i === checkpoints[c]) S[c++][a] = s;
      }
      if (path) paths.push(path);
    }
    return { mod, m, checkpoints, S, paths };
  }

  const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const variance = (xs) => {
    const mu = mean(xs);
    return xs.reduce((a, b) => a + (b - mu) ** 2, 0) / (xs.length - 1);
  };

  // Kolmogorov-Smirnov distance between the sample and N(0,1).
  function ksNormal(zs) {
    const sorted = Float64Array.from(zs).sort();
    const m = sorted.length;
    let d = 0;
    for (let i = 0; i < m; i++) {
      const F = Phi(sorted[i]);
      d = Math.max(d, F - i / m, (i + 1) / m - F);
    }
    return d;
  }

  // Summary of the three quantities for one model at checkpoint index c.
  function summarise(sim, c, eps) {
    const n = sim.checkpoints[c], { mu, var: s2 } = sim.mod, S = sim.S[c];
    const avg = S.map((s) => s / n), norm = S.map((s) => s / Math.sqrt(n));
    const std = S.map((s) => (s - n * mu) / Math.sqrt(n * s2));
    const exceed = avg.reduce((k, a) => k + (Math.abs(a - mu) >= eps ? 1 : 0), 0) / sim.m;
    return {
      n,
      meanS: mean(S), varS: variance(S), theoryVarS: n * s2,
      meanAvg: mean(avg), varAvg: variance(avg), theoryVarAvg: s2 / n,
      meanNorm: mean(norm), varNorm: variance(norm), theoryVarNorm: s2,
      exceed, chebyshev: Math.min(1, s2 / (n * eps * eps)),
      ks: ksNormal(std),
    };
  }

  root.Lab4 = { CHECKPOINTS, simulate, summarise, Phi, mulberry32 };
  if (typeof module !== "undefined") module.exports = root.Lab4;
})(typeof globalThis !== "undefined" ? globalThis : this);
