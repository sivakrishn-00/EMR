from rest_framework import serializers
from .models import LabRequest, LabResult, LabTestMaster, LabSubTest, LabDepartment, LabTestType, LabMachineData, LabMachine, LabProjectBridge

class LabTestTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = LabTestType
        fields = '__all__'

class LabDepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = LabDepartment
        fields = '__all__'

class LabSubTestSerializer(serializers.ModelSerializer):
    class Meta:
        model = LabSubTest
        fields = '__all__'

class LabTestMasterSerializer(serializers.ModelSerializer):
    sub_tests = LabSubTestSerializer(many=True, read_only=True)
    department_details = LabDepartmentSerializer(source='department', read_only=True)
    test_type_details = LabTestTypeSerializer(source='test_type', read_only=True)
    
    class Meta:
        model = LabTestMaster
        fields = '__all__'

class LabResultSerializer(serializers.ModelSerializer):
    class Meta:
        model = LabResult
        fields = '__all__'

class LabRequestSerializer(serializers.ModelSerializer):
    result = LabResultSerializer(read_only=True)
    test_master_details = LabTestMasterSerializer(source='test_master', read_only=True)
    patient_name = serializers.CharField(source='visit.patient.__str__', read_only=True)
    patient_id = serializers.CharField(source='visit.patient.patient_id', read_only=True)
    patient_dhid = serializers.CharField(source='visit.patient.ucode', read_only=True)
    ordered_by_name = serializers.CharField(source='ordered_by.username', read_only=True)

    class Meta:
        model = LabRequest
        fields = '__all__'


class LabMachineDataSerializer(serializers.ModelSerializer):
    class Meta:
        model = LabMachineData
        fields = '__all__'

class LabMachineSerializer(serializers.ModelSerializer):
    project_name = serializers.CharField(source='project.name', read_only=True)
    class Meta:
        model = LabMachine
        fields = '__all__'

class LabProjectBridgeSerializer(serializers.ModelSerializer):
    project_name = serializers.CharField(source='project.name', read_only=True)
    class Meta:
        model = LabProjectBridge
        fields = '__all__'

