from rest_framework import permissions

class IsStaffUser(permissions.BasePermission):
    """
    Allows access only to staff members (ADMIN, DOCTOR, NURSE, etc.)
    Strictly denies access to users with the PATIENT role.
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        
        # Superusers and Admins are always allowed
        if request.user.is_superuser or request.user.role == 'ADMIN':
            return True
            
        # Explicitly deny if the primary role is PATIENT
        if request.user.role == 'PATIENT':
            return False
            
        # Allow other internal roles (DOCTOR, NURSE, LAB_TECH, etc.)
        # In a more complex system, we could check request.user.user_roles.exists()
        return True
