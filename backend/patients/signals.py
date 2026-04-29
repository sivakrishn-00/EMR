from django.db.models.signals import post_migrate
from django.dispatch import receiver
from django.apps import AppConfig

@receiver(post_migrate)
def create_standard_registries(sender, **kwargs):
    if sender.name == 'patients':
        from patients.models import Project, RegistryType, RegistryField
        
        # We only apply this to the AP-GENCO project as per user request
        genco_project = Project.objects.filter(name__icontains='AP-GENCO').first()
        if genco_project:
            rt, _ = RegistryType.objects.get_or_create(
                project=genco_project,
                slug='employee_master',
                defaults={
                    'name': 'Unified Master Registry',
                    'type_category': 'PERSONNEL_PRIMARY',
                    'description': 'Direct staff and family dependency uploads (Unified Protocol)',
                    'coverage': 'ENTIRE ECOSYSTEM',
                    'icon': 'Users',
                    'color': '#6366f1'
                }
            )
            
            # Add default fields for the Unified Master Registry (ALWAYS ensure they exist)
            default_fields = [
                ('Card No', 'card_no', 'VARCHAR', 0),
                ('Name', 'name', 'VARCHAR', 1),
                ('Gender', 'gender', 'VARCHAR', 2),
                ('DOB', 'dob', 'DATE', 3),
                ('Mobile No', 'mobile_no', 'VARCHAR', 4),
                ('Aadhar No', 'aadhar_no', 'VARCHAR', 5),
                ('Address', 'address', 'VARCHAR', 6),
                ('Relationship', 'relationship', 'VARCHAR', 7),
                ('Designation', 'designation', 'VARCHAR', 8),
            ]
            
            for label, slug, dtype, order in default_fields:
                RegistryField.objects.get_or_create(
                    registry_type=rt,
                    slug=slug,
                    defaults={
                        'label': label,
                        'data_type': dtype,
                        'order': order,
                        'is_required': True
                    }
                )
            
            print(f"Standard registries and fields ensured for {genco_project.name}")

# --- BILLION SCALE SYNC TRIGGERS ---
from django.db.models.signals import post_save
from .tasks import sync_patient_dossier_task

def trigger_dossier_map(instance, created, **kwargs):
    """Universal Trigger to refresh the MongoDB Dossier"""
    if hasattr(instance, 'patient') and instance.patient and instance.patient.patient_id:
        try:
            sync_patient_dossier_task.delay(instance.patient.patient_id)
        except Exception as e:
            # Prevent system crash if Redis/Celery is unreachable
            print(f"RESILIENCE: Background dossier sync skipped due to connection failure: {e}")

@receiver(post_save, sender='clinical.Visit')
def sync_visit_to_dossier(sender, instance, created, **kwargs):
    trigger_dossier_map(instance, created)

@receiver(post_save, sender='laboratory.LabRequest')
def sync_lab_to_dossier(sender, instance, created, **kwargs):
    trigger_dossier_map(instance, created)

@receiver(post_save, sender='pharmacy.Prescription')
def sync_pharmacy_to_dossier(sender, instance, created, **kwargs):
    trigger_dossier_map(instance, created)
