from django.urls import path

from . import views

app_name = "labs"

urlpatterns = [
    path("", views.home, name="home"),
    path("<slug:slug>/", views.lab_detail, name="lab_detail"),
]
