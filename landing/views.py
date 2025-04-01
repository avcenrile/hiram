from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth import login, authenticate, logout
from django.contrib.auth.forms import UserCreationForm, AuthenticationForm
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth.models import User
from .models import CustomUser, EJeepLine, EJeepStop, EJeepLocation
import json
from datetime import datetime

# Landing page views
def index(request):
    return render(request, 'landing/index.html')

def catalogue(request):
    return render(request, 'landing/catalogue.html')

def about(request):
    return render(request, 'landing/about.html')

# Authentication views
def register(request):
    if request.method == 'POST':
        form = UserCreationForm(request.POST)
        if form.is_valid():
            user = form.save()
            # Create CustomUser profile
            is_driver = 'is_driver' in request.POST
            phone_number = request.POST.get('phone_number', '')
            CustomUser.objects.create(
                user=user,
                is_driver=is_driver,
                phone_number=phone_number
            )
            # Log the user in
            login(request, user)
            return redirect('landing:ejeep_selection')
    else:
        form = UserCreationForm()
    return render(request, 'landing/register.html', {'form': form})

def login_view(request):
    if request.method == 'POST':
        form = AuthenticationForm(data=request.POST)
        if form.is_valid():
            username = form.cleaned_data.get('username')
            password = form.cleaned_data.get('password')
            user = authenticate(username=username, password=password)
            if user is not None:
                login(request, user)
                return redirect('landing:ejeep_selection')
    else:
        form = AuthenticationForm()
    return render(request, 'landing/login.html', {'form': form})

def logout_view(request):
    logout(request)
    return redirect('landing:index')

# EJeep tracking views
def ejeep_selection(request):
    lines = EJeepLine.objects.all()
    return render(request, 'landing/ejeep_selection.html', {'lines': lines})

def ejeep_tracking(request, line_id):
    line = get_object_or_404(EJeepLine, name=line_id)
    stops = EJeepStop.objects.filter(line=line).order_by('order')
    
    # Check if user is a driver for this line
    is_driver = False
    if request.user.is_authenticated:
        try:
            custom_user = CustomUser.objects.get(user=request.user)
            is_driver = custom_user.is_driver
        except CustomUser.DoesNotExist:
            pass
    
    context = {
        'line': line,
        'stops': stops,
        'is_driver': is_driver,
    }
    return render(request, 'landing/ejeep_tracking.html', context)

# Test view
def test_view(request):
    return render(request, 'landing/ejeep_tracking.html', {
        'line': {'name': 'A'},
        'stops': [],
        'is_driver': False,
    })

# API endpoints for tracking
def ejeep_location_api(request, line_id):
    try:
        line = EJeepLine.objects.get(name=line_id)
        location = EJeepLocation.objects.filter(line=line, is_active=True).first()
        stops = EJeepStop.objects.filter(line=line).order_by('order')
        
        if location:
            location_data = {
                'latitude': location.latitude,
                'longitude': location.longitude,
                'last_updated': location.last_updated.strftime('%Y-%m-%d %H:%M:%S'),
                'heading': location.heading,
                'speed': location.speed,
            }
        else:
            location_data = None
            
        stops_data = [
            {
                'name': stop.name,
                'latitude': stop.latitude,
                'longitude': stop.longitude,
                'order': stop.order,
            } for stop in stops
        ]
        
        return JsonResponse({
            'success': True,
            'location': location_data,
            'stops': stops_data,
        })
    except EJeepLine.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'Line not found'})

@csrf_exempt
@login_required
def update_ejeep_location(request):
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'Only POST method allowed'})
    
    try:
        # Check if user is a driver
        custom_user = CustomUser.objects.get(user=request.user)
        if not custom_user.is_driver:
            return JsonResponse({'success': False, 'error': 'Only drivers can update location'})
        
        data = json.loads(request.body)
        line_id = data.get('line_id')
        latitude = data.get('latitude')
        longitude = data.get('longitude')
        heading = data.get('heading', 0)
        speed = data.get('speed', 0)
        
        if not all([line_id, latitude, longitude]):
            return JsonResponse({'success': False, 'error': 'Missing required fields'})
        
        line = EJeepLine.objects.get(name=line_id)
        
        # Update or create location
        location, created = EJeepLocation.objects.update_or_create(
            line=line,
            driver=custom_user,
            defaults={
                'latitude': latitude,
                'longitude': longitude,
                'heading': heading,
                'speed': speed,
                'is_active': True,
            }
        )
        
        return JsonResponse({
            'success': True,
            'location_id': location.id,
            'created': created,
        })
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)})