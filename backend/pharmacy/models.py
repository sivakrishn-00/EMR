from django.db import models
from clinical.models import Visit
from django.conf import settings
from django.utils import timezone

class Prescription(models.Model):
    STATUS_CHOICES = (
        ('PENDING', 'Pending'),
        ('PARTIALLY_DISPENSED', 'Partially Dispensed'),
        ('DISPENSED', 'Dispensed'),
        ('CANCELLED', 'Cancelled'),
    )
    visit = models.ForeignKey(Visit, on_delete=models.CASCADE, related_name='prescriptions')
    medication_name = models.CharField(max_length=255)
    dosage = models.CharField(max_length=100, blank=True, null=True, default='As directed')
    frequency = models.CharField(max_length=100)
    duration = models.CharField(max_length=100)
    total_units = models.IntegerField(default=1)
    ordered_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='medications_ordered')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    remarks = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(default=timezone.now)

    def save(self, *args, **kwargs):
        if not self.id and self.visit:
            self.created_at = self.visit.visit_date
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.medication_name} for {self.visit.patient}"

class DrugBatch(models.Model):
    registry_item = models.ForeignKey('patients.RegistryData', on_delete=models.CASCADE, related_name='batches')
    batch_number = models.CharField(max_length=255)
    mfg_date = models.DateField()
    expiry_date = models.DateField()
    initial_qty = models.IntegerField(default=0)
    quantity = models.IntegerField(default=0)  # Current stock in this batch
    unit_cost = models.DecimalField(max_digits=15, decimal_places=2, default=0.00)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['expiry_date']

    def __str__(self):
        return f"Batch {self.batch_number} of {self.registry_item.name} (Exp: {self.expiry_date})"

class DispensingRecord(models.Model):
    prescription = models.ForeignKey(Prescription, on_delete=models.CASCADE, related_name='dispensing_history')
    batch = models.ForeignKey(DrugBatch, on_delete=models.SET_NULL, null=True, blank=True, related_name='dispensings')
    dispensed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='medications_dispensed')
    quantity = models.IntegerField()
    unit_cost = models.DecimalField(max_digits=15, decimal_places=2, default=0.00)
    total_cost = models.DecimalField(max_digits=15, decimal_places=2, default=0.00)
    dispensed_at = models.DateTimeField(default=timezone.now)
    remarks = models.TextField(blank=True, null=True)

    def save(self, *args, **kwargs):
        if not self.id and self.prescription and self.prescription.visit:
            self.dispensed_at = self.prescription.visit.visit_date
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Dispensed {self.quantity} for {self.prescription}"
