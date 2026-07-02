from rest_framework import viewsets, permissions, status, views
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Sum, F, Q, Count, DecimalField, ExpressionWrapper
from django.utils import timezone
from datetime import timedelta, datetime
from patients.models import RegistryData, RegistryType, EmployeeMaster
from .models import Prescription, DispensingRecord, Indent, IndentItem, RoomStock, RoomStockTransfer, RoomStockDispensation, FacilityRoom, UserRoomAssignment
from .serializers import PrescriptionSerializer, DispensingRecordSerializer, IndentSerializer, IndentItemSerializer, RoomStockSerializer, RoomStockDispensationSerializer, FacilityRoomSerializer, UserRoomAssignmentSerializer
from accounts.models import Notification
from accounts.utils import log_action
from .reports import generate_consumption_pdf_report, generate_consumption_xlsx_report
from django.http import HttpResponse

def notify_team(project, roles, title, message):
    from accounts.models import User
    users = User.objects.all()
    if project:
        from django.db.models import Q
        users = users.filter(Q(project=project) | Q(role='ADMIN'))
    if roles:
        users = users.filter(role__in=roles)
    notifications = [Notification(recipient=u, project=project, title=title, message=message) for u in users]
    Notification.objects.bulk_create(notifications)

from rest_framework.pagination import PageNumberPagination

class LargeResultsPagination(PageNumberPagination):
    page_size = 30
    page_size_query_param = 'page_size'
    max_page_size = 1000

