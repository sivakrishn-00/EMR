from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import viewsets, permissions, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Patient, EmployeeMaster, FamilyMember, Project, ProjectCategoryMapping, ProjectFieldConfig, RegistryType, RegistryData, RegistryField, ProjectLogo
from .serializers import (
    PatientSerializer, EmployeeMasterSerializer, FamilyMemberSerializer,
    ProjectSerializer, ProjectCategoryMappingSerializer, ProjectFieldConfigSerializer,
    RegistryTypeSerializer, RegistryDataSerializer, RegistryFieldSerializer, ProjectLogoSerializer
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
        
        for idx, card_no_input in enumerate(card_numbers):
            try:
                card_no_input = str(card_no_input).strip()
                if not card_no_input: continue
                
                if '/' in card_no_input:
                    # 1. Family Member Granular Case (e.g. 2254/1)
                    parts = card_no_input.split('/')
                    parent_card = parts[0]
                    suffix = '/' + parts[1]
                    
                    member = FamilyMember.objects.filter(employee__card_no=parent_card, card_no_suffix=suffix).first()
                    if not member:
                        errors.append(f"Dependent {card_no_input} not found in Master Registry.")
                        continue
                    
                    employee = member.employee
                    # Sync parent project link if needed (Metadata sync)
                    if employee.project != project:
                        employee.project = project
                        employee.save()
                        
                    # Create/Update Patient Profile for the SPECIFIC Family Member
                    Patient.objects.update_or_create(
                        card_no=card_no_input,
                        project=project,
                        defaults={
                            'first_name': member.name.split(' ')[0],
                            'last_name': " ".join(member.name.split(' ')[1:]) if " " in member.name else "",
                            'dob': member.dob,
                            'gender': member.gender,
                            'phone': member.mobile_no or employee.mobile_no,
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
                    # 2. Primary Employee Case (e.g. 2254)
                    employee = EmployeeMaster.objects.filter(card_no=card_no_input).first()
                    if not employee:
                        errors.append(f"Card {card_no_input} not found in Global Master List.")
                        continue
                    
                    # Link to this project (Metadata)
                    employee.project = project
                    employee.save()
                    
                    # Create/Update Patient Profile for Primary Employee ONLY
                    Patient.objects.update_or_create(
                        card_no=card_no_input,
                        project=project,
                        defaults={
                            'first_name': employee.name.split(' ')[0],
                            'last_name': " ".join(employee.name.split(' ')[1:]) if " " in employee.name else "",
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
                
            except Exception as e:
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

    def perform_update(self, serializer):
        data = serializer.save()
        log_action(self.request.user, 'Registry', 'Data Entry Updated', f"Record {data.ucode} modified in registry {data.registry_type.name}")

    def get_queryset(self):
        """
        Dynamically filters the Clinical Repository based on the active registry scope (Protocol).
        Ensures that data is strictly isolated between different clinical workstreams.
        """
        queryset = RegistryData.objects.all().select_related('registry_type').order_by('id')
        
        # Protocol Isolation: Filter by Registry ID or Slug
        registry_type = self.request.query_params.get('registry_type')
        if registry_type and registry_type != 'null' and registry_type != 'undefined':
            # Handle both primary key (numeric ID) and technical slug (textual ID)
            if str(registry_type).isdigit():
                queryset = queryset.filter(registry_type_id=int(registry_type))
            else:
                queryset = queryset.filter(registry_type__slug=registry_type)
        elif not self.request.query_params.get('all', False):
            # If no protocol is specified and 'all' is not set, we return an empty set
            # to prevent cross-registry data leakage (Personnel board security)
            queryset = queryset.none()

        # Project Isolation: Filter by associated project
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
        
        if str(registry_type_id).isdigit():
            active_type_id = int(registry_type_id)
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

        success_count = 0
        for data in records:
            try:
                # Resolve ucode/primary key
                ucode = data.get('ucode') or data.get('card_no') or data.get('item_code') or next(iter(data.values()))
                name = data.get('name') or data.get('item_name') or data.get('label') or ""
                
                # Case-insensitive mapping of CSV headers to schema slugs
                additional = {}
                slug_map = {s.lower(): s for s in field_slugs} 
                
                for key, val in data.items():
                    clean_key = str(key).strip().lower()
                    if clean_key in slug_map:
                        additional[slug_map[clean_key]] = val
                    elif key in field_slugs:
                        additional[key] = val
                
                qty_input = int(data.get('quantity') or data.get('qty') or 0)
                cost_input = float(data.get('cost') or data.get('price') or 0.0)

                obj, created = RegistryData.objects.get_or_create(
                    registry_type_id=active_type_id,
                    ucode=str(ucode).strip(),
                    defaults={
                        'name': str(name).strip(),
                        'category': data.get('category') or data.get('item_group', ''),
                        'description': str(data.get('description') or ''),
                        'quantity': qty_input,
                        'cost': cost_input,
                        'additional_fields': additional
                    }
                )

                if not created:
                    # Update fields
                    obj.name = str(name).strip() or obj.name
                    obj.category = data.get('category') or data.get('item_group', obj.category)
                    obj.cost = cost_input or obj.cost
                    obj.additional_fields.update(additional)
                    
                    if mode == 'INCREMENT' or mode == 'ADD':
                        obj.quantity += qty_input
                    else:
                        obj.quantity = qty_input
                    
                    obj.save()

                success_count += 1
            except Exception as e:
                print(f"Schema Mapping Error: {e}")
        
        log_action(request.user, 'Registry', 'Bulk Upload', f"Processed {success_count} records ({mode}) into registry type {registry_type_id}")
        return Response({"success": success_count})


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

    @action(detail=False, methods=['post'], url_path='bulk-upload')
    def bulk_upload(self, request):
        records = request.data.get('records', [])
        failed_records = []; success_count = 0; error_count = 0
        
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
                    if d_key.lower().strip().replace(' ', '_').replace('/', '_') == k.lower():
                        return data[d_key]
            return None

        # 1. Process Primary Employees
        for data in records:
            rel = str(get_val(data, 'relationship', 'rel') or '').strip().upper()
            if not rel or 'PRIMARY' in rel or 'HOLDER' in rel:
                try:
                    card_no = str(get_val(data, 'card_no', 'cardno', 'id') or '').strip()
                    if not card_no: raise Exception("Missing Card Number")
                    
                    name = get_val(data, 'name', 'employee_name')
                    gender_str = str(get_val(data, 'gender', 'sex', 'age_gender') or 'MALE').upper()
                    gender = 'FEMALE' if 'F' in gender_str else ('OTHER' if 'O' in gender_str else 'MALE')
                    
                    dob = get_val(data, 'dob', 'date_of_birth')
                    if not dob:
                        dob = calculate_dob(get_val(data, 'age', 'age_gender'))

                    EmployeeMaster.objects.update_or_create(
                        card_no=card_no,
                        defaults={
                            'project_id': data.get('project'),
                            'name': name,
                            'dob': dob,
                            'gender': gender,
                            'aadhar_no': get_val(data, 'aadhar_no', 'aadhar', 'aadhaar'),
                            'mobile_no': get_val(data, 'mobile_no', 'mobile', 'phone'),
                            'address': get_val(data, 'address', 'addr') or '',
                            'designation': get_val(data, 'designation', 'desig') or '',
                        }
                    )
                    success_count += 1
                except Exception as e:
                    error_count += 1
                    failed_records.append({**data, 'error': str(e)})

        # 2. Process Dependents
        for data in records:
            rel = str(get_val(data, 'relationship', 'rel') or '').strip().upper()
            if rel and 'PRIMARY' not in rel and 'HOLDER' not in rel:
                try:
                    full_card_no = str(get_val(data, 'card_no', 'cardno', 'id') or '').strip()
                    if not full_card_no: raise Exception("Missing Card Number")
                    
                    parent_card_no = full_card_no.split('/')[0] if '/' in full_card_no else full_card_no
                    suffix = '/' + full_card_no.split('/')[1] if '/' in full_card_no else '/1'
                    
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
                            'aadhar_no': get_val(data, 'aadhar_no', 'aadhar', 'aadhaar'),
                            'mobile_no': get_val(data, 'mobile_no', 'mobile', 'phone'),
                            'relationship': rel
                        }
                    )
                    success_count += 1
                except Exception as e:
                    error_count += 1
                    failed_records.append({**data, 'error': str(e)})
        
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

class RegistryReportView(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def list(self, request):
        user = request.user
        project_id = request.query_params.get('project')
        is_admin = user.role == 'ADMIN' or user.is_superuser or user.user_roles.filter(name='ADMIN').exists()

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

        inventory_items = RegistryData.objects.filter(registry_type=pharmacy_type) if pharmacy_type else RegistryData.objects.none()

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

        # Process AuditLogs
        for log in consumption_logs:
            try:
                # Group 1: Name, Group 2: Qty
                match = re.search(r'\[CONSUMPTION\]\s*(.*?)\s*\|\s*(\d+)', log.details, re.IGNORECASE)
                if match:
                    add_to_series(timezone.localtime(log.timestamp).date(), int(match.group(2)), match.group(1).strip())
            except: continue

        # Process Dispensed Records (Highest Priority)
        processed_prescription_ids = set()
        for dr in dispensed_records:
            add_to_series(timezone.localtime(dr.dispensed_at).date(), dr.quantity, dr.prescription.medication_name)
            processed_prescription_ids.add(dr.prescription_id)

        # Process Prescriptions (Secondary Priority - fallback if no explicit records)
        # We calculate actual clinical units based on MNC-standard frequency parsing
        def get_dose_qty(rec):
            try:
                # If it's a DispensingRecord with quantity > 1, use that as source of truth
                if hasattr(rec, 'quantity') and rec.quantity > 1:
                    return rec.quantity
                
                # Otherwise, derive from prescription metadata
                p = rec if isinstance(rec, Prescription) else rec.prescription
                freq = str(p.frequency or "").upper()
                dur = str(p.duration or "0")
                
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

        trends = sorted([{'date': k, 'units': v} for k, v in daily_series.items()], key=lambda x: x['date'])

        # 2. Conversion Analytics (Dynamic)
        total_v = visit_qs.count()
        completed_v = visit_qs.filter(status__in=['COMPLETED', 'PENDING_PHARMACY']).count()
        conversion_rate = round((completed_v / total_v * 100) if total_v > 0 else 0, 1)

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

        # 3. Inventory Health
        inventory_stats = inventory_items.aggregate(
            total_value=Sum(Case(When(quantity__gt=0, then='cost'), default=0, output_field=FloatField())),
            low_stock=Count('id', filter=Q(quantity__lt=10, quantity__gt=0)),
            out_of_stock=Count('id', filter=Q(quantity=0))
        )

        all_c = sorted([{'name': k, 'total': v} for k, v in consumption_map.items()], key=lambda x: x['total'], reverse=True)

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
            'project_name': active_project.name if active_project else "All Projects"
        })

from .reports import generate_patient_pdf_report
from django.http import HttpResponse

class PatientViewSet(viewsets.ModelViewSet):

    serializer_class = PatientSerializer
    search_fields = ['first_name', 'last_name', 'phone', 'id_proof_number', 'card_no']
    permission_classes = [permissions.IsAuthenticated]

    def get_permissions(self):
        from accounts.permissions import IsStaffUser
        # Actions accessible to Patients (Self-service)
        if self.action in ['my_full_report', 'download_report_self']:
            return [permissions.IsAuthenticated()]
        # Actions restricted to Staff/Admin
        return [permissions.IsAuthenticated(), IsStaffUser()]

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

    def get_queryset(self):
        queryset = self.get_base_queryset()
            
        # --- Workflow Tab Filtering ---
        view_mode = self.request.query_params.get('view', 'all').lower()
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
        
        pdf_buffer = generate_patient_pdf_report(patient.patient_id, visit_date)
        
        response = HttpResponse(pdf_buffer, content_type='application/pdf')
        filename = f"Clinical_Report_{patient.patient_id}_{visit_date or 'full'}.pdf"
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response

    @action(detail=False, methods=['get'], url_path='download_report')
    def download_report_self(self, request):
        user = request.user
        patient_id = user.username
        visit_date = request.query_params.get('date')
        
        pdf_buffer = generate_patient_pdf_report(patient_id, visit_date)
        
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
