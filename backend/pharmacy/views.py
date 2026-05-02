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
from .reports import generate_consumption_pdf_report
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

class ConsumptionReportView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        project_id = request.query_params.get('project') or (user.project.id if user.project else None)
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

        # 3. Employee Specific Filter
        if employee_id:
            queryset = queryset.filter(
                Q(prescription__visit__patient__employee_master_id=employee_id) |
                Q(prescription__visit__patient__id_proof_number=employee_id) # Fallback for card matching
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
                    pass

        # 5. Aggregation Engine (MNC Standard: Clinical Dose Calculation Strategy)
        # We fetch records and calculate units based on prescription logic to ensure 100% accuracy
        matching_ids = queryset.values_list('id', flat=True)
        clean_agg_queryset = DispensingRecord.objects.filter(id__in=matching_ids).select_related('prescription', 'prescription__visit')
        
        clean_agg_records = clean_agg_queryset.values(
            'id', 
            'quantity',
            'prescription__medication_name',
            'prescription__frequency',
            'prescription__duration',
            'prescription__visit',
            'prescription__visit__visit_date',
            'prescription__visit__patient__patient_id',
            'prescription__visit__patient__first_name',
            'prescription__visit__patient__last_name'
        )

        def get_clinical_units(item):
            if item['quantity'] > 1:
                return item['quantity']
            
            freq = item['prescription__frequency'] or ""
            dur = item['prescription__duration'] or "0"
            
            per_day = 0
            if '-' in freq:
                try:
                    per_day = sum([int(v) for v in freq.split('-') if v.strip().isdigit()])
                except Exception:
                    per_day = 1
            else:
                mapping = { 'OD': 1, 'BD': 2, 'TDS': 3, 'QID': 4, 'SOS': 1, 'HS': 1, 'STAT': 1 }
                per_day = mapping.get(freq.upper(), 1)
            
            try:
                dur_val = int(''.join(filter(str.isdigit, str(dur))) or 0)
                return per_day * dur_val
            except Exception:
                return per_day or 1

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
                    "patient_name": full_name or "N/A",
                    "items": [],
                    "total_visit_units": 0
                }
            
            med_groups[group_key]["items"].append({
                "name": name,
                "clean_name": name.strip().upper(),
                "units": units
            })
            med_groups[group_key]["total_visit_units"] += units

        final_items = []
        grand_total_cost = 0
        grand_total_units = 0

        for key, data in med_groups.items():
            # Process items in this visit to calculate costs
            processed_items = []
            for item in data['items']:
                unit_price = prices.get(item['clean_name'], 0)
                total_price = item['units'] * unit_price
                
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
                "patient_name": data['patient_name'],
                "medications": processed_items,
                "total_visit_units": data['total_visit_units']
            })

        final_items.sort(key=lambda x: (x['visit_date'], x['visit_id']), reverse=True)

        # 6. Response Router (JSON or PDF)
        report_data = {
            "project_id": project_id,
            "range": range_type,
            "items": final_items,
            "total_visits": clean_agg_queryset.aggregate(v=Count('prescription__visit', distinct=True))['v'] or 0,
            "total_patients": clean_agg_queryset.aggregate(p=Count('prescription__visit__patient', distinct=True))['p'] or 0,
            "grand_total_cost": round(grand_total_cost, 2),
            "grand_total_units": grand_total_units,
            "generated_at": now.isoformat()
        }

        if request.query_params.get('format') == 'pdf':
            pdf_buffer = generate_consumption_pdf_report(report_data)
            response = HttpResponse(pdf_buffer, content_type='application/pdf')
            response['Content-Disposition'] = f'attachment; filename="Consumption_Report_{project_id}_{now.strftime("%Y%m%d")}.pdf"'
            return response

        return Response(report_data)