class PrescriptionViewSet(viewsets.ModelViewSet):
    serializer_class = PrescriptionSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = LargeResultsPagination

    def get_queryset(self):
        queryset = Prescription.objects.all().order_by('created_at')
        
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
            queryset = queryset.filter(status=status_param)
            if status_param == 'PENDING':
                queryset = queryset.filter(visit__status='PENDING_PHARMACY')

        search_query = self.request.query_params.get('search', '').strip()
        if search_query:
            import re
            card_match = re.search(r'\b(?:BHSPL)?(\d{4})(?:/\d+)?\b', search_query, re.IGNORECASE)
            if not card_match:
                card_match = re.search(r'\b(\d+)(?:/\d+)?\b', search_query)
            
            card_q = Q()
            if card_match:
                base_card = card_match.group(1)
                if base_card.isdigit():
                    base_card = base_card.zfill(4)
                card_q = Q(visit__patient__card_no=base_card) | Q(visit__patient__card_no__startswith=f"{base_card}/")

            queryset = queryset.filter(
                Q(visit__patient__first_name__icontains=search_query) |
                Q(visit__patient__last_name__icontains=search_query) |
                Q(visit__patient__patient_id__icontains=search_query) |
                Q(visit__patient__phone__icontains=search_query) |
                Q(visit__patient__card_no__icontains=search_query) |
                Q(visit__patient__employee_master__additional_fields__employee_id__icontains=search_query) |
                Q(medication_name__icontains=search_query) |
                card_q
            ).distinct()

        return queryset

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        prescription = self.get_object()
        prescription.status = 'CANCELLED'
        prescription.remarks = request.data.get('remarks', 'Marked Out of Stock')
        prescription.save()
        
        log_action(
            request.user, 
            'Pharmacy', 
            'Medication Out of Stock', 
            f"[OUT OF STOCK] {prescription.medication_name} | Visit ID: {prescription.visit.id}"
        )
        return Response({'status': 'marked out of stock'})

    @action(detail=True, methods=['post'])
    def finalize_visit(self, request, pk=None):
        prescription = self.get_object()
        visit = prescription.visit
        visit.status = 'COMPLETED'
        visit.is_active = False
        visit.save()
        
        log_action(
            request.user, 
            'Pharmacy', 
            'Visit Finalized', 
            f"[FINALIZED] Visit ID: {visit.id}"
        )
        return Response({'status': 'visit finalized'})

    @action(detail=True, methods=['post'])
    def dispense(self, request, pk=None):
        prescription = self.get_object()
        visit = prescription.visit
        
        # Check if associated employee is active
        if visit.patient.employee_master and not visit.patient.employee_master.is_active:
            return Response(
                {"error": "Cannot dispense medication. The associated employee card is deactivated (e.g. transferred)."},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        serializer = DispensingRecordSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(prescription=prescription, dispensed_by=request.user)
            prescription.status = 'DISPENSED'
            prescription.save()
            
            log_action(
                request.user, 
                'Pharmacy', 
                'Medication Dispensed', 
                f"[CONSUMPTION] {prescription.medication_name} | {serializer.instance.quantity} | Project:{visit.patient.project_id if visit.patient.project else 'NONE'} | ID:{prescription.id}"
            )

            # --- PROJECT-SPECIFIC AUTO-DEDUCTIVE INVENTORY ENGINE ---
            try:
                # 1. Resolve Project (Check Patient first, then Employee Master)
                p_project = visit.patient.project
                if not p_project and visit.patient.employee_master:
                    p_project = visit.patient.employee_master.project

                if p_project:
                    # 2. Locate the specific Pharmacy Registry for this project
                    pharmacy_registry = RegistryType.objects.filter(
                        project=p_project, 
                        slug__icontains='pharmacy'
                    ).first()

                    if pharmacy_registry:
                        # 3. Find the drug by Code, Name OR Alias (Case-Insensitive)
                        drug_item = None
                        if prescription.item_code:
                            # Match ONLY by ucode first to avoid incorrect name matching
                            drug_item = RegistryData.objects.filter(
                                registry_type=pharmacy_registry,
                                ucode__iexact=prescription.item_code
                            ).first()
                            if not drug_item:
                                drug_item = RegistryData.objects.filter(
                                    registry_type=pharmacy_registry,
                                    name__iexact=prescription.item_code
                                ).first()
                        
                        if not drug_item:
                            search_name = prescription.medication_name.strip()
                            drug_item = RegistryData.objects.filter(
                                registry_type=pharmacy_registry
                            ).filter(
                                Q(name__iexact=search_name) | Q(aliases__icontains=search_name)
                            ).first()

                        if drug_item:
                            # 4. FEFO Batch-Level Deduction & Split-Batch Transaction Generator
                            qty_to_deduct = serializer.instance.quantity
                            chunks = []
                            
                            from .models import DrugBatch
                            active_batches = DrugBatch.objects.filter(registry_item=drug_item, quantity__gt=0).order_by('expiry_date')
                            
                            if active_batches.exists():
                                remaining = qty_to_deduct
                                for b in active_batches:
                                    batch_cost = b.unit_cost or drug_item.cost or 0
                                    
                                    if b.quantity >= remaining:
                                        chunks.append({
                                            'batch': b,
                                            'qty': remaining,
                                            'cost': float(batch_cost)
                                        })
                                        b.quantity -= remaining
                                        b.save()
                                        remaining = 0
                                        break
                                    else:
                                        if b.quantity > 0:
                                            chunks.append({
                                                'batch': b,
                                                'qty': b.quantity,
                                                'cost': float(batch_cost)
                                            })
                                            remaining -= b.quantity
                                            b.quantity = 0
                                            b.save()
                                
                                # Fallback: if we need more than we have in active batches, charge the remaining at master price
                                if remaining > 0:
                                    chunks.append({
                                        'batch': None,
                                        'qty': remaining,
                                        'cost': float(drug_item.cost or 0.0)
                                    })
                                
                                # Process database records based on split chunks
                                if chunks:
                                    # Update the original record with the first chunk's details
                                    first_chunk = chunks[0]
                                    serializer.instance.batch = first_chunk['batch']
                                    serializer.instance.quantity = first_chunk['qty']
                                    serializer.instance.unit_cost = first_chunk['cost']
                                    serializer.instance.total_cost = float(first_chunk['qty']) * float(first_chunk['cost'])
                                    serializer.instance.save()
                                    
                                    # Create new individual records for the other chunks
                                    for chunk in chunks[1:]:
                                        DispensingRecord.objects.create(
                                            prescription=prescription,
                                            dispensed_by=request.user,
                                            batch=chunk['batch'],
                                            quantity=chunk['qty'],
                                            unit_cost=chunk['cost'],
                                            total_cost=float(chunk['qty']) * float(chunk['cost']),
                                            dispensed_at=serializer.instance.dispensed_at
                                        )
                                
                                # Synchronize parent quantity with sum of batches
                                total_batch_stock = DrugBatch.objects.filter(registry_item=drug_item).aggregate(total=Sum('quantity'))['total'] or 0
                                drug_item.quantity = total_batch_stock
                                drug_item.save(update_fields=['quantity'])
                            else:
                                # Legacy/Fallback: direct deduction if no batches exist
                                serializer.instance.unit_cost = float(drug_item.cost or 0.0)
                                serializer.instance.total_cost = float(qty_to_deduct) * float(drug_item.cost or 0.0)
                                serializer.instance.save()
                                
                                drug_item.refresh_from_db()
                                drug_item.quantity = max(0, drug_item.quantity - qty_to_deduct)
                                drug_item.save(update_fields=['quantity'])
                        else:
                            print(f"[PHARMACY LOG] Drug '{search_name}' not found in Registry for Project {p_project.name}")
                    else:
                        print(f"[PHARMACY LOG] No Pharmacy Registry found for Project {p_project.name}")
                else:
                    print(f"[PHARMACY LOG] Patient {visit.patient} is not linked to any Project. Skipping cost capture.")

            except Exception as e:
                # Log error but don't block dispensing (Clinical priority)
                print(f"[PHARMACY CRITICAL ERROR] Inventory Deduction failed: {e}")
            
            # Notify doctor
            if prescription.ordered_by:
                Notification.objects.create(
                    recipient=prescription.ordered_by,
                    project=visit.patient.project,
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
    pagination_class = None

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
        if user.is_superuser:
            if project_param:
                queryset = queryset.filter(Q(prescription__visit__patient__project_id=project_param) | Q(prescription__visit__patient__employee_master__project_id=project_param))
        elif user.project:
            queryset = queryset.filter(Q(prescription__visit__patient__project=user.project) | Q(prescription__visit__patient__employee_master__project=user.project))
        elif is_admin:
            if project_param:
                queryset = queryset.filter(Q(prescription__visit__patient__project_id=project_param) | Q(prescription__visit__patient__employee_master__project_id=project_param))
        else:
            queryset = queryset.filter(dispensed_by=user)

        batch_param = self.request.query_params.get('batch')
        if batch_param:
            queryset = queryset.filter(batch_id=batch_param)

        return queryset
    
    @action(detail=False, methods=['post'])
    def bulk_historical_upload(self, request):
        """
        Elite Admin Tool: Batch process historical consumption data.
        Input: List of { date, card_no, medication_name, quantity, project_id }
        """
        user = request.user
        is_admin = user.role == 'ADMIN' or user.is_superuser or user.user_roles.filter(name='ADMIN').exists()
        
        if not is_admin:
            has_permission = False
            for r in user.user_roles.all():
                if isinstance(r.permissions, list) and '/reports/bulk-import' in r.permissions:
                    has_permission = True
                    break
            if not has_permission:
                return Response({"error": "Access Restricted: You do not have permission to perform bulk historical upload. Please contact the administrator."}, status=403)

        data_list = request.data.get('records', [])
        if not data_list:
            return Response({"error": "No records provided"}, status=400)
            
        from patients.models import Patient
        from clinical.models import Visit
        from django.db import transaction
        
        created_count = 0
        errors = []
        
        with transaction.atomic():
            for idx, item in enumerate(data_list):
                try:
                    card_no = item.get('card_no')
                    med_name = item.get('medication_name')
                    qty = int(item.get('quantity', 0))
                    date_str = item.get('date')
                    
                    # 1. Find Patient (Support both legacy Patient and new RegistryData)
                    from patients.models import RegistryData, Patient
                    u_project = request.user.project
                    patient = None
                    patient_name = "Unknown"
                    
                    # Try Legacy Patient table first
                    p_query = Patient.objects.filter(card_no=card_no)
                    if u_project:
                        p_query = p_query.filter(Q(project=u_project) | Q(employee_master__project=u_project))
                    legacy_patient = p_query.first()
                    
                    if legacy_patient:
                        patient = legacy_patient
                        patient_name = f"{patient.first_name} {patient.last_name}"
                    else:
                        # Try New RegistryData (Unified Master Registry)
                        r_query = RegistryData.objects.filter(ucode=card_no, registry_type__type_category='PERSONNEL_PRIMARY')
                        if u_project:
                            r_query = r_query.filter(registry_type__project=u_project)
                        
                        reg_patient = r_query.first()
                        if reg_patient:
                            patient = reg_patient
                            patient_name = reg_patient.name
                    
                    if not patient:
                        errors.append(f"Row {idx+1}: Card No {card_no} not found in Patients or Registry for this project.")
                        continue
                    
                    # --- SMART DRUG MATCHING FOR HISTORICAL DATA ---
                    # Use the same Triple-Layer logic as live dispensing
                    # For RegistryData, we use the project from its registry_type
                    p_project = u_project
                    if hasattr(patient, 'project'):
                        p_project = patient.project or u_project
                    elif hasattr(patient, 'registry_type'):
                        p_project = patient.registry_type.project
                    drug_name_in_report = med_name # Display name for the report
                    
                    if p_project:
                        try:
                            drug_item = None
                            # Search for the standardized pharmacy registry
                            pharmacy_registry = RegistryType.objects.filter(project=p_project).filter(Q(slug='pharmacy') | Q(slug='pharmacy_drugs') | Q(icon='Pill')).first()
                            
                            if pharmacy_registry:
                                # Smart Search: Try exact match first, then partial name match
                                search_term = med_name.strip()
                                drug_item = RegistryData.objects.filter(
                                    registry_type=pharmacy_registry
                                ).filter(
                                    Q(ucode__iexact=search_term) | 
                                    Q(name__iexact=search_term) |
                                    Q(name__icontains=search_term) |
                                    Q(aliases__icontains=search_term)
                                ).first()
                                
                                if drug_item:
                                    drug_name_in_report = drug_item.name
                                else:
                                    # Auto-create the medication in the master registry!
                                    raw_price = item.get('price') or item.get('unit_price')
                                    try:
                                        init_price = float(raw_price) if raw_price else 0.0
                                    except Exception:
                                        init_price = 0.0
                                    
                                    search_term = med_name.strip()
                                    drug_item, created = RegistryData.objects.get_or_create(
                                        registry_type=pharmacy_registry,
                                        ucode=search_term.upper(),
                                        defaults={
                                            'name': search_term,
                                            'cost': init_price,
                                            'quantity': 0,
                                            'category': 'Historical Import',
                                            'description': 'Auto-created during bulk historical import'
                                        }
                                    )
                                    if not created:
                                        if drug_item.cost == 0 and init_price > 0:
                                            drug_item.cost = init_price
                                            drug_item.save(update_fields=['cost'])
                                    
                                    drug_name_in_report = drug_item.name
                        except Exception as e:
                            print(f"Historical Price Lookup Error: {e}")
                        
                    # 2. Resilient Date Parsing (Handle -, /, or spaces)
                    clean_date_str = str(date_str).replace('/', '-').replace(' ', '-')
                    dt = datetime.strptime(clean_date_str, '%Y-%m-%d')
                    
                    # Fix Naive Datetime Warning (Make it timezone aware)
                    dt_aware = timezone.make_aware(dt)
                    
                    # 3. Create/Find "Historical Visit"
                    # Use dt.date() for the DateField to prevent warnings
                    visit, _ = Visit.objects.get_or_create(
                        patient=patient,
                        visit_date=dt.date(),
                        defaults={
                            'status': 'COMPLETED',
                            'is_active': False,
                            'reason': 'Historical Consumption Entry'
                        }
                    )
                    
                    # 4. Create "Historical Prescription"
                    prescription = Prescription.objects.create(
                        visit=visit,
                        medication_name=med_name,
                        frequency='N/A',
                        duration='N/A',
                        total_units=qty,
                        status='DISPENSED',
                        remarks='Bulk Historical Import',
                        ordered_by=request.user
                    )
                    
                    # 5. Create Dispensing Record
                    # NOTE: We DO NOT deduct current stock for historical imports.
                    # We only snapshot the price and quantity for financial auditing.
                    unit_price = item.get('price') or item.get('unit_price') # Try to get historical price from import
                    
                    if not unit_price and drug_item:
                        unit_price = drug_item.cost
                    
                    # Convert to float to ensure calculation works
                    unit_price = float(unit_price or 0)

                    dr = DispensingRecord(
                        prescription=prescription,
                        dispensed_by=request.user,
                        quantity=qty,
                        unit_cost=unit_price,
                        total_cost=unit_price * qty,
                        remarks='Bulk Historical Import'
                    )
                    dr.save()
                    # Manually override the auto_now_add field with the Timezone-Aware date
                    DispensingRecord.objects.filter(id=dr.id).update(dispensed_at=dt_aware)
                    
                    created_count += 1
                except Exception as e:
                    errors.append(f"Row {idx+1}: {str(e)}")
                    
        return Response({
            "status": "success",
            "created": created_count,
            "errors": errors
        })


class ConsumptionReportView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        project_id = request.query_params.get('project')
        
        # Resolve Project Name
        from patients.models import Project
        project_name = "Global Enterprise"
        if project_id and project_id != 'all':
            try:
                project_name = Project.objects.get(id=project_id).name
            except Project.DoesNotExist:
                pass
        elif user.project:
            project_name = user.project.name
            project_id = user.project.id

        employee_id = request.query_params.get('employee')
        range_type = request.query_params.get('range', 'month') # week, month, year, all
        
        # 1. Base Queryset for Dispensing
        queryset = DispensingRecord.objects.select_related(
            'prescription', 
            'prescription__visit', 
            'prescription__visit__patient',
            'prescription__visit__patient__employee_master'
        )
        
        # 2. Project Isolation (Critical for Scale)
        # Handle "all" project context from UI
        clean_project = None if project_id == 'all' else project_id

        if not user.is_superuser:
            if not clean_project:
                # If "all" is selected by a non-superuser, only show their project
                clean_project = user.project.id if user.project else None
            
            if clean_project:
                queryset = queryset.filter(
                    Q(prescription__visit__patient__project_id=clean_project) | 
                    Q(prescription__visit__patient__employee_master__project_id=clean_project)
                )
            else:
                return Response({"error": "Project context required"}, status=400)
        elif clean_project:
            queryset = queryset.filter(
                Q(prescription__visit__patient__project_id=clean_project) | 
                Q(prescription__visit__patient__employee_master__project_id=clean_project)
            )

        # 3. Specific Personnel Filter (MNC Standard: Granular Card Matching)
        if employee_id:
            # We prioritize the unique Card No (e.g., 0001 or 0001/4) to avoid "Brainless" family-wide leaks
            exact_match = queryset.filter(prescription__visit__patient__card_no=employee_id)
            if exact_match.exists():
                queryset = exact_match
            else:
                # Fallback for legacy numeric IDs or proof numbers
                try:
                    queryset = queryset.filter(
                        Q(prescription__visit__patient__employee_master_id=int(employee_id)) |
                        Q(prescription__visit__patient__id_proof_number=employee_id)
                    )
                except (ValueError, TypeError):
                    queryset = queryset.filter(prescription__visit__patient__id_proof_number=employee_id)

        # 3.5. Specific Medicine Filter (Optimized for scale to prevent timeouts)
        medicine_id = request.query_params.get('medicine')
        if medicine_id:
            from patients.models import RegistryData
            try:
                med_item = RegistryData.objects.get(id=medicine_id)
                med_name = med_item.name
                med_ucode = med_item.ucode
            except RegistryData.DoesNotExist:
                med_item = None
                med_name = None
                med_ucode = None

            if med_item:
                # Filter by RegistryData link or name/code fallback to handle legacy/historical entries
                queryset = queryset.filter(
                    Q(batch__registry_item=med_item) |
                    Q(prescription__medication_name__iexact=med_name) |
                    (Q(prescription__item_code__iexact=med_ucode) if med_ucode else Q())
                )

        # Ensure unique records to prevent Sum inflation from joins
        queryset = queryset.distinct()

        # 4. Temporal Filtering (Optimized)
        now = timezone.now()
        if range_type == 'week':
            queryset = queryset.filter(dispensed_at__gte=now - timedelta(days=7))
        elif range_type == 'month':
            queryset = queryset.filter(dispensed_at__gte=now - timedelta(days=30))
        elif range_type == 'year':
            queryset = queryset.filter(dispensed_at__gte=now - timedelta(days=365))
        elif range_type == 'custom':
            start_date = request.query_params.get('start_date')
            end_date = request.query_params.get('end_date')
            if start_date and end_date:
                try:
                    s_dt = timezone.make_aware(datetime.strptime(start_date, '%Y-%m-%d'))
                    e_dt = timezone.make_aware(datetime.strptime(end_date, '%Y-%m-%d')) + timedelta(days=1)
                    queryset = queryset.filter(dispensed_at__range=(s_dt, e_dt))
                except Exception:
                    queryset = queryset.filter(dispensed_at__gte=now - timedelta(days=30))
            else:
                queryset = queryset.filter(dispensed_at__gte=now - timedelta(days=30))

        # 5. Aggregation Engine (MNC Standard: Clinical Dose Calculation Strategy)
        # We fetch records and calculate units based on prescription logic to ensure 100% accuracy
        clean_agg_queryset = queryset.select_related('prescription', 'prescription__visit')
        
        clean_agg_records = clean_agg_queryset.values(
            'id', 
            'quantity',
            'unit_cost',
            'total_cost',
            'prescription__medication_name',
            'prescription__frequency',
            'prescription__duration',
            'prescription__visit',
            'prescription__visit__visit_date',
            'prescription__visit__patient__patient_id',
            'prescription__visit__patient__card_no',
            'prescription__visit__patient__first_name',
            'prescription__visit__patient__last_name',
            'prescription__visit__is_late_entry',
            'prescription__visit__late_entry_justification'
        )

        def get_clinical_units(item):
            # MNC Standard: Always trust the actual dispensed quantity if it exists
            if item.get('quantity') and item['quantity'] > 0:
                return item['quantity']
            
            # Fallback Recalculation for Legacy/Migration Records
            freq = item['prescription__frequency'] or ""
            dur = item['prescription__duration'] or "0"
            name = item['prescription__medication_name'] or ""

            # Only multiply duration (days) for tablets/capsules/pills. Other forms (drops, ointment, syrup) default to 1 unit.
            unit_groups = ['SYRUP', 'OINTMENT', 'CREAM', 'GEL', 'INJECTION', 'DROP', 'LOTION', 'SOLUTION', 'SUSPENSION', 'SPRAY', 'INHALER']
            is_unit_based = any(g in name.upper() for g in unit_groups) or not any(t in name.upper() for t in ['TAB', 'CAP', 'PILL'])

            if is_unit_based:
                return 1

            per_day = 0
            if '-' in freq:
                try:
                    per_day = sum([float(v) for v in freq.split('-') if v.strip().replace('.', '').isdigit()])
                except Exception:
                    per_day = 1
            else:
                mapping = { 'OD': 1, 'BD': 2, 'TDS': 3, 'QID': 4, 'SOS': 1, 'HS': 1, 'STAT': 1 }
                per_day = mapping.get(freq.upper(), 1)
            
            try:
                dur_val = int(''.join(filter(str.isdigit, str(dur))) or 0)
                return int(per_day * dur_val)
            except Exception:
                return int(per_day or 1)

        # Fetch prices
        prices = {}
        try:
            clean_project_id = clean_project or project_id
            if clean_project_id and clean_project_id != 'all':
                pharmacy_registry = RegistryType.objects.get(project_id=clean_project_id, slug='pharmacy_drugs')
                price_list = RegistryData.objects.filter(registry_type=pharmacy_registry).values('name', 'cost')
                for p in price_list:
                    prices[p['name'].strip().upper()] = float(p['cost'])
        except Exception:
            pass

        # Perform Visit-Wise Aggregation (Granular Visit Separation)
        med_groups = {}
        for rec in clean_agg_records:
            name = rec['prescription__medication_name']
            date = rec['prescription__visit__visit_date']
            visit_id = rec['prescription__visit']
            
            # Key by Visit ID for precise separation of multiple visits on same day
            group_key = f"visit_{visit_id}"
            units = get_clinical_units(rec)
            
            if group_key not in med_groups:
                p_first = rec['prescription__visit__patient__first_name'] or ""
                p_last = rec['prescription__visit__patient__last_name'] or ""
                full_name = f"{p_first} {p_last}".strip()
                
                med_groups[group_key] = {
                    "visit_id": visit_id,
                    "visit_date": date.strftime('%Y-%m-%d') if date else 'N/A',
                    "patient_id": rec['prescription__visit__patient__patient_id'] or "N/A",
                    "card_no": rec['prescription__visit__patient__card_no'] or "N/A",
                    "patient_name": full_name or "N/A",
                    "is_late_entry": rec.get('prescription__visit__is_late_entry', False),
                    "late_entry_justification": rec.get('prescription__visit__late_entry_justification', ''),
                    "items": [],
                    "total_visit_units": 0
                }
            
            med_groups[group_key]["items"].append({
                "name": name,
                "clean_name": name.strip().upper(),
                "units": units,
                "unit_cost": rec.get('unit_cost', 0),
                "total_cost": rec.get('total_cost', 0)
            })
            med_groups[group_key]["total_visit_units"] += units

        # Add RoomStockDispensation records to med_groups
        room_qs = RoomStockDispensation.objects.select_related(
            'room_stock__registry_item', 
            'patient',
            'dispensed_by'
        ).all()
        if clean_project:
            room_qs = room_qs.filter(project_id=clean_project)
        
        # Temporal filters
        if range_type == 'week':
            room_qs = room_qs.filter(dispensed_at__gte=now - timedelta(days=7))
        elif range_type == 'month':
            room_qs = room_qs.filter(dispensed_at__gte=now - timedelta(days=30))
        elif range_type == 'year':
            room_qs = room_qs.filter(dispensed_at__gte=now - timedelta(days=365))
        elif range_type == 'custom':
            start_date = request.query_params.get('start_date')
            end_date = request.query_params.get('end_date')
            if start_date and end_date:
                try:
                    s_dt = timezone.make_aware(datetime.strptime(start_date, '%Y-%m-%d'))
                    e_dt = timezone.make_aware(datetime.strptime(end_date, '%Y-%m-%d')) + timedelta(days=1)
                    room_qs = room_qs.filter(dispensed_at__range=(s_dt, e_dt))
                except Exception:
                    room_qs = room_qs.filter(dispensed_at__gte=now - timedelta(days=30))
            else:
                room_qs = room_qs.filter(dispensed_at__gte=now - timedelta(days=30))
        
        if employee_id:
            room_qs = room_qs.filter(
                Q(patient__card_no=employee_id) | 
                Q(outside_patient_aadhaar=employee_id)
            )

        if medicine_id:
            room_qs = room_qs.filter(room_stock__registry_item_id=medicine_id)

        # Group room stock dispensations that occurred at the same time to the same recipient (Optimized to database-level sorting)
        room_qs = room_qs.order_by('recipient_type', 'patient_id', 'outside_patient_name', 'dispensed_by_id', 'room_stock__location', 'dispensed_at')
        sorted_records = list(room_qs)
        
        grouped_room = []
        if sorted_records:
            current_group = [sorted_records[0]]
            for rec in sorted_records[1:]:
                prev = current_group[0]
                
                rec_recipient = rec.patient_id if rec.recipient_type == 'PATIENT' else rec.outside_patient_name
                prev_recipient = prev.patient_id if prev.recipient_type == 'PATIENT' else prev.outside_patient_name
                
                rec_loc = rec.room_stock.location if (rec.room_stock and rec.room_stock.location) else ''
                prev_loc = prev.room_stock.location if (prev.room_stock and prev.room_stock.location) else ''
                
                same_keys = (
                    rec.recipient_type == prev.recipient_type and
                    rec_recipient == prev_recipient and
                    rec.dispensed_by_id == prev.dispensed_by_id and
                    rec_loc == prev_loc
                )
                
                time_diff = abs((rec.dispensed_at - prev.dispensed_at).total_seconds()) if (rec.dispensed_at and prev.dispensed_at) else 999999
                
                if same_keys and time_diff <= 5:
                    current_group.append(rec)
                else:
                    grouped_room.append(current_group)
                    current_group = [rec]
            if current_group:
                grouped_room.append(current_group)

        for group in grouped_room:
            disp = group[0]
            group_key = f"room_disp_{disp.id}"
            
            p_name = "N/A"
            card_no = "N/A"
            patient_id = "N/A"
            if disp.recipient_type == 'PATIENT' and disp.patient:
                p_name = disp.patient.__str__()
                card_no = disp.patient.card_no or "N/A"
                patient_id = disp.patient.patient_id or "N/A"
            else:
                p_name = f"Outside: {disp.outside_patient_name or 'Unknown'} (Phone: {disp.outside_patient_phone or 'N/A'})"
                card_no = f"Aadhaar: {disp.outside_patient_aadhaar or 'N/A'}"
                patient_id = "OUTSIDE"

            items_list = []
            total_units = 0
            for item in group:
                cost = float(item.room_stock.registry_item.cost or 0.0)
                total_cost = float(item.quantity) * cost
                items_list.append({
                    "name": item.room_stock.registry_item.name,
                    "clean_name": item.room_stock.registry_item.name.strip().upper(),
                    "units": item.quantity,
                    "unit_cost": cost,
                    "total_cost": total_cost
                })
                total_units += item.quantity

            med_groups[group_key] = {
                "visit_id": f"R-{disp.id}",
                "visit_date": disp.dispensed_at.strftime('%Y-%m-%d') if disp.dispensed_at else 'N/A',
                "patient_id": patient_id,
                "card_no": card_no,
                "patient_name": p_name,
                "is_late_entry": False,
                "late_entry_justification": f"Dispensed from {disp.room_stock.location} by {disp.dispensed_by.username}",
                "items": items_list,
                "total_visit_units": total_units
            }

        final_items = []
        grand_total_cost = 0
        grand_total_units = 0

        for key, data in med_groups.items():
            # Process items in this visit using Snapshot Prices
            processed_items = []
            total_visit_cost = 0
            for item in data['items']:
                unit_price = float(item.get('unit_cost') or 0.0)
                total_price = float(item.get('total_cost') or 0.0)
                
                processed_items.append({
                    "name": item['name'],
                    "quantity": item['units'],
                    "unit_price": unit_price,
                    "total_cost": round(total_price, 2)
                })
                grand_total_cost += total_price
                grand_total_units += item['units']
                total_visit_cost += total_price

            final_items.append({
                "visit_id": data['visit_id'],
                "visit_date": data['visit_date'],
                "patient_id": data['patient_id'],
                "card_no": data.get('card_no', 'N/A'),
                "patient_name": data['patient_name'],
                "is_late_entry": data.get('is_late_entry', False),
                "late_entry_justification": data.get('late_entry_justification', ''),
                "medications": processed_items,
                "total_visit_units": data['total_visit_units'],
                "total_visit_cost": round(total_visit_cost, 2)
            })

        final_items.sort(key=lambda x: (x['visit_date'], str(x['visit_id'])), reverse=True)

        # 1. Original business logic for pharmacy records (untouched database aggregations - optimized to a single query)
        pharmacy_stats = clean_agg_queryset.aggregate(
            v=Count('prescription__visit', distinct=True),
            p=Count('prescription__visit__patient', distinct=True)
        )
        pharmacy_visits = pharmacy_stats['v'] or 0
        pharmacy_patients = pharmacy_stats['p'] or 0

        # 2. Add-on logic for Room Stock dispensings
        room_visits = len(grouped_room)
        room_patients = set()
        for group in grouped_room:
            disp = group[0]
            if disp.recipient_type == 'PATIENT' and disp.patient_id:
                room_patients.add(disp.patient_id)
            else:
                room_patients.add(f"outside_{disp.outside_patient_aadhaar or disp.outside_patient_name}")

        # 3. Combine both systems cleanly
        total_visits = pharmacy_visits + room_visits
        
        pharm_patient_ids = set(clean_agg_queryset.values_list('prescription__visit__patient_id', flat=True))
        pharm_patient_ids.discard(None)
        total_patients = len(pharm_patient_ids.union(room_patients))

        # 6. Response Router (JSON or PDF)
        report_data = {
            "project_id": project_id,
            "project_name": project_name,
            "range": range_type,
            "items": final_items,
            "total_visits": total_visits,
            "total_patients": total_patients,
            "grand_total_cost": round(grand_total_cost, 2),
            "grand_total_units": grand_total_units,
            "generated_at": now.isoformat(),
            "start_date": request.query_params.get('start_date'),
            "end_date": request.query_params.get('end_date'),
        }

        if request.query_params.get('export_format') == 'pdf' or request.query_params.get('format') == 'pdf':
            pdf_buffer = generate_consumption_pdf_report(report_data)
            response = HttpResponse(pdf_buffer, content_type='application/pdf')
            response['Content-Disposition'] = f'attachment; filename="Consumption_Report_{project_id}_{now.strftime("%Y%m%d")}.pdf"'
            return response
            
        if request.query_params.get('export_format') == 'xlsx' or request.query_params.get('format') == 'xlsx':
            xlsx_buffer = generate_consumption_xlsx_report(report_data)
            response = HttpResponse(
                xlsx_buffer, 
                content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            )
            response['Content-Disposition'] = f'attachment; filename="Consumption_Audit_{project_id}_{now.strftime("%Y%m%d")}.xlsx"'
            return response

        return Response(report_data)


class IndentViewSet(viewsets.ModelViewSet):
    serializer_class = IndentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        project_param = self.request.query_params.get('project')
        
        queryset = Indent.objects.all().select_related('raised_by', 'doctor').prefetch_related('items')
        
        if user.is_superuser or user.role == 'ADMIN':
            if project_param:
                queryset = queryset.filter(project_id=project_param)
        elif user.project:
            queryset = queryset.filter(project=user.project)
        else:
            queryset = queryset.none()
            
        # Enforce room assignment isolation if not admin
        if user.role != 'ADMIN' and not user.is_superuser:
            assignment = user.dynamic_room_assignment
            if assignment:
                queryset = queryset.filter(requesting_location=assignment.assigned_room.name)
            
        status_param = self.request.query_params.get('status')
        if status_param:
            queryset = queryset.filter(status=status_param)
            
        location_param = self.request.query_params.get('location')
        if location_param:
            queryset = queryset.filter(requesting_location=location_param)
            
        return queryset

    def create(self, request, *args, **kwargs):
        user = request.user
        project = user.project
        if not project:
            return Response({'error': 'Your user profile is not linked to any project. Cannot raise indent.'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Enforce room assignment permission & lock location
        assignment = user.dynamic_room_assignment
        if assignment:
            if not assignment.can_raise_indent:
                return Response({'error': 'You do not have permission to raise indents for this room.'}, status=status.HTTP_403_FORBIDDEN)
            requesting_location = assignment.assigned_room.name
        else:
            requesting_location = request.data.get('requesting_location')
            
        if not requesting_location:
            return Response({'error': 'Requesting location/room is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        items_data = request.data.get('items', [])
        if not items_data:
            return Response({'error': 'At least one medicine item is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Resolve pharmacy registry
        pharmacy_registry = RegistryType.objects.filter(project=project, slug__icontains='pharmacy').first()
        if not pharmacy_registry:
            return Response({'error': f'No Pharmacy Registry found for project {project.name}'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Validate stock levels
        items_to_create = []
        for it in items_data:
            name = it.get('medication_name', '').strip()
            qty = int(it.get('requested_quantity', 0))
            if qty <= 0:
                return Response({'error': f'Requested quantity for {name} must be greater than zero.'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Find drug by Code first, then Name/Alias
            item_code = it.get('item_code') or it.get('ucode')
            drug_item = None
            if item_code:
                # Match ONLY by ucode first to avoid incorrect name matching
                drug_item = RegistryData.objects.filter(
                    registry_type=pharmacy_registry,
                    ucode__iexact=item_code
                ).first()
                if not drug_item:
                    drug_item = RegistryData.objects.filter(
                        registry_type=pharmacy_registry,
                        name__iexact=item_code
                    ).first()
            
            if not drug_item:
                drug_item = RegistryData.objects.filter(
                    registry_type=pharmacy_registry
                ).filter(
                    Q(name__iexact=name) | Q(aliases__icontains=name)
                ).first()
            
            if not drug_item:
                return Response({'error': f"Medicine '{name}' not found in project pharmacy registry."}, status=status.HTTP_400_BAD_REQUEST)
            
            # Validate against main pharmacy inventory stock
            if drug_item.quantity < qty:
                return Response({
                    'error': f"Insufficient stock in main pharmacy inventory for '{name}'. Available: {drug_item.quantity}, Requested: {qty}."
                }, status=status.HTTP_400_BAD_REQUEST)
            
            items_to_create.append({
                'medication_name': name,
                'requested_quantity': qty,
                'registry_item': drug_item
            })
            
        # Create Indent
        indent = Indent.objects.create(
            project=project,
            raised_by=user,
            raised_by_role=user.role or 'NURSE',
            requesting_location=requesting_location,
            status='PENDING_APPROVAL'
        )
        
        # Create items
        for it in items_to_create:
            IndentItem.objects.create(
                indent=indent,
                medication_name=it['medication_name'],
                requested_quantity=it['requested_quantity'],
                registry_item=it['registry_item']
            )
            
        # Notify doctors
        notify_team(project, ['DOCTOR', 'ADMIN'], "New Indent Request", f"New replenishment request for {requesting_location} raised by {user.username}.")
        
        serializer = self.get_serializer(indent)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        indent = self.get_object()
        if indent.status != 'PENDING_APPROVAL':
            return Response({'error': 'Only pending indents can be cancelled'}, status=status.HTTP_400_BAD_REQUEST)
            
        indent.status = 'CANCELLED'
        indent.save()
        return Response({'status': 'cancelled'})

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        indent = self.get_object()
        if indent.status != 'PENDING_APPROVAL':
            return Response({'error': 'Only pending indents can be approved'}, status=status.HTTP_400_BAD_REQUEST)
        
        items_data = request.data.get('items', [])
        approved_map = {}
        for it in items_data:
            approved_map[int(it['id'])] = int(it['approved_quantity'])
            
        # Validate approved quantities
        for item in indent.items.all():
            app_qty = approved_map.get(item.id, item.requested_quantity)
            if app_qty < 0:
                return Response({'error': f'Approved quantity for {item.medication_name} cannot be negative.'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Allow approving any quantity (doctor approved demand)
            drug_item = item.registry_item
                
            item.approved_quantity = app_qty
            item.save()
            
        indent.status = 'APPROVED'
        indent.doctor = request.user
        indent.doctor_remarks = request.data.get('doctor_remarks', '')
        indent.save()
        
        # Notify pharmacy
        notify_team(indent.project, ['PHARMACIST', 'PHARMACY', 'ADMIN'], "Indent Approved", f"Replenishment request for {indent.requesting_location} has been approved by Doctor {request.user.username}.")
        
        return Response({'status': 'approved'})

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        indent = self.get_object()
        if indent.status != 'PENDING_APPROVAL':
            return Response({'error': 'Only pending indents can be rejected'}, status=status.HTTP_400_BAD_REQUEST)
            
        indent.status = 'REJECTED'
        indent.doctor = request.user
        indent.doctor_remarks = request.data.get('doctor_remarks', '')
        indent.save()
        
        # Notify creator
        Notification.objects.create(
            recipient=indent.raised_by,
            project=indent.project,
            title="Indent Rejected",
            message=f"Your replenishment request for {indent.requesting_location} was rejected by Doctor."
        )
        
        return Response({'status': 'rejected'})

    @action(detail=True, methods=['post'])
    def dispense(self, request, pk=None):
        indent = self.get_object()
        if indent.status != 'APPROVED':
            return Response({'error': 'Only approved indents can be dispensed'}, status=status.HTTP_400_BAD_REQUEST)
        
        from django.db import transaction
        try:
            with transaction.atomic():
                for item in indent.items.all():
                    drug_item = item.registry_item
                    if not drug_item:
                        pharmacy_registry = RegistryType.objects.filter(
                            project=indent.project, 
                            slug__icontains='pharmacy'
                        ).first()
                        if pharmacy_registry:
                            drug_item = RegistryData.objects.filter(
                                registry_type=pharmacy_registry
                            ).filter(
                                Q(name__iexact=item.medication_name) | Q(aliases__icontains=item.medication_name)
                            ).first()
                    
                    if not drug_item:
                        raise Exception(f"Medication '{item.medication_name}' not found in registry")
                    
                    qty_to_deduct = item.approved_quantity
                    if qty_to_deduct <= 0:
                        continue
                    
                    if drug_item.quantity < qty_to_deduct:
                        raise Exception(f"Insufficient stock for {item.medication_name}. Approved: {qty_to_deduct}, Available: {drug_item.quantity}")
                    
                    # Deduct from batches using FEFO
                    from .models import DrugBatch
                    active_batches = DrugBatch.objects.filter(registry_item=drug_item, quantity__gt=0).order_by('expiry_date')
                    remaining = qty_to_deduct
                    
                    if active_batches.exists():
                        for b in active_batches:
                            batch_cost = b.unit_cost or drug_item.cost or 0
                            if b.quantity >= remaining:
                                RoomStockTransfer.objects.create(
                                    indent_item=item,
                                    batch=b,
                                    dispensed_by=request.user,
                                    quantity=remaining,
                                    unit_cost=batch_cost,
                                    total_cost=float(remaining) * float(batch_cost)
                                )
                                b.quantity -= remaining
                                b.save()
                                remaining = 0
                                break
                            else:
                                if b.quantity > 0:
                                    RoomStockTransfer.objects.create(
                                        indent_item=item,
                                        batch=b,
                                        dispensed_by=request.user,
                                        quantity=b.quantity,
                                        unit_cost=batch_cost,
                                        total_cost=float(b.quantity) * float(batch_cost)
                                    )
                                    remaining -= b.quantity
                                    b.quantity = 0
                                    b.save()
                                    
                        if remaining > 0:
                            RoomStockTransfer.objects.create(
                                indent_item=item,
                                batch=None,
                                dispensed_by=request.user,
                                quantity=remaining,
                                unit_cost=drug_item.cost or 0,
                                total_cost=float(remaining) * float(drug_item.cost or 0)
                            )
                        
                        total_batch_stock = DrugBatch.objects.filter(registry_item=drug_item).aggregate(total=Sum('quantity'))['total'] or 0
                        drug_item.quantity = total_batch_stock
                        drug_item.save(update_fields=['quantity'])
                    else:
                        # Fallback: direct deduction from parent stock if no active batches exist
                        RoomStockTransfer.objects.create(
                            indent_item=item,
                            batch=None,
                            dispensed_by=request.user,
                            quantity=qty_to_deduct,
                            unit_cost=drug_item.cost or 0,
                            total_cost=float(qty_to_deduct) * float(drug_item.cost or 0)
                        )
                        drug_item.refresh_from_db()
                        drug_item.quantity = max(0, drug_item.quantity - qty_to_deduct)
                        drug_item.save(update_fields=['quantity'])
                    
                    # Update Room Stock
                    room_stock, created = RoomStock.objects.get_or_create(
                        project=indent.project,
                        location=indent.requesting_location,
                        registry_item=drug_item
                    )
                    room_stock.quantity += item.approved_quantity
                    room_stock.save()
                    
                    item.dispensed_quantity = item.approved_quantity
                    item.save()
                
                indent.status = 'DISPENSED'
                indent.save()
                
                log_action(
                    request.user,
                    'Pharmacy',
                    'Indent Replenished',
                    f"[REPLENISHMENT] Dispensed Indent ID: {indent.id} to location: {indent.requesting_location}"
                )
                
                Notification.objects.create(
                    recipient=indent.raised_by,
                    project=indent.project,
                    title="Indent Dispensed",
                    message=f"Your replenishment request for {indent.requesting_location} has been dispensed by Pharmacy."
                )
                
                return Response({'status': 'dispensed to room stock'})
                
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class RoomStockViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = RoomStockSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        project_param = self.request.query_params.get('project')
        
        queryset = RoomStock.objects.all().select_related('registry_item')
        if user.is_superuser or user.role == 'ADMIN':
            if project_param:
                queryset = queryset.filter(project_id=project_param)
        elif user.project:
            queryset = queryset.filter(project=user.project)
        else:
            queryset = queryset.none()
            
        # Enforce room assignment isolation if not admin
        if user.role != 'ADMIN' and not user.is_superuser:
            assignment = user.dynamic_room_assignment
            if assignment:
                queryset = queryset.filter(location=assignment.assigned_room.name)
            
        location = self.request.query_params.get('location')
        if location:
            queryset = queryset.filter(location=location)
            
        return queryset


class RoomStockDispensationViewSet(viewsets.ModelViewSet):
    serializer_class = RoomStockDispensationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        project_param = self.request.query_params.get('project')
        
        queryset = RoomStockDispensation.objects.all().select_related('room_stock__registry_item', 'patient', 'dispensed_by')
        if user.is_superuser or user.role == 'ADMIN':
            if project_param:
                queryset = queryset.filter(project_id=project_param)
        elif user.project:
            queryset = queryset.filter(project=user.project)
        else:
            queryset = queryset.none()
            
        # Enforce room assignment isolation if not admin
        if user.role != 'ADMIN' and not user.is_superuser:
            assignment = user.dynamic_room_assignment
            if assignment:
                queryset = queryset.filter(room_stock__location=assignment.assigned_room.name)
            
        return queryset

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        
        # Sort queryset by dispensed_at desc to group chronologically
        records = list(queryset.order_by('-dispensed_at'))
        
        grouped_records = []
        visited = set()
        for i, rec in enumerate(records):
            if rec.id in visited:
                continue
                
            group = [rec]
            visited.add(rec.id)
            
            # Find matching items dispensed at the same time (within 5 seconds)
            for j in range(i + 1, len(records)):
                other = records[j]
                if other.id in visited:
                    continue
                if rec.recipient_type != other.recipient_type:
                    continue
                if rec.recipient_type == 'PATIENT':
                    if rec.patient_id != other.patient_id:
                        continue
                else:
                    if rec.outside_patient_name != other.outside_patient_name:
                        continue
                if rec.dispensed_by_id != other.dispensed_by_id:
                    continue
                if rec.room_stock.location != other.room_stock.location:
                    continue
                time_diff = abs((rec.dispensed_at - other.dispensed_at).total_seconds())
                if time_diff > 5:
                    continue
                
                group.append(other)
                visited.add(other.id)
            
            grouped_records.append(group)
            
        # Serialize grouped records
        serialized_list = []
        for group in grouped_records:
            base_rec = group[0]
            serializer = self.get_serializer(base_rec)
            data = serializer.data
            
            # Format medication_name and quantity to show all grouped items
            med_details = [f"{item.room_stock.registry_item.name} ({item.quantity})" for item in group]
            data['medication_name'] = ", ".join(med_details)
            data['quantity'] = sum(item.quantity for item in group)
            
            serialized_list.append(data)
            
        # Paginate grouped data
        page = self.paginate_queryset(serialized_list)
        if page is not None:
            return self.get_paginated_response(page)
            
        return Response(serialized_list)

    def create(self, request, *args, **kwargs):
        user = request.user
        project = user.project
        if not project:
            return Response({'error': 'Your user profile is not linked to any project.'}, status=status.HTTP_400_BAD_REQUEST)
            
        # Enforce room assignment permission
        assignment = user.dynamic_room_assignment
        if assignment:
            if not assignment.can_log_dispensation:
                return Response({'error': 'You do not have permission to log dispensations for this room.'}, status=status.HTTP_403_FORBIDDEN)
            
        recipient_type = request.data.get('recipient_type', 'PATIENT')
        patient_id = request.data.get('patient_id')
        outside_name = request.data.get('outside_patient_name')
        outside_aadhaar = request.data.get('outside_patient_aadhaar')
        outside_phone = request.data.get('outside_patient_phone')
        outside_details = request.data.get('outside_patient_details')
        
        patient = None
        if recipient_type == 'PATIENT':
            if not patient_id:
                return Response({'error': 'Patient is required for registered patient dispensing'}, status=status.HTTP_400_BAD_REQUEST)
            from patients.models import Patient
            try:
                patient = Patient.objects.get(id=patient_id)
            except Patient.DoesNotExist:
                return Response({'error': 'Patient not found'}, status=status.HTTP_400_BAD_REQUEST)
                
            # Check if associated employee is active
            if patient.employee_master and not patient.employee_master.is_active:
                return Response({'error': 'Cannot dispense medication. The associated employee card is deactivated (e.g. transferred).'}, status=status.HTTP_400_BAD_REQUEST)
        else:
            if not outside_name:
                return Response({'error': 'Walk-In Patient Name is required'}, status=status.HTTP_400_BAD_REQUEST)

        # Handle multi-item list or fallback to single item
        items_data = request.data.get('items')
        is_bulk = True
        if not items_data:
            is_bulk = False
            room_stock_id = request.data.get('room_stock_id')
            qty = int(request.data.get('quantity', 0))
            items_data = [{'room_stock_id': room_stock_id, 'quantity': qty}]

        if not items_data or len(items_data) == 0:
            return Response({'error': 'No items selected for dispensation'}, status=status.HTTP_400_BAD_REQUEST)

        from django.db import transaction
        from django.utils import timezone
        dispense_time = timezone.now()
        
        try:
            with transaction.atomic():
                dispensation_records = []
                for item in items_data:
                    rs_id = item.get('room_stock_id')
                    q = int(item.get('quantity', 0))
                    if q <= 0:
                        raise Exception('Quantity must be greater than zero')
                        
                    try:
                        room_stock = RoomStock.objects.get(id=rs_id, project=project)
                    except RoomStock.DoesNotExist:
                        raise Exception('Room stock item not found')
                        
                    # Verify room stock belongs to the user's assigned room
                    assignment = user.dynamic_room_assignment
                    if assignment:
                        if room_stock.location != assignment.assigned_room.name:
                            raise Exception('You cannot dispense from a room other than your assigned room.')
                            
                    if room_stock.quantity < q:
                        raise Exception(f'Insufficient room stock for {room_stock.registry_item.name}. Available: {room_stock.quantity}')
                        
                    # Deduct stock and save
                    room_stock.quantity -= q
                    room_stock.save()
                    
                    disp = RoomStockDispensation.objects.create(
                        project=project,
                        room_stock=room_stock,
                        dispensed_by=user,
                        recipient_type=recipient_type,
                        patient=patient,
                        outside_patient_name=outside_name,
                        outside_patient_aadhaar=outside_aadhaar,
                        outside_patient_phone=outside_phone,
                        outside_patient_details=outside_details,
                        quantity=q,
                        dispensed_at=dispense_time
                    )
                    dispensation_records.append(disp)
                    
                    log_action(
                        user,
                        'Pharmacy',
                        'Room Dispensation',
                        f"[ROOM_DISPENSE] Dispensed {q} of {room_stock.registry_item.name} from {room_stock.location} to {outside_name or patient}"
                    )
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        if is_bulk:
            serializer = self.get_serializer(dispensation_records, many=True)
        else:
            serializer = self.get_serializer(dispensation_records[0])
            
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class FacilityRoomViewSet(viewsets.ModelViewSet):
    serializer_class = FacilityRoomSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        queryset = FacilityRoom.objects.all()
        
        if user.project:
            queryset = queryset.filter(project=user.project)
        else:
            project_param = self.request.query_params.get('project')
            if project_param:
                queryset = queryset.filter(project_id=project_param)
                
        active_only = self.request.query_params.get('active_only', 'true')
        if active_only.lower() == 'true':
            queryset = queryset.filter(is_active=True)
            
        return queryset

    @action(detail=False, methods=['get'], url_path='room-types')
    def room_types(self, request):
        types = [{'value': code, 'label': name} for code, name in FacilityRoom.ROOM_TYPES]
        return Response(types)

    def perform_create(self, serializer):
        user = self.request.user
        project = user.project
        if not project and self.request.data.get('project'):
            from patients.models import Project
            project = Project.objects.get(id=self.request.data.get('project'))
            
        if not project:
            from rest_framework.exceptions import ValidationError
            raise ValidationError({'error': 'Project is required.'})
            
        serializer.save(project=project)


class UserRoomAssignmentViewSet(viewsets.ModelViewSet):
    serializer_class = UserRoomAssignmentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        queryset = UserRoomAssignment.objects.all().select_related('user', 'assigned_room')
        
        if user.project:
            queryset = queryset.filter(assigned_room__project=user.project)
        else:
            project_param = self.request.query_params.get('project')
            if project_param:
                queryset = queryset.filter(assigned_room__project_id=project_param)
                
        return queryset

