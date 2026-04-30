from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Visit, Vitals, Consultation, Appointment
from .serializers import VisitSerializer, VitalsSerializer, ConsultationSerializer, AppointmentSerializer
from accounts.models import Notification
from accounts.utils import log_action
from patients.models import RegistryData, RegistryType
from django.db import transaction

# Removed local log_action, using accounts.utils instead

def notify_user(recipient, title, message):
    Notification.objects.create(recipient=recipient, title=title, message=message)

def notify_team(project, roles, title, message):
    """
    Notify all members of a specific project with specific roles.
    If project is None, notify all users with those roles (for global admins).
    """
    from accounts.models import User
    users = User.objects.all()
    if project:
        from django.db.models import Q
        users = users.filter(Q(project=project) | Q(role='ADMIN')) # Admins always get notified
        
    if roles:
        users = users.filter(role__in=roles)
        
    notifications = [Notification(recipient=u, title=title, message=message) for u in users]
    Notification.objects.bulk_create(notifications)

class VisitViewSet(viewsets.ModelViewSet):
    serializer_class = VisitSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = Visit.objects.all().order_by('-visit_date')
        
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
                queryset = queryset.filter(Q(patient__project_id=project_param) | Q(patient__employee_master__project_id=project_param))
        elif user.project:
            queryset = queryset.filter(Q(patient__project=user.project) | Q(patient__employee_master__project=user.project))
        elif is_admin:
            if project_param:
                queryset = queryset.filter(Q(patient__project_id=project_param) | Q(patient__employee_master__project_id=project_param))
        else:
            queryset = queryset.filter(patient__registered_by=user)

        status_param = self.request.query_params.get('status')
        active_only = self.request.query_params.get('active_only')
        
        if status_param:
            statuses = status_param.split(',')
            queryset = queryset.filter(status__in=statuses)
        
        if active_only:
            queryset = queryset.filter(is_active=True)
            
        return queryset

    def perform_create(self, serializer):
        visit = serializer.save()
        log_action(self.request.user, 'Clinical', 'Visit Created', f"Created visit for patient {visit.patient}")

    @action(detail=True, methods=['post'])
    def record_vitals(self, request, pk=None):
        visit = self.get_object()
        vitals_instance = getattr(visit, 'vitals', None)
        serializer = VitalsSerializer(vitals_instance, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save(visit=visit, recorded_by=request.user)
            visit.status = 'PENDING_CONSULTATION'
            visit.save()
            log_action(request.user, 'Clinical', 'Vitals Recorded', f"Recorded vitals for visit {visit.id}")
            
            # Notify Doctors that vitals are ready
            project_obj = visit.patient.project or (visit.patient.employee_master.project if visit.patient.is_employee_linked and visit.patient.employee_master else None)
            notify_team(project_obj, ['DOCTOR', 'ADMIN'], "Vitals Ready", f"Vitals recorded for {visit.patient}. Ready for consultation.")
            
            # Notify Patient
            if visit.patient.user:
                notify_user(visit.patient.user, "Vitals Recorded", "Your vital parameters have been successfully recorded and shared with your doctor.")
            
            return Response(serializer.data, status=status.HTTP_201_CREATED if not vitals_instance else status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def record_consultation(self, request, pk=None):
        visit = self.get_object()
        patient = visit.patient
        project_obj = patient.project or (patient.employee_master.project if patient.is_employee_linked and patient.employee_master else None)
        
        # Check if consultation already exists
        consult_instance = getattr(visit, 'consultation', None)
        serializer = ConsultationSerializer(consult_instance, data=request.data, partial=True)
        
        if serializer.is_valid():
            consult = serializer.save(visit=visit, doctor=request.user)
            
            next_step = request.data.get('next_step', 'PENDING_PHARMACY')
            visit.status = next_step
            
            # Handle Lab Request(s) creation - Supports both single and bulk investigations
            if next_step == 'PENDING_LAB':
                from laboratory.models import LabRequest, LabTestMaster
                investigations = request.data.get('lab_investigations', [])
                
                # Support legacy single field if no list provided
                if not investigations:
                    test_name = request.data.get('lab_test_name', 'General Physician Panel')
                    test_master_id = request.data.get('lab_test_master_id')
                    investigations = [{'name': test_name, 'id': test_master_id}]

                for inv in investigations:
                    test_master = None
                    if inv.get('id'):
                        test_master = LabTestMaster.objects.filter(id=inv.get('id')).first()
                    
                    LabRequest.objects.create(
                        visit=visit,
                        test_master=test_master,
                        test_name=inv.get('name', 'General Physician Panel'),
                        ordered_by=request.user,
                        status='PENDING'
                    )
                log_action(request.user, 'Laboratory', 'Labs Ordered', f"Ordered {len(investigations)} tests for patient {visit.patient}")

            # Handle Pharmacy Prescription creation & Inventory Deduction
            if next_step == 'PENDING_PHARMACY':
                from pharmacy.models import Prescription
                medications = request.data.get('medications', [])
                
                with transaction.atomic():
                    for med in medications:
                        med_name = med.get('name')
                        dosage = med.get('dosage', 'As directed')
                        freq = med.get('frequency', '1-0-1')
                        duration = med.get('duration', '5 days')
                        
                        presc = Prescription.objects.create(
                            visit=visit,
                            medication_name=med_name,
                            dosage=dosage,
                            frequency=freq,
                            duration=duration,
                            ordered_by=request.user,
                            status='PENDING'
                        )

                        # --- Stock Deduction Logic ---
                        if project_obj and med_name:
                            try:
                                # 1. Calculate required quantity
                                per_day = 0
                                if '-' in freq:
                                    per_day = sum(int(x) for x in freq.split('-') if x.strip().isdigit())
                                else:
                                    map_shorthand = {'OD': 1, 'BD': 2, 'TDS': 3, 'QID': 4, 'SOS': 1, 'HS': 1, 'STAT': 1}
                                    per_day = map_shorthand.get(freq.strip().upper(), 1)
                                
                                days_str = str(duration).split(' ')[0] # Handle "5 days" or "5"
                                days = int(''.join(filter(str.isdigit, days_str))) if any(c.isdigit() for c in days_str) else 1
                                total_needed = per_day * days

                                # 2. Find and update the Pharmacy Master Registry for this Project (Dynamic Lookup)
                                from django.db.models import Q
                                pharma_type = RegistryType.objects.filter(
                                    project=project_obj
                                ).filter(
                                    Q(icon='Pill') | Q(slug__icontains='pharmacy') | Q(name__icontains='pharmacy')
                                ).first()
                                
                                registry_slug = pharma_type.slug if pharma_type else 'pharmacy-drugs'

                                inv_item = RegistryData.objects.select_for_update().filter(
                                    registry_type__slug=registry_slug,
                                    registry_type__project=project_obj,
                                    name__iexact=med_name.strip()
                                ).first()

                                if inv_item:
                                    old_qty = inv_item.quantity
                                    inv_item.quantity = max(0, inv_item.quantity - total_needed)
                                    inv_item.save()
                                    # Structured log for reporting: [CONSUMPTION] DrugName | Quantity | ProjectID
                                    log_action(request.user, 'Inventory', 'Stock Deduction', 
                                              f"[CONSUMPTION] {med_name} | {total_needed} units | Project:{project_obj.id} (Visit #{visit.id})")
                                else:
                                    log_action(request.user, 'Inventory', 'Stock Warning', 
                                              f"Drug '{med_name}' not found in Project '{project_obj.name}' pharmacy registry.")
                            except Exception as e:
                                print(f"Inventory matching error: {str(e)}")
                    
                    log_action(request.user, 'Pharmacy', 'Prescription Created', f"Prescribed {len(medications)} meds for patient {visit.patient}")


            if next_step == 'COMPLETED':
                visit.is_active = False
                
            visit.save()
            log_action(request.user, 'Clinical', 'Consultation Saved', f"Saved consult for visit {visit.id}")

            # Notify Pharmacy if pending
            if next_step == 'PENDING_PHARMACY':
                notify_team(project_obj, ['PHARMACIST', 'ADMIN'], "New Prescription", f"New medication order for {visit.patient}.")
                if visit.patient.user:
                    notify_user(visit.patient.user, "Prescription Ready", "Your doctor has prescribed medications. Please proceed to the pharmacy.")
            # Notify Lab if pending
            elif next_step == 'PENDING_LAB':
                notify_team(project_obj, ['LAB_TECHNICIAN', 'ADMIN'], "New Lab Request", f"New lab tests ordered for {visit.patient}.")
                if visit.patient.user:
                    notify_user(visit.patient.user, "Laboratory Investigations Ordered", "Your doctor has requested laboratory tests. Please visit the lab for sample collection.")
            elif next_step == 'COMPLETED':
                if visit.patient.user:
                    notify_user(visit.patient.user, "Clinical Session Completed", "Your clinical visit is now complete. You can download your report from the portal.")

            return Response(serializer.data, status=status.HTTP_201_CREATED if not consult_instance else status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class VitalsViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Vitals.objects.all()
    serializer_class = VitalsSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = Vitals.objects.all().order_by('-recorded_at')
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
                queryset = queryset.filter(Q(visit__patient__project=user.project) | Q(visit__patient__employee_master__project=user.project))
            else:
                queryset = queryset.filter(recorded_by=user)
        elif project_param:
            queryset = queryset.filter(Q(visit__patient__project_id=project_param) | Q(visit__patient__employee_master__project_id=project_param))
        return queryset

class ConsultationViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Consultation.objects.all()
    serializer_class = ConsultationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = Consultation.objects.all().order_by('-created_at')
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
                queryset = queryset.filter(doctor=user)
            elif user.project:
                queryset = queryset.filter(Q(visit__patient__project=user.project) | Q(visit__patient__employee_master__project=user.project))
            else:
                queryset = queryset.filter(doctor=user)
        elif project_param:
            queryset = queryset.filter(Q(visit__patient__project_id=project_param) | Q(visit__patient__employee_master__project_id=project_param))
        return queryset

class AppointmentViewSet(viewsets.ModelViewSet):
    serializer_class = AppointmentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = Appointment.objects.all().order_by('appointment_date')
        
        user = self.request.user
        is_admin = user.role == 'ADMIN' or user.is_superuser or user.user_roles.filter(name='ADMIN').exists()
        project_param = self.request.query_params.get('project')
        
        from django.db.models import Q
        if user.is_superuser:
            if project_param:
                queryset = queryset.filter(Q(patient__project_id=project_param) | Q(patient__employee_master__project_id=project_param))
        elif user.role == 'PATIENT':
            queryset = queryset.filter(patient__patient_id=user.username)
        elif user.project:
            queryset = queryset.filter(Q(patient__project=user.project) | Q(patient__employee_master__project=user.project))
        elif is_admin:
            if project_param:
                queryset = queryset.filter(Q(patient__project_id=project_param) | Q(patient__employee_master__project_id=project_param))
        else:
            queryset = queryset.filter(patient__registered_by=user)

        # Allow filtering by date (YYYY-MM-DD) or range
        date_param = self.request.query_params.get('date')
        from_date = self.request.query_params.get('from_date')
        to_date = self.request.query_params.get('to_date')

        if date_param:
            queryset = queryset.filter(appointment_date__date=date_param)
        elif from_date and to_date:
            queryset = queryset.filter(appointment_date__date__range=[from_date, to_date])
            
        return queryset

    @action(detail=True, methods=['post'])
    def confirm(self, request, pk=None):
        appt = self.get_object()
        if appt.status != 'SCHEDULED':
            return Response({"error": "Can only confirm pending scheduled appointments"}, status=status.HTTP_400_BAD_REQUEST)
        
        # Professional Slot Allocation: Allow adjusting date/time range during acknowledgment
        new_start = request.data.get('appointment_date')
        new_end = request.data.get('end_time')
        
        if new_start:
            appt.appointment_date = new_start
        if new_end:
            appt.end_time = new_end
            
        appt.status = 'CONFIRMED'
        appt.save()
        
        log_action(request.user, 'Clinical', 'Appointment Confirmed', f"Administrative slot allocation for appt {appt.id}")
        return Response({"message": "Appointment acknowledged and slot allocated successfully"}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def acknowledge(self, request, pk=None):
        """Allows a patient to formally acknowledge their confirmed clinical slot."""
        appt = self.get_object()
        if appt.status != 'CONFIRMED':
            return Response({"error": "Can only acknowledge confirmed slots"}, status=status.HTTP_400_BAD_REQUEST)
        
        appt.status = 'PATIENT_ACKNOWLEDGED'
        appt.save()
        return Response({"status": "Appointment acknowledged by patient"})

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """Allows a patient to formally reject a proposed clinical slot."""
        appt = self.get_object()
        if appt.status != 'CONFIRMED':
            return Response({"error": "Can only reject proposed slots"}, status=status.HTTP_400_BAD_REQUEST)
        
        appt.status = 'REJECTED'
        appt.save()
        return Response({"status": "Appointment rejected by patient"})

    @action(detail=True, methods=['post'])
    def check_in(self, request, pk=None):
        appt = self.get_object()
        if appt.status == 'CHECKED_IN':
            return Response({"error": "Already checked in"}, status=status.HTTP_400_BAD_REQUEST)
        
        # 1. Update Appointment
        appt.status = 'CHECKED_IN'
        appt.save()
        
        # 2. Create Visit (Starts the workflow)
        from clinical.models import Visit # Ensure within method if needed
        Visit.objects.create(
            patient=appt.patient,
            reason=f"Appointment Check-in: {appt.reason}",
            status='PENDING_VITALS'
        )
        
        log_action(request.user, 'Clinical', 'Appointment Checked In', f"Patient {appt.patient} arrived for appointment {appt.id}")
        
        # Notify Nursing for Vitals
        project_obj = appt.patient.project or (appt.patient.employee_master.project if appt.patient.is_employee_linked and appt.patient.employee_master else None)
        notify_team(project_obj, ['NURSE', 'ADMIN'], "Patient Checked In", f"{appt.patient} arrived and is waiting for vitals.")
        
        return Response({"message": "Checked in successfully"}, status=status.HTTP_200_OK)

    def perform_create(self, serializer):
        user = self.request.user
        patient = None
        
        # Automatically associate patient if user is a patient profile
        if hasattr(user, 'patient_profile'):
            patient = user.patient_profile
        
        # Allow overriding if provided (for admins)
        target_patient = serializer.validated_data.get('patient', patient)
        
        if not target_patient:
            from rest_framework.exceptions import ValidationError
            raise ValidationError({"error": "Patient profile not found"})

        # Edge Case: Check for active visits (ongoing clinical session)
        from clinical.models import Visit
        active_visit = Visit.objects.filter(patient=target_patient, is_active=True).exists()
        if active_visit:
            from rest_framework.exceptions import ValidationError
            raise ValidationError({"error": "You currently have an active clinical visit in progress. Please complete your current session before scheduling a new appointment."})

        serializer.save(patient=target_patient)
        log_action(user, 'Clinical', 'Appointment Created', f"Scheduled appt for patient {target_patient}")
