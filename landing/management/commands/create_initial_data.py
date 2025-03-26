from django.core.management.base import BaseCommand
from landing.models import EJeepLine, EJeepStop

class Command(BaseCommand):
    help = 'Creates initial data for EJeep lines and stops'

    def handle(self, *args, **kwargs):
        # Create Line A
        line_a, created_a = EJeepLine.objects.get_or_create(
            name='A',
            defaults={'description': 'Line A covers Gate 1, JSEC, Old Rizal Library, Xavier Hall, Cervini Hall, LHS, and Old Comm.'}
        )
        
        if created_a:
            self.stdout.write(self.style.SUCCESS(f'Created Line A'))
        else:
            self.stdout.write(self.style.WARNING(f'Line A already exists'))
        
        # Create Line B
        line_b, created_b = EJeepLine.objects.get_or_create(
            name='B',
            defaults={'description': 'Line B covers FLC, JHS, Bellarmine Hall, Cervini Hall, Xavier Hall, SDC, Northwest, and Leong Hall.'}
        )
        
        if created_b:
            self.stdout.write(self.style.SUCCESS(f'Created Line B'))
        else:
            self.stdout.write(self.style.WARNING(f'Line B already exists'))
        
        # Create stops for Line A
        line_a_stops = [
            {'name': 'Gate 1', 'latitude': 14.6385, 'longitude': 121.0775, 'order': 1},
            {'name': 'JSEC', 'latitude': 14.6390, 'longitude': 121.0765, 'order': 2},
            {'name': 'Old Rizal Library', 'latitude': 14.6395, 'longitude': 121.0760, 'order': 3},
            {'name': 'Xavier Hall', 'latitude': 14.6400, 'longitude': 121.0755, 'order': 4},
            {'name': 'Cervini Hall', 'latitude': 14.6405, 'longitude': 121.0750, 'order': 5},
            {'name': 'LHS', 'latitude': 14.6410, 'longitude': 121.0745, 'order': 6},
            {'name': 'Old Comm', 'latitude': 14.6415, 'longitude': 121.0740, 'order': 7},
        ]
        
        for stop_data in line_a_stops:
            stop, created = EJeepStop.objects.get_or_create(
                name=stop_data['name'],
                line=line_a,
                defaults={
                    'latitude': stop_data['latitude'],
                    'longitude': stop_data['longitude'],
                    'order': stop_data['order'],
                }
            )
            
            if created:
                self.stdout.write(self.style.SUCCESS(f'Created stop: {stop.name} for Line A'))
            else:
                self.stdout.write(self.style.WARNING(f'Stop {stop.name} for Line A already exists'))
        
        # Create stops for Line B
        line_b_stops = [
            {'name': 'FLC', 'latitude': 14.6380, 'longitude': 121.0780, 'order': 1},
            {'name': 'JHS', 'latitude': 14.6385, 'longitude': 121.0775, 'order': 2},
            {'name': 'Bellarmine Hall', 'latitude': 14.6390, 'longitude': 121.0770, 'order': 3},
            {'name': 'Cervini Hall', 'latitude': 14.6395, 'longitude': 121.0765, 'order': 4},
            {'name': 'Xavier Hall', 'latitude': 14.6400, 'longitude': 121.0760, 'order': 5},
            {'name': 'SDC', 'latitude': 14.6405, 'longitude': 121.0755, 'order': 6},
            {'name': 'Northwest', 'latitude': 14.6410, 'longitude': 121.0750, 'order': 7},
            {'name': 'Leong Hall', 'latitude': 14.6415, 'longitude': 121.0745, 'order': 8},
        ]
        
        for stop_data in line_b_stops:
            stop, created = EJeepStop.objects.get_or_create(
                name=stop_data['name'],
                line=line_b,
                defaults={
                    'latitude': stop_data['latitude'],
                    'longitude': stop_data['longitude'],
                    'order': stop_data['order'],
                }
            )
            
            if created:
                self.stdout.write(self.style.SUCCESS(f'Created stop: {stop.name} for Line B'))
            else:
                self.stdout.write(self.style.WARNING(f'Stop {stop.name} for Line B already exists'))
        
        self.stdout.write(self.style.SUCCESS('Initial data creation completed'))