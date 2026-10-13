"""Export the site as static HTML into docs/ for GitHub Pages.

Usage: .venv/bin/python build_static.py
Served at https://<user>.github.io/statistica/, so root-relative URLs get the
/statistica prefix.
"""
import os
import re
import shutil
from pathlib import Path

import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "statistica.settings")
django.setup()

from django.test import Client  # noqa: E402

from labs.registry import LABS  # noqa: E402

PREFIX = "/statistica"
OUT = Path(__file__).parent / "docs"

shutil.rmtree(OUT, ignore_errors=True)
client = Client(HTTP_HOST="localhost")
pages = {"/": OUT / "index.html"}
pages.update({f"/{lab['slug']}/": OUT / lab["slug"] / "index.html" for lab in LABS})

for url, dest in pages.items():
    html = client.get(url).content.decode()
    html = re.sub(r'(href|src)="/', rf'\1="{PREFIX}/', html)
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(html)

shutil.copytree(Path(__file__).parent / "labs" / "static", OUT / "static")
(OUT / ".nojekyll").touch()
print("Built", len(pages), "pages into", OUT)
