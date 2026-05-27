from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import viewsets, permissions, status, filters
from rest_framework.decorators import action
import threading

_sync_lock = threading.Lock()
from rest_framework.response import Response
from .models import Patient, EmployeeMaster, FamilyMember, Project, ProjectCategoryMapping, ProjectFieldConfig, RegistryType, RegistryData, RegistryField, ProjectLogo, RegistryUploadSession
from .serializers import (
    PatientSerializer, EmployeeMasterSerializer, FamilyMemberSerializer,
    ProjectSerializer, ProjectCategoryMappingSerializer, ProjectFieldConfigSerializer,
    RegistryTypeSerializer, RegistryDataSerializer, RegistryFieldSerializer, ProjectLogoSerializer,
    RegistryUploadSessionSerializer
)
from accounts.utils import log_action

class ProjectLogoViewSet(viewsets.ModelViewSet):
    queryset = ProjectLogo.objects.all().order_by('order')
    serializer_class = ProjectLogoSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        queryset = ProjectLogo.objects.all().order_by('order')
        
        # Admin can filter
        project_id = self.request.query_params.get('project')
        if project_id:
            return queryset.filter(project_id=project_id)
            
        # Non-admin only see their own project logos
        if user.is_authenticated:
            is_admin = user.role == 'ADMIN' or user.is_superuser or user.user_roles.filter(name='ADMIN').exists()
            if not is_admin and user.project:
                return queryset.filter(project=user.project)
        
        return queryset

class ProjectViewSet(viewsets.ModelViewSet):
    serializer_class = ProjectSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = Project.objects.all().order_by('name')
        user = self.request.user
        is_admin = user.role == 'ADMIN' or user.is_superuser or user.user_roles.filter(name='ADMIN').exists()
        
        if not is_admin and user.project:
            queryset = queryset.filter(id=user.project.id)
            
        return queryset

    def perform_create(self, serializer):
        project = serializer.save()
        log_action(self.request.user, 'Governance', 'Project Created', f"Created workspace {project.name}")

    def perform_update(self, serializer):
        project = serializer.save()
        log_action(self.request.user, 'Governance', 'Project Updated', f"Updated workspace {project.name}")

    @action(detail=True, methods=['post'], url_path='sync-mappings')
    def sync_mappings(self, request, pk=None):
        project = self.get_object()
        categories = request.data.get('categories', [])
        ProjectCategoryMapping.objects.filter(project=project).delete()
        for cat in categories:
            ProjectCategoryMapping.objects.create(project=project, category=cat)
            
        # 2. Provision standard system registries based on selected categories
        if 'EMPLOYEE' in categories:
            # Smart Sync: Look for existing slug or category to avoid IntegrityErrors
            rt, created = RegistryType.objects.get_or_create(
                project=project,
                slug='employee_master',
                defaults={
                    'name': 'Unified Master Registry',
                    'type_category': 'PERSONNEL_PRIMARY',
                    'description': 'Direct staff and family dependency uploads (Unified Protocol)',
                    'coverage': 'ENTIRE ECOSYSTEM',
                    'icon': 'Users',
                    'color': '#6366f1'
                }
            )
            if not created:
                rt.type_category = 'PERSONNEL_PRIMARY'
                rt.name = 'Unified Master Registry'
                rt.description = 'Direct staff and family dependency uploads (Unified Protocol)'
                rt.save()

        if 'FAMILY' in categories:
            rt, created = RegistryType.objects.get_or_create(
                project=project,
                slug='family_member',
                defaults={
                    'name': 'Dependent Registry',
                    'type_category': 'PERSONNEL_DEPENDENT',
                    'description': 'Linked family records for employees',
                    'coverage': 'DEPENDENT BASE',
                    'icon': 'UserPlus',
                    'color': '#ec4899'
                }
            )
            if not created:
                rt.type_category = 'PERSONNEL_DEPENDENT'
                rt.name = 'Dependent Registry'
                rt.save()

        log_action(request.user, 'Governance', 'Sync Mappings', f"Synchronized mappings and provisioned default registries for project {project.name}")
        return Response({"status": "Mappings synchronized and registries provisioned."})

    @action(detail=True, methods=['post'], url_path='setup-pharmacy')
    def setup_pharmacy(self, request, pk=None):
        project = self.get_object()
        
        # 1. Provision Pharmacy Registry Type
        rt, created = RegistryType.objects.get_or_create(
            project=project,
            slug='pharmacy',
            defaults={
                'name': 'Pharmacy Inventory',
                'type_category': 'PHARMACY',
                'description': f'Auto-deductive medical inventory for {project.name}',
                'coverage': 'PROJECT SPECIFIC',
                'icon': 'Pill',
                'color': '#10b981'
            }
        )
        
        # 2. Define standard Pharmacy Schema
        standard_fields = [
            {'label': 'ITEM CODE', 'slug': 'item_code', 'data_type': 'VARCHAR', 'order': 0},
            {'label': 'ITEM NAME', 'slug': 'item_name', 'data_type': 'VARCHAR', 'order': 1},
            {'label': 'DESCRIPTION', 'slug': 'description', 'data_type': 'VARCHAR', 'order': 2},
            {'label': 'ITEM GROUP', 'slug': 'item_group', 'data_type': 'VARCHAR', 'order': 3},
            {'label': 'QTY', 'slug': 'qty', 'data_type': 'INT', 'order': 4},
            {'label': 'COST', 'slug': 'cost', 'data_type': 'VARCHAR', 'order': 5},
        ]
        
        created_count = 0
        for f_data in standard_fields:
            _, f_created = RegistryField.objects.get_or_create(
                registry_type=rt,
                slug=f_data['slug'],
                defaults={
                    'label': f_data['label'],
                    'data_type': f_data['data_type'],
                    'order': f_data['order']
                }
            )
            if f_created: created_count += 1
            
        log_action(request.user, 'Governance', 'Setup Pharmacy', f"Initialized pharmacy registry for project {project.name}")
        return Response({
            "status": "Pharmacy registry initialized",
            "registry_id": rt.id,
            "fields_created": created_count
        })

    @action(detail=True, methods=['post'], url_path='bulk-link-employees')
    def bulk_link_employees(self, request, pk=None):
        project = self.get_object()
        card_numbers = request.data.get('card_numbers', [])
        
        if not card_numbers:
            return Response({"error": "No card numbers provided"}, status=400)
            
        linked_count = 0
        errors = []
        
        from .models import EmployeeMaster, FamilyMember, Patient
        from django.db import transaction
        
        with transaction.atomic():
            for idx, card_no_input in enumerate(card_numbers):
                sid = transaction.savepoint()
                try:
                    card_no_input = str(card_no_input).strip()
                    if not card_no_input: continue
                    
                    # Pad card base to 4 digits if numeric (e.g. 157 -> 0157, 1/2 -> 0001/2)
                    if '/' in card_no_input:
                        parts = card_no_input.split('/')
                        parent_card = parts[0].strip()
                        suffix = '/' + parts[1].strip()
                        if parent_card.isdigit():
                            parent_card = parent_card.zfill(4)
                        card_no_input = f"{parent_card}{suffix}"
                    else:
                        if card_no_input.isdigit():
                            card_no_input = card_no_input.zfill(4)
                    
                    is_family_case = '/' in card_no_input
                    member = None
                    employee = None
                    
                    if is_family_case:
                        # 1. Family Member Granular Case (e.g. 0157/1)
                        parts = card_no_input.split('/')
                        parent_card = parts[0]
                        suffix = '/' + parts[1]
                        
                        member = FamilyMember.objects.filter(employee__card_no=parent_card, card_no_suffix=suffix).first()
                        if not member:
                            # Fallback: Check if this card number with slash was actually uploaded as a Primary Employee
                            employee = EmployeeMaster.objects.filter(card_no=card_no_input).first()
                            if employee:
                                is_family_case = False # Re-classify as Primary Employee case
                            else:
                                # Create unlinked placeholder patient profile so it is present in reports/lists immediately!
                                patient_qs = Patient.objects.filter(card_no=card_no_input, project=project)
                                if patient_qs.count() > 1:
                                    patient_first = patient_qs.first()
                                    patient_qs.exclude(id=patient_first.id).delete()
                                    
                                Patient.objects.update_or_create(
                                    card_no=card_no_input,
                                    project=project,
                                    defaults={
                                        'first_name': 'Patient',
                                        'last_name': card_no_input,
                                        'dob': None,
                                        'gender': 'MALE',
                                        'id_proof_type': 'EMPLOYEE_CARD',
                                        'id_proof_number': card_no_input,
                                        'is_employee_linked': False,
                                        'relationship': 'DEPENDENT'
                                    }
                                )
                                errors.append(f"Dependent {card_no_input} not in Masters. Profile created as unlinked placeholder.")
                                linked_count += 1
                                transaction.savepoint_commit(sid)
                                continue
                                
                    if is_family_case:
                        employee = member.employee
                        # Sync parent project link if needed (Metadata sync)
                        if employee.project != project:
                            employee.project = project
                            employee.save()
                            
                        # Safe update or create: Deduplicate existing duplicate patient profiles to prevent MultipleObjectsReturned errors
                        patient_qs = Patient.objects.filter(card_no=card_no_input, project=project)
                        if patient_qs.count() > 1:
                            patient_first = patient_qs.first()
                            patient_qs.exclude(id=patient_first.id).delete()
                            
                        # Create/Update Patient Profile for the SPECIFIC Family Member
                        patient = patient_qs.first()
                        first_name = member.name.split(' ')[0]
                        last_name = " ".join(member.name.split(' ')[1:]) if " " in member.name else ""
                        phone = member.mobile_no or employee.mobile_no
                        
                        if not patient or (
                            patient.first_name != first_name or
                            patient.last_name != last_name or
                            patient.dob != member.dob or
                            patient.gender != member.gender or
                            patient.phone != phone or
                            patient.address != employee.address or
                            not patient.is_employee_linked or
                            patient.employee_master != employee or
                            patient.family_member != member or
                            patient.relationship != member.relationship
                        ):
                            Patient.objects.update_or_create(
                                card_no=card_no_input,
                                project=project,
                                defaults={
                                    'first_name': first_name,
                                    'last_name': last_name,
                                    'dob': member.dob,
                                    'gender': member.gender,
                                    'phone': phone,
                                    'address': employee.address,
                                    'id_proof_type': 'EMPLOYEE_CARD',
                                    'id_proof_number': card_no_input,
                                    'is_employee_linked': True,
                                    'employee_master': employee,
                                    'family_member': member,
                                    'relationship': member.relationship
                                }
                            )
                        linked_count += 1
                    else:
                        # 2. Primary Employee Case (e.g. 2254 or 0055/1 uploaded as primary employee)
                        if not employee:
                            employee = EmployeeMaster.objects.filter(card_no=card_no_input).first()
                        if not employee:
                            # Create unlinked placeholder patient profile so it is present in reports/lists immediately!
                            patient_qs = Patient.objects.filter(card_no=card_no_input, project=project)
                            if patient_qs.count() > 1:
                                patient_first = patient_qs.first()
                                patient_qs.exclude(id=patient_first.id).delete()
                                
                            Patient.objects.update_or_create(
                                card_no=card_no_input,
                                project=project,
                                defaults={
                                    'first_name': 'Patient',
                                    'last_name': card_no_input,
                                    'dob': None,
                                    'gender': 'MALE',
                                    'id_proof_type': 'EMPLOYEE_CARD',
                                    'id_proof_number': card_no_input,
                                    'is_employee_linked': False,
                                    'relationship': 'PRIMARY CARD HOLDER'
                                }
                            )
                            errors.append(f"Card {card_no_input} not in Masters. Profile created as unlinked placeholder.")
                            linked_count += 1
                            transaction.savepoint_commit(sid)
                            continue
                        
                        # Link to this project (Metadata) only if needed!
                        if employee.project != project:
                            employee.project = project
                            employee.save()
                        
                        # Safe update or create: Deduplicate existing duplicate patient profiles to prevent MultipleObjectsReturned errors
                        patient_qs = Patient.objects.filter(card_no=card_no_input, project=project)
                        if patient_qs.count() > 1:
                            patient_first = patient_qs.first()
                            patient_qs.exclude(id=patient_first.id).delete()
                            
                        # Create/Update Patient Profile for Primary Employee ONLY
                        patient = patient_qs.first()
                        first_name = employee.name.split(' ')[0]
                        last_name = " ".join(employee.name.split(' ')[1:]) if " " in employee.name else ""
                        
                        if not patient or (
                            patient.first_name != first_name or
                            patient.last_name != last_name or
                            patient.dob != employee.dob or
                            patient.gender != employee.gender or
                            patient.phone != employee.mobile_no or
                            patient.address != employee.address or
                            not patient.is_employee_linked or
                            patient.employee_master != employee
                        ):
                            Patient.objects.update_or_create(
                                card_no=card_no_input,
                                project=project,
                                defaults={
                                    'first_name': first_name,
                                    'last_name': last_name,
                                    'dob': employee.dob,
                                    'gender': employee.gender,
                                    'phone': employee.mobile_no,
                                    'address': employee.address,
                                    'id_proof_type': 'EMPLOYEE_CARD',
                                    'id_proof_number': card_no_input,
                                    'is_employee_linked': True,
                                    'employee_master': employee,
                                    'relationship': 'PRIMARY CARD HOLDER'
                                }
                            )
                        linked_count += 1
                    
                    transaction.savepoint_commit(sid)
                except Exception as e:
                    transaction.savepoint_rollback(sid)
                    errors.append(f"Error linking {card_no_input}: {str(e)}")
                    
        return Response({
            "status": "success",
            "linked": linked_count,
            "errors": errors
        })

