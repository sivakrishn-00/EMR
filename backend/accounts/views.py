from rest_framework import generics, permissions, status, viewsets
from rest_framework.response import Response
from rest_framework.decorators import action
from .serializers import (
    RegisterSerializer, UserSerializer, CustomTokenObtainPairSerializer, 
    AuditLogSerializer, NotificationSerializer, UserRoleSerializer
)
from rest_framework_simplejwt.views import TokenObtainPairView
from .models import User, AuditLog, Notification, UserRole
from clinical.serializers import VisitSerializer

class UserRoleViewSet(viewsets.ModelViewSet):
    queryset = UserRole.objects.all()
    serializer_class = UserRoleSerializer
    permission_classes = [permissions.IsAuthenticated]

class UserViewSet(viewsets.ModelViewSet):
    def get_queryset(self):
        # 🚀 AUTO-REPAIR: Ensure all patients have the 'PATIENT' role linked
        from .models import UserRole
        patient_role = UserRole.objects.filter(name='PATIENT').first()
        if patient_role:
            # Fix patients who were created without the dynamic role link
            users_needing_repair = User.objects.filter(role='PATIENT', user_roles=None)
            for u in users_needing_repair:
                u.user_roles.add(patient_role)
        
        return User.objects.all().order_by('-date_joined')
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAdminUser]

    @action(detail=False, methods=['get'], permission_classes=[permissions.IsAuthenticated])
    def roles(self, request):
        db_roles = list(UserRole.objects.values_list('name', flat=True))
        default_roles = ['ADMIN', 'DOCTOR', 'NURSE', 'DEO', 'LAB_TECH', 'PHARMACIST', 'PATIENT']
        for r in default_roles:
            if r not in db_roles:
                db_roles.append(r)
        return Response(db_roles)

class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = (permissions.AllowAny,)
    serializer_class = RegisterSerializer

class CurrentUserView(generics.RetrieveAPIView):
    serializer_class = UserSerializer
    permission_classes = (permissions.IsAuthenticated,)

    def get_object(self):
        return self.request.user

class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer

class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AuditLog.objects.all()
    serializer_class = AuditLogSerializer
    permission_classes = [permissions.IsAdminUser]

class NotificationViewSet(viewsets.ModelViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None # Return full list for dropdown

    def get_queryset(self):
        return Notification.objects.filter(recipient=self.request.user)

    @action(detail=False, methods=['post'])
    def mark_all_as_read(self, request):
        Notification.objects.filter(recipient=request.user, is_read=False).update(is_read=True)
        return Response({'status': 'notifications marked as read'})

from .permissions import IsStaffUser

class DashboardStatsView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated, IsStaffUser]
    
    def get(self, request):
        from django.utils import timezone
        from patients.models import Patient
        from clinical.models import Visit
        from laboratory.models import LabRequest
        from pharmacy.models import Prescription
        from django.db.models import Q
        
        today = timezone.now().date()
        user = request.user
        
        is_admin = user.role == 'ADMIN' or user.is_superuser or user.user_roles.filter(name='ADMIN').exists()
        project_param = request.query_params.get('project')

        patient_qs = Patient.objects.all()
        visit_qs = Visit.objects.all()
        lab_qs = LabRequest.objects.all()
        pharmacy_qs = Prescription.objects.all()

        is_isolated_personally = False
        roles = user.user_roles.all()
        if roles.exists():
            is_isolated_personally = any(r.data_isolation for r in roles)
        else:
            is_isolated_personally = not is_admin

        if not is_admin:
            if is_isolated_personally:
                # Role explicitly mandates ONLY seeing data they created
                patient_qs = patient_qs.filter(registered_by=user)
                visit_qs = visit_qs.filter(patient__registered_by=user)
                lab_qs = lab_qs.filter(ordered_by=user)
                pharmacy_qs = pharmacy_qs.filter(ordered_by=user)
            elif user.project:
                # Isolate by Project Facility (sees all project data)
                patient_qs = patient_qs.filter(Q(project=user.project) | Q(employee_master__project=user.project))
                visit_qs = visit_qs.filter(Q(patient__project=user.project) | Q(patient__employee_master__project=user.project))
                lab_qs = lab_qs.filter(Q(visit__patient__project=user.project) | Q(visit__patient__employee_master__project=user.project))
                pharmacy_qs = pharmacy_qs.filter(Q(visit__patient__project=user.project) | Q(visit__patient__employee_master__project=user.project))
            else:
                # Stringent fallback: Users without project only see what they created
                patient_qs = patient_qs.filter(registered_by=user)
                visit_qs = visit_qs.filter(patient__registered_by=user)
                lab_qs = lab_qs.filter(ordered_by=user)
                pharmacy_qs = pharmacy_qs.filter(ordered_by=user)
        elif project_param:
            # Admin filtering by project
            patient_qs = patient_qs.filter(Q(project_id=project_param) | Q(employee_master__project_id=project_param))
            visit_qs = visit_qs.filter(Q(patient__project_id=project_param) | Q(patient__employee_master__project_id=project_param))
            lab_qs = lab_qs.filter(Q(visit__patient__project_id=project_param) | Q(visit__patient__employee_master__project_id=project_param))
            pharmacy_qs = pharmacy_qs.filter(Q(visit__patient__project_id=project_param) | Q(visit__patient__employee_master__project_id=project_param))
        
        recent_visits = visit_qs.filter(is_active=True).order_by('-visit_date')[:5]
        
        
        # Dept Flow counts
        dept_counts = {
            'Nursing': visit_qs.filter(status='PENDING_VITALS', is_active=True).count(),
            'Doctor': visit_qs.filter(status__in=['PENDING_CONSULTATION', 'FINAL_CONSULTATION'], is_active=True).count(),
            'Laboratory': lab_qs.filter(status__in=['PENDING', 'COLLECTED']).count(),
            'Pharmacy': pharmacy_qs.filter(status='PENDING').count(),
        }
        
        return Response({
            'total_patients': patient_qs.count(),
            'visits_today': visit_qs.filter(visit_date__date=today).count(),
            'lab_pending': lab_qs.filter(status__in=['PENDING', 'COLLECTED']).count(),
            'prescriptions_today': pharmacy_qs.filter(created_at__date=today).count(),
            'emergency_today': patient_qs.filter(patient_type='EMERGENCY').count(),
            'recent_visits': VisitSerializer(recent_visits, many=True).data,
            'dept_flow': [
                {'name': 'Nursing', 'value': (dept_counts['Nursing'] * 10), 'color': '#f59e0b'}, # Scale for vis
                {'name': 'Doctor', 'value': (dept_counts['Doctor'] * 10), 'color': '#6366f1'},
                {'name': 'Laboratory', 'value': (dept_counts['Laboratory'] * 10), 'color': '#10b981'},
                {'name': 'Pharmacy', 'value': (dept_counts['Pharmacy'] * 10), 'color': '#ef4444'},
            ]
        })
