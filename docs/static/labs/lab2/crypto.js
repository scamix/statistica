/*
 * Educational, dependency-free implementations of the primitives used by an
 * Ethereum wallet:
 *
 *   SHA-256, SHA-512, HMAC-SHA512, PBKDF2      (hashing / key derivation)
 *   Keccak-256 and SHA3-256                     (hashing, two paddings)
 *   secp256k1                                   (public-key cryptography)
 *   BIP-39, BIP-32, BIP-44                      (mnemonic, seed, HD keys)
 *   EIP-55                                      (checksummed address)
 *
 * Written for readability, not for production: no constant-time code, no
 * side-channel protection. Never use it for real funds.
 */
(function (global) {
  "use strict";

  // ------------------------------------------------------------- bytes

  const te = new TextEncoder();
  const utf8 = (s) => te.encode(s);
  const toHex = (bytes) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  function fromHex(hex) {
    const h = hex.replace(/^0x/, "");
    const out = new Uint8Array(h.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(h.substr(2 * i, 2), 16);
    return out;
  }
  function concat(...parts) {
    const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
    let o = 0;
    for (const p of parts) { out.set(p, o); o += p.length; }
    return out;
  }
  const bytesToBig = (bytes) => (bytes.length ? BigInt("0x" + toHex(bytes)) : 0n);
  const bigToBytes = (n, len = 32) => fromHex(n.toString(16).padStart(2 * len, "0"));
  const ser32 = (i) => new Uint8Array([i >>> 24, (i >>> 16) & 255, (i >>> 8) & 255, i & 255]);

  // floor(n^(1/k)) for BigInt, by Newton's method.
  function iroot(n, k) {
    const K = BigInt(k);
    let x = 1n << BigInt(Math.ceil(n.toString(2).length / k) + 1);
    for (;;) {
      const y = ((K - 1n) * x + n / x ** (K - 1n)) / K;
      if (y >= x) return x;
      x = y;
    }
  }

  function firstPrimes(count) {
    const primes = [];
    for (let n = 2; primes.length < count; n++) {
      if (primes.every((q) => n % q !== 0)) primes.push(n);
    }
    return primes;
  }

  // SHA-2 constants are "nothing up my sleeve" numbers: the fractional parts
  // of square roots (initial hash) and cube roots (round constants) of primes.
  function fractionalRoots(count, root, bits) {
    const mask = (1n << BigInt(bits)) - 1n;
    return firstPrimes(count).map((q) => iroot(BigInt(q) << BigInt(bits * root), root) & mask);
  }

  // ------------------------------------------------------------- SHA-256

  const K256 = Uint32Array.from(fractionalRoots(64, 3, 32), Number);
  const IV256 = Uint32Array.from(fractionalRoots(8, 2, 32), Number);

  function sha256(msg) {
    const len = msg.length;
    const padded = new Uint8Array(Math.ceil((len + 9) / 64) * 64);
    padded.set(msg);
    padded[len] = 0x80;
    const view = new DataView(padded.buffer);
    view.setUint32(padded.length - 8, Math.floor((len * 8) / 2 ** 32));
    view.setUint32(padded.length - 4, (len * 8) >>> 0);

    const H = IV256.slice();
    const W = new Uint32Array(64);
    const rotr = (x, n) => (x >>> n) | (x << (32 - n));
    for (let off = 0; off < padded.length; off += 64) {
      for (let t = 0; t < 16; t++) W[t] = view.getUint32(off + 4 * t);
      for (let t = 16; t < 64; t++) {
        const s0 = rotr(W[t - 15], 7) ^ rotr(W[t - 15], 18) ^ (W[t - 15] >>> 3);
        const s1 = rotr(W[t - 2], 17) ^ rotr(W[t - 2], 19) ^ (W[t - 2] >>> 10);
        W[t] = (W[t - 16] + s0 + W[t - 7] + s1) >>> 0;
      }
      let [a, b, c, d, e, f, g, h] = H;
      for (let t = 0; t < 64; t++) {
        const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        const ch = (e & f) ^ (~e & g);
        const t1 = (h + S1 + ch + K256[t] + W[t]) >>> 0;
        const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const t2 = (S0 + maj) >>> 0;
        [h, g, f, e, d, c, b, a] = [g, f, e, (d + t1) >>> 0, c, b, a, (t1 + t2) >>> 0];
      }
      [a, b, c, d, e, f, g, h].forEach((v, i) => { H[i] = (H[i] + v) >>> 0; });
    }
    const out = new Uint8Array(32);
    const ov = new DataView(out.buffer);
    H.forEach((v, i) => ov.setUint32(4 * i, v));
    return out;
  }

  // ------------------------------------------------------------- SHA-512
  // 64-bit words are stored as (hi, lo) pairs of 32-bit integers.

  const split64 = (big) => [Number(big >> 32n) | 0, Number(big & 0xffffffffn) | 0];
  const K512 = Int32Array.from(fractionalRoots(80, 3, 64).flatMap(split64));
  const IV512 = Int32Array.from(fractionalRoots(8, 2, 64).flatMap(split64));

  function sha512Compress(state, block, off) {
    const W = new Int32Array(160);
    const view = new DataView(block.buffer, block.byteOffset);
    for (let t = 0; t < 32; t++) W[t] = view.getInt32(off + 4 * t);

    // rotate right / shift right of the 64-bit word (h, l), returned as hi then lo.
    const rotrH = (h, l, n) => (n < 32 ? (h >>> n) | (l << (32 - n)) : (l >>> (n - 32)) | (h << (64 - n)));
    const rotrL = (h, l, n) => (n < 32 ? (l >>> n) | (h << (32 - n)) : (h >>> (n - 32)) | (l << (64 - n)));
    const shrH = (h, l, n) => h >>> n;
    const shrL = (h, l, n) => (l >>> n) | (h << (32 - n));

    for (let t = 16; t < 80; t++) {
      const h15 = W[2 * (t - 15)], l15 = W[2 * (t - 15) + 1];
      const h2 = W[2 * (t - 2)], l2 = W[2 * (t - 2) + 1];
      const s0h = rotrH(h15, l15, 1) ^ rotrH(h15, l15, 8) ^ shrH(h15, l15, 7);
      const s0l = rotrL(h15, l15, 1) ^ rotrL(h15, l15, 8) ^ shrL(h15, l15, 7);
      const s1h = rotrH(h2, l2, 19) ^ rotrH(h2, l2, 61) ^ shrH(h2, l2, 6);
      const s1l = rotrL(h2, l2, 19) ^ rotrL(h2, l2, 61) ^ shrL(h2, l2, 6);
      const lo = (W[2 * (t - 16) + 1] >>> 0) + (s0l >>> 0) + (W[2 * (t - 7) + 1] >>> 0) + (s1l >>> 0);
      W[2 * t] = W[2 * (t - 16)] + s0h + W[2 * (t - 7)] + s1h + Math.floor(lo / 2 ** 32);
      W[2 * t + 1] = lo;
    }

    const v = state.slice(); // a..h as 16 ints
    for (let t = 0; t < 80; t++) {
      const [ah, al, bh, bl, ch, cl, dh, dl, eh, el, fh, fl, gh, gl, hh, hl] = v;
      const S1h = rotrH(eh, el, 14) ^ rotrH(eh, el, 18) ^ rotrH(eh, el, 41);
      const S1l = rotrL(eh, el, 14) ^ rotrL(eh, el, 18) ^ rotrL(eh, el, 41);
      const chh = (eh & fh) ^ (~eh & gh);
      const chl = (el & fl) ^ (~el & gl);
      const t1l = (hl >>> 0) + (S1l >>> 0) + (chl >>> 0) + (K512[2 * t + 1] >>> 0) + (W[2 * t + 1] >>> 0);
      const t1h = hh + S1h + chh + K512[2 * t] + W[2 * t] + Math.floor(t1l / 2 ** 32);
      const S0h = rotrH(ah, al, 28) ^ rotrH(ah, al, 34) ^ rotrH(ah, al, 39);
      const S0l = rotrL(ah, al, 28) ^ rotrL(ah, al, 34) ^ rotrL(ah, al, 39);
      const majh = (ah & bh) ^ (ah & ch) ^ (bh & ch);
      const majl = (al & bl) ^ (al & cl) ^ (bl & cl);
      const t2l = (S0l >>> 0) + (majl >>> 0);
      const t2h = S0h + majh + Math.floor(t2l / 2 ** 32);
      const el2 = (dl >>> 0) + (t1l >>> 0);
      const al2 = (t1l >>> 0) + (t2l >>> 0);
      v[15] = gl; v[14] = gh; v[13] = fl; v[12] = fh; v[11] = el; v[10] = eh;
      v[9] = el2; v[8] = dh + t1h + Math.floor(el2 / 2 ** 32);
      v[7] = cl; v[6] = ch; v[5] = bl; v[4] = bh; v[3] = al; v[2] = ah;
      v[1] = al2; v[0] = t1h + t2h + Math.floor(al2 / 2 ** 32);
    }
    for (let i = 0; i < 16; i += 2) {
      const lo = (state[i + 1] >>> 0) + (v[i + 1] >>> 0);
      state[i] = state[i] + v[i] + Math.floor(lo / 2 ** 32);
      state[i + 1] = lo;
    }
  }

  // Hash `data` starting from `state`, where `prefixLen` bytes were already absorbed.
  function sha512Finish(state, data, prefixLen = 0) {
    const total = prefixLen + data.length;
    const padded = new Uint8Array(Math.ceil((data.length + 17) / 128) * 128);
    padded.set(data);
    padded[data.length] = 0x80;
    const view = new DataView(padded.buffer);
    view.setUint32(padded.length - 8, Math.floor((total * 8) / 2 ** 32));
    view.setUint32(padded.length - 4, (total * 8) >>> 0);
    for (let off = 0; off < padded.length; off += 128) sha512Compress(state, padded, off);
    const out = new Uint8Array(64);
    const ov = new DataView(out.buffer);
    state.forEach((x, i) => ov.setInt32(4 * i, x));
    return out;
  }

  const sha512 = (msg) => sha512Finish(IV512.slice(), msg);

  // HMAC-SHA512 with the key blocks pre-hashed, so PBKDF2 can reuse them.
  function hmacSha512Key(key) {
    let k = key.length > 128 ? sha512(key) : key;
    const block = new Uint8Array(128);
    block.set(k);
    const inner = IV512.slice();
    const outer = IV512.slice();
    sha512Compress(inner, block.map((b) => b ^ 0x36), 0);
    sha512Compress(outer, block.map((b) => b ^ 0x5c), 0);
    return (msg) => sha512Finish(outer.slice(), sha512Finish(inner.slice(), msg, 128), 128);
  }
  const hmacSha512 = (key, msg) => hmacSha512Key(key)(msg);

  // PBKDF2-HMAC-SHA512 producing one 64-byte block (all BIP-39 needs).
  function pbkdf2Sha512(password, salt, iterations) {
    const mac = hmacSha512Key(password);
    let u = mac(concat(salt, ser32(1)));
    const out = u.slice();
    for (let i = 1; i < iterations; i++) {
      u = mac(u);
      for (let j = 0; j < 64; j++) out[j] ^= u[j];
    }
    return out;
  }

  // ------------------------------------------------------------- Keccak
  // Lanes are BigInt; constants are generated from the specification.

  const MASK64 = (1n << 64n) - 1n;
  const KECCAK_RC = (() => {
    const rcBit = (t) => {
      let r = 1;
      for (let i = 0; i < t % 255; i++) {
        r <<= 1;
        if (r & 0x100) r ^= 0x171;
      }
      return BigInt(r & 1);
    };
    return Array.from({ length: 24 }, (_, ir) => {
      let rc = 0n;
      for (let j = 0; j <= 6; j++) rc |= rcBit(j + 7 * ir) << BigInt(2 ** j - 1);
      return rc;
    });
  })();
  const KECCAK_ROT = (() => {
    const rot = Array(25).fill(0);
    let x = 1, y = 0;
    for (let t = 0; t < 24; t++) {
      rot[x + 5 * y] = (((t + 1) * (t + 2)) / 2) % 64;
      [x, y] = [y, (2 * x + 3 * y) % 5];
    }
    return rot.map(BigInt);
  })();

  const rotl64 = (v, n) => (n === 0n ? v : ((v << n) | (v >> (64n - n))) & MASK64);

  function keccakF(A) {
    for (let round = 0; round < 24; round++) {
      const C = [0, 1, 2, 3, 4].map((x) => A[x] ^ A[x + 5] ^ A[x + 10] ^ A[x + 15] ^ A[x + 20]);
      for (let x = 0; x < 5; x++) {
        const D = C[(x + 4) % 5] ^ rotl64(C[(x + 1) % 5], 1n);
        for (let y = 0; y < 25; y += 5) A[x + y] ^= D;
      }
      const B = Array(25);
      for (let x = 0; x < 5; x++) {
        for (let y = 0; y < 5; y++) B[y + 5 * ((2 * x + 3 * y) % 5)] = rotl64(A[x + 5 * y], KECCAK_ROT[x + 5 * y]);
      }
      for (let y = 0; y < 25; y += 5) {
        for (let x = 0; x < 5; x++) A[x + y] = B[x + y] ^ (~B[((x + 1) % 5) + y] & MASK64 & B[((x + 2) % 5) + y]);
      }
      A[0] ^= KECCAK_RC[round];
    }
  }

  // Sponge with rate 136 bytes (256-bit output). The only difference between
  // Keccak-256 and SHA3-256 is the domain byte: 0x01 vs 0x06.
  function sponge256(msg, domain) {
    const rate = 136;
    const padded = new Uint8Array(Math.floor(msg.length / rate + 1) * rate);
    padded.set(msg);
    padded[msg.length] ^= domain;
    padded[padded.length - 1] ^= 0x80;
    const A = Array(25).fill(0n);
    for (let off = 0; off < padded.length; off += rate) {
      for (let i = 0; i < rate / 8; i++) {
        let lane = 0n;
        for (let b = 7; b >= 0; b--) lane = (lane << 8n) | BigInt(padded[off + 8 * i + b]);
        A[i] ^= lane;
      }
      keccakF(A);
    }
    const out = new Uint8Array(32);
    for (let i = 0; i < 4; i++) {
      for (let b = 0; b < 8; b++) out[8 * i + b] = Number((A[i] >> BigInt(8 * b)) & 0xffn);
    }
    return out;
  }
  const keccak256 = (msg) => sponge256(msg, 0x01);
  const sha3_256 = (msg) => sponge256(msg, 0x06);

  // ------------------------------------------------------------- secp256k1
  // y² = x³ + 7 over F_p. Points in Jacobian coordinates {X, Y, Z}; Z = 0 is O.

  const P = 2n ** 256n - 2n ** 32n - 977n;
  const N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;
  const G = {
    X: 0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798n,
    Y: 0x483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8n,
    Z: 1n,
  };
  const md = (a, m = P) => { const r = a % m; return r < 0n ? r + m : r; };

  function modInv(a, m = P) {
    let [r0, r1, s0, s1] = [md(a, m), m, 1n, 0n];
    while (r1 !== 0n) {
      const q = r0 / r1;
      [r0, r1] = [r1, r0 - q * r1];
      [s0, s1] = [s1, s0 - q * s1];
    }
    return md(s0, m);
  }

  function pointDouble({ X, Y, Z }) {
    if (Z === 0n || Y === 0n) return { X: 0n, Y: 1n, Z: 0n };
    const A = md(X * X), B = md(Y * Y), C = md(B * B);
    const D = md(2n * (md((X + B) ** 2n) - A - C));
    const E = 3n * A, F = md(E * E);
    const X3 = md(F - 2n * D);
    return { X: X3, Y: md(E * (D - X3) - 8n * C), Z: md(2n * Y * Z) };
  }

  function pointAdd(p1, p2) {
    if (p1.Z === 0n) return p2;
    if (p2.Z === 0n) return p1;
    const Z1Z1 = md(p1.Z * p1.Z), Z2Z2 = md(p2.Z * p2.Z);
    const U1 = md(p1.X * Z2Z2), U2 = md(p2.X * Z1Z1);
    const S1 = md(p1.Y * p2.Z * Z2Z2), S2 = md(p2.Y * p1.Z * Z1Z1);
    const H = md(U2 - U1), r = md(2n * (S2 - S1));
    if (H === 0n) return r === 0n ? pointDouble(p1) : { X: 0n, Y: 1n, Z: 0n };
    const I = md(4n * H * H), J = md(H * I), V = md(U1 * I);
    const X3 = md(r * r - J - 2n * V);
    return {
      X: X3,
      Y: md(r * (V - X3) - 2n * S1 * J),
      Z: md((md((p1.Z + p2.Z) ** 2n) - Z1Z1 - Z2Z2) * H),
    };
  }

  // Q = kG by double-and-add, returned in affine coordinates {x, y}.
  function pointMultiply(k) {
    let R = { X: 0n, Y: 1n, Z: 0n };
    for (const bit of k.toString(2)) {
      R = pointDouble(R);
      if (bit === "1") R = pointAdd(R, G);
    }
    const zi = modInv(R.Z);
    return { x: md(R.X * zi * zi), y: md(R.Y * zi * zi * zi) };
  }

  function publicKey(privBytes) {
    const k = bytesToBig(privBytes);
    if (k <= 0n || k >= N) throw new Error("Private key out of range 1..n-1");
    const { x, y } = pointMultiply(k);
    const xb = bigToBytes(x), yb = bigToBytes(y);
    return {
      x: xb,
      y: yb,
      uncompressed: concat([0x04], xb, yb),
      compressed: concat([y % 2n === 0n ? 0x02 : 0x03], xb),
    };
  }

  // ------------------------------------------------------------- BIP-39

  const words = () => global.BIP39_WORDLIST;

  function bitsOf(bytes) {
    return Array.from(bytes, (b) => b.toString(2).padStart(8, "0")).join("");
  }

  // Entropy (16..32 bytes) -> mnemonic: append ENT/32 checksum bits of SHA-256, split into 11-bit words.
  function entropyToMnemonic(entropy) {
    const entBits = bitsOf(entropy);
    const csLen = entropy.length * 8 / 32;
    const checksum = bitsOf(sha256(entropy)).slice(0, csLen);
    const all = entBits + checksum;
    const indices = [];
    for (let i = 0; i < all.length; i += 11) indices.push(parseInt(all.slice(i, i + 11), 2));
    return { phrase: indices.map((i) => words()[i]).join(" "), indices, checksum };
  }

  function normalizePhrase(phrase) {
    return phrase.normalize("NFKD").trim().toLowerCase().split(/\s+/).filter(Boolean);
  }

  // Mnemonic -> entropy, verifying words and checksum.
  function mnemonicToEntropy(phrase) {
    const list = normalizePhrase(phrase);
    if (![12, 15, 18, 21, 24].includes(list.length)) {
      return { ok: false, error: `A mnemonic has 12, 15, 18, 21 or 24 words (got ${list.length}).` };
    }
    const indices = list.map((w) => words().indexOf(w));
    const unknown = list.filter((w, i) => indices[i] < 0);
    if (unknown.length) return { ok: false, error: `Not in the BIP-39 wordlist: ${unknown.join(", ")}` };
    const bits = indices.map((i) => i.toString(2).padStart(11, "0")).join("");
    const csLen = list.length * 11 / 33;
    const entBits = bits.slice(0, bits.length - csLen);
    const entropy = new Uint8Array(entBits.length / 8);
    for (let i = 0; i < entropy.length; i++) entropy[i] = parseInt(entBits.slice(8 * i, 8 * i + 8), 2);
    const checksum = bits.slice(-csLen);
    const expected = bitsOf(sha256(entropy)).slice(0, csLen);
    return { ok: checksum === expected, entropy, indices, checksum, expected, words: list,
      error: checksum === expected ? null : "Checksum mismatch: this is not a valid BIP-39 mnemonic." };
  }

  // Mnemonic (+ optional passphrase) -> 64-byte seed: PBKDF2-HMAC-SHA512, 2048 rounds.
  function mnemonicToSeed(phrase, passphrase = "") {
    const sentence = normalizePhrase(phrase).join(" ");
    return pbkdf2Sha512(utf8(sentence), utf8(("mnemonic" + passphrase).normalize("NFKD")), 2048);
  }

  // ------------------------------------------------------------- BIP-32 / BIP-44

  const HARDENED = 0x80000000;

  function masterKey(seed) {
    const I = hmacSha512(utf8("Bitcoin seed"), seed);
    return { key: I.slice(0, 32), chainCode: I.slice(32) };
  }

  // CKDpriv: child private key number `index` of the node {key, chainCode}.
  function childKey(node, index) {
    const hardened = index >= HARDENED;
    const data = hardened
      ? concat([0x00], node.key, ser32(index)) // hardened: uses the parent PRIVATE key
      : concat(publicKey(node.key).compressed, ser32(index)); // normal: uses the parent PUBLIC key
    const I = hmacSha512(node.chainCode, data);
    const IL = bytesToBig(I.slice(0, 32));
    const child = md(IL + bytesToBig(node.key), N);
    if (IL >= N || child === 0n) throw new Error("Invalid child key (probability < 2^-127), use the next index");
    return { key: bigToBytes(child), chainCode: I.slice(32), hardened };
  }

  function parsePath(path) {
    const parts = path.trim().split("/");
    if (parts[0] !== "m") throw new Error("A derivation path starts with m");
    return parts.slice(1).map((p) => {
      const m = /^(\d+)('?)$/.exec(p);
      if (!m || Number(m[1]) >= HARDENED) throw new Error(`Bad path element: ${p}`);
      return { label: p, index: Number(m[1]) + (m[2] ? HARDENED : 0) };
    });
  }

  // All the nodes along the path: [{label, key, chainCode}, ...].
  function derivePath(seed, path) {
    let node = masterKey(seed);
    const levels = [{ label: "m", ...node }];
    for (const { label, index } of parsePath(path)) {
      node = childKey(node, index);
      levels.push({ label, index, ...node });
    }
    return levels;
  }

  // ------------------------------------------------------------- Ethereum

  // Address: last 20 bytes of Keccak-256 of the 64-byte public key (x || y).
  function addressFromPublicKey(pub) {
    const hash = keccak256(concat(pub.x, pub.y));
    return { hash, address: toHex(hash.slice(12)) };
  }

  // EIP-55: uppercase each letter whose nibble in keccak256(lowercase address) is >= 8.
  function toChecksumAddress(addressHex) {
    const lower = addressHex.replace(/^0x/, "").toLowerCase();
    const hash = toHex(keccak256(utf8(lower)));
    let out = "";
    for (let i = 0; i < lower.length; i++) {
      out += parseInt(hash[i], 16) >= 8 ? lower[i].toUpperCase() : lower[i];
    }
    return { address: "0x" + out, hash };
  }

  function isValidChecksumAddress(address) {
    if (!/^0x[0-9a-fA-F]{40}$/.test(address)) return false;
    return toChecksumAddress(address).address === address;
  }

  // The whole pipeline in one call.
  function walletFromMnemonic(phrase, passphrase = "", path = "m/44'/60'/0'/0/0") {
    const seed = mnemonicToSeed(phrase, passphrase);
    const levels = derivePath(seed, path);
    const privateKey = levels.at(-1).key;
    const pub = publicKey(privateKey);
    const { hash, address } = addressFromPublicKey(pub);
    return { seed, levels, privateKey, publicKey: pub, keccak: hash, address,
      checksummed: toChecksumAddress(address).address };
  }

  global.WalletCrypto = {
    utf8, toHex, fromHex, concat, bitsOf,
    sha256, sha512, hmacSha512, pbkdf2Sha512, keccak256, sha3_256,
    curve: { P, N, G }, publicKey,
    entropyToMnemonic, mnemonicToEntropy, mnemonicToSeed, normalizePhrase,
    masterKey, childKey, derivePath, parsePath, HARDENED,
    addressFromPublicKey, toChecksumAddress, isValidChecksumAddress, walletFromMnemonic,
  };
})(window);
