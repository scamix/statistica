// Toy elliptic curve: y^2 = x^3 + 7 (mod 17), base point G = (1, 5).
// A point is {x, y}; null stands for O, the "point at infinity".
const p = 17;
const a = 0;
const G = { x: 1, y: 5 };

// Remainder that is never negative, e.g. mod(-3) = 14.
function mod(n) {
  return ((n % p) + p) % p;
}

// Modular inverse: the number i with n * i ≡ 1 (mod p). Brute force is fine for small p.
function inverse(n) {
  for (let i = 1; i < p; i++) {
    if (mod(n * i) === 1) return i;
  }
}

// Point addition P + Q on the curve.
function add(P, Q) {
  if (P === null) return Q;
  if (Q === null) return P;
  if (P.x === Q.x && mod(P.y + Q.y) === 0) return null; // vertical line -> O

  let lambda; // slope of the line through P and Q
  if (P.x === Q.x && P.y === Q.y) {
    lambda = mod((3 * P.x * P.x + a) * inverse(2 * P.y)); // tangent (P = Q)
  } else {
    lambda = mod((Q.y - P.y) * inverse(Q.x - P.x)); // chord (P != Q)
  }
  const x = mod(lambda * lambda - P.x - Q.x);
  const y = mod(lambda * (P.x - x) - P.y);
  return { x, y };
}

function show(P) {
  return P === null ? "O (point at infinity)" : `(${P.x}, ${P.y})`;
}

// Public key Q = kG, computed as G + G + ... + G, printing every step.
function publicKey(k) {
  const lines = [];
  let Q = G;
  lines.push(`1G = ${show(Q)}`);
  for (let i = 2; i <= k; i++) {
    Q = add(Q, G);
    lines.push(`${i}G = ${show(Q)}`);
  }
  lines.push("", `TOY PUBLIC KEY: Q = ${k}G = ${show(Q)}`);
  return lines.join("\n");
}

document.getElementById("keygen").addEventListener("submit", (event) => {
  event.preventDefault();
  const k = Number(document.getElementById("k").value);
  const out = document.getElementById("output");
  out.textContent = Number.isInteger(k) && k >= 1 && k <= 100
    ? publicKey(k)
    : "Please enter a whole number k between 1 and 100.";
});

document.getElementById("output").textContent = publicKey(6);
