from rest_framework import generics, permissions, status, viewsets
from rest_framework.response import Response
from rest_framework.decorators import action
from .serializers import (
    RegisterSerializer, UserSerializer, CustomTokenObtainPairSerializer, 
    AuditLogSerializer, NotificationSerializer, UserRoleSerializer)
from rest_framework_simplejwt.views import TokenObtainPairView
from .models import User, AuditLog, Notification, UserRole
from clinical.serializers import VisitSerializer

class UserRoleViewSet(viewsets.ModelViewSet):
    serializer_class = UserRoleSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        user = self.request.user
        queryset = UserRole.objects.all()
        
        if user.project:
            queryset = queryset.filter(project=user.project)
        else:
            project_param = self.request.query_params.get('project')
            if project_param is not None:
                if project_param in ['null', 'None', 'global', '']:
                    queryset = queryset.filter(project__isnull=True)
                else:
                    queryset = queryset.filter(project_id=project_param)
        return queryset.order_by('id')

    def perform_create(self, serializer):
        if self.request.user.project:
            serializer.save(project=self.request.user.project)
        else:
            serializer.save()

class UserViewSet(viewsets.ModelViewSet):
    def get_queryset(self):
        # 🚀 AUTO-REPAIR: Ensure all patients have the 'PATIENT' role linked
        from .models import UserRole
        users_needing_repair = User.objects.filter(role='PATIENT', user_roles=None)
        for u in users_needing_repair:
            p_role = UserRole.objects.filter(name='PATIENT', project=u.project).first()
            if not p_role:
                p_role = UserRole.objects.filter(name='PATIENT', project__isnull=True).first()
            if p_role:
                u.user_roles.add(p_role)
        
        return User.objects.all().order_by('-date_joined')
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAdminUser]

    @action(detail=False, methods=['get'], permission_classes=[permissions.IsAuthenticated])
    def roles(self, request):
        user = request.user
        qs = UserRole.objects.all()
        if user.project:
            qs = qs.filter(project=user.project)
        db_roles = list(qs.values_list('name', flat=True).distinct())
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
    serializer_class = AuditLogSerializer
    permission_classes = [permissions.IsAdminUser]

    def get_queryset(self):
        queryset = AuditLog.objects.all().select_related('user').order_by('-timestamp')
        
        user = self.request.user
        project_param = self.request.query_params.get('project')
        
        if user.project:
            queryset = queryset.filter(user__project=user.project)
        elif project_param:
            queryset = queryset.filter(user__project_id=project_param)
            
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        
        if start_date:
            try:
                import datetime
                from django.utils.timezone import make_aware
                start_dt = make_aware(datetime.datetime.strptime(start_date, '%Y-%m-%d'))
                queryset = queryset.filter(timestamp__gte=start_dt)
            except ValueError:
                pass
                
        if end_date:
            try:
                import datetime
                from django.utils.timezone import make_aware
                end_dt = make_aware(datetime.datetime.strptime(f"{end_date} 23:59:59", '%Y-%m-%d %H:%M:%S'))
                queryset = queryset.filter(timestamp__lte=end_dt)
            except ValueError:
                pass
            
        search = self.request.query_params.get('search')
        if search:
            from django.db.models import Q
            queryset = queryset.filter(
                Q(user__username__icontains=search) |
                Q(module__icontains=search) |
                Q(action__icontains=search) |
                Q(details__icontains=search)
            )
            
        return queryset

    @action(detail=False, methods=['get'])
    def download_csv(self, request):
        # Disable pagination for download
        queryset = self.filter_queryset(self.get_queryset())
        
        import csv
        from django.http import HttpResponse
        
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="audit_logs.csv"'
        
        writer = csv.writer(response)
        writer.writerow(['User', 'Module', 'Action', 'Details', 'IP Address', 'Timestamp'])
        
        for log in queryset:
            username = log.user.username if log.user else 'System'
            timestamp_str = log.timestamp.strftime('%Y-%m-%d %H:%M:%S')
            writer.writerow([
                username,
                log.module,
                log.action,
                log.details,
                log.ip_address or '127.0.0.1',
                timestamp_str
            ])
            
        return response

from rest_framework.pagination import PageNumberPagination

class NotificationPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = 'page_size'
    max_page_size = 100

    def get_paginated_response(self, data):
        from django.db.models import Q
        from .models import Notification
        user = self.request.user
        
        unread_qs = Notification.objects.filter(recipient=user, is_read=False)
        if user.project:
            unread_qs = unread_qs.filter(Q(project=user.project) | Q(project__isnull=True))
        else:
            project_id = self.request.query_params.get('project')
            if project_id:
                unread_qs = unread_qs.filter(Q(project_id=project_id) | Q(project__isnull=True))
                
        return Response({
            'count': self.page.paginator.count,
            'next': self.get_next_link(),
            'previous': self.get_previous_link(),
            'unread_count': unread_qs.count(),
            'results': data
        })

