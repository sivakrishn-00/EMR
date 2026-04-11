from django.db import models
from clinical.models import Visit
from django.conf import settings

class LabDepartment(models.Model):
    project = models.ForeignKey('patients.Project', on_delete=models.CASCADE, related_name='lab_departments')
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.project.name})"

class LabTestType(models.Model):
    project = models.ForeignKey('patients.Project', on_delete=models.CASCADE, related_name='lab_test_types')
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.project.name})"

class LabTestMaster(models.Model):
    project = models.ForeignKey('patients.Project', on_delete=models.CASCADE, related_name='lab_tests')
    name = models.CharField(max_length=200)
    code = models.CharField(max_length=50, blank=True, null=True)
    test_type = models.ForeignKey(LabTestType, on_delete=models.SET_NULL, null=True, blank=True, related_name='tests')
    department = models.ForeignKey(LabDepartment, on_delete=models.SET_NULL, null=True, blank=True, related_name='tests')
    description = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.project.name})"

class LabSubTest(models.Model):
    VALUE_TYPES = (
        ('INPUT', 'Input (Numeric/Short Text)'),
        ('DROPDOWN', 'Dropdown Selection'),
        ('DESCRIPTIVE', 'Descriptive Text'),
    )
    INPUT_DATA_TYPES = (
        ('text', 'Text'),
        ('number', 'Number'),
    )
    lab_test = models.ForeignKey(LabTestMaster, on_delete=models.CASCADE, related_name='sub_tests')
    name = models.CharField(max_length=200)
    code = models.CharField(max_length=50, blank=True, null=True)
    value_type = models.CharField(max_length=20, choices=VALUE_TYPES, default='INPUT')
    
    # Advanced Input Config
    input_data_type = models.CharField(max_length=20, choices=INPUT_DATA_TYPES, default='text')
    min_chars = models.IntegerField(default=0, blank=True, null=True)
    max_chars = models.IntegerField(default=255, blank=True, null=True)
    
    units = models.CharField(max_length=50, blank=True, null=True)
    biological_range = models.CharField(max_length=100, blank=True, null=True)
    dropdown_options = models.JSONField(default=list, blank=True, null=True, help_text="List of strings for dropdown values")
    description = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return f"{self.name} for {self.lab_test.name}"

class LabRequest(models.Model):
    STATUS_CHOICES = (
        ('PENDING', 'Pending'),
        ('COLLECTED', 'Sample Collected'),
        ('IN_PROGRESS', 'In Progress'),
        ('COMPLETED', 'Completed'),
        ('CANCELLED', 'Cancelled'),
    )
    visit = models.ForeignKey(Visit, on_delete=models.CASCADE, related_name='lab_requests')
    test_master = models.ForeignKey(LabTestMaster, on_delete=models.SET_NULL, null=True, blank=True)
    test_name = models.CharField(max_length=200) # Fallback / Manual
    ordered_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='lab_ordered')
    
    # New Fields for Lab Workflow
    sample_type = models.CharField(max_length=100, blank=True, null=True)
    sample_collected_at = models.DateTimeField(blank=True, null=True)
    sample_collected_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='samples_collected')
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    remarks = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.test_name} for {self.visit.patient}"

class LabResult(models.Model):
    lab_request = models.OneToOneField(LabRequest, on_delete=models.CASCADE, related_name='result')
    recorded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='lab_results_recorded')
    
    # Multi-component results
    # Example: {"Hb%": "14.5", "WBC": "8.5k", "Platelets": "200k"}
    values = models.JSONField(default=dict) 
    
    value = models.CharField(max_length=255, blank=True, null=True) # Legacy support
    reference_range = models.CharField(max_length=255, blank=True, null=True)
    interpretation = models.TextField(blank=True, null=True)
    recorded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Result for {self.lab_request}"


class LabProjectBridge(models.Model):
    """
    Project-Level Sync Governance.
    Allows one key and one IP whitelist to manage multiple machines in a single Project.
    """
    project = models.OneToOneField('patients.Project', on_delete=models.CASCADE, related_name='lab_bridge')
    sync_key = models.CharField(max_length=100, unique=True, db_index=True, blank=True)
    allowed_ips = models.JSONField(default=list, blank=True, help_text="List of IPs allowed to sink data for this project")
    alert_emails = models.TextField(blank=True, null=True, help_text="Comma-separated emails for project-wide alerts")
    downtime_threshold = models.IntegerField(default=5, help_text="Global threshold for machines in this project")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if not self.sync_key:
            import secrets
            self.sync_key = secrets.token_hex(16)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Bridge for {self.project.name}"

# LabAnalyzer and AnalyzerLog removed. Integration is now handled via the Cloud Sync Bridge API.


