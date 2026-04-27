from pymongo import MongoClient
from django.conf import settings
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

class DossierManager:
    def __init__(self):
        self.client = None
        self.db = None
        self.collection = None
        self.connect()

    def connect(self):
        try:
            self.client = MongoClient(settings.MONGO_URI, serverSelectionTimeoutMS=2000)
            # Trigger a connection check
            self.client.server_info() 
            self.db = self.client[settings.MONGO_DB_NAME]
            self.collection = self.db['patient_dossiers']
            logger.info("🍃 MongoDB Connected: Dossier Engine Active")
        except Exception as e:
            logger.error(f"❌ MongoDB Connection Failed: {e}")
            self.client = None

    def get_dossier(self, patient_id):
        """Fetches the materialized clinical dossier from MongoDB"""
        if not self.client: 
            self.connect()
            if not self.client: return None
            
        return self.collection.find_one({"patient_id": patient_id}, {"_id": 0})

    def sync_dossier(self, patient_id):
        """
        Gathers all clinical data from MySQL and materializes it into a MongoDB document.
        This provides O(1) retrieval for the Billion-Scale Patient Portal.
        """
        if not self.client: 
            self.connect()
            if not self.client: return False
        
        try:
            from .models import Patient
            from clinical.models import Visit
            from laboratory.models import LabRequest
            from pharmacy.models import Prescription
            
            from clinical.serializers import VisitSerializer, AppointmentSerializer
            from laboratory.serializers import LabRequestSerializer
            from pharmacy.serializers import PrescriptionSerializer
            
            patient = Patient.objects.get(patient_id=patient_id)
            
            # 🧊 COLD DATA GATHERING (SQL)
            visits = Visit.objects.filter(patient=patient).order_by('-visit_date')
            lab_requests = LabRequest.objects.filter(visit__patient=patient).order_by('-created_at')
            prescriptions = Prescription.objects.filter(visit__patient=patient).order_by('-created_at')
            from clinical.models import Appointment
            appointments = Appointment.objects.filter(patient=patient).order_by('-appointment_date')
            
            # 🏗️ DOSSIER CONSTRUCTION
            dossier_document = {
                "patient_id": patient_id,
                "full_name": f"{patient.first_name} {patient.last_name}",
                "updated_at": datetime.now().isoformat(),
                "registry_metadata": {
                    "gender": patient.gender,
                    "dob": str(patient.dob) if patient.dob else None,
                    "phone": patient.phone,
                    "blood_group": patient.blood_group,
                    "address": patient.address,
                    "allow_appointments": patient.project.allow_appointments if patient.project else True
                },
                "clinical_summary": {
                    "total_visits": visits.count(),
                    "total_lab_investigations": lab_requests.count(),
                    "total_active_prescriptions": prescriptions.count(),
                    "total_appointments": appointments.count()
                },
                # Materialized Arrays
                "visit_history": VisitSerializer(visits, many=True).data,
                "laboratory_history": LabRequestSerializer(lab_requests, many=True).data,
                "pharmacy_history": PrescriptionSerializer(prescriptions, many=True).data,
                "appointments": AppointmentSerializer(appointments, many=True).data,
                "system_status": "INDEXED_AND_HOT"
            }
            
            # 🚀 HIGH-SPEED PERSISTENCE (NoSQL)
            self.collection.update_one(
                {"patient_id": patient_id},
                {"$set": dossier_document},
                upsert=True
            )
            logger.info(f"✅ Dossier Materialized for {patient_id}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Dossier Materialization Failed for {patient_id}: {str(e)}")
            return False

# Singleton instance for high-performance reuse
dossier_manager = DossierManager()
