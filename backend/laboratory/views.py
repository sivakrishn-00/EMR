from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import LabRequest, LabResult
from .serializers import LabRequestSerializer, LabResultSerializer
from accounts.models import AuditLog, Notification

def notify_team(project, roles, title, message):
    from accounts.models import User
    users = User.objects.all()
    if project:
        from django.db.models import Q
        users = users.filter(Q(project=project) | Q(role='ADMIN'))
    if roles:
        users = users.filter(role__in=roles)
    notifications = [Notification(recipient=u, title=title, message=message) for u in users]
    Notification.objects.bulk_create(notifications)

class LabRequestViewSet(viewsets.ModelViewSet):
    queryset = LabRequest.objects.all().order_by('-created_at')
    serializer_class = LabRequestSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = LabRequest.objects.all().order_by('-created_at')
        
        user = self.request.user
        is_admin = user.role == 'ADMIN' or user.is_superuser or user.user_roles.filter(name='ADMIN').exists()
        project_param = self.request.query_params.get('project')
        
        roles = user.user_roles.all()
        is_isolated_personally = False
        if roles.exists():
            is_isolated_personally = any(r.data_isolation for r in roles)
        else:
            is_isolated_personally = not is_admin

        from django.db.models import Q
        if not is_admin:
            if is_isolated_personally:
                queryset = queryset.filter(ordered_by=user)
            elif user.project:
                queryset = queryset.filter(Q(visit__patient__project=user.project) | Q(visit__patient__employee_master__project=user.project))
            else:
                queryset = queryset.filter(ordered_by=user)
        elif project_param:
            queryset = queryset.filter(Q(visit__patient__project_id=project_param) | Q(visit__patient__employee_master__project_id=project_param))

        status_param = self.request.query_params.get('status')
        if status_param:
            statuses = status_param.split(',')
            queryset = queryset.filter(status__in=statuses)

        return queryset

    @action(detail=True, methods=['post'])
    def record_result(self, request, pk=None):
        lab_request = self.get_object()
        result_instance = getattr(lab_request, 'result', None)
        
        serializer = LabResultSerializer(result_instance, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save(lab_request=lab_request, recorded_by=request.user)
            lab_request.status = 'COMPLETED'
            lab_request.save()
            
            # Update visit status to Final Prescription phase
            visit = lab_request.visit
            visit.status = 'FINAL_CONSULTATION'
            visit.save()
            
            AuditLog.objects.create(
                user=request.user, 
                module='Laboratory', 
                action='Result Recorded', 
                details=f"Results recorded for request {lab_request.id}"
            )
            
            if visit.consultation and visit.consultation.doctor:
                Notification.objects.create(
                    recipient=visit.consultation.doctor,
                    title='Lab Results Ready',
                    message=f"Lab Results are ready for patient {visit.patient.first_name}"
                )
            
            # Also notify any admins or other lab techs in the project about completion
            notify_team(visit.patient.project, ['ADMIN', 'LAB_TECH'], "Lab Job Completed", f"Results finalized for {visit.patient}")
                
            return Response(serializer.data, status=status.HTTP_201_CREATED if not result_instance else status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def collect_sample(self, request, pk=None):
        lab_request = self.get_object()
        sample_type = request.data.get('sample_type', 'Blood')
        
        lab_request.status = 'COLLECTED'
        lab_request.sample_type = sample_type
        lab_request.sample_collected_by = request.user
        lab_request.save()
        
        AuditLog.objects.create(
            user=request.user, 
            module='Laboratory', 
            action='Sample Collected', 
            details=f"Sample collected for request {lab_request.id}"
        )
        
        return Response({'status': 'Sample Collected'}, status=status.HTTP_200_OK)

class LabResultViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = LabResult.objects.all()
    serializer_class = LabResultSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = LabResult.objects.all().order_by('-recorded_at')
        
        user = self.request.user
        is_admin = user.role == 'ADMIN' or user.is_superuser or user.user_roles.filter(name='ADMIN').exists()
        project_param = self.request.query_params.get('project')
        
        roles = user.user_roles.all()
        is_isolated_personally = False
        if roles.exists():
            is_isolated_personally = any(r.data_isolation for r in roles)
        else:
            is_isolated_personally = not is_admin

        from django.db.models import Q
        if not is_admin:
            if is_isolated_personally:
                queryset = queryset.filter(recorded_by=user)
            elif user.project:
                queryset = queryset.filter(Q(lab_request__visit__patient__project=user.project) | Q(lab_request__visit__patient__employee_master__project=user.project))
            else:
                queryset = queryset.filter(recorded_by=user)
        elif project_param:
            queryset = queryset.filter(Q(lab_request__visit__patient__project_id=project_param) | Q(lab_request__visit__patient__employee_master__project_id=project_param))

        return queryset
