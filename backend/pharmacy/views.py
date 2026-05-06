from rest_framework import viewsets, permissions, status, views
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Sum, F, Q, Count, DecimalField, ExpressionWrapper
from django.utils import timezone
from datetime import timedelta, datetime
from patients.models import RegistryData, RegistryType, EmployeeMaster
from .models import Prescription, DispensingRecord
from .serializers import PrescriptionSerializer, DispensingRecordSerializer
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
                        # 3. Find the drug by Name OR Alias (Case-Insensitive)
                        search_name = prescription.medication_name.strip()
                        drug_item = RegistryData.objects.filter(
                            registry_type=pharmacy_registry
                        ).filter(
                            Q(name__iexact=search_name) | Q(aliases__icontains=search_name)
                        ).first()

                        if drug_item:
                            # 4. Atomic Deduction
                            qty_to_deduct = serializer.instance.quantity
                            drug_item.quantity = F('quantity') - qty_to_deduct
                            drug_item.save(update_fields=['quantity'])

                            # 5. Lock Project-Specific Price for the Audit Trail
                            current_unit_cost = drug_item.cost or 0
                            serializer.instance.unit_cost = current_unit_cost
                            serializer.instance.total_cost = current_unit_cost * qty_to_deduct
                            serializer.instance.save(update_fields=['unit_cost', 'total_cost'])
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

        return queryset
    
    @action(detail=False, methods=['post'])
    def bulk_historical_upload(self, request):
        """
        Elite Admin Tool: Batch process historical consumption data.
        Input: List of { date, card_no, medication_name, quantity, project_id }
        """
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
                    pass

        # 5. Aggregation Engine (MNC Standard: Clinical Dose Calculation Strategy)
        # We fetch records and calculate units based on prescription logic to ensure 100% accuracy
        matching_ids = queryset.values_list('id', flat=True)
        clean_agg_queryset = DispensingRecord.objects.filter(id__in=matching_ids).select_related('prescription', 'prescription__visit')
        
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
            'prescription__visit__patient__last_name'
        )

        def get_clinical_units(item):
            # MNC Standard: Always trust the actual dispensed quantity if it exists
            if item.get('quantity') and item['quantity'] > 0:
                return item['quantity']
            
            # Fallback Recalculation for Legacy/Migration Records
            freq = item['prescription__frequency'] or ""
            dur = item['prescription__duration'] or "0"
            name = item['prescription__medication_name'] or ""

            # Check if it's a unit-based medication group
            unit_groups = ['SYRUP', 'OINTMENT', 'CREAM', 'GEL', 'INJECTION', 'DROP', 'LOTION']
            is_unit_based = any(g in name.upper() for g in unit_groups)

            if is_unit_based:
                try:
                    return int(''.join(filter(str.isdigit, str(dur))) or 1)
                except Exception:
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

        final_items = []
        grand_total_cost = 0
        grand_total_units = 0

        for key, data in med_groups.items():
            # Process items in this visit using Snapshot Prices
            processed_items = []
            for item in data['items']:
                unit_price = item.get('unit_cost', 0)
                total_price = item.get('total_cost', 0)
                
                processed_items.append({
                    "name": item['name'],
                    "quantity": item['units'],
                    "unit_price": unit_price,
                    "total_cost": round(total_price, 2)
                })
                grand_total_cost += total_price
                grand_total_units += item['units']

            final_items.append({
                "visit_id": data['visit_id'],
                "visit_date": data['visit_date'],
                "patient_id": data['patient_id'],
                "card_no": data.get('card_no', 'N/A'),
                "patient_name": data['patient_name'],
                "medications": processed_items,
                "total_visit_units": data['total_visit_units']
            })

        final_items.sort(key=lambda x: (x['visit_date'], x['visit_id']), reverse=True)

        # 6. Response Router (JSON or PDF)
        report_data = {
            "project_id": project_id,
            "project_name": project_name,
            "range": range_type,
            "items": final_items,
            "total_visits": clean_agg_queryset.aggregate(v=Count('prescription__visit', distinct=True))['v'] or 0,
            "total_patients": clean_agg_queryset.aggregate(p=Count('prescription__visit__patient', distinct=True))['p'] or 0,
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
