from rest_framework import permissions
from django.conf import settings

class HasMachineSyncKey(permissions.BasePermission):
    """
    Allows access only to requests that include a valid Machine Sync Key.
    """
    def has_permission(self, request, view):
        key = request.headers.get('X-Machine-Sync-Key')
        # In a real production app, this would be stored in a database or env var
        expected_key = getattr(settings, 'MACHINE_SYNC_API_KEY', None)
        
        if not expected_key:
            # Fallback for development if not set in settings.py
            # This is NOT for production use
            return False
            
        return key == expected_key
