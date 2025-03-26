from django.contrib import admin
from .models import CustomUser, EJeepLine, EJeepStop, EJeepLocation

# Register your models here.
admin.site.register(CustomUser)
admin.site.register(EJeepLine)
admin.site.register(EJeepStop)
admin.site.register(EJeepLocation)
