"""Registry of course labs.

To add a lab, append an entry here and create the template
``labs/templates/labs/<slug>.html``.
"""

LABS = [
    {
        "slug": "lab1",
        "title": "Lab 1",
        "subtitle": "HMWK 1 — Public-key cryptography",
        "description": "Compute G, 2G, …, kG, "
        "print the toy public key, then explore the statistics of the results.",
    },
    {
        "slug": "lab2",
        "title": "Lab 2",
        "subtitle": "HMWK 2 — From wallet seed to Ethereum address",
        "description": "BIP-39, BIP-32/44, secp256k1, Keccak-256 and EIP-55: the full wallet "
        "pipeline step by step, its history and its statistical properties.",
    },
    {
        "slug": "lab3",
        "title": "Lab 3",
        "subtitle": "HMWK 3 — Toy curve encryption vs the Caesar cipher",
        "description": "EC-ElGamal on the toy secp256k1-style curve of Lab 1: "
        "encrypt and decrypt a message, compare it with the Caesar cipher, then break Caesar with letter statistics.",
    },
    {
        "slug": "lab4",
        "title": "Lab 4",
        "subtitle": "HMWK 4 — Random walks, LLN and CLT",
        "description": "n systems and m attackers: simulate Bernoulli and Rademacher penetration scores "
        "and compare S_n, S_n/n and S_n/√n against the Law of Large Numbers and the Central Limit Theorem.",
    },
    {
        "slug": "lab5",
        "title": "Lab 5",
        "subtitle": "HMWK 5 — Welford’s recurrences, sampling mean and variance",
        "description": "Derive and code Welford’s online formulas for the sum of squares and the variance, then use them on "
        "m hackers scoring 0–10 on n systems to compare the averages of x̄ and s² with μ and σ².",
    },
    {
        "slug": "lab6",
        "title": "Lab 6",
        "subtitle": "HMWK 6 — Riemann vs Lebesgue integration, the normal CDF",
        "description": "Approximate integrals by partitioning the domain (Riemann) or the range (Lebesgue), up to the Dirichlet "
        "and Thomae functions; then compute Φ(x) numerically and see why Liouville's theorem makes erf necessary.",
    },
]


def get_lab(slug):
    return next((lab for lab in LABS if lab["slug"] == slug), None)
