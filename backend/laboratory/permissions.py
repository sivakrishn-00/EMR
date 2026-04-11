from rest_framework import permissions
from django.conf import settings
import hmac
import hashlib

class HasMachineSyncKey(permissions.BasePermission):
    """
    Allows access only to requests that include a valid Machine Sync Key.
    """
    def has_permission(self, request, view):
        key = request.headers.get('X-Machine-Sync-Key')
        signature = request.headers.get('X-Sync-Signature')
        
        if not key:
            return False
            
        from .models import LabMachine, LabProjectBridge
        
        # 1. AUTHENTICATION & IP CHECK
        auth_obj = None
        is_project_key = False
        
        # Check individual machine keys first
        try:
            auth_obj = LabMachine.objects.get(sync_key=key, is_active=True)
        except LabMachine.DoesNotExist:
            # Check project-wide keys
            try:
                auth_obj = LabProjectBridge.objects.get(sync_key=key, is_active=True)
                is_project_key = True
            except LabProjectBridge.DoesNotExist:
                return False
                
        # 2. IP WHITELISTING CHECK (Unified)
        allowed_ips = auth_obj.allowed_ips
        if allowed_ips:
            client_ip = request.META.get('HTTP_X_FORWARDED_FOR', request.META.get('REMOTE_ADDR'))
            if client_ip and ',' in client_ip: client_ip = client_ip.split(',')[0].strip()
            
            # Allow loopback addresses during local testing
            if client_ip not in allowed_ips and client_ip not in ['127.0.0.1', '::1']:
                return False

        # 3. HMAC SIGNATURE CHECK (Premium Security)
        if signature:
            expected_signature = hmac.new(
                key.encode('utf-8'),
                request.body,
                hashlib.sha256
            ).hexdigest()
            
            if not hmac.compare_digest(expected_signature, signature):
                return False
        
        # Attach context to request
        if is_project_key:
            request.sync_project = auth_obj.project
            request.sync_machine = None
        else:
            request.sync_machine = auth_obj
            request.sync_project = auth_obj.project
            
        return True
