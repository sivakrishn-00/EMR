from .models import AuditLog

def log_action(user, module, action, details, ip_address=None):
    """
    Central utility for creating system audit logs.
    """
    # Defensive check for user
    if user and not user.is_authenticated:
        user = None
        
    AuditLog.objects.create(
        user=user, 
        module=module, 
        action=action, 
        details=details,
        ip_address=ip_address
    )
