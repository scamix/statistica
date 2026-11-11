// Lab 6, Ex. 2: numerical computation of the standard normal CDF  Φ(x) = ∫_{−∞}^x φ(t) dt.
(function (root) {
  const SQRT2 = Math.SQRT2, SQRT2PI = Math.sqrt(2 * Math.PI), SQRTPI = Math.sqrt(Math.PI);
  const phi = (x) => Math.exp(-0.5 * x * x) / SQRT2PI;

  // Trusted reference: Φ(x) to 17 significant digits, computed with mpmath (40-digit arithmetic).
  // The same numbers are returned by Wolfram|Alpha for CDF[NormalDistribution[0, 1], x].
  const REFERENCE = [
    [-8, 6.2209605742717841e-16],
    [-7.75, 4.5946274357785955e-15],
    [-7.5, 3.1908916729108962e-14],
    [-7.25, 2.0838581586720694e-13],
    [-7, 1.279812543885835e-12],
    [-6.75, 7.3922577780178224e-12],
    [-6.5, 4.0160005838591178e-11],
    [-6.25, 2.0522634252189389e-10],
    [-6, 9.8658764503769814e-10],
    [-5.75, 4.4621724539016119e-9],
    [-5.5, 1.8989562465887719e-8],
    [-5.25, 7.6049605164887143e-8],
    [-5, 2.8665157187919391e-7],
    [-4.75, 1.0170832425687032e-6],
    [-4.5, 3.3976731247300604e-6],
    [-4.25, 1.068852577493442e-5],
    [-4, 3.1671241833119921e-5],
    [-3.75, 8.8417285200803868e-5],
    [-3.5, 0.00023262907903552504],
    [-3.25, 0.00057702504239076704],
    [-3, 0.0013498980316300945],
    [-2.75, 0.0029797632350545568],
    [-2.5, 0.0062096653257761352],
    [-2.25, 0.012224472655044703],
    [-2, 0.022750131948179207],
    [-1.96, 0.024997895148220436],
    [-1.75, 0.04005915686381709],
    [-1.5, 0.066807201268858066],
    [-1.25, 0.10564977366685526],
    [-1, 0.15865525393145705],
    [-0.75, 0.2266273523768682],
    [-0.5, 0.3085375387259869],
    [-0.25, 0.40129367431707628],
    [0, 0.5],
    [0.25, 0.59870632568292372],
    [0.5, 0.6914624612740131],
    [0.75, 0.7733726476231318],
    [1, 0.84134474606854295],
    [1.25, 0.89435022633314474],
    [1.5, 0.93319279873114193],
    [1.75, 0.95994084313618291],
    [1.96, 0.97500210485177956],
    [2, 0.97724986805182079],
    [2.25, 0.9877755273449553],
    [2.5, 0.99379033467422386],
    [2.75, 0.99702023676494544],
    [3, 0.99865010196836991],
    [3.25, 0.99942297495760923],
    [3.5, 0.99976737092096447],
    [3.75, 0.9999115827147992],
    [4, 0.99996832875816688],
    [4.25, 0.99998931147422507],
    [4.5, 0.99999660232687527],
    [4.75, 0.99999898291675743],
    [5, 0.99999971334842812],
    [5.25, 0.99999992395039484],
    [5.5, 0.99999998101043753],
    [5.75, 0.99999999553782755],
    [6, 0.99999999901341235],
    [6.25, 0.99999999979477366],
    [6.5, 0.99999999995983999],
    [6.75, 0.99999999999260774],
    [7, 0.99999999999872019],
    [7.25, 0.99999999999979161],
    [7.5, 0.99999999999996809],
    [7.75, 0.99999999999999541],
    [8, 0.99999999999999938]
  ];

  // ---- 1. Numerical integration of φ on [0, x]:  Φ(x) = 1/2 + ∫_0^x φ(t) dt ----------------------
  function cdfTrapezoid(x, n = 100) {
    const h = x / n;
    let s = 0.5 * (phi(0) + phi(x));
    for (let i = 1; i < n; i++) s += phi(i * h);
    return 0.5 + s * h;
  }

  function cdfSimpson(x, n = 100) {
    if (n % 2) n++;
    const h = x / n;
    let s = phi(0) + phi(x);
    for (let i = 1; i < n; i++) s += (i % 2 ? 4 : 2) * phi(i * h);
    return 0.5 + (s * h) / 3;
  }

  // ---- 2. Power series of erf:  erf(z) = 2/√π Σ_k (−1)^k z^{2k+1} / (k! (2k+1)) ----------------
  // Alternating series; the largest term grows like e^{z²}, so for large z digits cancel.
  function erfSeries(z) {
    let term = z, sum = z, k = 0, maxTerm = Math.abs(z); // term = (−1)^k z^{2k+1}/k!
    while (k < 1000) {
      k++;
      term *= (-z * z) / k;
      const add = term / (2 * k + 1);
      sum += add;
      maxTerm = Math.max(maxTerm, Math.abs(add));
      if (Math.abs(add) < 1e-17 * Math.abs(sum)) break;
    }
    return { value: (2 / SQRTPI) * sum, terms: k + 1, maxTerm: (2 / SQRTPI) * maxTerm };
  }
  const cdfSeries = (x) => 0.5 * (1 + erfSeries(x / SQRT2).value);

  // ---- 3. Abramowitz & Stegun 7.1.26: erf(z) ≈ 1 − (a1 t + … + a5 t⁵) e^{−z²}, t = 1/(1 + p z) -----
  // A fixed rational-times-exponential approximation, |error in erf| ≤ 1.5·10⁻⁷.
  function erfAS(z) {
    const s = z < 0 ? -1 : 1;
    z = Math.abs(z);
    const t = 1 / (1 + 0.3275911 * z);
    const poly = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
    return s * (1 - poly * Math.exp(-z * z));
  }
  const cdfAS = (x) => 0.5 * (1 + erfAS(x / SQRT2));

  // ---- 4. Marsaglia (2004): Φ(x) = 1/2 + φ(x)·(x + x³/3 + x⁵/(3·5) + x⁷/(3·5·7) + …) ----------------
  // Obtained by integrating by parts repeatedly. All terms have the sign of x: no cancellation.
  function marsagliaSum(x) {
    let term = x, sum = x, k = 1;
    for (; k < 500; k++) {
      term *= (x * x) / (2 * k + 1);
      const s = sum + term;
      if (s === sum) break;
      sum = s;
    }
    return sum;
  }
  const cdfMarsaglia = (x) => 0.5 + phi(x) * marsagliaSum(x);

  // ---- 5. Laplace continued fraction for the upper tail (x > 0) ------------------------------------
  //   Q(x) = 1 − Φ(x) = φ(x) / (x + 1/(x + 2/(x + 3/(x + …))))
  // evaluated with the modified Lentz algorithm. Converges fast for large x, slowly near 0.
  function tailCF(x) {
    const tiny = 1e-300;
    let f = x, C = x, D = 0, k = 1;
    for (; k < 5000; k++) {
      D = x + k * D; D = Math.abs(D) < tiny ? tiny : D; D = 1 / D;
      C = x + k / C; C = Math.abs(C) < tiny ? tiny : C;
      const delta = C * D;
      f *= delta;
      if (Math.abs(delta - 1) < 1e-16) break;
    }
    return { value: phi(x) / f, iterations: k };
  }

  // ---- 6. Our method: Marsaglia's series in the centre, continued fraction in the tails --------------
  // Always compute the SMALL tail probability Q = Φ(−|x|) directly, then Φ(x) = Q or 1 − Q.
  // This keeps full relative accuracy for tiny probabilities such as Φ(−8) ≈ 6·10⁻¹⁶.
  const SWITCH = 2.5;
  function cdf(x) {
    if (Number.isNaN(x)) return NaN;
    const a = Math.abs(x);
    const q = a < SWITCH ? 0.5 - phi(a) * marsagliaSum(a) : tailCF(a).value;
    return x < 0 ? q : 1 - q;
  }

  root.Lab6Normal = { phi, REFERENCE, cdfTrapezoid, cdfSimpson, erfSeries, cdfSeries, erfAS, cdfAS, marsagliaSum, cdfMarsaglia, tailCF, cdf, SWITCH };
  if (typeof module !== "undefined") module.exports = root.Lab6Normal;
})(typeof globalThis !== "undefined" ? globalThis : this);
