from django.db import models
from django.conf import settings

GENDER_CHOICES = (
    ('MALE', 'Male'),
    ('FEMALE', 'Female'),
    ('OTHER', 'Other'),
)

class Project(models.Model):
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True, null=True)
    logo = models.ImageField(upload_to='project_logos/', blank=True, null=True)
    primary_color = models.CharField(max_length=20, default='#1e3a8a')
    secondary_color = models.CharField(max_length=20, default='#a5b4fc')
    accent_color = models.CharField(max_length=20, default='#f43f5e')
    use_registry_for_personnel = models.BooleanField(default=False, help_text="Prioritize polymorphic registry for Staff/Family")
    allow_appointments = models.BooleanField(default=True)
    vitals_mandatory = models.BooleanField(default=True, help_text="Enforce mandatory collection of core vitals (Temp/Weight)")
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return self.name

class ProjectFieldConfig(models.Model):
    FIELD_TYPES = (
        ('VARCHAR', 'Text Field'),
        ('NUMBER', 'Numeric Value'),
        ('DATE', 'Date Picker'),
    )
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='custom_fields')
    field_name = models.CharField(max_length=50)
    field_label = models.CharField(max_length=100)
    field_type = models.CharField(max_length=20, choices=FIELD_TYPES, default='VARCHAR')
    char_length = models.IntegerField(default=100) # For VARCHAR
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = ('project', 'field_name')

    def __str__(self):
        return f"{self.project.name} - {self.field_label}"

class ProjectCategoryMapping(models.Model):
    CATEGORY_CHOICES = (
        ('EMPLOYEE', 'Employee'),
        ('FAMILY', 'Family Member'),
        ('GENERAL', 'General Patient'),
    )
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='category_mappings')
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES)

    class Meta:
        unique_together = ('project', 'category')

    def __str__(self):
        return f"{self.project.name} - {self.category}"

class EmployeeMaster(models.Model):
    project = models.ForeignKey(Project, on_delete=models.SET_NULL, null=True, blank=True, related_name='employees')
    card_no = models.CharField(max_length=20, unique=True, help_text="Primary Card Number (e.g., 0001)")
    name = models.CharField(max_length=150)
    dob = models.DateField(null=True, blank=True)
    gender = models.CharField(max_length=10, choices=GENDER_CHOICES)
    aadhar_no = models.CharField(max_length=20, unique=True, blank=True, null=True)
    mobile_no = models.CharField(max_length=15, blank=True, null=True, db_index=True)
    address = models.TextField(blank=True, null=True)
    designation = models.CharField(max_length=100, blank=True, null=True)
    additional_fields = models.JSONField(default=dict, blank=True)
    proof_image = models.ImageField(upload_to='employee_proofs/', blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.card_no} - {self.name}"

class FamilyMember(models.Model):
    RELATIONSHIP_CHOICES = (
        ('PRIMARY CARD HOLDER', 'Primary Card Holder'),
        ('SPOUSE', 'Spouse'),
        ('WIFE', 'Wife'),
        ('HUSBAND', 'Husband'),
        ('SON', 'Son'),
        ('DAUGHTER', 'Daughter'),
        ('FATHER', 'Father'),
        ('MOTHER', 'Mother'),
        ('BROTHER', 'Brother'),
        ('SISTER', 'Sister'),
        ('GRANDFATHER', 'Grandfather'),
        ('GRANDMOTHER', 'Grandmother'),
        ('OTHER', 'Other'),
    )

    employee = models.ForeignKey(EmployeeMaster, on_delete=models.CASCADE, related_name='family_members')
    card_no_suffix = models.CharField(max_length=10, help_text="e.g., /1, /2, /3")
    name = models.CharField(max_length=150)
    dob = models.DateField(null=True, blank=True)
    gender = models.CharField(max_length=10, choices=GENDER_CHOICES)
    aadhar_no = models.CharField(max_length=20, blank=True, null=True)
    mobile_no = models.CharField(max_length=15, blank=True, null=True)
    relationship = models.CharField(max_length=50, choices=RELATIONSHIP_CHOICES)
    additional_fields = models.JSONField(default=dict, blank=True)
    proof_image = models.ImageField(upload_to='family_proofs/', blank=True, null=True)

    @property
    def card_no(self):
        return f"{self.employee.card_no}{self.card_no_suffix}"

    def __str__(self):
        return f"{self.card_no} - {self.name} ({self.relationship})"

