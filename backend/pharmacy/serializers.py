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

    class Meta:
        model = Prescription
        fields = '__all__'

    def get_uhid(self, obj):
        return 1000 + obj.visit.patient.id
