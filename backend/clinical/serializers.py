from rest_framework import serializers
from clinical.models import Visit, Vitals, Consultation, Appointment
from patients.serializers import PatientSerializer

class VitalsSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vitals
        fields = '__all__'
        read_only_fields = ('visit', 'recorded_by', 'bmi')

class ConsultationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Consultation
        fields = '__all__'
        read_only_fields = ('visit', 'doctor')

class VisitSerializer(serializers.ModelSerializer):
    patient_details = PatientSerializer(source='patient', read_only=True)
    vitals = serializers.SerializerMethodField()
    consultation = serializers.SerializerMethodField()
    lab_requests = serializers.SerializerMethodField()
    prescriptions = serializers.SerializerMethodField()

    class Meta:
        model = Visit
        fields = '__all__'

    def get_vitals(self, obj):
        try:
            if hasattr(obj, 'vitals'):
                return VitalsSerializer(instance=obj.vitals).data
            return None
        except Exception:
            return None

    def get_consultation(self, obj):
        try:
            if hasattr(obj, 'consultation'):
                return ConsultationSerializer(instance=obj.consultation).data
            return None
        except Exception:
            return None

    def get_lab_requests(self, obj):
        from laboratory.serializers import LabRequestSerializer
        return LabRequestSerializer(obj.lab_requests.all(), many=True).data

    def get_prescriptions(self, obj):
        from pharmacy.serializers import PrescriptionSerializer
        return PrescriptionSerializer(obj.prescriptions.all(), many=True).data

class AppointmentSerializer(serializers.ModelSerializer):
    patient_name = serializers.SerializerMethodField()
    doctor_name = serializers.ReadOnlyField(source='doctor.username')
    formatted_time = serializers.SerializerMethodField()

    class Meta:
        model = Appointment
        fields = '__all__'

    def get_patient_name(self, obj):
        return f"{obj.patient.first_name} {obj.patient.last_name}"

    def get_formatted_time(self, obj):
        # Return only the local time part HH:MM
        if obj.appointment_date:
            return obj.appointment_date.strftime("%H:%M")
        return ""

