from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Prescription, DispensingRecord
from .serializers import PrescriptionSerializer, DispensingRecordSerializer
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

class PrescriptionViewSet(viewsets.ModelViewSet):
    serializer_class = PrescriptionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = Prescription.objects.all().order_by('-created_at')
        
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
            queryset = queryset.filter(status=status_param)
        return queryset

    @action(detail=True, methods=['post'])
    def dispense(self, request, pk=None):
        prescription = self.get_object()
        serializer = DispensingRecordSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(prescription=prescription, dispensed_by=request.user)
            prescription.status = 'DISPENSED'
            prescription.save()
            
            # Finalize visit
            visit = prescription.visit
            visit.status = 'COMPLETED'
            visit.is_active = False
            visit.save()
            
            AuditLog.objects.create(
                user=request.user, 
                module='Pharmacy', 
                action='Medication Dispensed', 
                details=f"Dispensed medicines for prescription {prescription.id}"
            )
            
            # Notify doctor
            if prescription.ordered_by:
                Notification.objects.create(
                    recipient=prescription.ordered_by,
                    title='Medication Dispensed',
                    message=f"Medications have been dispensed for your patient {visit.patient.first_name}"
                )
            
            # Notify team about visit completion
            notify_team(visit.patient.project, ['ADMIN', 'NURSE'], "Visit Completed", f"All steps finalized for {visit.patient}")
            
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class DispensingRecordViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = DispensingRecord.objects.all()
    serializer_class = DispensingRecordSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = DispensingRecord.objects.all().order_by('-dispensed_at')
        
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
                queryset = queryset.filter(dispensed_by=user)
            elif user.project:
                queryset = queryset.filter(Q(prescription__visit__patient__project=user.project) | Q(prescription__visit__patient__employee_master__project=user.project))
            else:
                queryset = queryset.filter(dispensed_by=user)
        elif project_param:
            queryset = queryset.filter(Q(prescription__visit__patient__project_id=project_param) | Q(prescription__visit__patient__employee_master__project_id=project_param))

        return queryset
