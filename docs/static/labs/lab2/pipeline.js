/*
 * HMWK 2, sections 1 and 5: run the wallet pipeline step by step, check
 * EIP-55 addresses, and compare four hash functions on the same input.
 */
(function () {
  "use strict";

  const W = window.WalletCrypto;
  const $ = (id) => document.getElementById(id);
  const hex = W.toHex;
  const TEST_PHRASE = "test test test test test test test test test test test junk";

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const code = (s) => `<code class="w-hex">${esc(s)}</code>`;

  const TAGS = {
    gen: "Key generation",
    der: "Key derivation",
    pk: "Public-key cryptography",
    hash: "Hashing",
    cs: "Checksum",
    enc: "Encoding",
  };
  const tags = (...kinds) => kinds.map((k) => `<span class="tag t-${k}">${TAGS[k]}</span>`).join(" ");

  // Meaning of each level of a BIP-44 path.
  const BIP44_LEVELS = ["purpose (BIP-44)", "coin type (60 = Ether, SLIP-44)", "account", "change (0 = receiving)", "address index"];

  let generatedEntropy = null; // set when the phrase came from "Generate"

  function step(title, standard, kinds, body) {
    return `<li class="w-step">
      <div class="w-step-head"><h3>${title}</h3><span class="w-std">${standard}</span></div>
      <div class="w-tags">${tags(...kinds)}</div>
      ${body}
    </li>`;
  }

  function wordTable(dec) {
    const csLen = dec.checksum.length;
    const rows = dec.words.map((w, i) => {
      let bits = dec.indices[i].toString(2).padStart(11, "0");
      if (i === dec.words.length - 1) {
        bits = `${bits.slice(0, 11 - csLen)}<mark title="checksum bits">${bits.slice(11 - csLen)}</mark>`;
      }
      return `<tr><td>${i + 1}</td><td>${esc(w)}</td><td>${dec.indices[i]}</td><td class="w-mono">${bits}</td></tr>`;
    });
    return `<div class="w-scroll w-short"><table class="w-table w-words">
      <thead><tr><th>#</th><th>Word</th><th>Index</th><th>11 bits</th></tr></thead>
      <tbody>${rows.join("")}</tbody></table></div>`;
  }

  function eip55Grid(lower, hash) {
    const cells = [...lower].map((c, i) => {
      const nib = parseInt(hash[i], 16);
      const letter = /[a-f]/.test(c);
      const cls = !letter ? "digit" : nib >= 8 ? "upper" : "lower";
      return `<span class="w-cell ${cls}"><b>${nib >= 8 && letter ? c.toUpperCase() : c}</b><i>${hash[i]}</i></span>`;
    });
    return `<div class="w-grid" aria-label="Address characters with hash nibbles">${cells.join("")}</div>
      <p class="w-note"><span class="w-cell upper sample"><b>A</b></span> letter with nibble ≥ 8 → upper case
      &nbsp; <span class="w-cell lower sample"><b>a</b></span> nibble &lt; 8 → lower case
      &nbsp; <span class="w-cell digit sample"><b>0</b></span> digits carry no checksum</p>`;
  }

  function run() {
    const phrase = $("w-phrase").value;
    const passphrase = $("w-pass").value;
    const path = $("w-path").value;
    const errorBox = $("w-error");
    const out = $("w-steps");
    errorBox.hidden = true;

    const dec = W.mnemonicToEntropy(phrase);
    if (!dec.ok) {
      errorBox.textContent = dec.error + (dec.expected
        ? ` The last word ends with checksum bits ${dec.checksum}, but SHA-256 of the entropy gives ${dec.expected}. Wallets reject this phrase.`
        : "");
      errorBox.hidden = false;
      out.innerHTML = "";
      return;
    }
    let levels;
    const t0 = performance.now();
    const seed = W.mnemonicToSeed(phrase, passphrase);
    const seedMs = performance.now() - t0;
    try {
      levels = W.derivePath(seed, path);
    } catch (err) {
      errorBox.textContent = err.message;
      errorBox.hidden = false;
      out.innerHTML = "";
      return;
    }

    const entropyBits = dec.entropy.length * 8;
    const fromGenerator = generatedEntropy && hex(generatedEntropy) === hex(dec.entropy);
    const privateKey = levels.at(-1).key;
    const pub = W.publicKey(privateKey);
    const { hash, address } = W.addressFromPublicKey(pub);
    const eip = W.toChecksumAddress(address);
    const hashHex = hex(hash);
    const isStandardPath = /^m\/44'\/60'\/\d+'\/[01]\/\d+$/.test(path.trim());

    const html = [];

    html.push(step("Entropy", "CSPRNG", ["gen"], `
      <p>${fromGenerator
        ? `${entropyBits} random bits from <code>crypto.getRandomValues</code>, the browser's cryptographic random number generator.`
        : `The ${entropyBits} bits of entropy recovered from the words. When a wallet is created, these bits come from a cryptographic random number generator.`}</p>
      <p>${code(hex(dec.entropy))}</p>
      <p class="w-note">This is the only random step. Everything below is deterministic.</p>`));

    html.push(step("Mnemonic", "BIP-39", ["enc", "cs"], `
      <p>Append the first ${dec.checksum.length} bits of SHA-256(entropy) as a checksum
        (${code(dec.checksum)} ${dec.checksum === dec.expected ? "✓ valid" : "✗"}), then split
        ${entropyBits + dec.checksum.length} bits into ${dec.words.length} groups of 11 bits. Each group is an index into the 2048-word list.</p>
      ${wordTable(dec)}`));

    html.push(step("Seed", "BIP-39", ["der"], `
      <p>PBKDF2-HMAC-SHA512 with 2048 iterations. Password = the sentence, salt =
        <code>"mnemonic${esc(passphrase)}"</code>. Output: 512 bits.</p>
      <p>${code(hex(seed))}</p>
      <p class="w-note">Took ${seedMs.toFixed(0)} ms here. The repetitions make each guess slower for an attacker.
        A different passphrase gives an unrelated seed, and therefore a different wallet.</p>`));

    html.push(step("Master key and chain code", "BIP-32", ["der"], `
      <p>HMAC-SHA512(key = <code>"Bitcoin seed"</code>, data = seed). The left 256 bits are the master private key,
        the right 256 bits are the chain code (extra entropy for deriving children).</p>
      <p>Master private key ${code(hex(levels[0].key))}</p>
      <p>Chain code ${code(hex(levels[0].chainCode))}</p>`));

    const rows = levels.slice(1).map((lv, i) => `<tr>
      <td class="w-mono">${esc(levels.slice(0, i + 2).map((l) => l.label).join("/"))}</td>
      <td>${isStandardPath ? BIP44_LEVELS[i] : "—"}</td>
      <td>${lv.hardened ? "yes (uses private key)" : "no (uses public key)"}</td>
      <td class="w-mono">${hex(lv.key).slice(0, 16)}…</td></tr>`).join("");
    html.push(step("Derivation path", "BIP-32 + BIP-44", ["der"], `
      <p>Each level is a child-key derivation: HMAC-SHA512(chain code, parent key ‖ index), then child = (left half + parent key) mod n.
        Hardened levels (<code>'</code>) use the parent <em>private</em> key.</p>
      <div class="w-scroll"><table class="w-table"><thead><tr><th>Path</th><th>BIP-44 meaning</th><th>Hardened</th><th>Private key</th></tr></thead>
      <tbody>${rows}</tbody></table></div>
      <p>Account private key (k) ${code(hex(privateKey))}</p>`));

    html.push(step("Public key", "secp256k1", ["pk"], `
      <p>K = k · G on y² = x³ + 7 (mod p), using double-and-add as in HMWK 1, with 256-bit numbers.
        Uncompressed encoding: <code>04 ‖ x ‖ y</code> (65 bytes).</p>
      <p>${code(hex(pub.uncompressed))}</p>
      <p class="w-note">Compressed form (used inside BIP-32): ${code(hex(pub.compressed))}</p>`));

    html.push(step("Keccak-256 of the public key", "Keccak-256", ["hash"], `
      <p>Hash the 64 bytes x ‖ y (without the 04 prefix). The last 20 bytes become the address.</p>
      <p><code class="w-hex"><span class="w-dim">${hashHex.slice(0, 24)}</span><strong>${hashHex.slice(24)}</strong></code></p>`));

    html.push(step("Address", "Ethereum", ["enc"], `
      <p>Take the last 20 bytes and write them as hex with a <code>0x</code> prefix.</p>
      <p>${code("0x" + address)}</p>`));

    html.push(step("Checksummed address", "EIP-55", ["cs", "enc"], `
      <p>Keccak-256 of the <em>text</em> of the lowercase address (40 ASCII characters). Letter <em>i</em> is
        written in upper case when hex digit <em>i</em> of that hash is ≥ 8.</p>
      ${eip55Grid(address, eip.hash)}
      <p class="w-final">${code(eip.address)}</p>`));

    out.innerHTML = html.join("");
  }

  function checkAddress() {
    const a = $("w-check").value.trim();
    const box = $("w-check-result");
    let msg, cls;
    if (!/^0x[0-9a-fA-F]{40}$/.test(a)) {
      [msg, cls] = ["Not an address: expected 0x followed by 40 hex digits.", "bad"];
    } else if (a.slice(2) === a.slice(2).toLowerCase() || a.slice(2) === a.slice(2).toUpperCase()) {
      [msg, cls] = ["All one case: there is no checksum to verify. A typo would go unnoticed.", "warn"];
    } else if (W.isValidChecksumAddress(a)) {
      [msg, cls] = ["✓ Valid EIP-55 checksum.", "ok"];
    } else {
      [msg, cls] = [`✗ Checksum mismatch: probably a typo. The correctly checksummed form of these hex digits would be ${W.toChecksumAddress(a).address}.`, "bad"];
    }
    box.textContent = msg;
    box.className = `w-check ${cls}`;
  }

  function hashes() {
    const data = W.utf8($("h-input").value);
    const rows = [
      ["SHA-256", W.sha256(data), "SHA-2, 2001"],
      ["SHA-512", W.sha512(data), "SHA-2, 2001"],
      ["SHA3-256", W.sha3_256(data), "FIPS 202, padding byte 0x06"],
      ["Keccak-256", W.keccak256(data), "Ethereum, padding byte 0x01"],
    ];
    $("h-out").innerHTML = rows
      .map(([name, h, note]) => `<tr><th>${name}<br><span class="w-note">${note}</span></th><td>${code(hex(h))}</td></tr>`)
      .join("");
  }

  // ------------------------------------------------------------ events

  $("w-form").addEventListener("submit", (e) => { e.preventDefault(); run(); });
  document.querySelectorAll("[data-generate]").forEach((btn) =>
    btn.addEventListener("click", () => {
      generatedEntropy = crypto.getRandomValues(new Uint8Array(Number(btn.dataset.generate)));
      $("w-phrase").value = W.entropyToMnemonic(generatedEntropy).phrase;
      run();
    }));
  $("w-test").addEventListener("click", () => {
    $("w-phrase").value = TEST_PHRASE;
    $("w-pass").value = "";
    $("w-path").value = "m/44'/60'/0'/0/0";
    run();
  });
  $("w-check").addEventListener("input", checkAddress);
  $("h-input").addEventListener("input", hashes);

  run();
  checkAddress();
  hashes();
})();
