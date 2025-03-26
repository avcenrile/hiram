from django.urls import path
from . import views

# URL Config
urlpatterns = [
    # Landing page
    path('', views.index, name='index'),
    path('catalogue/', views.catalogue, name='catalogue'),
    
    # Authentication
    path('register/', views.register, name='register'),
    path('login/', views.login_view, name='login'),
    path('logout/', views.logout_view, name='logout'),
    
    # EJeep tracking
    path('ejeep/', views.ejeep_selection, name='ejeep_selection'),
    path('ejeep/line/<str:line_id>/', views.ejeep_tracking, name='ejeep_tracking'),
    
    # Test view
    path('test/', views.test_view, name='test_view'),
    
    # API endpoints for tracking
    path('api/ejeep/location/<str:line_id>/', views.ejeep_location_api, name='ejeep_location_api'),
    path('api/ejeep/update_location/', views.update_ejeep_location, name='update_ejeep_location'),
]