class Patient(models.Model):
    PATIENT_TYPE_CHOICES = (
        ('OPD', 'Outpatient'),
        ('IPD', 'Inpatient'),
        ('EMERGENCY', 'Emergency'),
        ('REVIEW', 'Review'),
    )

    ID_PROOF_CHOICES = (
        ('AADHAAR', 'Aadhaar Card'),
        ('VOTER_ID', 'Voter ID'),
        ('DRIVING_LICENCE', 'Driving Licence'),
        ('PASSPORT', 'Passport'),
        ('EMPLOYEE_CARD', 'Employee Card'),
    )

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='patient_profile')
    project = models.ForeignKey(Project, on_delete=models.SET_NULL, null=True, blank=True, related_name='other_patients')
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    dob = models.DateField(null=True, blank=True)
    gender = models.CharField(max_length=10, choices=GENDER_CHOICES)
    phone = models.CharField(max_length=15, blank=True, null=True, db_index=True) # Family members often share a contact number
    address = models.TextField(blank=True, null=True)
    email = models.EmailField(blank=True, null=True)
    
    # New Fields
    patient_id = models.CharField(max_length=20, unique=True, null=True, blank=True, help_text="Unique Patient ID (e.g., BHSPL0001)")
    id_proof_type = models.CharField(max_length=20, choices=ID_PROOF_CHOICES, default='AADHAAR')
    id_proof_number = models.CharField(max_length=50, unique=True, null=False, help_text="Aadhaar or primary ID number")
    abha_id = models.CharField(max_length=20, blank=True, null=True)
    patient_type = models.CharField(max_length=20, choices=PATIENT_TYPE_CHOICES, default='OPD')
    blood_group = models.CharField(max_length=10, blank=True, null=True)
    
    # Employee Fields
    is_employee_linked = models.BooleanField(default=False)
    employee_master = models.ForeignKey(EmployeeMaster, on_delete=models.SET_NULL, null=True, blank=True, related_name='patients')
    family_member = models.ForeignKey(FamilyMember, on_delete=models.SET_NULL, null=True, blank=True, related_name='patients')
    card_no = models.CharField(max_length=50, blank=True, null=True, help_text="Full Card Number (e.g., 0001/2)")
    relationship = models.CharField(max_length=50, blank=True, null=True)

    # Data Isolation Tracker
    registered_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='registered_patients')

    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if not self.patient_id:
            # Generate BHSPLXXXX
            # Correctly find the highest current BHSPL ID
            last_patient = Patient.objects.filter(patient_id__startswith='BHSPL').order_by('patient_id').last()
            if not last_patient:
                self.patient_id = 'BHSPL0001'
            else:
                try:
                    # Get the last number from the last patient_id
                    import re
                    last_id = last_patient.patient_id
                    digits = re.findall(r'\d+', last_id)
                    if digits:
                        new_num = int(digits[-1]) + 1
                    else:
                        new_num = 1
                    self.patient_id = f'BHSPL{new_num:04d}'
                except Exception as e:
                    # Generic fallback just in case
                    self.patient_id = f'BHSPL{Patient.objects.all().count() + 1:04d}'
        super(Patient, self).save(*args, **kwargs)

    def __str__(self):
        return f"{self.patient_id} ({self.first_name} {self.last_name})"

    @property
    def current_visit(self):
        return self.visits.filter(is_active=True).first()

class RegistryType(models.Model):
    TYPE_CATEGORIES = (
        ('PERSONNEL_PRIMARY', 'Personnel Main Registry'),
        ('PERSONNEL_DEPENDENT', 'Family/Dependent Mapping'),
        ('CLINICAL_REPOSITORY', 'Standard Clinical Data'),
        ('GENERAL', 'Generic Registry'),
    )
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='registry_types')
    name = models.CharField(max_length=100)
    slug = models.SlugField(max_length=100)
    type_category = models.CharField(max_length=30, choices=TYPE_CATEGORIES, default='GENERAL')
    description = models.TextField(blank=True, null=True)
    coverage = models.CharField(max_length=100, default='WORKSPACE')
    icon = models.CharField(max_length=50, default='Pill')
    color = models.CharField(max_length=20, default='#ec4899')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('project', 'slug')

    def __str__(self):
        return f"{self.project.name} - {self.name}"

