from django.http import Http404
from django.shortcuts import render

from .registry import LABS, get_lab


def home(request):
    return render(request, "labs/home.html", {"labs": LABS})


def lab_detail(request, slug):
    lab = get_lab(slug)
    if lab is None:
        raise Http404("Lab not found")
    return render(request, f"labs/{slug}.html", {"lab": lab, "labs": LABS})