class NotificationViewSet(viewsets.ModelViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = NotificationPagination

    def get_queryset(self):
        from django.db.models import Q
        user = self.request.user
        queryset = Notification.objects.filter(recipient=user)
        if user.project:
            queryset = queryset.filter(Q(project=user.project) | Q(project__isnull=True))
        else:
            project_id = self.request.query_params.get('project')
            if project_id:
                queryset = queryset.filter(Q(project_id=project_id) | Q(project__isnull=True))
        return queryset

    @action(detail=False, methods=['post'])
    def mark_all_as_read(self, request):
        from django.db.models import Q
        user = request.user
        queryset = Notification.objects.filter(recipient=user, is_read=False)
        if user.project:
            queryset = queryset.filter(Q(project=user.project) | Q(project__isnull=True))
        else:
            project_id = request.query_params.get('project')
            if project_id:
                queryset = queryset.filter(Q(project_id=project_id) | Q(project__isnull=True))
        queryset.update(is_read=True)
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

        if user.is_superuser:
            if project_param:
                patient_qs = patient_qs.filter(Q(project_id=project_param) | Q(employee_master__project_id=project_param))
                visit_qs = visit_qs.filter(Q(patient__project_id=project_param) | Q(patient__employee_master__project_id=project_param))
                lab_qs = lab_qs.filter(Q(visit__patient__project_id=project_param) | Q(visit__patient__employee_master__project_id=project_param))
                pharmacy_qs = pharmacy_qs.filter(Q(visit__patient__project_id=project_param) | Q(visit__patient__employee_master__project_id=project_param))
        elif user.project:
            # Strict Project Isolation for any user assigned to a project
            patient_qs = patient_qs.filter(Q(project=user.project) | Q(employee_master__project=user.project))
            visit_qs = visit_qs.filter(Q(patient__project=user.project) | Q(patient__employee_master__project=user.project))
            lab_qs = lab_qs.filter(Q(visit__patient__project=user.project) | Q(visit__patient__employee_master__project=user.project))
            pharmacy_qs = pharmacy_qs.filter(Q(visit__patient__project=user.project) | Q(visit__patient__employee_master__project=user.project))
        elif is_admin:
            # Global Admin (no project assigned) - Can see all or filter
            if project_param:
                patient_qs = patient_qs.filter(Q(project_id=project_param) | Q(employee_master__project_id=project_param))
                visit_qs = visit_qs.filter(Q(patient__project_id=project_param) | Q(patient__employee_master__project_id=project_param))
                lab_qs = lab_qs.filter(Q(visit__patient__project_id=project_param) | Q(visit__patient__employee_master__project_id=project_param))
                pharmacy_qs = pharmacy_qs.filter(Q(visit__patient__project_id=project_param) | Q(visit__patient__employee_master__project_id=project_param))
        else:
            # Isolated Personnel / Users without project see only their records
            patient_qs = patient_qs.filter(registered_by=user)
            visit_qs = visit_qs.filter(patient__registered_by=user)
            lab_qs = lab_qs.filter(ordered_by=user)
            pharmacy_qs = pharmacy_qs.filter(ordered_by=user)
        
        recent_visits = visit_qs.filter(is_active=True).order_by('-visit_date')[:5]
        
        # --- CENTRAL STOCK DEPLETION MONITOR FOR GLOBAL ADMINS ---
        low_stock_items = []
        if is_admin:
            from patients.models import RegistryData
            # Find drugs in any project's pharmacy registry that are critically low (<= 15 items)
            critical_items = RegistryData.objects.filter(
                registry_type__slug__icontains='pharmacy',
                quantity__lte=15
            ).exclude(name='').exclude(ucode='').exclude(name__isnull=True).exclude(ucode__isnull=True).select_related('registry_type', 'registry_type__project').order_by('quantity')[:8]
            
            for item in critical_items:
                low_stock_items.append({
                    'id': item.id,
                    'name': item.name,
                    'quantity': item.quantity,
                    'project_name': item.registry_type.project.name if item.registry_type.project else 'Global',
                    'initial_qty': int(item.additional_fields.get('initial_quantity', 100)) if (item.additional_fields and isinstance(item.additional_fields, dict)) else 100,
                })
        
        # Dept Flow counts
        dept_counts = {
            'Nursing': visit_qs.filter(status='PENDING_VITALS', is_active=True).count(),
            'Doctor': visit_qs.filter(status__in=['PENDING_CONSULTATION', 'FINAL_CONSULTATION'], is_active=True).count(),
            'Laboratory': lab_qs.filter(status__in=['PENDING', 'COLLECTED']).count(),
            'Pharmacy': pharmacy_qs.filter(status='PENDING').count(),
        }
        
        return Response({
            'total_patients': patient_qs.count(),
            'pending_patients': visit_qs.filter(is_active=True).count(),
            'lab_pending': lab_qs.filter(status__in=['PENDING', 'COLLECTED']).count(),
            'doctor_pending': dept_counts['Doctor'],
            'pharmacy_pending': dept_counts['Pharmacy'],
            'recent_visits': VisitSerializer(recent_visits, many=True).data,
            'low_stock_items': low_stock_items,
            'dept_flow': [
                {'name': 'Nursing', 'value': min(100, dept_counts['Nursing'] * 10), 'color': '#f59e0b'},
                {'name': 'Doctor', 'value': min(100, dept_counts['Doctor'] * 10), 'color': '#6366f1'},
                {'name': 'Laboratory', 'value': min(100, dept_counts['Laboratory'] * 10), 'color': '#10b981'},
                {'name': 'Pharmacy', 'value': min(100, dept_counts['Pharmacy'] * 10), 'color': '#ef4444'},
            ]
        })
