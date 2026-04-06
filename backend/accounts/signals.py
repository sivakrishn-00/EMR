from django.db.models.signals import post_migrate
from django.dispatch import receiver
from django.conf import settings

@receiver(post_migrate)
def create_default_superuser(sender, **kwargs):
    # Only run for the accounts app to avoid multiple triggers
    if sender.name == 'accounts':
        from accounts.models import User, UserRole
        
        # Ensure all default roles exist
        default_roles = [
            ('ADMIN', 'System Administrator with full access'),
            ('DOCTOR', 'Medical practitioner'),
            ('NURSE', 'Nursing staff'),
            ('DEO', 'Data Entry Operator'),
            ('LAB_TECH', 'Laboratory Technician'),
            ('PHARMACIST', 'Pharmacy staff'),
            ('PATIENT', 'Patient with basic access')
        ]
        
        for name, description in default_roles:
            UserRole.objects.get_or_create(
                name=name, 
                defaults={'description': description}
            )
        
        # Specifically fetch ADMIN role for superuser assignment
        admin_role = UserRole.objects.get(name='ADMIN')
        
        username = 'admin'
        email = 'admin@emr.com'
        password = 'adminemr@123'
        
        if not User.objects.filter(username=username).exists():
            admin_user = User.objects.create_superuser(
                username=username,
                email=email,
                password=password,
                role='ADMIN',
                first_name='System',
                last_name='Administrator'
            )
            admin_user.user_roles.add(admin_role)
            print(f"Default superuser '{username}' created successfully via post_migrate signal.")
        else:
            print(f"Default superuser '{username}' already exists.")
