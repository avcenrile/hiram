# Arrivo - EJeep Tracking System

Arrivo is a Django web application for tracking EJeep transportation lines in Ateneo. It provides real-time updates on the current location of EJeeps and estimates how far they are from the next stop.

## Features

- Landing page with information about Arrivo
- User authentication (login and registration)
- EJeep line selection (Line A and Line B)
- Real-time tracking with interactive maps
- Special driver accounts for updating EJeep locations
- Traffic updates integration

## How to Run Locally

1. Make sure you have Python 3.8+ installed
2. Install dependencies:
   ```
   pip install -r requirements.txt
   ```
3. Run migrations:
   ```
   python manage.py migrate
   ```
4. Create initial data (EJeep lines and stops):
   ```
   python manage.py create_initial_data
   ```
5. Start the development server:
   ```
   python manage.py runserver
   ```
6. Access the application at http://localhost:8000/landing/

## How to Check if It's Working

1. **Registration and Login**:
   - Go to http://localhost:8000/landing/register/
   - Create a new account
   - You should be redirected to the EJeep selection page after successful registration
   - Try logging out and logging back in

2. **EJeep Tracking**:
   - After logging in, select either Line A or Line B
   - You should see a map with the current location of the EJeep
   - The map should update automatically every 5 seconds

3. **Driver Functionality**:
   - Register a new account and check the "I am an EJeep driver" box
   - Log in with this account
   - When viewing the tracking page, you should see additional controls to update the EJeep location
   - Try updating the location and see if it reflects on the map

## Deployment Options

You can deploy this Django application on various platforms:

1. **PythonAnywhere**:
   - Free tier available
   - Easy setup for Django applications
   - Visit: https://www.pythonanywhere.com/

2. **Heroku**:
   - Free tier available (with limitations)
   - Supports Django applications
   - Visit: https://www.heroku.com/

3. **Railway**:
   - Modern platform with free tier
   - Good for Django applications
   - Visit: https://railway.app/
   - **Note**: Make sure all required packages are in requirements.txt (especially django-bootstrap5)

4. **DigitalOcean**:
   - Paid service with droplets starting at $5/month
   - More control over the server
   - Visit: https://www.digitalocean.com/

5. **AWS Elastic Beanstalk**:
   - Managed service from Amazon
   - Free tier available for 12 months
   - Visit: https://aws.amazon.com/elasticbeanstalk/

## Deploying to Railway

1. Create a Railway account at https://railway.app/
2. Install the Railway CLI: `npm i -g @railway/cli`
3. Login to Railway: `railway login`
4. Initialize your project: `railway init`
5. Create a PostgreSQL database: `railway add`
6. Set environment variables:
   ```
   railway variables set SECRET_KEY=your_secret_key
   railway variables set DEBUG=False
   railway variables set DATABASE_URL=${{Postgres.DATABASE_URL}}
   ```
7. Deploy your application: `railway up`
8. Open your application: `railway open`

### Troubleshooting Railway Deployment

If you encounter the error "Worker failed to boot" with "ModuleNotFoundError: No module named 'django_bootstrap5'", make sure:

1. The django-bootstrap5 package is included in your requirements.txt file
2. Run `pip install -r requirements.txt` locally to test if all packages install correctly
3. Redeploy your application after updating requirements.txt

## Deployment Steps (General)

1. Set up a production database (PostgreSQL recommended)
2. Configure environment variables for production settings
3. Set `DEBUG = False` in settings.py
4. Configure static files serving (using whitenoise or a CDN)
5. Set up HTTPS with a valid SSL certificate
6. Configure a proper web server (Nginx, Apache) with WSGI

## Additional Notes

- For production, make sure to set proper `SECRET_KEY` and other sensitive settings as environment variables
- Consider using a CDN for static files in production
- Set up regular database backups
- Configure proper logging
