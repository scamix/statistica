/*
 * HMWK 2, section 7: statistical properties of the wallet pipeline.
 * Generates many wallets and measures bit balance, hex-digit frequencies,
 * avalanche behaviour and the error-detection rate of both checksums.
 */
(function () {
  "use strict";

  const W = window.WalletCrypto;
  const $ = (id) => document.getElementById(id);
  const pct = (v, d = 1) => `${(100 * v).toFixed(d)}%`;
  const randInt = (n) => crypto.getRandomValues(new Uint32Array(1))[0] % n;

  // Stages of the pipeline, as bit strings, for one entropy value.
  const STAGES = [
    { key: "entropy", name: "Entropy", kind: "Key generation" },
    { key: "mnemonic", name: "Mnemonic (entropy + checksum bits)", kind: "Encoding + checksum" },
    { key: "seed", name: "Seed", kind: "Key derivation (PBKDF2)" },
    { key: "master", name: "BIP-32 master key", kind: "Key derivation (HMAC)" },
    { key: "priv", name: "Private key m/44'/60'/0'/0/0", kind: "Key derivation (HMAC)" },
    { key: "pubx", name: "Public key, x coordinate", kind: "Public-key cryptography" },
    { key: "hash", name: "Keccak-256 of the public key", kind: "Hashing" },
    { key: "address", name: "Address (20 bytes)", kind: "Encoding of the hash" },
  ];

  function stages(entropy) {
    const m = W.entropyToMnemonic(entropy);
    const seed = W.mnemonicToSeed(m.phrase);
    const levels = W.derivePath(seed, "m/44'/60'/0'/0/0");
    const pub = W.publicKey(levels.at(-1).key);
    const { hash, address } = W.addressFromPublicKey(pub);
    return {
      bits: {
        entropy: W.bitsOf(entropy),
        mnemonic: W.bitsOf(entropy) + m.checksum,
        seed: W.bitsOf(seed),
        master: W.bitsOf(levels[0].key),
        priv: W.bitsOf(levels.at(-1).key),
        pubx: W.bitsOf(pub.x),
        hash: W.bitsOf(hash),
        address: W.bitsOf(hash.slice(12)),
      },
      address,
      checksummed: W.toChecksumAddress(address).address,
    };
  }

  function newEntropy(weak) {
    if (!weak) return crypto.getRandomValues(new Uint8Array(16));
    // A broken generator: only 2^16 possible outputs, then "whitened" by SHA-256.
    return W.sha256(W.utf8(`weak-${randInt(65536)}`)).slice(0, 16);
  }

  const ones = (bits) => bits.split("1").length - 1;
  function distance(a, b) {
    let d = 0;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++;
    return d / a.length;
  }

  // BIP-39 validity straight from word indices (faster than going through the words).
  function validIndices(indices) {
    const bits = indices.map((i) => i.toString(2).padStart(11, "0")).join("");
    const cs = indices.length * 11 / 33;
    const ent = new Uint8Array((bits.length - cs) / 8);
    for (let i = 0; i < ent.length; i++) ent[i] = parseInt(bits.slice(8 * i, 8 * i + 8), 2);
    return W.bitsOf(W.sha256(ent)).slice(0, cs) === bits.slice(-cs);
  }

  function checksumTests(wallets) {
    const results = [];
    const trials = 20000;

    for (const words of [12, 24]) {
      let valid = 0;
      for (let t = 0; t < trials; t++) {
        if (validIndices(Array.from({ length: words }, () => randInt(2048)))) valid++;
      }
      const cs = words * 11 / 33;
      results.push([`BIP-39: ${trials.toLocaleString("en")} random ${words}-word sequences that pass the checksum`,
        pct(valid / trials, 2), `1/2^${cs} = ${pct(1 / 2 ** cs, 2)}`]);
    }

    let caught = 0;
    for (let t = 0; t < trials; t++) {
      const { indices } = W.entropyToMnemonic(crypto.getRandomValues(new Uint8Array(16)));
      const pos = randInt(12);
      let w;
      do { w = randInt(2048); } while (w === indices[pos]);
      indices[pos] = w;
      if (!validIndices(indices)) caught++;
    }
    results.push([`BIP-39: one word of a valid 12-word phrase replaced (${trials.toLocaleString("en")} trials), error detected`,
      pct(caught / trials, 2), "15/16 = 93.75%"]);

    let letters = 0, upper = 0;
    for (const { checksummed } of wallets) {
      for (const c of checksummed.slice(2)) {
        if (/[a-fA-F]/.test(c)) { letters++; if (c === c.toUpperCase()) upper++; }
      }
    }
    results.push(["EIP-55: letters written in upper case", pct(upper / letters), "50%"]);
    results.push(["EIP-55: letters (= checksum bits) per address", (letters / wallets.length).toFixed(1), "40 × 6/16 = 15"]);

    const alphabet = "0123456789abcdefABCDEF";
    let typos = 0, detected = 0;
    for (const { checksummed } of wallets) {
      for (let t = 0; t < 50; t++) {
        const pos = 2 + randInt(40);
        let c;
        do { c = alphabet[randInt(alphabet.length)]; } while (c === checksummed[pos]);
        const typo = checksummed.slice(0, pos) + c + checksummed.slice(pos + 1);
        typos++;
        if (!W.isValidChecksumAddress(typo)) detected++;
      }
    }
    results.push([`EIP-55: one random character changed (${typos} typos), error detected`,
      pct(detected / typos, 2), "≈ 1 − 2⁻¹⁵ ≈ 99.997%"]);
    return results;
  }

  function shareBar(v) {
    return `<span class="w-share"><span style="width:${100 * v}%"></span></span> ${pct(v, 2)}`;
  }

  async function runExperiment() {
    const count = Math.min(Math.max(Number($("s-count").value) || 40, 5), 500);
    const weak = $("s-weak").checked;
    const progress = $("s-progress");
    const button = $("s-form").querySelector("button");
    button.disabled = true;
    progress.hidden = false;
    progress.value = 0;
    $("s-summary").textContent = "Running…";

    const t0 = performance.now();
    const wallets = [];
    const flips = Object.fromEntries(STAGES.map((s) => [s.key, []]));
    for (let i = 0; i < count; i++) {
      const entropy = newEntropy(weak);
      const a = stages(entropy);
      // Avalanche: flip one random bit of the entropy and recompute everything.
      const flipped = entropy.slice();
      const bit = randInt(128);
      flipped[bit >> 3] ^= 0x80 >> (bit & 7);
      const b = stages(flipped);
      for (const s of STAGES) flips[s.key].push(distance(a.bits[s.key], b.bits[s.key]));
      wallets.push(a);
      progress.value = (i + 1) / count;
      if (i % 2 === 1) await new Promise((r) => setTimeout(r)); // keep the page responsive
    }

    // a. bit balance
    $("s-bits").innerHTML = STAGES.map((s) => {
      const all = wallets.map((w) => w.bits[s.key]).join("");
      const n1 = ones(all);
      const chi = (2 * n1 - all.length) ** 2 / all.length;
      return `<tr><td>${s.name}</td><td>${s.kind}</td><td>${wallets[0].bits[s.key].length}</td>
        <td>${shareBar(n1 / all.length)}</td><td>${chi.toFixed(2)}${chi > 3.84 ? " (≠ 50% at 5%)" : ""}</td></tr>`;
    }).join("");

    // b. hex digits of the addresses
    const counts = new Array(16).fill(0);
    for (const w of wallets) for (const c of w.address) counts[parseInt(c, 16)]++;
    const total = counts.reduce((s, c) => s + c, 0);
    const expected = total / 16;
    const chi = counts.reduce((s, c) => s + (c - expected) ** 2 / expected, 0);
    const max = Math.max(...counts);
    $("s-hex").innerHTML = counts.map((c, d) => `<div class="w-col" data-tip="${d.toString(16)}: ${c} (${pct(c / total)})">
      <div class="w-bar" style="height:${(100 * c) / max}%"></div><span>${d.toString(16)}</span></div>`).join("");
    $("s-hex-chi").textContent = `χ² = ${chi.toFixed(1)} with 15 degrees of freedom (5% critical value 25.0): ` +
      (chi > 25.0 ? "uniformity rejected." : "consistent with a uniform distribution.");

    // c. avalanche
    $("s-aval").innerHTML = STAGES.map((s) => {
      const d = flips[s.key];
      const mean = d.reduce((x, y) => x + y, 0) / d.length;
      return `<tr><td>${s.name}</td><td>${s.kind}</td><td>${shareBar(mean)}</td>
        <td>${pct(Math.min(...d))} – ${pct(Math.max(...d))}</td></tr>`;
    }).join("");

    // d. checksums
    $("s-checks").innerHTML = checksumTests(wallets)
      .map(([name, measured, theory]) => `<tr><td>${name}</td><td><strong>${measured}</strong></td><td>${theory}</td></tr>`)
      .join("");

    const secs = ((performance.now() - t0) / 1000).toFixed(1);
    $("s-summary").textContent = `${count} wallets (${2 * count} pipeline runs including the avalanche twins) in ${secs} s, ` +
      (weak ? "with the WEAK generator: only 65 536 possible wallets exist." : "with the browser's cryptographic random generator.");
    progress.hidden = true;
    button.disabled = false;
  }

  $("s-form").addEventListener("submit", (e) => { e.preventDefault(); runExperiment(); });
  runExperiment();
})();