class LabMachine(models.Model):
    """
    Registry for the 1000+ local lab locations syncing to this EMR.
    An identity is a composite of the 4 header fields.
    """
    project = models.ForeignKey('patients.Project', on_delete=models.CASCADE, related_name='machines', null=True, blank=True)
    
    # The 4 identifiers from the local bridge
    machine_id = models.CharField(max_length=100)
    machine_name = models.CharField(max_length=200)
    lab_id = models.CharField(max_length=100)
    location = models.CharField(max_length=200)
    
    # Store a unique hash/slug of the 4 fields for instant lookup
    composite_identity = models.CharField(max_length=255, unique=True, db_index=True)
    
    sync_key = models.CharField(max_length=100, unique=True, db_index=True, null=True, blank=True, help_text="Unique API key for machine-to-cloud synchronization")
    
    is_active = models.BooleanField(default=True)
    last_synced_at = models.DateTimeField(null=True, blank=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    # ENTERPRISE SECURITY & TELEMETRY
    allowed_ips = models.JSONField(default=list, blank=True, help_text="List of IPv4/IPv6 addresses authorized for this key")
    telemetry_data = models.JSONField(default=dict, blank=True, help_text="Real-time performance metrics (count, latency, etc.)")
    maintenance_mode = models.BooleanField(default=False, help_text="If true, server will send RESET command to attached agent")
    alert_emails = models.TextField(blank=True, null=True, help_text="Comma-separated emails for downtime alerts")
    downtime_threshold = models.IntegerField(default=5, help_text="Send alert if no pulse for X minutes")

    class Meta:
        verbose_name = "Lab Machine Station"
        unique_together = ('machine_id', 'machine_name', 'lab_id', 'location')

    def save(self, *args, **kwargs):
        if not self.composite_identity:
            self.composite_identity = f"{self.machine_id}|{self.machine_name}|{self.lab_id}|{self.location}"
        if not self.sync_key:
            import secrets
            self.sync_key = secrets.token_hex(16)
        super().save(*args, **kwargs)

    def __str__(self):
        proj_name = self.project.name if self.project else "UNASSIGNED"
        return f"{self.machine_name} - {self.lab_id} ({proj_name})"

class LabMachineData(models.Model):
    """
    High-volume staging table for mirroring 10 Million+ records.
    Optimized for fast ingestion and historical auditing.
    """
    project = models.ForeignKey('patients.Project', on_delete=models.SET_NULL, related_name='machine_results', null=True, blank=True)
    
    # Identification (Mirrored from Local)
    machine_id = models.CharField(max_length=50, db_index=True)
    machine_name = models.CharField(max_length=100)
    lab_id = models.CharField(max_length=50)
    location = models.CharField(max_length=100)
    
    # Patient Data (Mandatory Patient ID from machine name column)
    sample_id = models.CharField(max_length=100, db_index=True)
    patient_id = models.CharField(max_length=100, db_index=True, null=False, blank=False) # Mandatory
    patient_name = models.CharField(max_length=200, null=True, blank=True)
    
    # Hematology / CBC Parameters (Floats as per the machine output)
    wbc = models.FloatField(null=True, blank=True)
    lym_pct = models.FloatField(null=True, blank=True)
    mid_pct = models.FloatField(null=True, blank=True)
    gran_pct = models.FloatField(null=True, blank=True)
    lym_abs = models.FloatField(null=True, blank=True)
    mid_abs = models.FloatField(null=True, blank=True)
    gran_abs = models.FloatField(null=True, blank=True)
    
    rbc = models.FloatField(null=True, blank=True)
    hgb = models.FloatField(null=True, blank=True)
    hct = models.FloatField(null=True, blank=True)
    mcv = models.FloatField(null=True, blank=True)
    mch = models.FloatField(null=True, blank=True)
    mchc = models.FloatField(null=True, blank=True)
    rdw_cv = models.FloatField(null=True, blank=True)
    rdw_sd = models.FloatField(null=True, blank=True)
    
    plt = models.FloatField(null=True, blank=True)
    mpv = models.FloatField(null=True, blank=True)
    pct = models.FloatField(null=True, blank=True)
    p_lcr = models.FloatField(null=True, blank=True)
    p_lcc = models.FloatField(null=True, blank=True)
    pdw_sd = models.FloatField(null=True, blank=True)
    pdw_cv = models.FloatField(null=True, blank=True)
    
    # Metadata & Sync Logic
    raw_data = models.TextField(null=True, blank=True) # Full HL7/Machine output
    received_at_machine = models.DateTimeField(db_index=True)
    synced_at_cloud = models.DateTimeField(auto_now_add=True)
    
    # To track if this raw data has been updated into clinical records
    is_processed = models.BooleanField(default=False, db_index=True)

    class Meta:
        # High-performance indexing for crores of records
        verbose_name = "Lab Machine Raw Result"
        indexes = [
            models.Index(fields=['patient_id', 'received_at_machine']),
            models.Index(fields=['received_at_machine', 'machine_id']),
        ]
        # Prevents duplicate syncs of the same result
        unique_together = ('patient_id', 'machine_id', 'received_at_machine')

class LabSyncAudit(models.Model):
    """
    Granular audit trail for every sync batch received by the EMR.
    Used for monitoring 'Success vs. Failure' counts per location.
    """
    machine = models.ForeignKey(LabMachine, on_delete=models.CASCADE, related_name='sync_history')
    batch_size = models.IntegerField(default=0)
    success_count = models.IntegerField(default=0)
    failed_count = models.IntegerField(default=0)
    
    # Tracking latency
    received_at = models.DateTimeField(auto_now_add=True)
    processing_time_ms = models.FloatField(default=0.0)
    
    # Store any specific error messages or metadata
    status_msg = models.TextField(blank=True, null=True)
    is_success = models.BooleanField(default=True)

    class Meta:
        ordering = ['-received_at']
        indexes = [
            models.Index(fields=['machine', 'received_at']),
        ]

    def __str__(self):
        return f"Audit for {self.machine.machine_name} at {self.received_at}"

