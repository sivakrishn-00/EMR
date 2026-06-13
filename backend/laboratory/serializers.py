from rest_framework import serializers
from .models import LabRequest, LabResult, LabResultAttachment, LabTestMaster, LabSubTest, LabDepartment, LabTestType, LabMachineData, LabMachine, LabProjectBridge

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

class LabResultAttachmentSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = LabResultAttachment
        fields = ['id', 'file', 'file_url', 'uploaded_at']

    def get_file_url(self, obj):
        request = self.context.get('request')
        if obj.file:
            if request:
                return request.build_absolute_uri(obj.file.url)
            return obj.file.url
        return None

class LabResultSerializer(serializers.ModelSerializer):
    attachment_url = serializers.SerializerMethodField()
    attachments = LabResultAttachmentSerializer(many=True, read_only=True)

    class Meta:
        model = LabResult
        fields = '__all__'
        read_only_fields = ['lab_request', 'recorded_by', 'recorded_at']

    def get_attachment_url(self, obj):
        request = self.context.get('request')
        if obj.attachment:
            if request:
                return request.build_absolute_uri(obj.attachment.url)
            return obj.attachment.url
        return None

class LabRequestSerializer(serializers.ModelSerializer):
    result = LabResultSerializer(read_only=True)
    test_master_details = LabTestMasterSerializer(source='test_master', read_only=True)
    patient_name = serializers.CharField(source='visit.patient.__str__', read_only=True)
    patient_id = serializers.CharField(source='visit.patient.patient_id', read_only=True)
    patient_dhid = serializers.CharField(source='visit.patient.ucode', read_only=True)
    card_no = serializers.CharField(source='visit.patient.card_no', read_only=True)
    employee_id = serializers.SerializerMethodField()
    ordered_by_name = serializers.CharField(source='ordered_by.username', read_only=True)

    class Meta:
        model = LabRequest
        fields = '__all__'

    def get_employee_id(self, obj):
        patient = obj.visit.patient
        if patient and patient.employee_master:
            return patient.employee_master.additional_fields.get('employee_id', '')
        return ''


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

