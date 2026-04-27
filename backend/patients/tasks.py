from celery import shared_task
from .dossier_manager import dossier_manager
import logging

logger = logging.getLogger(__name__)

@shared_task(queue='bulk')
def sync_patient_dossier_task(patient_id):
    """
    Background worker task to materialize the clinical dossier in MongoDB.
    This ensures zero-lag for the primary clinical workflow.
    """
    logger.info(f"🔄 BACKGROUND_SYNC: Materializing dossier for {patient_id}")
    success = dossier_manager.sync_dossier(patient_id)
    if success:
        logger.info(f"✅ BACKGROUND_SYNC: Dossier Hot-Loaded for {patient_id}")
    else:
        logger.error(f"❌ BACKGROUND_SYNC: Materialization failed for {patient_id}")
    return success
