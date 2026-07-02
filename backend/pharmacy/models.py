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
    item_code = models.CharField(max_length=255, blank=True, null=True)
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
    dispensed_at = models.DateTimeField(default=timezone.now, db_index=True)
    remarks = models.TextField(blank=True, null=True)

    def save(self, *args, **kwargs):
        if not self.id and self.prescription and self.prescription.visit:
            self.dispensed_at = self.prescription.visit.visit_date
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Dispensed {self.quantity} for {self.prescription}"


class Indent(models.Model):
    STATUS_CHOICES = (
        ('PENDING_APPROVAL', 'Pending Doctor Approval'),
        ('APPROVED', 'Approved (Pending Pharmacy)'),
        ('DISPENSED', 'Dispensed to Room Stock'),
        ('REJECTED', 'Rejected by Doctor'),
        ('CANCELLED', 'Cancelled'),
    )
    
    project = models.ForeignKey('patients.Project', on_delete=models.CASCADE, related_name='indents')
    raised_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='indents_raised')
    raised_by_role = models.CharField(max_length=50) # 'NURSE', 'LABORATORY', etc.
    requesting_location = models.CharField(max_length=100) # e.g., 'Nurse Room', 'Lab Room'
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING_APPROVAL')
    doctor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='indents_approved')
    doctor_remarks = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Replenishment Indent {self.id} ({self.status}) for {self.requesting_location}"


class IndentItem(models.Model):
    indent = models.ForeignKey(Indent, on_delete=models.CASCADE, related_name='items')
    medication_name = models.CharField(max_length=255)
    registry_item = models.ForeignKey('patients.RegistryData', on_delete=models.SET_NULL, null=True, blank=True, related_name='indent_items')
    requested_quantity = models.IntegerField()
    approved_quantity = models.IntegerField(default=0)
    dispensed_quantity = models.IntegerField(default=0)

    def __str__(self):
        return f"{self.medication_name} ({self.requested_quantity} requested) for Indent {self.indent.id}"


class RoomStock(models.Model):
    project = models.ForeignKey('patients.Project', on_delete=models.CASCADE, related_name='room_stocks')
    location = models.CharField(max_length=100) # e.g., 'Nurse Room', 'Lab Room'
    registry_item = models.ForeignKey('patients.RegistryData', on_delete=models.CASCADE, related_name='room_stocks')
    quantity = models.IntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('project', 'location', 'registry_item')

    def __str__(self):
        return f"{self.location} - {self.registry_item.name} ({self.quantity} in stock)"


class RoomStockTransfer(models.Model):
    indent_item = models.ForeignKey(IndentItem, on_delete=models.CASCADE, related_name='transfers')
    batch = models.ForeignKey(DrugBatch, on_delete=models.SET_NULL, null=True, blank=True, related_name='room_transfers')
    dispensed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='room_transfers_dispensed')
    quantity = models.IntegerField()
    unit_cost = models.DecimalField(max_digits=15, decimal_places=2, default=0.00)
    total_cost = models.DecimalField(max_digits=15, decimal_places=2, default=0.00)
    transferred_at = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return f"Transferred {self.quantity} of {self.indent_item.medication_name} to {self.indent_item.indent.requesting_location}"


class RoomStockDispensation(models.Model):
    RECIPIENT_TYPES = (
        ('PATIENT', 'Registered Patient'),
        ('OUTSIDE_PATIENT', 'Outside / Unregistered Patient'),
    )
    
    project = models.ForeignKey('patients.Project', on_delete=models.CASCADE, related_name='room_dispensations')
    room_stock = models.ForeignKey(RoomStock, on_delete=models.CASCADE, related_name='dispensations')
    dispensed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='room_dispensations_given')
    
    recipient_type = models.CharField(max_length=20, choices=RECIPIENT_TYPES, default='PATIENT')
    patient = models.ForeignKey('patients.Patient', on_delete=models.SET_NULL, null=True, blank=True, related_name='room_dispensations')
    
    outside_patient_name = models.CharField(max_length=255, blank=True, null=True)
    outside_patient_aadhaar = models.CharField(max_length=20, blank=True, null=True)
    outside_patient_phone = models.CharField(max_length=15, blank=True, null=True)
    outside_patient_details = models.TextField(blank=True, null=True)
    
    quantity = models.IntegerField()
    dispensed_at = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        ordering = ['-dispensed_at']

    def __str__(self):
        recipient = self.patient if self.recipient_type == 'PATIENT' else f"{self.outside_patient_name} (Aadhaar: {self.outside_patient_aadhaar})"
        return f"Given {self.quantity} of {self.room_stock.registry_item.name} to {recipient} from {self.room_stock.location}"


class FacilityRoom(models.Model):
    ROOM_TYPES = (
        ('NURSE_ROOM', 'Nurse Room'),
        ('LABORATORY', 'Laboratory'),
        ('OHC', 'Occupational Health Centre (OHC)'),
        ('EMERGENCY', 'Emergency Room'),
        ('WARD', 'General Ward'),
        ('OTHER', 'Other Facility'),
    )
    
    project = models.ForeignKey('patients.Project', on_delete=models.CASCADE, related_name='facility_rooms')
    name = models.CharField(max_length=100)
    room_type = models.CharField(max_length=20, choices=ROOM_TYPES, default='NURSE_ROOM')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('project', 'name')
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.get_room_type_display()}) - {self.project.name}"


class UserRoomAssignment(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='room_assignment')
    assigned_room = models.ForeignKey(FacilityRoom, on_delete=models.CASCADE, related_name='assigned_staff')
    can_raise_indent = models.BooleanField(default=True)
    can_log_dispensation = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.user.username} -> {self.assigned_room.name}"

