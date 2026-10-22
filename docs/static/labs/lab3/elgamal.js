// Toy EC-ElGamal on the Lab 1 curve: y^2 = x^3 + 7 (mod 17), base point G = (1, 5).
// A point is {x, y}; null stands for O, the "point at infinity".
const p = 17;
const G = { x: 1, y: 5 };

function mod(n) {
  return ((n % p) + p) % p;
}

function inverse(n) {
  for (let i = 1; i < p; i++) {
    if (mod(n * i) === 1) return i;
  }
}

function add(P, Q) {
  if (P === null) return Q;
  if (Q === null) return P;
  if (P.x === Q.x && mod(P.y + Q.y) === 0) return null;
  let lambda;
  if (P.x === Q.x && P.y === Q.y) {
    lambda = mod(3 * P.x * P.x * inverse(2 * P.y));
  } else {
    lambda = mod((Q.y - P.y) * inverse(Q.x - P.x));
  }
  const x = mod(lambda * lambda - P.x - Q.x);
  const y = mod(lambda * (P.x - x) - P.y);
  return { x, y };
}

function neg(P) {
  return P === null ? null : { x: P.x, y: mod(-P.y) };
}

// Scalar multiplication kP by repeated addition (the group is tiny).
function mul(k, P) {
  let R = null;
  for (let i = 0; i < k; i++) R = add(R, P);
  return R;
}

function show(P) {
  return P === null ? "O" : `(${P.x}, ${P.y})`;
}

// Order of G: smallest n with nG = O.
let n = 1;
while (mul(n, G) !== null) n++;

// The curve has 17 affine points (18 with O). The first 16 in (x, y) order are the "alphabet":
// a nibble (0-15) is encoded as the point ALPHABET[m]. They need not lie in <G>.
const ALPHABET = [];
for (let x = 0; x < p; x++) {
  for (let y = 0; y < p; y++) {
    if (mod(y * y - x * x * x - 7) === 0 && ALPHABET.length < 16) ALPHABET.push({ x, y });
  }
}

function samePoint(P, Q) {
  return P !== null && Q !== null && P.x === Q.x && P.y === Q.y;
}

function nibbles(text) {
  const out = [];
  for (const byte of new TextEncoder().encode(text)) out.push(byte >> 4, byte & 15);
  return out;
}

function fromNibbles(list) {
  const bytes = [];
  for (let i = 0; i + 1 < list.length; i += 2) bytes.push((list[i] << 4) | list[i + 1]);
  return new TextDecoder().decode(new Uint8Array(bytes));
}

function randomScalar() {
  return 1 + Math.floor(Math.random() * (n - 1));
}

function encrypt(text, Q) {
  return nibbles(text).map((m) => {
    const r = randomScalar(); // fresh ephemeral secret for every block
    return { m, r, M: ALPHABET[m], C1: mul(r, G), C2: add(ALPHABET[m], mul(r, Q)) };
  });
}

function decrypt(cipher, d) {
  return cipher.map((c) => {
    const S = mul(d, c.C1); // shared secret dC1 = rQ
    const M = add(c.C2, neg(S));
    return { S, M, m: ALPHABET.findIndex((A) => samePoint(A, M)) };
  });
}

const $ = (id) => document.getElementById(id);
let current = null;

function render() {
  const d = Number($("d").value);
  const text = $("msg").value;
  const out = $("output");
  if (!Number.isInteger(d) || d < 1 || d >= n) {
    out.textContent = `Please enter a private key d between 1 and ${n - 1}.`;
    return;
  }
  if (!text) {
    out.textContent = "Please enter a message.";
    return;
  }
  const Q = mul(d, G);
  const cipher = encrypt(text, Q);
  const plain = decrypt(cipher, d);
  const ok = plain.every((x) => x.m >= 0);
  const decoded = ok ? fromNibbles(plain.map((x) => x.m)) : "(decoding failed)";

  const lines = [
    `Curve y² = x³ + 7 (mod ${p}), G = ${show(G)}, order n = ${n}`,
    "",
    "KEY GENERATION (Bob)",
    `  private key d = ${d}`,
    `  public key  Q = dG = ${show(Q)}`,
    "",
    `ENCRYPTION (Alice, uses only Q) — ${cipher.length} blocks of 4 bits`,
  ];
  cipher.forEach((c, i) => {
    lines.push(
      `  #${i + 1}  m=${c.m} → M=${show(c.M)}  r=${c.r}  C1=rG=${show(c.C1)}  C2=M+rQ=${show(c.C2)}`
    );
  });
  lines.push("", "DECRYPTION (Bob, uses d)");
  plain.forEach((x, i) => {
    lines.push(`  #${i + 1}  dC1=${show(x.S)}  M=C2−dC1=${show(x.M)} → m=${x.m}`);
  });
  lines.push("", `Decrypted message: "${decoded}"  ${decoded === text ? "✓ matches" : "✗ differs"}`);
  out.textContent = lines.join("\n");
  current = { cipher, Q };
}

$("enc").addEventListener("submit", (event) => {
  event.preventDefault();
  render();
});

// Eve tries a wrong private key on the last ciphertext.
$("eve").addEventListener("submit", (event) => {
  event.preventDefault();
  const res = $("eve-out");
  if (!current) {
    res.textContent = "Run the encryption above first.";
    return;
  }
  const d = Number($("d-wrong").value);
  if (!Number.isInteger(d) || d < 1 || d >= n) {
    res.textContent = `Please enter a guess between 1 and ${n - 1}.`;
    return;
  }
  const plain = decrypt(current.cipher, d);
  res.textContent = plain.every((x) => x.m >= 0)
    ? `With d = ${d}: "${fromNibbles(plain.map((x) => x.m))}"`
    : `With d = ${d}: garbage (not even valid blocks)`;
});
