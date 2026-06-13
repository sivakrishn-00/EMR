from rest_framework import serializers
from clinical.models import Visit, Vitals, Consultation, Appointment
from patients.serializers import PatientSerializer

class VitalsSerializer(serializers.ModelSerializer):
    recorded_by_username = serializers.CharField(source='recorded_by.username', read_only=True)
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

    def validate(self, attrs):
        from django.utils import timezone
        
        # 1. Resolve Patient
        patient = attrs.get('patient')
        if not patient and self.instance:
            patient = self.instance.patient
            
        if not patient:
            raise serializers.ValidationError("Patient is required.")
            
        # 2. Get Project and Config
        project = patient.project
        if not project and patient.employee_master:
            project = patient.employee_master.project
            
        visit_date = attrs.get('visit_date', timezone.now() if not self.instance else self.instance.visit_date)
        
        # 3. Future-Date Check
        if visit_date > timezone.now() + timezone.timedelta(minutes=5): # Allow 5m clock skew
            raise serializers.ValidationError({"visit_date": "Visit date cannot be in the future."})
            
        # 4. Project-Level Late Entry Permission Check
        if project:
            if not project.allow_custom_visit_date:
                # If they tried to send a custom visit date that differs from now
                if 'visit_date' in attrs:
                    time_diff = abs((attrs['visit_date'] - timezone.now()).total_seconds())
                    if time_diff > 300: # 5 minutes
                        raise serializers.ValidationError({"visit_date": "Retroactive visit entry is not enabled for this project."})
            else:
                # Project allows custom visit date
                # Check if it's backdated by more than 1 hour
                time_diff = (timezone.now() - visit_date).total_seconds()
                if time_diff > 3600: # 1 hour in seconds
                    attrs['is_late_entry'] = True
                    if not attrs.get('late_entry_justification'):
                        raise serializers.ValidationError({
                            "late_entry_justification": "Late entry justification is required for backdated visits."
                        })
                else:
                    attrs['is_late_entry'] = False
                    
        # 5. Double Encounter prevention (same patient, within 30 minutes)
        start_block = visit_date - timezone.timedelta(minutes=15)
        end_block = visit_date + timezone.timedelta(minutes=15)
        duplicate_query = Visit.objects.filter(
            patient=patient,
            visit_date__range=(start_block, end_block),
            is_active=True
        )
        if self.instance:
            duplicate_query = duplicate_query.exclude(id=self.instance.id)
            
        if duplicate_query.exists():
            raise serializers.ValidationError("A visit for this patient already exists within this 30-minute window.")
            
        return attrs

    def create(self, validated_data):
        from django.utils import timezone
        visit = super().create(validated_data)
        
        # Chronology Paradox alignment
        patient = visit.patient
        if patient and visit.visit_date < patient.created_at:
            patient.created_at = visit.visit_date
            patient.save(update_fields=['created_at'])
            
        # Close scheduled appointments in this window
        appt_start = visit.visit_date - timezone.timedelta(hours=12)
        appt_end = visit.visit_date + timezone.timedelta(hours=12)
        Appointment.objects.filter(
            patient=patient,
            appointment_date__range=(appt_start, appt_end),
            status__in=['SCHEDULED', 'CONFIRMED']
        ).update(status='CHECKED_IN')
        
        return visit

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
    end_time_only = serializers.SerializerMethodField()

    class Meta:
        model = Appointment
        fields = '__all__'
        extra_kwargs = {
            'patient': {'required': False}
        }

    def get_patient_name(self, obj):
        return f"{obj.patient.first_name} {obj.patient.last_name}"

    def get_end_time_only(self, obj):
        if obj.end_time:
            return obj.end_time.strftime("%H:%M")
        return ""

    def get_formatted_time(self, obj):
        if not obj.appointment_date:
            return ""
        
        from django.utils import timezone
        start_dt = obj.appointment_date
        start_str = start_dt.strftime("%H:%M")
        
        # Consistent professional range: Default to 30 mins if not explicitly set
        end_dt = obj.end_time or (start_dt + timezone.timedelta(minutes=30))
        end_str = end_dt.strftime("%H:%M")
        
        return f"{start_str} - {end_str}"

