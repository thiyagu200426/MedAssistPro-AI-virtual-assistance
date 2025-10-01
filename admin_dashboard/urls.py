from django.urls import path
from . import views

urlpatterns = [
    path('analytics/', views.get_analytics, name='analytics'),
]