class RegistryTypeViewSet(viewsets.ModelViewSet):
    serializer_class = RegistryTypeSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = RegistryType.objects.all()
        user = self.request.user
        is_admin = user.role == 'ADMIN' or user.is_superuser or user.user_roles.filter(name='ADMIN').exists()
        
        project_id = self.request.query_params.get('project')
        
        if not is_admin:
            if user.project:
                queryset = queryset.filter(project=user.project)
            else:
                queryset = queryset.none()
        elif project_id:
            queryset = queryset.filter(project_id=project_id)
            
        return queryset

class RegistryFieldViewSet(viewsets.ModelViewSet):
    queryset = RegistryField.objects.all()
    serializer_class = RegistryFieldSerializer
    permission_classes = [permissions.IsAuthenticated]

from rest_framework.pagination import PageNumberPagination

class LargeResultsPagination(PageNumberPagination):
    page_size = 100
    page_size_query_param = 'page_size'
    max_page_size = 1000

class RegistryDataViewSet(viewsets.ModelViewSet):
    queryset = RegistryData.objects.all()
    serializer_class = RegistryDataSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = LargeResultsPagination
    filter_backends = [filters.SearchFilter]
    search_fields = ['ucode', 'name']

    def perform_create(self, serializer):
        data = serializer.save()
        log_action(self.request.user, 'Registry', 'Data Entry Created', f"Record {data.ucode} added to registry {data.registry_type.name}")
        
        # Self-healing Sync: Automatically create a default batch for manually-added pharmacy registry items
        rt = data.registry_type
        is_pharmacy = (
            rt.type_category in ['CLINICAL_DRUGS', 'PHARMACY'] or
            'pharmacy' in rt.slug.lower() or
            'pharmacy' in rt.name.lower() or
            'drug' in rt.slug.lower() or
            'drug' in rt.name.lower()
        )
        if is_pharmacy:
            from pharmacy.models import DrugBatch
            from django.utils import timezone
            DrugBatch.objects.get_or_create(
                registry_item=data,
                batch_number='DEFAULT',
                defaults={
                    'mfg_date': timezone.localdate(),
                    'expiry_date': timezone.localdate() + timezone.timedelta(days=365),
                    'initial_qty': data.quantity,
                    'quantity': data.quantity,
                    'unit_cost': data.cost
                }
            )

    def perform_update(self, serializer):
        old_instance = self.get_object()
        
        # Build snapshot of old values for validated fields
        old_values = {}
        for field in serializer.validated_data.keys():
            old_values[field] = getattr(old_instance, field, None)
            
        data = serializer.save()
        
        # Determine changed fields
        changes = []
        for field, old_val in old_values.items():
            new_val = getattr(data, field, None)
            if old_val != new_val:
                changes.append(f"{field}: '{old_val}' -> '{new_val}'")
                
        change_str = ", ".join(changes) if changes else "No fields changed"
        log_action(
            self.request.user, 
            'Registry', 
            'Data Entry Updated', 
            f"Record {data.ucode} modified in registry {data.registry_type.name}. Changes: {change_str}"
        )
        
        # Self-healing Sync: Align child batches when the parent medicine quantity or price is manually modified
        rt = data.registry_type
        is_pharmacy = (
            rt.type_category in ['CLINICAL_DRUGS', 'PHARMACY'] or
            'pharmacy' in rt.slug.lower() or
            'pharmacy' in rt.name.lower() or
            'drug' in rt.slug.lower() or
            'drug' in rt.name.lower()
        )
        if is_pharmacy:
            from pharmacy.models import DrugBatch
            from django.utils import timezone
            
            batches = DrugBatch.objects.filter(registry_item=data)
            if batches.exists():
                # Identify the DEFAULT or first batch to absorb manual adjustments
                default_batch = batches.filter(batch_number='DEFAULT').first() or batches.first()
                if default_batch:
                    # Calculate total quantity held in other custom batches
                    other_qty = sum(b.quantity for b in batches if b.id != default_batch.id)
                    # The default batch quantity is adjusted so that the overall batch total matches the parent quantity
                    default_batch.quantity = max(0, data.quantity - other_qty)
                    # Sync the batch cost to the manual price update
                    default_batch.unit_cost = data.cost
                    default_batch.save()
            else:
                # Fallback: Create a DEFAULT batch if it was somehow deleted or missing
                DrugBatch.objects.create(
                    registry_item=data,
                    batch_number='DEFAULT',
                    mfg_date=timezone.localdate(),
                    expiry_date=timezone.localdate() + timezone.timedelta(days=365),
                    initial_qty=data.quantity,
                    quantity=data.quantity,
                    unit_cost=data.cost
                )

    def get_queryset(self):
        """
        Dynamically filters the Clinical Repository based on the active registry scope (Protocol).
        Ensures that data is strictly isolated between different clinical workstreams.
        """
        queryset = RegistryData.objects.all().select_related('registry_type').order_by('id')
        
        # Project Isolation: Filter by associated project (Enforced globally for all actions)
        project_id = self.request.query_params.get('project')
        
        user = self.request.user
        is_admin = user.role == 'ADMIN' or user.is_superuser or user.user_roles.filter(name='ADMIN').exists()
        
        if not is_admin:
            if user.project:
                queryset = queryset.filter(registry_type__project=user.project)
            else:
                # If no project, they can only see what they created if possible, 
                # but RegistryData is usually tied to projects.
                queryset = queryset.none()
        elif project_id:
            queryset = queryset.filter(registry_type__project_id=project_id)

        # Apply list-specific filters and fallbacks only during the list action
        if hasattr(self, 'action') and self.action == 'list':
            queryset = queryset.exclude(name='').exclude(ucode='').exclude(name__isnull=True).exclude(ucode__isnull=True)
            
            # Advanced Clinical Filtering: Support multiple slugs and type-categories
            registry_type = self.request.query_params.get('registry_type')
            slugs = self.request.query_params.get('registry_type__slug')
            categories = self.request.query_params.get('type_category')

            if slugs:
                slug_list = [s.strip() for s in slugs.split(',') if s.strip()]
                queryset = queryset.filter(registry_type__slug__in=slug_list)
            elif registry_type and registry_type != 'null' and registry_type != 'undefined':
                if str(registry_type).isdigit():
                    queryset = queryset.filter(registry_type_id=int(registry_type))
                else:
                    queryset = queryset.filter(registry_type__slug=registry_type)
            
            if categories:
                cat_list = [c.strip() for c in categories.split(',') if c.strip()]
                queryset = queryset.filter(registry_type__type_category__in=cat_list)
            elif not slugs and not registry_type and not self.request.query_params.get('all', False):
                # Security: If no protocol/filter is specified, return nothing
                queryset = queryset.none()

            names_param = self.request.query_params.get('names')
            if names_param:
                from django.db.models.functions import Lower
                name_list = [n.strip().lower() for n in names_param.split(',') if n.strip()]
                queryset = queryset.annotate(name_lower=Lower('name')).filter(name_lower__in=name_list)

            # Workspace Search: Filter by primary identifiers (ucode/name)
            search = self.request.query_params.get('search')
            if search:
                from django.db.models import Q
                queryset = queryset.filter(Q(ucode__icontains=search) | Q(name__icontains=search) | Q(category__icontains=search))

        return queryset

    @action(detail=False, methods=['get'], url_path='all-masters')
    def all_masters(self, request):
        """Provides a master list of all clinical registries filtered by project context."""
        from .models import RegistryType
        from .serializers import RegistryTypeSerializer
        
        user = request.user
        is_admin = user.role == 'ADMIN' or user.is_superuser or user.user_roles.filter(name='ADMIN').exists()
        project_id = request.query_params.get('project')
        
        queryset = RegistryType.objects.all()
        
        if not is_admin:
            if user.project:
                queryset = queryset.filter(project=user.project)
            else:
                queryset = queryset.none()
        elif project_id:
            queryset = queryset.filter(project_id=project_id)
            
        return Response(RegistryTypeSerializer(queryset, many=True).data)

    @action(detail=False, methods=['post'], url_path='bulk-upload')
    def bulk_upload(self, request):
        registry_type_id = request.data.get('registry_type')
        records = request.data.get('records', [])
        mode = request.data.get('mode', 'OVERWRITE') # OVERWRITE or INCREMENT
        
        if not registry_type_id or not records:
            return Response({"error": "Missing registry_type or records"}, status=400)
        
        # Support slug-based lookup if registry_type_id is not numeric
        active_type_id = None
        project_id = request.data.get('project')
        rt = None
        
        if str(registry_type_id).isdigit():
            active_type_id = int(registry_type_id)
            rt = RegistryType.objects.filter(id=active_type_id).first()
            if not rt:
                return Response({"error": f"Registry type ID '{registry_type_id}' not found"}, status=404)
        else:
            rt_qs = RegistryType.objects.filter(slug=registry_type_id)
            if project_id:
                rt_qs = rt_qs.filter(project_id=project_id)
            
            rt = rt_qs.first()
            if rt:
                active_type_id = rt.id
            else:
                return Response({"error": f"Registry type '{registry_type_id}' not found for this project"}, status=404)

        # Fetch active schema for this registry type
        from .models import RegistryField
        schema_fields = RegistryField.objects.filter(registry_type_id=active_type_id)
        field_slugs = [f.slug for f in schema_fields]

        def parse_date_safely(date_str):
            if not date_str:
                return None
            import re
            from datetime import datetime, date
            date_str = str(date_str).strip()
            patterns = [
                '%Y-%m-%d',
                '%d-%m-%Y',
                '%m-%d-%Y',
                '%Y/%m/%d',
                '%d/%m/%Y',
                '%m/%d/%Y',
            ]
            for pat in patterns:
                try:
                    return datetime.strptime(date_str, pat).date()
                except:
                    continue
            try:
                m = re.match(r'^(\d{2})[-/](\d{2,4})$', date_str)
                if m:
                    month = int(m.group(1))
                    year = int(m.group(2))
                    if year < 100:
                        year += 2000
                    return date(year, month, 1)
            except:
                pass
            return None

        # Track cleared item batches per bulk upload session
        cleared_batches = set()
        success_count = 0
        failed_records = []
        success_details_list = []
        
        from django.db import transaction
        
        with transaction.atomic():
            for row_idx, data in enumerate(records, start=2):
                try:
                    with transaction.atomic():
                        # Normalize keys: convert keys to lowercase, replace spaces with underscores,
                        # and strip any "_(optional)" or "(optional)" suffixes so they match cleanly!
                        clean_data = {}
                        for k, v in data.items():
                            clean_k = str(k).strip().lower().replace(' ', '_')
                            if clean_k.endswith('_(optional)'):
                                clean_k = clean_k[:-11]
                            elif clean_k.endswith('(optional)'):
                                clean_k = clean_k[:-10]
                            clean_data[clean_k] = v

                        # Skip blank/empty rows in Excel/CSV
                        if not clean_data or not any(str(val).strip() for val in clean_data.values() if val is not None):
                            continue

                        # Resolve ucode/primary key
                        ucode = clean_data.get('ucode') or clean_data.get('card_no') or clean_data.get('item_code') or next(iter(clean_data.values()))
                        name = clean_data.get('name') or clean_data.get('item_name') or clean_data.get('label') or ""
                        
                        # If both ucode and name are blank, this is an empty/trailing row (e.g. only autofilled project ID exists) - skip it gracefully!
                        if not str(ucode or '').strip() and not str(name or '').strip():
                            continue
                            
                        if not str(ucode or '').strip() or not str(name or '').strip():
                            raise Exception("Missing primary key/code or name")
                        
                        # Case-insensitive mapping of CSV headers to schema slugs
                        additional = {}
                        slug_map = {s.lower(): s for s in field_slugs} 
                        
                        for key, val in clean_data.items():
                            clean_key = str(key).strip().lower()
                            if clean_key in slug_map:
                                additional[slug_map[clean_key]] = val
                            elif key in field_slugs:
                                additional[key] = val
                        
                        existing_item = RegistryData.objects.filter(registry_type_id=active_type_id, ucode=str(ucode).strip()).first()
                        qty_input = int(clean_data.get('quantity') or clean_data.get('qty') or 0)
                        cost_input = float(clean_data.get('cost') or clean_data.get('price') or 0.0)
                        if cost_input == 0.0 and existing_item and existing_item.cost:
                            cost_input = float(existing_item.cost)

                        obj, created = RegistryData.objects.get_or_create(
                            registry_type_id=active_type_id,
                            ucode=str(ucode).strip(),
                            defaults={
                                'name': str(name).strip(),
                                'category': clean_data.get('category') or clean_data.get('item_group', ''),
                                'description': str(clean_data.get('description') or ''),
                                'quantity': qty_input,
                                'cost': cost_input,
                                'additional_fields': additional
                            }
                        )

                        if not created:
                            # Update fields
                            obj.name = str(name).strip() or obj.name
                            obj.category = clean_data.get('category') or clean_data.get('item_group', obj.category)
                            
                            # Prevent overriding parent cost during refill/increment uploads
                            if mode != 'INCREMENT' and mode != 'ADD':
                                obj.cost = cost_input or obj.cost
                                
                            obj.additional_fields.update(additional)
                            
                            if mode == 'INCREMENT' or mode == 'ADD':
                                obj.quantity += qty_input
                            else:
                                obj.quantity = qty_input
                            
                            obj.save()

                        # Sync drug batches for pharmacy registries
                        is_pharmacy = (
                            rt.type_category in ['CLINICAL_DRUGS', 'PHARMACY'] or
                            'pharmacy' in rt.slug.lower() or
                            'pharmacy' in rt.name.lower() or
                            'drug' in rt.slug.lower() or
                            'drug' in rt.name.lower()
                        )

                        if is_pharmacy:
                            from pharmacy.models import DrugBatch
                            from django.utils import timezone
                            
                            batch_number = clean_data.get('batch_number') or clean_data.get('batch') or clean_data.get('batch_no')
                            if not batch_number:
                                batch_number = "DEFAULT"
                                
                            mfg_raw = clean_data.get('mfg_date') or clean_data.get('mfg') or clean_data.get('manufacturing_date') or clean_data.get('mfg_dt')
                            exp_raw = clean_data.get('expiry_date') or clean_data.get('expiry') or clean_data.get('expiry_dt') or clean_data.get('exp_date') or clean_data.get('expire')
                            
                            mfg_date = parse_date_safely(mfg_raw)
                            expiry_date = parse_date_safely(exp_raw)
                            
                            if not mfg_date:
                                mfg_date = timezone.localdate()
                            if not expiry_date:
                                expiry_date = timezone.localdate() + timezone.timedelta(days=365) # 1 year default
                                
                            # Self-Healing Sync: If parent medicine has stock but NO physical batches exist in the DB,
                            # convert the existing parent stock into a real physical DEFAULT batch first.
                            if not DrugBatch.objects.filter(registry_item=obj).exists():
                                pre_existing_qty = obj.quantity
                                if mode == 'INCREMENT' or mode == 'ADD':
                                    pre_existing_qty = max(0, obj.quantity - qty_input)
                                
                                if pre_existing_qty > 0:
                                    DrugBatch.objects.create(
                                        registry_item=obj,
                                        batch_number='DEFAULT',
                                        mfg_date=timezone.localdate() - timezone.timedelta(days=45),
                                        expiry_date=timezone.localdate() + timezone.timedelta(days=320),
                                        initial_qty=pre_existing_qty,
                                        quantity=pre_existing_qty,
                                        unit_cost=obj.cost
                                    )
                                
                            # Clean/Overwrite existing batches only once per unique medication in the bulk upload
                            if mode == 'OVERWRITE' or mode == 'REPLACE':
                                if obj.id not in cleared_batches:
                                    DrugBatch.objects.filter(registry_item=obj).delete()
                                    cleared_batches.add(obj.id)
                                    
                            base_batch_number = str(batch_number).strip()
                            
                            # Cost variations support: if there's an existing batch with this name but with a DIFFERENT unit cost,
                            # we should create a separate batch with a suffix so the different costs/prices are preserved!
                            existing_batches = DrugBatch.objects.filter(registry_item=obj, batch_number=base_batch_number)
                            if existing_batches.exists():
                                first_existing = existing_batches.first()
                                if float(first_existing.unit_cost) != float(cost_input):
                                    # Append the cost suffix to make it a distinct, isolated batch card!
                                    batch_number = f"{base_batch_number} (₹{cost_input:.2f})"

                            # Update/Create the specific drug batch
                            batch_obj, b_created = DrugBatch.objects.get_or_create(
                                registry_item=obj,
                                batch_number=str(batch_number).strip(),
                                defaults={
                                    'mfg_date': mfg_date,
                                    'expiry_date': expiry_date,
                                    'initial_qty': qty_input,
                                    'quantity': qty_input,
                                    'unit_cost': cost_input
                                }
                            )
                            
                            if not b_created:
                                batch_obj.mfg_date = mfg_date
                                batch_obj.expiry_date = expiry_date
                                if mode == 'INCREMENT' or mode == 'ADD':
                                    batch_obj.quantity += qty_input
                                else:
                                    batch_obj.quantity = qty_input
                                batch_obj.unit_cost = cost_input or batch_obj.unit_cost
                                batch_obj.save()
                                
                            # Sync parent quantity to the total of active batches
                            from django.db.models import Sum
                            total_qty = DrugBatch.objects.filter(registry_item=obj).aggregate(total=Sum('quantity'))['total'] or 0
                            obj.quantity = total_qty
                            obj.save()

                        # If successful, record success details
                        success_details_list.append({
                            'ucode': str(ucode).strip(),
                            'name': str(name).strip(),
                            'qty': qty_input,
                            'cost': cost_input,
                            'category': clean_data.get('category') or clean_data.get('item_group', '')
                        })

                        success_count += 1
                except Exception as e:
                    failed_records.append({
                        "row": row_idx,
                        "item": data.get('item_name') or data.get('item_code') or data.get('name') or 'Unknown',
                        "error": str(e)
                    })

        # Save the registry upload session record
        filename = request.data.get('filename') or 'uploaded_sheet.xlsx'
        upload_session_id = request.data.get('upload_session_id')
        status = 'SUCCESS'
        if len(failed_records) > 0:
            status = 'WARNING' if success_count > 0 else 'FAILED'

        try:
            from .models import RegistryUploadSession
            from django.utils import timezone
            
            user_val = request.user if request.user and request.user.is_authenticated else None
            existing_session = None
            
            # 1. Primary lookup by unique upload_session_id if provided by frontend
            if upload_session_id:
                existing_session = RegistryUploadSession.objects.filter(
                    upload_session_id=upload_session_id
                ).first()
                
            # 2. Fallback lookup by time window (last 3 minutes) if upload_session_id not passed
            if not existing_session:
                three_minutes_ago = timezone.now() - timezone.timedelta(minutes=3)
                existing_session = RegistryUploadSession.objects.filter(
                    user=user_val,
                    project_id=project_id or rt.project_id,
                    registry_type=rt,
                    filename=filename,
                    mode=mode,
                    timestamp__gte=three_minutes_ago
                ).first()
                
            if existing_session:
                # Merge into the existing upload session to present as a single logical upload event!
                existing_session.success_count += success_count
                existing_session.error_count += len(failed_records)
                
                curr_success = existing_session.success_details or []
                curr_errors = existing_session.error_details or []
                
                existing_session.success_details = curr_success + success_details_list
                existing_session.error_details = curr_errors + failed_records
                
                # Recalculate status
                if existing_session.error_count > 0:
                    existing_session.status = 'WARNING' if existing_session.success_count > 0 else 'FAILED'
                else:
                    existing_session.status = 'SUCCESS'
                    
                # Store the session ID if it was missing
                if upload_session_id and not existing_session.upload_session_id:
                    existing_session.upload_session_id = upload_session_id
                    
                existing_session.save()
            else:
                RegistryUploadSession.objects.create(
                    user=user_val,
                    project_id=project_id or rt.project_id,
                    registry_type=rt,
                    filename=filename,
                    mode=mode,
                    success_count=success_count,
                    error_count=len(failed_records),
                    status=status,
                    success_details=success_details_list,
                    error_details=failed_records,
                    upload_session_id=upload_session_id
                )
        except Exception as audit_err:
            print(f"RegistryUploadSession audit log creation/merge failed: {str(audit_err)}")

        log_action(request.user, 'Registry', 'Bulk Upload', f"Processed {success_count} records ({mode}) into registry type {registry_type_id}")
        return Response({
            "success": success_count,
            "errors": len(failed_records),
            "failed_records": failed_records
        })


