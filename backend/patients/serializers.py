from rest_framework import serializers
from .models import Patient, EmployeeMaster, FamilyMember, Project, ProjectCategoryMapping, ProjectFieldConfig, RegistryType, RegistryData, RegistryField, ProjectLogo

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
    
    class Meta:
        model = RegistryData
        fields = '__all__'

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

    class Meta:
        model = Patient
        fields = '__all__'

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
            appt = Appointment.objects.filter(patient=obj, appointment_date__gte=timezone.now(), status='SCHEDULED').order_by('appointment_date').first()
            if appt:
                return {
                    'time': appt.appointment_date.strftime("%H:%M"),
                    'date': appt.appointment_date.strftime("%Y-%m-%d"),
                    'reason': appt.reason
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
