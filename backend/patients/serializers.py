from rest_framework import serializers
from .models import Patient, EmployeeMaster, FamilyMember, Project, ProjectCategoryMapping, ProjectFieldConfig, RegistryType, RegistryData, RegistryField, ProjectLogo, RegistryUploadSession

class ProjectFieldConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProjectFieldConfig
        fields = '__all__'

class ProjectCategoryMappingSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProjectCategoryMapping
        fields = '__all__'

class ProjectSerializer(serializers.ModelSerializer):
    category_mappings = ProjectCategoryMappingSerializer(many=True, read_only=True)
    custom_fields = ProjectFieldConfigSerializer(many=True, read_only=True)
    registry_types = serializers.SerializerMethodField()
    
    class Meta:
        model = Project
        fields = '__all__'
    
    def get_registry_types(self, obj):
        return RegistryTypeSerializer(obj.registry_types.all(), many=True).data

class RegistryFieldSerializer(serializers.ModelSerializer):
    class Meta:
        model = RegistryField
        fields = '__all__'

class RegistryDataSerializer(serializers.ModelSerializer):
    family_members = serializers.SerializerMethodField()
    registry_type_project = serializers.IntegerField(source='registry_type.project.id', read_only=True)
    registry_type_project_name = serializers.CharField(source='registry_type.project.name', read_only=True)
    batch_info = serializers.SerializerMethodField()
    total_uploaded = serializers.SerializerMethodField()
    
    class Meta:
        model = RegistryData
        fields = '__all__'

    def to_representation(self, instance):
        data = super().to_representation(instance)
        # Expose common keys at root level for seamless frontend consumption
        if instance.additional_fields and isinstance(instance.additional_fields, dict):
            for key in ['item_group', 'item_code', 'item_name', 'qty', 'cost']:
                if key in instance.additional_fields and data.get(key) is None:
                    data[key] = instance.additional_fields[key]
            # Ensure category is populated in representation even if database column was null
            if not data.get('category'):
                for cat_key in ['item_group', 'category', 'group']:
                    if cat_key in instance.additional_fields:
                        data['category'] = instance.additional_fields[cat_key]
                        break
        # Also ensure item_group is set from category if category exists but item_group doesn't
        if not data.get('item_group') and data.get('category'):
            data['item_group'] = data['category']
        return data

    def get_total_uploaded(self, obj):
        try:
            batches = obj.batches.all()
            if batches.exists():
                sum_initial = sum(b.initial_qty for b in batches)
                return max(sum_initial, obj.quantity)
        except Exception:
            pass
            
        if obj.additional_fields and isinstance(obj.additional_fields, dict):
            for key in ['total_uploaded', 'initial_quantity', 'initial_qty']:
                if key in obj.additional_fields:
                    try:
                        return int(float(obj.additional_fields[key]))
                    except (ValueError, TypeError):
                        pass
        
        return obj.quantity

    def get_batch_info(self, obj):
        try:
            rt = obj.registry_type
            is_pharmacy = (
                rt.type_category in ['CLINICAL_DRUGS', 'PHARMACY'] or
                'pharmacy' in rt.slug.lower() or
                'pharmacy' in rt.name.lower() or
                'drug' in rt.slug.lower() or
                'drug' in rt.name.lower()
            )
            if is_pharmacy:
                batches = obj.batches.all()
                if batches.exists():
                    costs = [float(b.unit_cost) for b in batches]
                    min_cost = min(costs)
                    max_cost = max(costs)
                    total_qty = sum(b.quantity for b in batches)
                    return {
                        'has_batches': True,
                        'min_cost': min_cost,
                        'max_cost': max_cost,
                        'total_qty': total_qty,
                        'batch_count': batches.count(),
                        'costs_match': min_cost == max_cost
                    }
        except Exception:
            pass
        return {'has_batches': False}

    def get_family_members(self, obj):
        # Dynamically resolve family members based on type category instead of hardcoded slugs
        if obj.registry_type.type_category == 'PERSONNEL_PRIMARY':
            from .models import RegistryData
            # Find records in any registry categorized as 'PERSONNEL_DEPENDENT' pointing to this employee
            families = RegistryData.objects.filter(
                registry_type__project=obj.registry_type.project,
                registry_type__type_category='PERSONNEL_DEPENDENT',
                additional_fields__parent_card_no=obj.ucode
            )
            return [{
                'id': f.id,
                'ucode': f.ucode,
                'name': f.name,
                'category': f.category,
                'additional_fields': f.additional_fields
            } for f in families]
        return []

