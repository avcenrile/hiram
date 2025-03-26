from django.db import models
from django.contrib.auth.models import User

# Create your models here.
class CustomUser(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    is_driver = models.BooleanField(default=False)
    phone_number = models.CharField(max_length=15, blank=True, null=True)
    
    def __str__(self):
        return self.user.username

class EJeepLine(models.Model):
    LINE_CHOICES = [
        ('A', 'Line A'),
        ('B', 'Line B'),
    ]
    name = models.CharField(max_length=1, choices=LINE_CHOICES)
    description = models.TextField()
    
    def __str__(self):
        return f"EJeep {self.get_name_display()}"

class EJeepStop(models.Model):
    name = models.CharField(max_length=100)
    line = models.ForeignKey(EJeepLine, related_name='stops', on_delete=models.CASCADE)
    latitude = models.FloatField()
    longitude = models.FloatField()
    order = models.IntegerField()  # To maintain the order of stops in the line
    
    def __str__(self):
        return f"{self.name} ({self.line.get_name_display()})"
    
    class Meta:
        ordering = ['line', 'order']

class EJeepLocation(models.Model):
    line = models.ForeignKey(EJeepLine, related_name='locations', on_delete=models.CASCADE)
    driver = models.ForeignKey(CustomUser, related_name='driven_ejeeps', on_delete=models.SET_NULL, null=True, blank=True)
    latitude = models.FloatField()
    longitude = models.FloatField()
    last_updated = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True)
    heading = models.FloatField(default=0)  # Direction in degrees
    speed = models.FloatField(default=0)  # Speed in km/h
    
    def __str__(self):
        return f"{self.line.get_name_display()} EJeep at {self.last_updated.strftime('%Y-%m-%d %H:%M:%S')}"
    
    class Meta:
        ordering = ['-last_updated']