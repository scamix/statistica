// Statistical attack on the Caesar cipher: choose the shift whose decryption has the letter
// distribution closest (chi-square) to the one measured on a reference corpus.
(function () {
  const el = (id) => document.getElementById(id);
  const A = 65;

  const lettersOf = (text) => [...text.toUpperCase()].filter((ch) => ch >= "A" && ch <= "Z").map((ch) => ch.charCodeAt(0) - A);

  function frequencies(codes) {
    const f = new Array(26).fill(0);
    for (const c of codes) f[c]++;
    return f.map((x) => x / codes.length);
  }

  // Reference distribution with add-one smoothing so no letter has probability 0.
  const refCodes = lettersOf(REFERENCE_CORPUS);
  const REF = (() => {
    const counts = new Array(26).fill(1);
    for (const c of refCodes) counts[c]++;
    const total = refCodes.length + 26;
    return counts.map((x) => x / total);
  })();

  // chi2(k) = sum_i (O_i - E_i)^2 / E_i, with O the counts of the ciphertext decrypted by k.
  function scores(codes) {
    const counts = new Array(26).fill(0);
    for (const c of codes) counts[c]++;
    const N = codes.length;
    const out = [];
    for (let k = 0; k < 26; k++) {
      let chi = 0;
      for (let i = 0; i < 26; i++) {
        const observed = counts[(i + k) % 26]; // plaintext letter i would appear as i + k
        const expected = N * REF[i];
        chi += ((observed - expected) ** 2) / expected;
      }
      out.push({ k, chi });
    }
    return out;
  }

  function recoverKey(codes) {
    return scores(codes).reduce((best, s) => (s.chi < best.chi ? s : best)).k;
  }

  function shift(text, k) {
    return text.replace(/[a-z]/gi, (ch) => {
      const base = ch <= "Z" ? 65 : 97;
      return String.fromCharCode(((ch.charCodeAt(0) - base + k) % 26 + 26) % 26 + base);
    });
  }

  // ---- single attack ----
  el("attack-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const text = el("cipher").value;
    const codes = lettersOf(text);
    const out = el("attack-out");
    if (codes.length < 5) {
      out.textContent = "Please enter a ciphertext with at least 5 letters.";
      return;
    }
    const ranked = scores(codes).sort((a, b) => a.chi - b.chi);
    const k = ranked[0].k;
    const lines = [
      `${codes.length} letters, best key k = ${k}`,
      "",
      "Plaintext: " + shift(text, -k),
      "",
      "Best candidates (smaller χ² = closer to English)",
    ];
    for (const s of ranked.slice(0, 5)) lines.push(`  k=${String(s.k).padStart(2)}  χ² = ${s.chi.toFixed(1)}`);
    out.textContent = lines.join("\n");
  });

  // ---- experiment on different lengths ----
  const testCodes = lettersOf(TEST_CORPUS);
  const LENGTHS = [5, 10, 20, 30, 50, 100, 200];

  el("exp-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const trials = 1000;
    let html = "";
    for (const len of LENGTHS) {
      let ok = 0;
      for (let t = 0; t < trials; t++) {
        const start = Math.floor(Math.random() * (testCodes.length - len));
        const k = 1 + Math.floor(Math.random() * 25);
        const cipher = testCodes.slice(start, start + len).map((c) => (c + k) % 26);
        if (recoverKey(cipher) === k) ok++;
      }
      const rate = (100 * ok) / trials;
      html += `<tr><td>${len}</td><td>${rate.toFixed(1)}%</td>` +
        `<td><span class="share"><span style="width:${rate}%"></span></span></td></tr>`;
    }
    el("exp-out").innerHTML = html;
    el("exp-note").textContent = `${trials} random windows and keys per length; reference corpus ${refCodes.length} letters, ` +
      `test corpus ${testCodes.length} letters (different passages).`;
  });

  el("cipher").value = shift("Meet me at the old bridge at midnight and bring the letter with you", 7);
})();