class ProjectCategoryMappingViewSet(viewsets.ModelViewSet):
    queryset = ProjectCategoryMapping.objects.all()
    serializer_class = ProjectCategoryMappingSerializer
    permission_classes = [permissions.IsAuthenticated]

class ProjectFieldConfigViewSet(viewsets.ModelViewSet):
    queryset = ProjectFieldConfig.objects.all()
    serializer_class = ProjectFieldConfigSerializer
    permission_classes = [permissions.IsAuthenticated]

class EmployeeMasterViewSet(viewsets.ModelViewSet):
    queryset = EmployeeMaster.objects.all().order_by('card_no')
    serializer_class = EmployeeMasterSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = LargeResultsPagination
    filter_backends = [filters.SearchFilter]
    search_fields = ['card_no', 'name', 'aadhar_no', 'mobile_no']

    def get_queryset(self):
        queryset = EmployeeMaster.objects.all().order_by('card_no')
        user = self.request.user
        is_admin = user.role == 'ADMIN' or user.is_superuser or user.user_roles.filter(name='ADMIN').exists()
        
        roles = user.user_roles.all()
        is_isolated_personally = False
        if roles.exists():
            is_isolated_personally = any(r.data_isolation for r in roles)
        else:
            is_isolated_personally = not is_admin

        if not is_admin:
            if is_isolated_personally:
                queryset = queryset.none()
            elif user.project:
                queryset = queryset.filter(project=user.project)
            else:
                queryset = queryset.none()

        project_id = self.request.query_params.get('project')
        if project_id:
            queryset = queryset.filter(project_id=project_id)
        return queryset

    def perform_update(self, serializer):
        old_instance = self.get_object()
        
        # Build snapshot of old values for validated fields
        old_values = {}
        for field in serializer.validated_data.keys():
            old_values[field] = getattr(old_instance, field, None)
            
        data = serializer.save()
        
        # Determine changed fields
        changes = []
        for field, old_val in old_values.items():
            new_val = getattr(data, field, None)
            if old_val != new_val:
                changes.append(f"{field}: '{old_val}' -> '{new_val}'")
                
        change_str = ", ".join(changes) if changes else "No fields changed"
        log_action(
            self.request.user, 
            'Personnel', 
            'Employee Updated', 
            f"Employee {data.card_no} ({data.name}) modified. Changes: {change_str}"
        )

    @action(detail=False, methods=['post'], url_path='bulk-upload')
    def bulk_upload(self, request):
        records = request.data.get('records', [])
        failed_records = []; success_count = 0; error_count = 0
        success_details_list = []
        
        filename = request.data.get('filename') or 'personnel_sheet.xlsx'
        upload_session_id = request.data.get('upload_session_id')
        mode = request.data.get('mode', 'INCREMENT')
        
        def calculate_dob(age_str):
            if not age_str: return None
            import re
            match = re.search(r'(\d+)', str(age_str))
            if match:
                age = int(match.group(1))
                return (timezone.now() - timezone.timedelta(days=age*365.25)).date()
            return None

        def get_val(data, *keys):
            for k in keys:
                for d_key in data.keys():
                    # Strip dots and normalize spaces/slashes to ensure matching with headers like "Mobile No." or "Aadhar No."
                    clean_d_key = d_key.lower().strip().replace(' ', '_').replace('/', '_').replace('.', '')
                    clean_k = k.lower().replace('.', '')
                    if clean_d_key == clean_k:
                        return data[d_key]
            return None

        def clean_str_field(val):
            if val is None:
                return None
            val_str = str(val).strip()
            if val_str.lower() in ['nan', 'none', 'null', '', 'n/a']:
                return None
            # Strip trailing float decimals if present (e.g. 9876543210.0 -> 9876543210)
            if '.' in val_str:
                parts = val_str.split('.')
                if parts[1] == '0' or parts[1] == '':
                    val_str = parts[0]
            return val_str

        from django.db import transaction

        with transaction.atomic():
            # 1. Process Primary Employees
            for idx, data in enumerate(records):
                card_no = str(get_val(data, 'card_no', 'cardno', 'id') or '').strip()
                if '/' in card_no:
                    continue # Skip slashed card numbers, they are dependents!
                
                rel = str(get_val(data, 'relationship', 'rel') or '').strip().upper()
                if not rel or 'PRIMARY' in rel or 'HOLDER' in rel:
                    try:
                        with transaction.atomic():
                            card_no = str(get_val(data, 'card_no', 'cardno', 'id') or '').strip()
                            if not card_no: raise Exception("Missing Card Number")
                            if card_no.endswith('.0'):
                                card_no = card_no[:-2]
                            if card_no.isdigit():
                                card_no = card_no.zfill(4)
                            
                            name = get_val(data, 'name', 'employee_name')
                            gender_str = str(get_val(data, 'gender', 'sex', 'age_gender') or 'MALE').upper()
                            gender = 'FEMALE' if 'F' in gender_str else ('OTHER' if 'O' in gender_str else 'MALE')
                            
                            dob = get_val(data, 'dob', 'date_of_birth')
                            if not dob:
                                dob = calculate_dob(get_val(data, 'age', 'age_gender'))

                            emp_id_val = clean_str_field(get_val(data, 'employee_id', 'employeeid', 'emp_id', 'empid', 'emp_code', 'employee_code')) or ''
                            
                            EmployeeMaster.objects.update_or_create(
                                card_no=card_no,
                                defaults={
                                    'project_id': data.get('project'),
                                    'name': name,
                                    'dob': dob,
                                    'gender': gender,
                                    'aadhar_no': clean_str_field(get_val(data, 'aadhar_no', 'aadhar', 'aadhaar', 'aadhar_card', 'aadhaar_card', 'aadhar_card_number')),
                                    'mobile_no': clean_str_field(get_val(data, 'mobile_no', 'mobile', 'phone', 'contact_link', 'contact', 'contact_no', 'contact_number', 'phone_no', 'phone_number', 'mobile_number', 'contact_link_no', 'contact_link_number')),
                                    'address': get_val(data, 'address', 'addr') or '',
                                    'designation': get_val(data, 'designation', 'desig') or '',
                                    'additional_fields': {'employee_id': emp_id_val} if emp_id_val else {},
                                }
                            )
                            success_count += 1
                            success_details_list.append({
                                'ucode': str(card_no).strip(),
                                'name': str(name).strip(),
                                'category': 'Employee Primary',
                                'qty': 1,
                                'cost': 0.0
                            })
                    except Exception as e:
                        error_count += 1
                        failed_records.append({
                            'row': idx + 2,
                            'item': str(get_val(data, 'name', 'employee_name') or 'Unknown'),
                            'error': str(e)
                        })

            # 2. Process Dependents
            for idx, data in enumerate(records):
                full_card_no = str(get_val(data, 'card_no', 'cardno', 'id') or '').strip()
                rel = str(get_val(data, 'relationship', 'rel') or '').strip().upper()
                is_dependent = '/' in full_card_no or (rel and 'PRIMARY' not in rel and 'HOLDER' not in rel)
                if is_dependent:
                    try:
                        with transaction.atomic():
                            if not full_card_no: raise Exception("Missing Card Number")
                            if full_card_no.endswith('.0'):
                                full_card_no = full_card_no[:-2]
                            
                            parent_card_no = full_card_no.split('/')[0] if '/' in full_card_no else full_card_no
                            suffix = '/' + full_card_no.split('/')[1] if '/' in full_card_no else '/1'
                            
                            if parent_card_no.isdigit():
                                parent_card_no = parent_card_no.zfill(4)
                            
                            employee = EmployeeMaster.objects.filter(card_no=parent_card_no).first()
                            if not employee: raise Exception(f"Parent employee {parent_card_no} not found")

                            gender_str = str(get_val(data, 'gender', 'sex', 'age_gender') or 'MALE').upper()
                            gender = 'FEMALE' if 'F' in gender_str else ('OTHER' if 'O' in gender_str else 'MALE')
                            
                            dob = get_val(data, 'dob', 'date_of_birth')
                            if not dob:
                                dob = calculate_dob(get_val(data, 'age', 'age_gender'))

                            FamilyMember.objects.update_or_create(
                                employee=employee,
                                card_no_suffix=suffix,
                                defaults={
                                    'name': get_val(data, 'name', 'family_name'),
                                    'dob': dob,
                                    'gender': gender,
                                    'aadhar_no': clean_str_field(get_val(data, 'aadhar_no', 'aadhar', 'aadhaar', 'aadhar_card', 'aadhaar_card', 'aadhar_card_number')),
                                    'mobile_no': clean_str_field(get_val(data, 'mobile_no', 'mobile', 'phone', 'contact_link', 'contact', 'contact_no', 'contact_number', 'phone_no', 'phone_number', 'mobile_number', 'contact_link_no', 'contact_link_number')),
                                    'relationship': rel
                                }
                            )
                            success_count += 1
                            success_details_list.append({
                                'ucode': str(full_card_no).strip(),
                                'name': str(get_val(data, 'name', 'family_name')).strip(),
                                'category': f"Dependent ({rel})",
                                'qty': 1,
                                'cost': 0.0
                            })
                    except Exception as e:
                        error_count += 1
                        failed_records.append({
                            'row': idx + 2,
                            'item': str(get_val(data, 'name', 'family_name') or 'Unknown'),
                            'error': str(e)
                        })
        
        # Save RegistryUploadSession log for personnel spreadsheets
        try:
            from .models import RegistryType, RegistryUploadSession
            rt = RegistryType.objects.filter(slug='employee_master').first()
            first_record = records[0] if records else {}
            project_id = first_record.get('project') or (request.user.project.id if request.user and request.user.project else None)
            
            if not rt:
                rt = RegistryType.objects.filter(project_id=project_id).first() or RegistryType.objects.first()
                
            if rt:
                user_val = request.user if request.user and request.user.is_authenticated else None
                status = 'SUCCESS'
                if len(failed_records) > 0:
                    status = 'WARNING' if success_count > 0 else 'FAILED'
                    
                existing_session = None
                if upload_session_id:
                    existing_session = RegistryUploadSession.objects.filter(upload_session_id=upload_session_id).first()
                    
                if not existing_session:
                    three_minutes_ago = timezone.now() - timezone.timedelta(minutes=3)
                    existing_session = RegistryUploadSession.objects.filter(
                        user=user_val,
                        project_id=project_id or rt.project_id,
                        registry_type=rt,
                        filename=filename,
                        mode=mode,
                        timestamp__gte=three_minutes_ago
                    ).first()
                    
                if existing_session:
                    existing_session.success_count += success_count
                    existing_session.error_count += len(failed_records)
                    existing_session.success_details = (existing_session.success_details or []) + success_details_list
                    existing_session.error_details = (existing_session.error_details or []) + failed_records
                    if existing_session.error_count > 0:
                        existing_session.status = 'WARNING' if existing_session.success_count > 0 else 'FAILED'
                    else:
                        existing_session.status = 'SUCCESS'
                    if upload_session_id and not existing_session.upload_session_id:
                        existing_session.upload_session_id = upload_session_id
                    existing_session.save()
                else:
                    RegistryUploadSession.objects.create(
                        user=user_val,
                        project_id=project_id or rt.project_id,
                        registry_type=rt,
                        filename=filename,
                        mode=mode,
                        success_count=success_count,
                        error_count=len(failed_records),
                        status=status,
                        success_details=success_details_list,
                        error_details=failed_records,
                        upload_session_id=upload_session_id
                    )
        except Exception as audit_err:
            print(f"RegistryUploadSession personnel logging failed: {str(audit_err)}")

        log_action(request.user, 'Governance', 'Bulk Upload', f"Imported {success_count} personnel records (Errors: {error_count})")
        return Response({"success": success_count, "errors": error_count, "failed_records": failed_records})

    @action(detail=False, methods=['get'], url_path='all-masters')
    def all_masters(self, request):
        """Returns employee masters filtered by project for unified search in Navbar."""
        from .models import EmployeeMaster
        from .serializers import EmployeeMasterSerializer
        
        user = request.user
        is_admin = user.role == 'ADMIN' or user.is_superuser or user.user_roles.filter(name='ADMIN').exists()
        
        # Base queryset
        queryset = EmployeeMaster.objects.all().prefetch_related('family_members')
        
        # Enforce Isolation
        if not is_admin:
            if user.project:
                queryset = queryset.filter(project=user.project)
            else:
                queryset = queryset.none()
        else:
            # Admins can filter by project param
            project_id = request.query_params.get('project')
            if project_id:
                queryset = queryset.filter(project_id=project_id)
        
        return Response(EmployeeMasterSerializer(queryset, many=True).data)

    @action(detail=False, methods=['get'], url_path='next-card-no')
    def next_card_no(self, request):
        project_id = request.query_params.get('project')
        user = request.user
        
        # Determine target project
        target_project_id = project_id
        if not target_project_id and user.project:
            target_project_id = user.project.id
            
        # Get all card numbers for this project (or all if no project)
        queryset = EmployeeMaster.objects.all()
        if target_project_id:
            queryset = queryset.filter(project_id=target_project_id)
            
        card_nos = queryset.values_list('card_no', flat=True)
        
        # Extract numeric parts and find max
        import re
        max_no = 0
        for cn in card_nos:
            # Primary part is before any / or - suffix
            primary_part = str(cn).split('/')[0].split('-')[0]
            # Extract numeric sequence from primary part
            match = re.search(r'(\d+)', primary_part)
            if match:
                val = int(match.group(1))
                if val > max_no:
                    max_no = val
        
        next_no = max_no + 1
        # Format as 4-digit padded string by default, or just string
        formatted_next = str(next_no).zfill(4)
        
        return Response({"next_card_no": formatted_next})


