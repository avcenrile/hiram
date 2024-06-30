from django.urls import path
from . import views

# URL Config
urlpatterns = [
    # always add a forward slash at the end
    path('', views.index, name='index'),
    path('catalogue/', views.catalogue, name='catalogue')
]   