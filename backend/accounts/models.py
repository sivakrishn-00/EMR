from django.db import models
from django.contrib.auth.models import AbstractUser
from django.conf import settings

class UserRole(models.Model):
    name = models.CharField(max_length=50, unique=True)
    description = models.TextField(blank=True)
    data_isolation = models.BooleanField(default=False, help_text="If True, users with this role can only see records they created.")
    permissions = models.JSONField(default=list, blank=True, help_text="List of allowed module paths, e.g., ['/patients', '/vitals']")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

class User(AbstractUser):
    # Dynamic Role system: role names now fetched from UserRole model in the DB
    role = models.CharField(max_length=50, default='PATIENT')
    user_roles = models.ManyToManyField(UserRole, blank=True, related_name='users')
    project = models.ForeignKey('patients.Project', on_delete=models.SET_NULL, null=True, blank=True, related_name='users')
    phone = models.CharField(max_length=15, blank=True, null=True, db_index=True)
    address = models.TextField(blank=True, null=True)
    is_password_set = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.username}"

class AuditLog(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='audit_logs')
    action = models.CharField(max_length=255)
    module = models.CharField(max_length=100)
    details = models.TextField()
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f"{self.user} - {self.action} at {self.timestamp}"

class Notification(models.Model):
    recipient = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='notifications')
    title = models.CharField(max_length=255)
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.title} for {self.recipient}"
