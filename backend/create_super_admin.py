import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'emr_backend.settings')
django.setup()

from accounts.models import User

def create_super_admin():
    username = 'admin'
    email = 'admin@emr.com'
    password = 'adminpassword123'
    
    if not User.objects.filter(username=username).exists():
        User.objects.create_superuser(
            username=username,
            email=email,
            password=password,
            role='ADMIN',
            first_name='System',
            last_name='Administrator'
        )
        print(f"Superuser '{username}' created successfully.")
    else:
        print(f"Superuser '{username}' already exists.")

if __name__ == '__main__':
    create_super_admin()
