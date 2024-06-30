from django.shortcuts import render

# Create your views here.
# takes a request and returns a response (request handler)
def index(request):
    return render(request, 'home.html')

def catalogue(request):
    return render(request, 'catalogue.html')