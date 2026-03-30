from rest_framework import serializers
from .models import LabRequest, LabResult

class LabResultSerializer(serializers.ModelSerializer):
    class Meta:
        model = LabResult
        fields = '__all__'

class LabRequestSerializer(serializers.ModelSerializer):
    result = LabResultSerializer(read_only=True)
    patient_name = serializers.CharField(source='visit.patient.__str__', read_only=True)
    ordered_by_name = serializers.CharField(source='ordered_by.get_full_name', read_only=True)

    class Meta:
        model = LabRequest
        fields = '__all__'
