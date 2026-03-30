from django.db import models
from clinical.models import Visit
from django.conf import settings

class LabRequest(models.Model):
    STATUS_CHOICES = (
        ('PENDING', 'Pending'),
        ('COLLECTED', 'Sample Collected'),
        ('IN_PROGRESS', 'In Progress'),
        ('COMPLETED', 'Completed'),
        ('CANCELLED', 'Cancelled'),
    )
    visit = models.ForeignKey(Visit, on_delete=models.CASCADE, related_name='lab_requests')
    test_name = models.CharField(max_length=200)
    ordered_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='lab_ordered')
    
    # New Fields for Lab Workflow
    sample_type = models.CharField(max_length=100, blank=True, null=True)
    sample_collected_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='samples_collected')
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    remarks = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.test_name} for {self.visit.patient}"

class LabResult(models.Model):
    lab_request = models.OneToOneField(LabRequest, on_delete=models.CASCADE, related_name='result')
    recorded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='lab_results_recorded')
    value = models.CharField(max_length=255) # For simplicity, a string value
    reference_range = models.CharField(max_length=255, blank=True, null=True)
    interpretation = models.TextField(blank=True, null=True)
    recorded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Result for {self.lab_request}"