class RegistryData(models.Model):
    registry_type = models.ForeignKey(RegistryType, on_delete=models.CASCADE, related_name='items')
    ucode = models.CharField(max_length=50, help_text="Common code/ID for item")
    name = models.CharField(max_length=255)
    category = models.CharField(max_length=100, blank=True, null=True)
    description = models.TextField(blank=True, null=True)
    quantity = models.IntegerField(default=0)
    cost = models.DecimalField(max_digits=15, decimal_places=2, default=0.00)
    status = models.CharField(max_length=50, default='ACTIVE')
    additional_fields = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('registry_type', 'ucode')

    def __str__(self):
        return f"{self.registry_type.name} - {self.name} ({self.ucode})"

class RegistryField(models.Model):
    FIELD_TYPES = (
        ('VARCHAR', 'VARCHAR'),
        ('INT', 'INT'),
        ('DATE', 'DATE'),
        ('BOOLEAN', 'BOOLEAN'),
    )
    registry_type = models.ForeignKey(RegistryType, on_delete=models.CASCADE, related_name='fields')
    label = models.CharField(max_length=100)
    slug = models.SlugField(max_length=100)
    data_type = models.CharField(max_length=20, choices=FIELD_TYPES, default='VARCHAR')
    is_required = models.BooleanField(default=False)
    max_length = models.IntegerField(default=255, help_text="Maximum allowed characters/length")
    order = models.IntegerField(default=0)

    class Meta:
        unique_together = ('registry_type', 'slug')
        ordering = ['order', 'id']

    def __str__(self):
        return f"{self.registry_type.name} - {self.label} ({self.data_type})"

# --- Polymorphic Synchronization Signals (Project 1) ---
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver

# --- Polymorphic Synchronization Signals ---
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver

@receiver(post_save, sender=EmployeeMaster)
def sync_employee_to_registry(sender, instance, **kwargs):
    # Dynamically find the Primary Registry for this project
    try:
        registry_types = RegistryType.objects.filter(project=instance.project, type_category='PERSONNEL_PRIMARY')
        for rt in registry_types:
            RegistryData.objects.update_or_create(
                registry_type=rt,
                ucode=instance.card_no,
                defaults={
                    'name': instance.name,
                    'category': instance.designation or 'STAFF',
                    'description': instance.address or '',
                    'additional_fields': {
                        'dob': str(instance.dob) if instance.dob else '',
                        'gender': instance.gender,
                        'aadhar_no': instance.aadhar_no or '',
                        'mobile_no': instance.mobile_no,
                        'address': instance.address or '',
                        'designation': instance.designation or '',
                    }
                }
            )
    except Exception as e:
        print(f"Sync Primary Registry Error: {e}")

@receiver(post_save, sender=FamilyMember)
def sync_family_to_registry(sender, instance, **kwargs):
    if not instance.employee:
        return
    try:
        # Dynamically find Dependent Registries for this project
        registry_types = RegistryType.objects.filter(project=instance.employee.project, type_category='PERSONNEL_DEPENDENT')
        for rt in registry_types:
            full_card_no = f"{instance.employee.card_no}{instance.card_no_suffix}"
            RegistryData.objects.update_or_create(
                registry_type=rt,
                ucode=full_card_no,
                defaults={
                    'name': instance.name,
                    'category': instance.relationship or 'DEPENDENT',
                    'description': f"Linked to {instance.employee.card_no}",
                    'additional_fields': {
                        'parent_card_no': instance.employee.card_no,
                        'dob': str(instance.dob) if instance.dob else '',
                        'gender': instance.gender,
                        'aadhar_no': instance.aadhar_no or '',
                        'mobile_no': instance.mobile_no or '',
                        'relationship': instance.relationship,
                    }
                }
            )
    except Exception as e:
        print(f"Sync Dependent Registry Error: {e}")

@receiver(post_delete, sender=EmployeeMaster)
def delete_employee_from_registry(sender, instance, **kwargs):
    RegistryData.objects.filter(registry_type__project=instance.project, registry_type__type_category='PERSONNEL_PRIMARY', ucode=instance.card_no).delete()

@receiver(post_delete, sender=FamilyMember)
def delete_family_from_registry(sender, instance, **kwargs):
    if instance.employee:
        full_card_no = f"{instance.employee.card_no}{instance.card_no_suffix}"
        RegistryData.objects.filter(registry_type__project=instance.employee.project, registry_type__type_category='PERSONNEL_DEPENDENT', ucode=full_card_no).delete()

class ProjectLogo(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='header_logos')
    image = models.ImageField(upload_to='project_header_logos/')
    order = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order', 'id']

    def __str__(self):
        return f"{self.project.name} - Logo {self.id}"