class FamilyMemberViewSet(viewsets.ModelViewSet):
    queryset = FamilyMember.objects.all()
    serializer_class = FamilyMemberSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_update(self, serializer):
        old_instance = self.get_object()
        
        # Build snapshot of old values for validated fields
        old_values = {}
        for field in serializer.validated_data.keys():
            old_values[field] = getattr(old_instance, field, None)
            
        data = serializer.save()
        
        # Determine changed fields
        changes = []
        for field, old_val in old_values.items():
            new_val = getattr(data, field, None)
            if old_val != new_val:
                changes.append(f"{field}: '{old_val}' -> '{new_val}'")
                
        change_str = ", ".join(changes) if changes else "No fields changed"
        log_action(
            self.request.user, 
            'Personnel', 
            'Family Member Updated', 
            f"Family Member {data.card_no} ({data.name}) modified. Changes: {change_str}"
        )

class RegistryReportView(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def list(self, request):
        user = request.user
        project_id = request.query_params.get('project')
        is_admin = user.role == 'ADMIN' or user.is_superuser or user.user_roles.filter(name='ADMIN').exists()

        low_threshold_str = request.query_params.get('low_threshold', '10')
        try:
            low_threshold = int(low_threshold_str)
        except ValueError:
            low_threshold = 10

        active_project = None
        if user.is_superuser:
            if project_id:
                active_project = Project.objects.filter(id=project_id).first()
        elif user.project:
            active_project = user.project
        elif is_admin:
            if project_id:
                active_project = Project.objects.filter(id=project_id).first()

        from django.utils import timezone
        from datetime import timedelta
        from django.db.models import Count, Sum, Case, When, FloatField, Q
        from accounts.models import AuditLog
        from clinical.models import Visit

        today = timezone.localdate()
        week_ago = today - timedelta(days=7)

        # Base filters
        patient_qs = Patient.objects.all()
        visit_qs = Visit.objects.all()
        
        # Dynamic Pharmacy Discovery (Project Isolated)
        # We look for the first registry marked with the 'Pill' icon or having 'pharmacy' in its identifier
        pharmacy_type = None
        if active_project:
            pharmacy_type = RegistryType.objects.filter(project=active_project).filter(Q(icon='Pill') | Q(slug__icontains='pharmacy') | Q(name__icontains='pharmacy')).first()
        else:
            pharmacy_type = RegistryType.objects.filter(Q(icon='Pill') | Q(slug='pharmacy-drugs')).first()

        inventory_items = RegistryData.objects.filter(registry_type=pharmacy_type).exclude(name='').exclude(ucode='').exclude(name__isnull=True).exclude(ucode__isnull=True) if pharmacy_type else RegistryData.objects.none()

        if active_project:
            patient_qs = patient_qs.filter(Q(project=active_project) | Q(employee_master__project=active_project))
            visit_qs = visit_qs.filter(Q(patient__project=active_project) | Q(patient__employee_master__project=active_project))
            # inventory_items is already filtered by registry_type which is project-aware

        
        # 1. Consumption Aggregation (Last 7 Days Trend)
        # Search for all consumption logs first
        consumption_logs = AuditLog.objects.filter(details__icontains='[CONSUMPTION]', timestamp__date__gte=week_ago)
        
        # Primary daily series
        daily_series = { (today - timedelta(days=i)).strftime('%Y-%m-%d'): 0 for i in range(7) }
        consumption_map = {}
        
        # Source 2: Actual DispensingRecords (Pharmacy)
        from pharmacy.models import DispensingRecord, Prescription
        dispensed_records = DispensingRecord.objects.filter(dispensed_at__date__gte=week_ago)
        
        # Source 3: All Prescriptions (Doctor/Pharmacy) 
        # We look for prescriptions that were either created this week OR marked as DISPENSED this week
        prescriptions = Prescription.objects.filter(
            Q(created_at__date__gte=week_ago) | Q(status__in=['DISPENSED', 'PARTIALLY_DISPENSED'])
        )

        if active_project:
            # Filter all sources by project
            dispensed_records = dispensed_records.filter(
                Q(prescription__visit__patient__project=active_project) | 
                Q(prescription__visit__patient__employee_master__project=active_project)
            )
            prescriptions = prescriptions.filter(
                Q(visit__patient__project=active_project) | 
                Q(visit__patient__employee_master__project=active_project)
            )
            # Log filtering done via details__contains
            pid_search = f'Project:{active_project.id}'
            consumption_logs = consumption_logs.filter(details__icontains=pid_search)

        import re
        # Aggregation Logic
        def add_to_series(date_obj, qty, med_name):
            try:
                ds_key = date_obj.strftime('%Y-%m-%d')
                if ds_key in daily_series:
                    daily_series[ds_key] += qty
                if med_name:
                    consumption_map[med_name] = consumption_map.get(med_name, 0) + qty
            except: pass

        # Process Dispensed Records (Highest Priority)
        processed_prescription_ids = set()
        for dr in dispensed_records:
            add_to_series(timezone.localtime(dr.dispensed_at).date(), dr.quantity, dr.prescription.medication_name)
            processed_prescription_ids.add(dr.prescription_id)

        # Process AuditLogs (Secondary Priority - fallback if no explicit dispensing records)
        for log in consumption_logs:
            try:
                # Group 1: Name, Group 2: Qty
                match = re.search(r'\[CONSUMPTION\]\s*(.*?)\s*\|\s*(\d+)', log.details, re.IGNORECASE)
                if match:
                    # Deduplicate: Skip log if we already processed this prescription via DispensingRecord
                    id_match = re.search(r'ID:(\d+)', log.details)
                    if id_match:
                        pid = int(id_match.group(1))
                        if pid in processed_prescription_ids:
                            continue
                    add_to_series(timezone.localtime(log.timestamp).date(), int(match.group(2)), match.group(1).strip())
            except: continue

        # Process Prescriptions (Secondary Priority - fallback if no explicit records)
        # We calculate actual clinical units based on MNC-standard frequency parsing
        def get_dose_qty(rec):
            try:
                # If it's a DispensingRecord, use that actual quantity as the absolute source of truth (including 1)
                if hasattr(rec, 'quantity') and rec.quantity is not None:
                    return rec.quantity
                
                # Otherwise, derive from prescription metadata
                p = rec if isinstance(rec, Prescription) else rec.prescription
                freq = str(p.frequency or "").upper()
                dur = str(p.duration or "0")
                name = str(p.medication_name or "").upper()
                
                # Only multiply duration (days) for tablets/capsules/pills. Other forms (drops, ointment, syrup) default to 1 unit.
                unit_groups = ['SYRUP', 'OINTMENT', 'CREAM', 'GEL', 'INJECTION', 'DROP', 'LOTION', 'SOLUTION', 'SUSPENSION', 'SPRAY', 'INHALER']
                is_unit_based = any(g in name for g in unit_groups) or not any(t in name for t in ['TAB', 'CAP', 'PILL'])
                if is_unit_based:
                    return 1
                
                per_day = 0
                if '-' in freq:
                    try:
                        per_day = sum([int(v) for v in freq.split('-') if v.strip().isdigit()])
                    except: per_day = 1
                else:
                    mapping = { 'OD': 1, 'BD': 2, 'BID': 2, 'TDS': 3, 'TID': 3, 'QID': 4, 'SOS': 1, 'HS': 1, 'STAT': 1 }
                    per_day = mapping.get(freq, 1)
                
                dur_val = int(''.join(filter(str.isdigit, dur)) or 0)
                return per_day * dur_val
            except: return 1

        for p in prescriptions:
            if p.id not in processed_prescription_ids and p.status in ['DISPENSED', 'PARTIALLY_DISPENSED']:
                qty = get_dose_qty(p)
                add_to_series(timezone.localtime(p.created_at).date(), qty, p.medication_name)

        # 1b. Total Historical Consumption (All Time)
        total_units_sum = 0
        all_time_dispensed = DispensingRecord.objects.all()
        all_time_prescriptions = Prescription.objects.filter(status__in=['DISPENSED', 'PARTIALLY_DISPENSED'])
        
        if active_project:
            all_time_dispensed = all_time_dispensed.filter(
                Q(prescription__visit__patient__project=active_project) | 
                Q(prescription__visit__patient__employee_master__project=active_project)
            )
            all_time_prescriptions = all_time_prescriptions.filter(
                Q(visit__patient__project=active_project) | 
                Q(visit__patient__employee_master__project=active_project)
            )

        # Sum Dispensed Records
        for dr in all_time_dispensed:
            total_units_sum += get_dose_qty(dr)
        
        # Add prescriptions that don't have dispensed records yet (calculated fallback)
        all_time_processed_pids = set(all_time_dispensed.values_list('prescription_id', flat=True))
        for p in all_time_prescriptions:
            if p.id not in all_time_processed_pids:
                total_units_sum += get_dose_qty(p)

        # Trends are sorted chronologically
        trends = sorted([{'date': k, 'units': v} for k, v in daily_series.items()], key=lambda x: x['date'])

        # 2. Conversion Analytics (Dynamic)
        total_v = visit_qs.count()
        completed_v = visit_qs.filter(status__in=['COMPLETED', 'PENDING_PHARMACY']).count()
        conversion_rate = round((completed_v / total_v * 100) if total_v > 0 else 0, 1)

        # 3. Inventory Health
        inventory_stats = inventory_items.aggregate(
            total_value=Sum(Case(When(quantity__gt=0, then='cost'), default=0, output_field=FloatField())),
            low_stock=Count('id', filter=Q(quantity__lt=low_threshold, quantity__gt=0)),
            out_of_stock=Count('id', filter=Q(quantity=0))
        )

        all_c = sorted([{'name': k, 'total': v} for k, v in consumption_map.items()], key=lambda x: x['total'], reverse=True)

        # 4. Fetch Active Batches with Detailed Metadata for Premium UI Viz
        from pharmacy.models import DrugBatch
        active_batches_qs = DrugBatch.objects.filter(registry_item__in=inventory_items).select_related('registry_item')
        
        batches_list = []
        for batch in active_batches_qs:
            days_to_expiry = (batch.expiry_date - today).days
            status = 'SAFE'
            if batch.quantity == 0:
                status = 'DEPLETED'
            elif days_to_expiry <= 0:
                status = 'EXPIRED'
            elif days_to_expiry <= 90:
                status = 'EXPIRING_SOON'
            elif batch.quantity < low_threshold:
                status = 'LOW_STOCK'
            elif batch.quantity > 100:
                status = 'HIGH_STOCK'
                
            batches_list.append({
                'id': batch.id,
                'medication_name': batch.registry_item.name,
                'batch_number': batch.batch_number,
                'mfg_date': batch.mfg_date.strftime('%Y-%m-%d') if batch.mfg_date else None,
                'expiry_date': batch.expiry_date.strftime('%Y-%m-%d') if batch.expiry_date else None,
                'days_to_expiry': days_to_expiry,
                'initial_qty': batch.initial_qty,
                'quantity': batch.quantity,
                'unit_cost': float(batch.unit_cost),
                'status': status
            })

        # Proactively supplement virtual default batches for items with stock but no physical batch entries
        items_with_physical_batches = set(active_batches_qs.values_list('registry_item_id', flat=True))
        for item in inventory_items:
            if item.id not in items_with_physical_batches and item.quantity > 0:
                mfg = today - timedelta(days=45)
                exp = today + timedelta(days=320)
                
                initial_qty = 100
                if item.additional_fields and isinstance(item.additional_fields, dict):
                    try:
                        initial_qty = int(item.additional_fields.get('initial_quantity') or item.additional_fields.get('initial_qty') or item.quantity)
                    except Exception:
                        initial_qty = item.quantity or 100
                if initial_qty < item.quantity:
                    initial_qty = item.quantity
                
                days_to_expiry = (exp - today).days
                status = 'SAFE'
                if item.quantity == 0:
                    status = 'DEPLETED'
                elif item.quantity < low_threshold:
                    status = 'LOW_STOCK'
                elif item.quantity > 100:
                    status = 'HIGH_STOCK'
                    
                batches_list.append({
                    'id': f"fallback_{item.id}",
                    'medication_name': item.name,
                    'batch_number': "DEFAULT",
                    'mfg_date': mfg.strftime('%Y-%m-%d'),
                    'expiry_date': exp.strftime('%Y-%m-%d'),
                    'days_to_expiry': days_to_expiry,
                    'initial_qty': initial_qty,
                    'quantity': item.quantity,
                    'unit_cost': float(item.cost or 0.0),
                    'status': status
                })

        return Response({
            'total_registered': patient_qs.count(),
            'total_units_all_time': total_units_sum,
            'conversion_rate': conversion_rate,
            'inventory_value': inventory_stats['total_value'] or 0,
            'stock_health': {
                'low': inventory_stats['low_stock'],
                'out': inventory_stats['out_of_stock']
            },
            'total_investigations': visit_qs.aggregate(total=Sum('lab_requests'))['total'] or visit_qs.count(),
            'drug_variations': inventory_items.count(),
            'trends': trends,
            'by_gender': list(patient_qs.values('gender').annotate(count=Count('gender'))),
            'top_medications': all_c[:10],
            'all_consumption': all_c,
            'project_name': active_project.name if active_project else "All Projects",
            'batches': batches_list
        })

from .reports import generate_patient_pdf_report
from django.http import HttpResponse

class PatientViewSet(viewsets.ModelViewSet):

    serializer_class = PatientSerializer
    pagination_class = LargeResultsPagination
    filter_backends = [filters.SearchFilter]
    search_fields = ['first_name', 'last_name', 'phone', 'id_proof_number', 'card_no', 'patient_id']
    permission_classes = [permissions.IsAuthenticated]

    def get_permissions(self):
        from accounts.permissions import IsStaffUser
        # Actions accessible to Patients (Self-service)
        if self.action in ['my_full_report', 'download_report_self']:
            return [permissions.IsAuthenticated()]
        # Actions restricted to Staff/Admin
        return [permissions.IsAuthenticated(), IsStaffUser()]

    def filter_queryset(self, queryset):
        search_query = self.request.query_params.get('search', '').strip()
        card_ids = []
        if search_query:
            import re
            match = re.search(r'\b(?:BHSPL)?(\d{4})(?:/\d+)?\b', search_query, re.IGNORECASE)
            if not match:
                match = re.search(r'\b(\d+)(?:/\d+)?\b', search_query)
            
            if match:
                base_card = match.group(1)
                if base_card.isdigit():
                    base_card = base_card.zfill(4)
                
                card_matches = queryset.filter(
                    Q(card_no=base_card) | Q(card_no__startswith=f"{base_card}/")
                )
                card_ids = list(card_matches.values_list('id', flat=True))

        queryset = super().filter_queryset(queryset)

        if card_ids:
            queryset_ids = list(queryset.values_list('id', flat=True))
            combined_ids = list(set(card_ids + queryset_ids))
            queryset = queryset.filter(id__in=combined_ids)
            
        return queryset

    def get_base_queryset(self):
        queryset = Patient.objects.all().order_by('-created_at')
        user = self.request.user
        is_admin = user.role == 'ADMIN' or user.is_superuser or user.user_roles.filter(name='ADMIN').exists()
        project_param = self.request.query_params.get('project')
        
        if user.is_superuser:
            if project_param:
                queryset = queryset.filter(Q(project_id=project_param) | Q(employee_master__project_id=project_param))
        elif user.project:
            queryset = queryset.filter(Q(project=user.project) | Q(employee_master__project=user.project))
        elif is_admin:
            if project_param:
                queryset = queryset.filter(Q(project_id=project_param) | Q(employee_master__project_id=project_param))
        else:
            queryset = queryset.filter(registered_by=user)
            
        return queryset

    def sync_missing_family_members(self):
        # 0. Thread-safe lock to prevent concurrent execution from parallel API calls
        if not _sync_lock.acquire(blocking=False):
            return
        try:
            from django.db import transaction
            from django.db.models import Count
            from patients.models import Patient, EmployeeMaster, FamilyMember
            
            # A. Dynamic Duplicate Cleanup: Clean up any duplicate Patient records sharing the same family_member or employee_master
            try:
                # Dup Family Members
                dup_families = Patient.objects.filter(family_member__isnull=False).values('family_member').annotate(cnt=Count('id')).filter(cnt__gt=1)
                for dup in dup_families:
                    fm_id = dup['family_member']
                    pats = list(Patient.objects.filter(family_member_id=fm_id).order_by('id'))
                    for p in pats[1:]:
                        p.delete()

                # Dup Employees (Primary)
                dup_employees = Patient.objects.filter(employee_master__isnull=False, family_member__isnull=True).values('employee_master').annotate(cnt=Count('id')).filter(cnt__gt=1)
                for dup in dup_employees:
                    emp_id = dup['employee_master']
                    pats = list(Patient.objects.filter(employee_master_id=emp_id, family_member__isnull=True).order_by('id'))
                    for p in pats[1:]:
                        p.delete()
            except Exception as clean_err:
                print("Failed during duplicate Patient cleanup:", clean_err)

            # 1. Sync Employee Masters that do not have a Patient record
            missing_employees = EmployeeMaster.objects.filter(patients__isnull=True)
            for emp in missing_employees:
                try:
                    with transaction.atomic():
                        # Strict double check: Ensure no Patient record already exists
                        if Patient.objects.filter(employee_master=emp, family_member__isnull=True).exists():
                            continue
                        if Patient.objects.filter(card_no=emp.card_no).exists():
                            continue
                            
                        # Determine unique id_proof_number
                        aadhaar = emp.aadhar_no or emp.mobile_no or f"EMP-{emp.card_no}"
                        if Patient.objects.filter(id_proof_number=aadhaar).exists():
                            aadhaar = f"EMP-{emp.card_no}-{emp.id}"
                        
                        parts = emp.name.strip().split(' ', 1)
                        first_name = parts[0]
                        last_name = parts[1] if len(parts) > 1 else 'Employee'
                        
                        Patient.objects.create(
                            first_name=first_name,
                            last_name=last_name,
                            dob=emp.dob,
                            gender=emp.gender if emp.gender in ['MALE', 'FEMALE', 'OTHER'] else 'MALE',
                            phone=emp.mobile_no,
                            address=emp.address,
                            id_proof_type='AADHAAR' if emp.aadhar_no else 'EMPLOYEE_CARD',
                            id_proof_number=aadhaar,
                            card_no=emp.card_no,
                            relationship='PRIMARY CARD HOLDER',
                            is_employee_linked=True,
                            employee_master=emp,
                            project=emp.project
                        )
                except Exception as ex:
                    print(f"Error syncing employee {emp.card_no}:", ex)
            
            # 2. Sync Family Members that do not have a Patient record
            missing_families = FamilyMember.objects.filter(patients__isnull=True)
            for fm in missing_families:
                try:
                    with transaction.atomic():
                        # Strict double check: Ensure no Patient record already exists for this fm
                        if Patient.objects.filter(family_member=fm).exists():
                            continue
                        
                        emp = fm.employee
                        card_no_val = f"{emp.card_no}{fm.card_no_suffix}"
                        if Patient.objects.filter(card_no=card_no_val).exists():
                            continue
                            
                        # Determine unique id_proof_number
                        aadhaar = fm.aadhar_no or fm.mobile_no or f"CARD-{emp.card_no}{fm.card_no_suffix}"
                        if Patient.objects.filter(id_proof_number=aadhaar).exists():
                            aadhaar = f"CARD-{emp.card_no}{fm.card_no_suffix}-{fm.id}"
                        
                        parts = fm.name.strip().split(' ', 1)
                        first_name = parts[0]
                        last_name = parts[1] if len(parts) > 1 else 'Family'
                        
                        Patient.objects.create(
                            first_name=first_name,
                            last_name=last_name,
                            dob=fm.dob,
                            gender=fm.gender if fm.gender in ['MALE', 'FEMALE', 'OTHER'] else 'MALE',
                            phone=fm.mobile_no or emp.mobile_no,
                            address=emp.address,
                            id_proof_type='AADHAAR' if fm.aadhar_no else 'EMPLOYEE_CARD',
                            id_proof_number=aadhaar,
                            card_no=card_no_val,
                            relationship=fm.relationship,
                            is_employee_linked=True,
                            employee_master=emp,
                            family_member=fm,
                            project=emp.project
                        )
                except Exception as ex:
                    print(f"Error syncing family member {fm.card_no_suffix}:", ex)
        except Exception as e:
            print("Failed during dynamic Patient sync:", e)
        finally:
            _sync_lock.release()

    def get_queryset(self):
        self.sync_missing_family_members()
        queryset = self.get_base_queryset()
            
        # --- Workflow Tab Filtering ---
        view_mode = self.request.query_params.get('view', 'all').lower()
        search_query = self.request.query_params.get('search', '').strip()
        


        if view_mode == 'active':
            # Only show patients with a currently active clinical visit
            queryset = queryset.filter(visits__is_active=True).distinct()
        elif view_mode == 'scheduled':
            # Only show patients with upcoming or today's pending appointments
            from django.utils import timezone
            from datetime import timedelta
            # Include anything from today onwards that hasn't been checked in
            today_start = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)
            queryset = queryset.filter(
                appointments__status__in=['SCHEDULED', 'CONFIRMED'], 
                appointments__appointment_date__gte=today_start
            ).distinct()
        elif view_mode == 'completed':
            # Only show patients who completed their visit today
            from django.utils import timezone
            from datetime import timedelta
            
            # Use a robust date range for the current local day
            today_start = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)
            tomorrow_start = today_start + timedelta(days=1)
            
            # We look for patients with inactive visits that were either started or (implicitly) handled today
            # Since we don't have a closed_at, we prioritize visits that started today and are inactive.
            queryset = queryset.filter(
                visits__is_active=False, 
                visits__visit_date__range=(today_start, tomorrow_start)
            ).distinct()
        # 'all' (Master Registry) requires no further filtering

        return queryset.distinct()

    @action(detail=False, methods=['get'])
    def stats(self, request):
        from django.utils import timezone
        from datetime import timedelta
        today = timezone.localdate()
        base_qs = self.get_base_queryset()
        
        # Calculate real-time counts for all columns
        today_start = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)
        tomorrow_start = today_start + timedelta(days=1)
        
        q_active = base_qs.filter(visits__is_active=True).distinct().count()
        q_scheduled = base_qs.filter(
            appointments__status__in=['SCHEDULED', 'CONFIRMED'], 
            appointments__appointment_date__gte=today_start
        ).distinct().count()
        q_completed = base_qs.filter(
            visits__is_active=False, 
            visits__visit_date__range=(today_start, tomorrow_start)
        ).distinct().count()
        q_all = base_qs.distinct().count()

        return Response({
            "total_registered": q_all,
            "active_count": q_active,
            "scheduled_count": q_scheduled,
            "completed_count": q_completed,
            "opd_today": q_active + q_completed,
            "emergency_today": base_qs.filter(patient_type='Emergency', visits__visit_date__date=today).count()
        })

    @action(detail=True, methods=['get'])
    def full_report(self, request, pk=None):
        patient = self.get_object()
        from clinical.models import Visit
        from clinical.serializers import VisitSerializer
        
        # Fetch all visits with nested details (vitals, consult, lab, pharmacy)
        visits = Visit.objects.filter(patient=patient).order_by('-visit_date')
        
        return Response({
            "patient": PatientSerializer(patient).data,
            "visits": VisitSerializer(visits, many=True).data
        })

    @action(detail=False, methods=['get'], url_path='me/full_report')
    def my_full_report(self, request):
        """
        Fetches the clinical dossier. Prioritizes the high-speed MongoDB 'Hot Dossier'
        with an automatic SQL fallback for absolute reliability.
        """
        user = request.user
        if user.role != 'PATIENT':
            return Response({"error": "This record is restricted to Patient portal access."}, status=403)
        
        # Find the patient profile linked to this user
        patient = getattr(user, 'patient_profile', None)
        if not patient:
             return Response({"error": "No patient profile linked to this account."}, status=404)

        # 🚀 PHASE 2: MongoDB High-Speed Retrieval
        from .dossier_manager import dossier_manager
        hot_dossier = dossier_manager.get_dossier(patient.patient_id)
        
        if hot_dossier:
             # Ensure live identity context is preserved
             hot_dossier["patient_id"] = patient.patient_id
             return Response(hot_dossier)

        # 🧊 FALLBACK: Standard SQL Retrieval (Cold Data)
        from clinical.models import Visit, Appointment
        from clinical.serializers import VisitSerializer, AppointmentSerializer
        from .tasks import sync_patient_dossier_task
        
        # Schedule a materialization since the Hot Dossier was missing
        try:
            sync_patient_dossier_task.delay(patient.patient_id)
        except Exception as e:
            print(f"⚠️ INFRA: Celery/Redis Offline. Skipping background sync. ({str(e)})")
            # Optional: Run synchronously if we really need the data hot next time
            # sync_patient_dossier_task(patient.patient_id) 
        
        visits = Visit.objects.filter(patient=patient)\
            .select_related('vitals', 'consultation')\
            .prefetch_related('lab_requests', 'prescriptions')\
            .order_by('-visit_date')
        
        return Response({
            "patient_id": patient.patient_id,
            "full_name": f"{patient.first_name} {patient.last_name}",
            "project_name": patient.project.name if patient.project else (patient.employee_master.project.name if patient.employee_master and patient.employee_master.project else "Global Workspace"),
            "registry_metadata": {
                "gender": patient.gender,
                "dob": str(patient.dob) if patient.dob else None,
                "phone": patient.phone,
                "blood_group": patient.blood_group,
                "address": patient.address,
                "allow_appointments": patient.project.allow_appointments if patient.project else True
            },
            "clinical_summary": {
                "total_visits": visits.count(),
                "total_lab_investigations": sum(v.lab_requests.count() for v in visits),
                "total_active_prescriptions": sum(v.prescriptions.count() for v in visits),
                "total_appointments": Appointment.objects.filter(patient=patient).count()
            },
            "visit_history": VisitSerializer(visits, many=True).data,
            "appointments": AppointmentSerializer(Appointment.objects.filter(patient=patient).order_by('-appointment_date'), many=True).data,
            "system_status": "SQL_COLD_RETRIEVAL"
        })

    @action(detail=True, methods=['get'], url_path='download_report')
    def download_report_detail(self, request, pk=None):
        patient = self.get_object()
        visit_date = request.query_params.get('date')
        limit = request.query_params.get('limit')
        
        pdf_buffer = generate_patient_pdf_report(patient.patient_id, visit_date, limit=limit)
        
        response = HttpResponse(pdf_buffer, content_type='application/pdf')
        filename = f"Clinical_Report_{patient.patient_id}_{visit_date or 'full'}.pdf"
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response

    @action(detail=False, methods=['get'], url_path='download_report')
    def download_report_self(self, request):
        user = request.user
        patient_id = user.username
        visit_date = request.query_params.get('date')
        limit = request.query_params.get('limit')
        
        pdf_buffer = generate_patient_pdf_report(patient_id, visit_date, limit=limit)
        
        response = HttpResponse(pdf_buffer, content_type='application/pdf')
        filename = f"My_Clinical_Report_{patient_id}_{visit_date or 'latest'}.pdf"
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def enable_portal(self, request, pk=None):
        patient = self.get_object()
        from accounts.models import User
        
        if User.objects.filter(username=patient.patient_id).exists():
            return Response({"error": "Portal account already exists for this patient"}, status=400)
            
        # Create the locked user account
        user = User.objects.create(
            username=patient.patient_id,
            first_name=patient.first_name,
            last_name=patient.last_name,
            phone=patient.phone,
            role='PATIENT',
            is_active=False,      # Must be activated via OTP setup
            is_password_set=False # Force password setup
        )

        # 🚀 AUTOMATIC PROVISIONING: Link the 'PATIENT' Role instantly
        from accounts.models import UserRole
        patient_role, created = UserRole.objects.get_or_create(
            name='PATIENT',
            defaults={'description': 'Default role for MNC Portal patients'}
        )
        user.user_roles.add(patient_role)
        
        # In a real scenario, you would trigger an SMS here with the Registry ID
        # For now, we'll return success
        return Response({
            "message": f"Portal access enabled for {patient.patient_id}. Patient can now login via Mobile OTP.",
            "username": user.username
        })
    @action(detail=False, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def bulk_enable_portal(self, request):
        patient_ids = request.data.get('patient_ids', [])
        if not patient_ids:
            return Response({"error": "No patients selected"}, status=400)
            
        from accounts.models import User, UserRole
        patient_role, _ = UserRole.objects.get_or_create(
            name='PATIENT',
            defaults={'description': 'Default role for MNC Portal patients'}
        )
        
        success_count = 0
        patients = Patient.objects.filter(id__in=patient_ids)
        
        for patient in patients:
            if not User.objects.filter(username=patient.patient_id).exists():
                user = User.objects.create(
                    username=patient.patient_id,
                    first_name=patient.first_name,
                    last_name=patient.last_name,
                    phone=patient.phone,
                    role='PATIENT',
                    is_active=False,
                    is_password_set=False
                )
                user.user_roles.add(patient_role)
                success_count += 1
                
        return Response({
            "message": f"Bulk provisioning complete. {success_count} portal accounts activated.",
            "processed": len(patients)
        })


class RegistryUploadSessionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = RegistryUploadSession.objects.all()
    serializer_class = RegistryUploadSessionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = RegistryUploadSession.objects.all()
        project_id = self.request.query_params.get('project')
        registry_type_id = self.request.query_params.get('registry_type')
        if project_id:
            qs = qs.filter(project_id=project_id)
        if registry_type_id:
            qs = qs.filter(registry_type_id=registry_type_id)
        return qs
