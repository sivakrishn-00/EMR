from rest_framework import serializers
from .models import Prescription, DispensingRecord, Indent, IndentItem, RoomStock, RoomStockTransfer, RoomStockDispensation

class DispensingRecordSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source='prescription.visit.patient.__str__', read_only=True, default='Unknown')
    card_no = serializers.CharField(source='prescription.visit.patient.card_no', read_only=True, default='N/A')
    prescribed_by = serializers.CharField(source='prescription.ordered_by.username', read_only=True, default='System')
    dispensed_by_username = serializers.CharField(source='dispensed_by.username', read_only=True, default='System')

    class Meta:
        model = DispensingRecord
        fields = '__all__'
        read_only_fields = ('prescription', 'dispensed_by')

class PrescriptionSerializer(serializers.ModelSerializer):
    dispensing_history = DispensingRecordSerializer(many=True, read_only=True)
    patient_name = serializers.CharField(source='visit.patient.__str__', read_only=True)
    card_no = serializers.CharField(source='visit.patient.card_no', read_only=True, default='N/A')
    employee_id = serializers.SerializerMethodField()
    uhid = serializers.SerializerMethodField()
    visit_id = serializers.IntegerField(source='visit.id', read_only=True)
    visit_is_late_entry = serializers.BooleanField(source='visit.is_late_entry', read_only=True, default=False)
    visit_late_entry_justification = serializers.CharField(source='visit.late_entry_justification', read_only=True, default='')
    project_id = serializers.SerializerMethodField()
    item_group = serializers.SerializerMethodField()
    ordered_by_name = serializers.CharField(source='ordered_by.username', read_only=True)

    class Meta:
        model = Prescription
        fields = '__all__'

    def get_employee_id(self, obj):
        patient = obj.visit.patient
        if patient and patient.employee_master:
            return patient.employee_master.additional_fields.get('employee_id', '')
        return ''

    def get_item_group(self, obj):
        from patients.models import RegistryData
        
        # Resolve Project
        patient = obj.visit.patient
        project = patient.project or (patient.employee_master.project if patient.is_employee_linked and patient.employee_master else None)
        
        # 1. Try matching by unique item_code first
        if obj.item_code:
            queryset_code = RegistryData.objects.filter(ucode=obj.item_code)
            if project:
                queryset_code = queryset_code.filter(registry_type__project=project)
            drug = queryset_code.first()
            if not drug:
                drug = RegistryData.objects.filter(ucode=obj.item_code).first()
            if drug:
                return drug.category or "GENERAL"

        clean_name = obj.medication_name.strip().split('(')[0].strip()
        
        # Try exact case-insensitive match scoped by project
        queryset = RegistryData.objects.filter(name__iexact=clean_name)
        if project:
            queryset = queryset.filter(registry_type__project=project)
        drug = queryset.first()
        
        # Try exact case-insensitive match globally
        if not drug:
            drug = RegistryData.objects.filter(name__iexact=clean_name).first()
            
        # Try partial match scoped by project
        if not drug:
            queryset_contains = RegistryData.objects.filter(name__icontains=clean_name)
            if project:
                queryset_contains = queryset_contains.filter(registry_type__project=project)
            drug = queryset_contains.first()
            
        # Try partial match globally
        if not drug:
            drug = RegistryData.objects.filter(name__icontains=clean_name).first()

        if drug:
            return drug.category or "GENERAL"
        return "GENERAL"

    def get_project_id(self, obj):
        p = obj.visit.patient.project
        if not p and obj.visit.patient.employee_master:
            p = obj.visit.patient.employee_master.project
        return p.id if p else None

    def get_uhid(self, obj):
        return 1000 + obj.visit.patient.id


class IndentItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = IndentItem
        fields = '__all__'


class IndentSerializer(serializers.ModelSerializer):
    items = IndentItemSerializer(many=True, read_only=True)
    raised_by_username = serializers.CharField(source='raised_by.username', read_only=True)
    doctor_username = serializers.CharField(source='doctor.username', read_only=True, default='')

    class Meta:
        model = Indent
        fields = '__all__'


class RoomStockSerializer(serializers.ModelSerializer):
    registry_item_name = serializers.CharField(source='registry_item.name', read_only=True)
    registry_item_code = serializers.CharField(source='registry_item.ucode', read_only=True)
    category = serializers.CharField(source='registry_item.category', read_only=True)

    class Meta:
        model = RoomStock
        fields = '__all__'


class RoomStockDispensationSerializer(serializers.ModelSerializer):
    dispensed_by_username = serializers.CharField(source='dispensed_by.username', read_only=True)
    medication_name = serializers.CharField(source='room_stock.registry_item.name', read_only=True)
    patient_name = serializers.CharField(source='patient.__str__', read_only=True, default='')
    card_no = serializers.CharField(source='patient.card_no', read_only=True, default='')
    location = serializers.CharField(source='room_stock.location', read_only=True)

    class Meta:
        model = RoomStockDispensation
        fields = '__all__'
