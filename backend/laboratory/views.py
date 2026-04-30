from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
import time
from .models import LabRequest, LabResult, LabTestMaster, LabSubTest, LabDepartment, LabTestType, LabMachine, LabMachineData, LabSyncAudit, LabProjectBridge
from .serializers import (
    LabRequestSerializer, LabResultSerializer, LabTestMasterSerializer, 
    LabSubTestSerializer, LabDepartmentSerializer, LabTestTypeSerializer, 
    LabMachineSerializer, LabMachineDataSerializer, LabProjectBridgeSerializer
)

from accounts.models import Notification
from patients.models import Patient
from accounts.utils import log_action
from django.core.cache import cache
from django.utils import timezone
import json
import secrets
import hashlib

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

from .permissions import HasMachineSyncKey

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
        if user.is_superuser:
            if project_param:
                queryset = queryset.filter(Q(visit__patient__project_id=project_param) | Q(visit__patient__employee_master__project_id=project_param))
        elif user.project:
            queryset = queryset.filter(Q(visit__patient__project=user.project) | Q(visit__patient__employee_master__project=user.project))
        elif is_admin:
            if project_param:
                queryset = queryset.filter(Q(visit__patient__project_id=project_param) | Q(visit__patient__employee_master__project_id=project_param))
        else:
            queryset = queryset.filter(ordered_by=user)

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
            
            # One-step workflow supports saving sample_type here
            sample_type = request.data.get('sample_type')
            if sample_type:
                lab_request.sample_type = sample_type
                if not lab_request.sample_collected_at:
                    lab_request.sample_collected_at = timezone.now()
                    lab_request.sample_collected_by = request.user
            
            lab_request.status = 'COMPLETED'
            lab_request.save()
            
            # Update visit status to Final Prescription phase
            visit = lab_request.visit
            visit.status = 'FINAL_CONSULTATION'
            visit.save()
            
            log_action(
                request.user, 
                'Laboratory', 
                'Result Recorded', 
                f"Results recorded for request {lab_request.id}"
            )
            
            if visit.consultation and visit.consultation.doctor:
                Notification.objects.create(
                    recipient=visit.consultation.doctor,
                    title='Lab Results Ready',
                    message=f"Lab Results are ready for patient {visit.patient.first_name}"
                )
            
            # Notify Patient
            if visit.patient.user:
                Notification.objects.create(
                    recipient=visit.patient.user,
                    title='Laboratory Results Released',
                    message=f"Your laboratory results for {lab_request.test_name} are now available in your portal."
                )
            
            # Also notify any admins or other lab techs in the project about completion
            notify_team(visit.patient.project, ['ADMIN', 'LAB_TECH'], "Lab Job Completed", f"Results finalized for {visit.patient}")
                
            return Response(serializer.data, status=status.HTTP_201_CREATED if not result_instance else status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


    @action(detail=False, methods=['post'], permission_classes=[HasMachineSyncKey])
    def sync_batch(self, request):
        """
        Platinum-Tier Asynchronous Ingestion with Idempotency.
        Dispatches massive diagnostic results to the 'bulk' queue cluster.
        """
        results_batch = request.data.get('results', [])
        if not results_batch:
            return Response({"status": "Success", "message": "Heartbeat pulse received."}, status=200)

        # 1. Idempotency Check (Prevent Duplicates across 1,000+ labs)
        # Using a hash of the first 5 records as a 'Batch Fingerprint'
        import hashlib, json
        from django_redis import get_redis_connection
        
        batch_id = None
        try:
            batch_fingerprint = hashlib.sha256(json.dumps(results_batch[:5]).encode()).hexdigest()
            redis_conn = get_redis_connection("default")
            
            if redis_conn.get(f"EMR_IDEMPOTENCY_{batch_fingerprint}"):
                return Response({
                    "status": "Success",
                    "message": "Duplicate batch ignored (already processed)."
                }, status=status.HTTP_200_OK)

            # Set 2-hour window for idempotency
            redis_conn.set(f"EMR_IDEMPOTENCY_{batch_fingerprint}", "1", ex=7200)
        except Exception as redis_err:
            request.redis_failed = True
            print(f"CRITICAL: Redis Connection Failed. Idempotency check bypassed. Error: {redis_err}")

        # 2. Priority Routing: Move heavy data to 'bulk' lane
        from .tasks import process_sync_batch
        
        # Identity Context
        machine = getattr(request, 'sync_machine', None)
        project = getattr(request, 'sync_project', None)
        project_id = project.id if project else None
        
        # TELEMETRY START
        start_time = time.time()
        
        try:
            process_sync_batch.apply_async(
                args=[results_batch], 
                kwargs={'forced_project_id': project_id, 'machine_pk': machine.id if machine else None},
                queue='bulk'
            )
        except Exception as celery_err:
            request.redis_failed = True
            print(f"WARN: Celery/Redis Broker Unreachable. Executing Task Synchronously. Error: {celery_err}")
            # SYNC FALLBACK: Process immediately if background queue is down
            process_sync_batch(results_batch, forced_project_id=project_id, machine_pk=machine.id if machine else None)
        
        # Update Telemetry & Heartbeat
        latency = (time.time() - start_time) * 1000
        if machine:
            telemetry = machine.telemetry_data or {}
            telemetry['total_batches'] = telemetry.get('total_batches', 0) + 1
            telemetry['total_records'] = telemetry.get('total_records', 0) + len(results_batch)
            
            # Simple moving average for latency visualization
            old_avg = telemetry.get('avg_latency_ms', 0)
            telemetry['avg_latency_ms'] = round((old_avg * 0.8) + (latency * 0.2), 2)
            telemetry['last_ip'] = request.META.get('HTTP_X_FORWARDED_FOR', request.META.get('REMOTE_ADDR'))
            
            machine.telemetry_data = telemetry
            machine.last_synced_at = timezone.now()
            machine.save(update_fields=['telemetry_data', 'last_synced_at'])

        response_payload = {
            "status": "Success", 
            "message": f"Processed {len(results_batch)} records.",
            "mode": "ASYNC" if not getattr(request, 'redis_failed', False) else "SYNC_FALLBACK",
            "latency_ms": round(latency, 2)
        }

        # SELF-HEALING LOGIC: Server-side maintenance override
        if machine and machine.maintenance_mode:
            response_payload["cmd"] = "RESET"
            machine.maintenance_mode = False
            machine.save(update_fields=['maintenance_mode'])

        return Response(response_payload, status=status.HTTP_202_ACCEPTED)



    @action(detail=True, methods=['post'])
    def collect_sample(self, request, pk=None):

        lab_request = self.get_object()
        sample_type = request.data.get('sample_type', 'Blood')
        
        lab_request.status = 'COLLECTED'
        lab_request.sample_type = sample_type
        lab_request.sample_collected_by = request.user
        lab_request.save()
        
        log_action(
            request.user, 
            'Laboratory', 
            'Sample Collected', 
            f"Sample collected for request {lab_request.id}"
        )
        
        return Response({'status': 'Sample Collected'}, status=status.HTTP_200_OK)

class LabMachineViewSet(viewsets.ModelViewSet):
    """
    Registry Management for 1000+ Machine Locations.
    Used to link unique machine combinations to specific Projects.
    """
    queryset = LabMachine.objects.all()
    serializer_class = LabMachineSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = LabMachine.objects.all().select_related('project')
        project_id = self.request.query_params.get('project')
        if project_id:
            queryset = queryset.filter(project_id=project_id)
        return queryset

    @action(detail=False, methods=['get'], url_path='registry-list', permission_classes=[permissions.AllowAny])
    def registry_list(self, request):
        """
        DIRECT UI BRIDGE: Bypasses all routing errors to get the machines for your dropdown.
        """
        # We explicitly fetch the records and include project details
        machines = LabMachine.objects.all().select_related('project')
        
        results = []
        for m in machines:
            results.append({
                "id": m.id,
                "machine_id": m.machine_id,
                "machine_name": m.machine_name,
                "lab_id": m.lab_id,
                "location": m.location,
                "is_linked": m.project_id is not None,
                "project_id": m.project_id, # Added for frontend dropdown select
                "project_name": m.project.name if m.project else "UNASSIGNED",
                "composite_identity": m.composite_identity,
                "sync_key": m.sync_key,
                "last_pulse": m.last_synced_at.isoformat() if m.last_synced_at else None,
                "is_online": (timezone.now() - m.last_synced_at).total_seconds() < 90 if m.last_synced_at else False
            })
            
        print(f"DELIVERING {len(results)} MACHINES TO DROPDOWN")
        return Response(results, content_type='application/json')

    @action(detail=True, methods=['post'], url_path='generate-key')
    def generate_key(self, request, pk=None):
        """
        SECURITY: Provision a unique cryptographically secure 32-char token for this lab station.
        """
        machine = self.get_object()
        if not machine.sync_key:
            machine.sync_key = secrets.token_hex(16) # 32 chars
            machine.save()
            return Response({"status": "Key Generated", "sync_key": machine.sync_key})
        return Response({"status": "Key exists", "sync_key": machine.sync_key}, status=400)

    @action(detail=True, methods=['post'], url_path='rotate-key')
    def rotate_key(self, request, pk=None):
        """
        GOVERNANCE: Regenerate a key (Revokes the old one immediately).
        """
        machine = self.get_object()
        new_key = secrets.token_hex(16)
        machine.sync_key = new_key
        machine.save()
        return Response({"status": "Key Rotated Successfully", "sync_key": new_key})

    @action(detail=False, methods=['post'], url_path='link_discovery')
    def link_discovery(self, request):
        """
        ACTION: Links a specific Machine Combination to a Project.
        This will retroactively update all historical records in LabMachineData.
        """
        machine_db_id = request.data.get('machine_db_id')
        project_id = request.data.get('project_id')
        
        # Fallback for manual parameters
        m_id = request.data.get('machine_id')
        
        if 'project_id' not in request.data or (not machine_db_id and not m_id):
            return Response({"error": "Missing ID or Project"}, status=400)
            
        try:
            # 1. Resolve the machine identity
            if machine_db_id:
                machine = LabMachine.objects.get(id=machine_db_id)
            else:
                composite_id = f"{m_id}|{request.data.get('machine_name')}|{request.data.get('lab_id')}|{request.data.get('location')}"
                machine, _ = LabMachine.objects.get_or_create(composite_identity=composite_id, defaults={
                    'machine_id': m_id,
                    'machine_name': request.data.get('machine_name'),
                    'lab_id': request.data.get('lab_id'),
                    'location': request.data.get('location')
                })

            # 2. Update the Main Registry
            target_project_id = project_id if project_id else None
            machine.project_id = target_project_id
            machine.save()
            
            # 3. Retroactive Mirroring: Assign all historic data from this machine to the project
            updated_count = LabMachineData.objects.filter(
                machine_id=machine.machine_id,
                machine_name=machine.machine_name,
                lab_id=machine.lab_id,
                location=machine.location
            ).update(project_id=target_project_id)

            # 4. Sibling Discovery: Link all other detached machines at this exact location
            # This helps auto-configure multiple machines (WBC, Biochemistry, etc.) at the same site.
            siblings_linked = 0
            if target_project_id:
                siblings_linked = LabMachine.objects.filter(
                    lab_id=machine.lab_id,
                    location=machine.location,
                    project__isnull=True
                ).update(project_id=target_project_id)
            
            p_name = machine.project.name if machine.project else "UNASSIGNED"
            
            return Response({
                "status": "Success",
                "message": f"Associated with {p_name}. {updated_count} records updated. {siblings_linked} sibling machines linked."
            })
        except Exception as e:
            return Response({"error": str(e)}, status=500)

    @action(detail=True, methods=['get'], url_path='sync-audit', permission_classes=[permissions.AllowAny])
    def sync_audit(self, request, pk=None):
        """
        FETCH: The detailed 'sent vs received' audit trail for a specific location.
        """
        machine = self.get_object()
        audits = LabSyncAudit.objects.filter(machine=machine).order_by('-received_at')[:50]
        
        data = [{
            "id": a.id,
            "batch_size": a.batch_size,
            "success_count": a.success_count,
            "failed_count": a.failed_count,
            "received_at": a.received_at.isoformat(),
            "status": "Success" if a.is_success else "Fail"
        } for a in audits]
        
        return Response(data)

    @action(detail=True, methods=['get'], url_path='download-audit', permission_classes=[permissions.AllowAny])
    def download_audit(self, request, pk=None):
        """
        DOWNLOAD: CSV Export of all synchronization activities for this location.
        """
        import csv
        from django.http import HttpResponse
        
        machine = self.get_object()
        audits = LabSyncAudit.objects.filter(machine=machine).order_by('-received_at')
        
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="sync_audit_{machine.machine_id}.csv"'
        
        writer = csv.writer(response)
        writer.writerow(['TIMESTAMP', 'BATCH SIZE', 'RECEIVED COUNT', 'FAILED COUNT', 'STATUS'])
        
        for a in audits:
            writer.writerow([
                a.received_at.strftime('%Y-%m-%d %H:%M:%S'),
                a.batch_size,
                a.success_count,
                a.failed_count,
                "SUCCESS" if a.is_success else "FAILED"
            ])
            
        return response

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
        if user.is_superuser:
            if project_param:
                queryset = queryset.filter(Q(lab_request__visit__patient__project_id=project_param) | Q(lab_request__visit__patient__employee_master__project_id=project_param))
        elif user.project:
            queryset = queryset.filter(Q(lab_request__visit__patient__project=user.project) | Q(lab_request__visit__patient__employee_master__project=user.project))
        elif is_admin:
            if project_param:
                queryset = queryset.filter(Q(lab_request__visit__patient__project_id=project_param) | Q(lab_request__visit__patient__employee_master__project_id=project_param))
        else:
            queryset = queryset.filter(recorded_by=user)

        return queryset

class LabTestMasterViewSet(viewsets.ModelViewSet):
    queryset = LabTestMaster.objects.all().prefetch_related('sub_tests')
    serializer_class = LabTestMasterSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = LabTestMaster.objects.all().prefetch_related('sub_tests')
        project_id = self.request.query_params.get('project')
        if project_id:
            queryset = queryset.filter(project_id=project_id)
        elif not self.request.user.is_superuser and self.request.user.project:
             queryset = queryset.filter(project=self.request.user.project)
        return queryset

    def perform_create(self, serializer):
        serializer.save()
        log_action(self.request.user, 'Governance', 'Lab Test Created', f"Defined new lab test master: {serializer.validated_data['name']}")

class LabSubTestViewSet(viewsets.ModelViewSet):
    queryset = LabSubTest.objects.all()
    serializer_class = LabSubTestSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = LabSubTest.objects.all()
        test_id = self.request.query_params.get('lab_test')
        if test_id:
            queryset = queryset.filter(lab_test_id=test_id)
        return queryset

class LabDepartmentViewSet(viewsets.ModelViewSet):
    queryset = LabDepartment.objects.all()
    serializer_class = LabDepartmentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = LabDepartment.objects.all()
        project_id = self.request.query_params.get('project')
        if project_id:
            queryset = queryset.filter(project_id=project_id)
        elif not self.request.user.is_superuser and self.request.user.project:
             queryset = queryset.filter(project=self.request.user.project)
        return queryset

class LabTestTypeViewSet(viewsets.ModelViewSet):
    queryset = LabTestType.objects.all()
    serializer_class = LabTestTypeSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = LabTestType.objects.all()
        project_id = self.request.query_params.get('project')
        if project_id:
            queryset = queryset.filter(project_id=project_id)
        elif not self.request.user.is_superuser and self.request.user.project:
             queryset = queryset.filter(project=self.request.user.project)
        return queryset


class LabMachineDataViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = LabMachineData.objects.all().order_by('-received_at_machine')
    serializer_class = LabMachineDataSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = LabMachineData.objects.all().order_by('-received_at_machine')
        patient_id = self.request.query_params.get('patient_id')
        if patient_id:
            queryset = queryset.filter(patient_id=patient_id)
        return queryset

class LabProjectBridgeViewSet(viewsets.ModelViewSet):
    """
    GOVERNANCE: Unified access for Project-Wide Sync Keys and Security Policies.
    """
    queryset = LabProjectBridge.objects.all()
    serializer_class = LabProjectBridgeSerializer
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=False, methods=['get'], url_path='get-by-project')
    def get_by_project(self, request):
        project_id = request.query_params.get('project')
        if not project_id:
            return Response({"error": "Project ID required"}, status=400)
        
        bridge, created = LabProjectBridge.objects.get_or_create(project_id=project_id)
        serializer = self.get_serializer(bridge)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='rotate-key')
    def rotate_key(self, request, pk=None):
        bridge = self.get_object()
        bridge.sync_key = secrets.token_hex(16)
        bridge.save()
        return Response({"sync_key": bridge.sync_key})

