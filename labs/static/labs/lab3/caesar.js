// Caesar cipher and a side-by-side statistical comparison with the EC-ElGamal of elgamal.js
// (which must be loaded first: it provides n, G, mul, encrypt, nibbles, ...).
(function () {
  const el = (id) => document.getElementById(id);

  // Shift letters by k places in the 26-letter alphabet; everything else is left alone.
  function shift(text, k) {
    return text.replace(/[a-z]/gi, (ch) => {
      const base = ch <= "Z" ? 65 : 97;
      return String.fromCharCode(((ch.charCodeAt(0) - base + k) % 26 + 26) % 26 + base);
    });
  }
  const caesarEncrypt = (text, k) => shift(text, k);
  const caesarDecrypt = (text, k) => shift(text, -k);

  function validKey(k) {
    return Number.isInteger(k) && k >= 1 && k <= 25;
  }

  el("caesar").addEventListener("submit", (event) => {
    event.preventDefault();
    const out = el("caesar-out");
    const k = Number(el("shift").value);
    const text = el("msg").value;
    if (!validKey(k)) {
      out.textContent = "Please enter a shift between 1 and 25.";
      return;
    }
    if (!text) {
      out.textContent = "Please enter a message in the box above.";
      return;
    }
    const cipher = caesarEncrypt(text, k);
    const plain = caesarDecrypt(cipher, k);
    const lines = [
      "KEY: shift k = " + k + "  (A → " + shift("A", k) + ")",
      "",
      "ENCRYPTION  c = (m + k) mod 26 for each letter",
      "  plaintext : " + text,
      "  ciphertext: " + cipher,
      "",
      "DECRYPTION  m = (c − k) mod 26 for each letter",
      "  recovered : " + plain + "  " + (plain === text ? "✓ matches" : "✗ differs"),
      "",
      "BRUTE FORCE (Eve tries all 25 keys)",
    ];
    for (let t = 1; t <= 25; t++) lines.push("  k=" + String(t).padStart(2) + "  " + caesarDecrypt(cipher, t));
    out.textContent = lines.join("\n");
  });

  // ---- statistics ----
  function counts(symbols) {
    const map = new Map();
    for (const s of symbols) map.set(s, (map.get(s) || 0) + 1);
    return map;
  }
  function entropy(map) {
    const total = [...map.values()].reduce((a, b) => a + b, 0);
    let h = 0;
    for (const c of map.values()) h -= (c / total) * Math.log2(c / total);
    return h;
  }
  function topShare(map) {
    const total = [...map.values()].reduce((a, b) => a + b, 0);
    return Math.max(...map.values()) / total;
  }
  // Index of coincidence: probability that two random symbols are equal.
  function coincidence(map) {
    const total = [...map.values()].reduce((a, b) => a + b, 0);
    let s = 0;
    for (const c of map.values()) s += c * (c - 1);
    return s / (total * (total - 1));
  }
  const pct = (x) => (100 * x).toFixed(1) + "%";

  function letters(text) {
    return [...text.toUpperCase()].filter((ch) => ch >= "A" && ch <= "Z");
  }

  function row(name, symbols, map) {
    return "<tr><td>" + name + "</td><td>" + symbols + "</td><td>" + map.size + "</td><td>" +
      entropy(map).toFixed(2) + "</td><td>" + pct(topShare(map)) + "</td><td>" +
      coincidence(map).toFixed(3) + "</td></tr>";
  }

  el("stats-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const out = el("stats-out");
    const text = el("sample").value;
    const k = Number(el("stats-shift").value);
    const d = Number(el("stats-d").value);
    const L = letters(text);
    if (L.length < 30 || !validKey(k) || !Number.isInteger(d) || d < 1 || d >= n) {
      out.innerHTML = "<tr><td>Need at least 30 letters, a shift in 1–25 and d in 1–" + (n - 1) + ".</td></tr>";
      return;
    }
    const plainMap = counts(L);
    const caesarText = caesarEncrypt(L.join(""), k);
    const caesarMap = counts(caesarText);

    const nib = nibbles(L.join(""));
    const nibMap = counts(nib);
    const Q = mul(d, G);
    const blocks = encrypt(L.join(""), Q);
    const c2Map = counts(blocks.map((b) => show(b.C2)));
    const c1Map = counts(blocks.map((b) => show(b.C1)));

    // Frequency analysis: assume the most common ciphertext letter is E.
    let top = "";
    for (const [s, c] of caesarMap) if (!top || c > caesarMap.get(top)) top = s;
    const guess = (top.charCodeAt(0) - 69 + 26) % 26;

    out.innerHTML =
      row("Plaintext letters (A–Z)", L.length, plainMap) +
      row("Caesar ciphertext letters", L.length, caesarMap) +
      row("Plaintext nibbles (0–15)", nib.length, nibMap) +
      row("ElGamal C1 points", blocks.length, c1Map) +
      row("ElGamal C2 points", blocks.length, c2Map);
    el("stats-note").textContent =
      "Frequency analysis on the Caesar ciphertext (most common letter " + top +
      " assumed to be E) guesses k = " + guess + (guess === k ? ", which is correct." : ", which is wrong for this text.") +
      " The same trick gives Eve nothing on the ElGamal pairs.";
  });
})();
