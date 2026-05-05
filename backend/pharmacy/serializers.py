from rest_framework import serializers
from .models import Prescription, DispensingRecord

class DispensingRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = DispensingRecord
        fields = '__all__'
        read_only_fields = ('prescription', 'dispensed_by')

class PrescriptionSerializer(serializers.ModelSerializer):
    dispensing_history = DispensingRecordSerializer(many=True, read_only=True)
    patient_name = serializers.CharField(source='visit.patient.__str__', read_only=True)
    uhid = serializers.SerializerMethodField()
    visit_id = serializers.IntegerField(source='visit.id', read_only=True)
    project_id = serializers.SerializerMethodField()
    item_group = serializers.SerializerMethodField()

    class Meta:
        model = Prescription
        fields = '__all__'

    def get_item_group(self, obj):
        # MNC Standard: Dynamic lookup to ensure category-aware dispensing even for legacy records
        from patients.models import RegistryData
        clean_name = obj.medication_name.strip().split('(')[0].strip() # Handle 'Drug (Strength)' cases
        drug = RegistryData.objects.filter(name__icontains=clean_name).first()
        if drug:
            return drug.category or drug.item_group or "GENERAL"
        return "GENERAL"

    def get_project_id(self, obj):
        p = obj.visit.patient.project
        if not p and obj.visit.patient.employee_master:
            p = obj.visit.patient.employee_master.project
        return p.id if p else None

    def get_uhid(self, obj):
        return 1000 + obj.visit.patient.id