class RegistryTypeSerializer(serializers.ModelSerializer):
    items_count = serializers.IntegerField(source='items.count', read_only=True)
    fields = RegistryFieldSerializer(many=True, read_only=True)
    class Meta:
        model = RegistryType
        fields = '__all__'

class FamilyMemberSerializer(serializers.ModelSerializer):
    class Meta:
        model = FamilyMember
        fields = '__all__'

class EmployeeMasterSerializer(serializers.ModelSerializer):
    family_members = FamilyMemberSerializer(many=True, read_only=True)
    project_name = serializers.CharField(source='project.name', read_only=True)
    
    class Meta:
        model = EmployeeMaster
        fields = '__all__'

class PatientSerializer(serializers.ModelSerializer):
    current_visit = serializers.SerializerMethodField()
    last_visit_details = serializers.SerializerMethodField()
    upcoming_appointment = serializers.SerializerMethodField()
    total_visits = serializers.SerializerMethodField()
    employee_details = serializers.SerializerMethodField()
    family_details = serializers.SerializerMethodField()
    project_name = serializers.CharField(source='project.name', read_only=True)
    portal_status = serializers.SerializerMethodField()
    registered_by_username = serializers.CharField(source='registered_by.username', read_only=True)
    is_active = serializers.SerializerMethodField()

    class Meta:
        model = Patient
        fields = '__all__'

    def get_is_active(self, obj):
        if obj.is_employee_linked:
            if obj.employee_master:
                return obj.employee_master.is_active
            if obj.family_member and obj.family_member.employee:
                return obj.family_member.employee.is_active
        return True

    def get_portal_status(self, obj):
        from accounts.models import User
        try:
            user = User.objects.get(username=obj.patient_id)
            if user.is_active: return 'ENABLED'
            return 'PENDING'
        except User.DoesNotExist:
            return 'DISABLED'

    def get_employee_details(self, obj):
        if obj.employee_master:
            return EmployeeMasterSerializer(obj.employee_master).data
        return None

    def get_family_details(self, obj):
        if obj.family_member:
            return FamilyMemberSerializer(obj.family_member).data
        return None

    def get_current_visit(self, obj):
        from clinical.models import Visit
        try:
            visit = Visit.objects.filter(patient=obj, is_active=True).order_by('-visit_date').first()
            if visit:
                return {
                    'id': visit.id,
                    'status': visit.status,
                    'visit_date': visit.visit_date
                }
        except: return None
        return None

    def get_last_visit_details(self, obj):
        from clinical.models import Visit
        try:
            last_visit = Visit.objects.filter(patient=obj, is_active=False).order_by('-visit_date').first()
            if last_visit:
                return {
                    'id': last_visit.id,
                    'last_date': last_visit.visit_date.strftime("%Y-%m-%d"),
                    'reason': last_visit.reason
                }
        except: return None
        return None

    def get_upcoming_appointment(self, obj):
        from clinical.models import Appointment
        from django.utils import timezone
        try:
            # Include both Scheduled and Confirmed for the upcoming tracking
            appt = Appointment.objects.filter(
                patient=obj, 
                appointment_date__gte=timezone.now() - timezone.timedelta(hours=2) # Grace period
            ).filter(status__in=['SCHEDULED', 'CONFIRMED', 'PATIENT_ACKNOWLEDGED']).order_by('appointment_date').first()
            
            if appt:
                # Reuse the same range logic as clinical serializer
                start_dt = appt.appointment_date
                start_str = start_dt.strftime("%H:%M")
                
                # If end_time is missing, default to 30 mins range for UI consistency
                end_dt = appt.end_time or (start_dt + timezone.timedelta(minutes=30))
                end_str = end_dt.strftime("%H:%M")
                
                formatted_range = f"{start_str} - {end_str}"
                
                return {
                    'id': appt.id,
                    'time': start_str,
                    'formatted_time': formatted_range,
                    'end_time_only': end_str,
                    'date': appt.appointment_date.strftime("%Y-%m-%d"),
                    'reason': appt.reason,
                    'status': appt.status
                }
        except: return None
        return None

    def get_total_visits(self, obj):
        from clinical.models import Visit
        try:
            return Visit.objects.filter(patient=obj).count()
        except: return 0

class ProjectLogoSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProjectLogo
        fields = '__all__'

class RegistryUploadSessionSerializer(serializers.ModelSerializer):
    username = serializers.SerializerMethodField()
    registry_type_name = serializers.SerializerMethodField()
    
    class Meta:
        model = RegistryUploadSession
        fields = '__all__'

    def get_username(self, obj):
        return obj.user.username if obj.user else "System/Admin"

    def get_registry_type_name(self, obj):
        return obj.registry_type.name if obj.registry_type else "General Registry"
