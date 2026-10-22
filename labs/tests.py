from django.test import TestCase
from django.urls import reverse

from .registry import LABS


class LabsViewsTests(TestCase):
    def test_home_links_every_lab(self):
        response = self.client.get(reverse("labs:home"))
        self.assertEqual(response.status_code, 200)
        for lab in LABS:
            self.assertContains(response, reverse("labs:lab_detail", args=[lab["slug"]]))

    def test_each_lab_page_renders(self):
        for lab in LABS:
            response = self.client.get(reverse("labs:lab_detail", args=[lab["slug"]]))
            self.assertEqual(response.status_code, 200)
            self.assertContains(response, lab["subtitle"])

    def test_lab1_loads_keygen_script(self):
        response = self.client.get(reverse("labs:lab_detail", args=["lab1"]))
        self.assertContains(response, "labs/lab1/keygen.js")

    def test_lab2_loads_wallet_scripts(self):
        response = self.client.get(reverse("labs:lab_detail", args=["lab2"]))
        for script in ("wordlist.js", "crypto.js", "pipeline.js", "stats.js"):
            self.assertContains(response, f"labs/lab2/{script}")

    def test_lab3_loads_elgamal_script(self):
        response = self.client.get(reverse("labs:lab_detail", args=["lab3"]))
        self.assertContains(response, "labs/lab3/elgamal.js")
        self.assertContains(response, "labs/lab3/caesar.js")
        self.assertContains(response, "labs/lab3/cryptanalysis.js")

    def test_unknown_lab_returns_404(self):
        response = self.client.get(reverse("labs:lab_detail", args=["lab999"]))
        self.assertEqual(response.status_code, 404)
