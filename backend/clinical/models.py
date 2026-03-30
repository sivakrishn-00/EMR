from django.db import models
from django.conf import settings
from patients.models import Patient

class Visit(models.Model):
    STATUS_CHOICES = (
        ('PENDING_VITALS', 'Pending Vitals'),
        ('PENDING_CONSULTATION', 'Initial Consultation'),
        ('PENDING_LAB', 'Laboratory Hub'),
        ('FINAL_CONSULTATION', 'Final Prescription'),
        ('PENDING_PHARMACY', 'Pharmacy Dispensing'),
        ('COMPLETED', 'Visit Completed'),
    )

    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name='visits')
    visit_date = models.DateTimeField(auto_now_add=True)
    reason = models.TextField()
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='PENDING_VITALS')
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"Visit for {self.patient} on {self.visit_date.strftime('%Y-%m-%d')} ({self.status})"

class Vitals(models.Model):
    visit = models.OneToOneField(Visit, on_delete=models.CASCADE, related_name='vitals')
    recorded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='recorded_vitals')
    
    # Core Vitals
    temperature_c = models.DecimalField(max_digits=4, decimal_places=1, null=True, blank=True)
    blood_pressure_sys = models.IntegerField(null=True, blank=True)
    blood_pressure_dia = models.IntegerField(null=True, blank=True)
    heart_rate = models.IntegerField(null=True, blank=True) # Pulse Rate
    respiratory_rate = models.IntegerField(null=True, blank=True)
    spo2 = models.IntegerField(null=True, blank=True)
    
    # Body Composition
    weight_kg = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    height_cm = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    bmi = models.DecimalField(max_digits=4, decimal_places=1, null=True, blank=True)
    
    # Personal History
    smoking = models.CharField(max_length=50, blank=True, null=True)
    alcohol = models.CharField(max_length=50, blank=True, null=True)
    physical_activity = models.CharField(max_length=50, blank=True, null=True)
    food_habit = models.CharField(max_length=50, blank=True, null=True)
    allergy_food = models.TextField(blank=True, null=True)
    allergy_drug = models.TextField(blank=True, null=True)
    
    # Family History
    family_dm = models.CharField(max_length=50, blank=True, null=True)
    family_htn = models.CharField(max_length=50, blank=True, null=True)
    family_cancer = models.CharField(max_length=50, blank=True, null=True)
    family_cvs = models.CharField(max_length=50, blank=True, null=True)
    family_thyroid = models.CharField(max_length=50, blank=True, null=True)
    family_tb = models.CharField(max_length=50, blank=True, null=True)
    family_others = models.TextField(blank=True, null=True)
    
    # Systemic Examination
    sys_respiratory = models.CharField(max_length=50, blank=True, null=True)
    sys_cvs = models.CharField(max_length=50, blank=True, null=True)
    sys_cns = models.CharField(max_length=50, blank=True, null=True)
    sys_gis = models.CharField(max_length=50, blank=True, null=True)
    sys_mss = models.CharField(max_length=50, blank=True, null=True)
    sys_gus = models.CharField(max_length=50, blank=True, null=True)
    
    # Known History
    known_dm = models.CharField(max_length=50, blank=True, null=True)
    known_htn = models.CharField(max_length=50, blank=True, null=True)
    known_cancer = models.CharField(max_length=50, blank=True, null=True)
    known_cvs = models.CharField(max_length=50, blank=True, null=True)
    known_thyroid = models.CharField(max_length=50, blank=True, null=True)
    known_tb = models.CharField(max_length=50, blank=True, null=True)
    known_others = models.TextField(blank=True, null=True)
    
    # Observations
    symptoms = models.TextField(blank=True, null=True)
    notes = models.TextField(blank=True, null=True)
    
    recorded_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if self.weight_kg and self.height_cm:
            height_m = self.height_cm / 100
            self.bmi = self.weight_kg / (height_m * height_m)
        super().save(*args, **kwargs)

    class Meta:
        verbose_name_plural = "Vitals"

class Consultation(models.Model):
    visit = models.OneToOneField(Visit, on_delete=models.CASCADE, related_name='consultation')
    doctor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='consultations_given')
    chief_complaint = models.TextField()
    history_of_present_illness = models.TextField(blank=True)
    physical_examination = models.TextField(blank=True)
    diagnosis = models.TextField()
    plan = models.TextField()
    conducted_at = models.DateTimeField(auto_now_add=True)

class Appointment(models.Model):
    STATUS_CHOICES = (
        ('SCHEDULED', 'Scheduled'),
        ('CHECKED_IN', 'Checked In'),
        ('CANCELLED', 'Cancelled'),
        ('NO_SHOW', 'No Show'),
    )

    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name='appointments')
    doctor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='doctor_appointments')
    appointment_date = models.DateTimeField()
    reason = models.CharField(max_length=200, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='SCHEDULED')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Appt: {self.patient} with Dr. {self.doctor} on {self.appointment_date}"

