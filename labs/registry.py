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
]


def get_lab(slug):
    return next((lab for lab in LABS if lab["slug"] == slug), None)
