from celery import shared_task
from django.utils import timezone
from django.utils.timezone import make_aware, is_naive
from .models import LabMachine, LabMachineData, LabSyncAudit
import json
import re

@shared_task
def process_sync_batch(results_batch):
    """
    Background Task: Processes 1000+ pulses without blocking the EMR UI.
    Performs HL7 extraction, identity matching, and bulk database persistence.
    """
    if not results_batch:
        return
        
    def find_hl7_val(raw_text, key):
        if not raw_text: return None
        pattern = rf"\|{re.escape(key)}\|+(?P<val>[\d\.]+)"
        match = re.search(pattern, raw_text, re.IGNORECASE)
        if match:
            try: return float(match.group('val'))
            except: return None
        return None

    project_cache = {}
    machine_cache = {} 
    objects_to_create = []
    batch_stats = {} 

    for item in results_batch:
        raw = item.get('raw_data', "")
        m_id = str(item.get('machine_id') or "").strip()
        m_name = str(item.get('machine_name', 'Unknown Machine')).strip()
        l_id = str(item.get('lab_id', 'Unknown Lab')).strip()
        loc = str(item.get('location', 'Global')).strip()
        composite_id = f"{m_id}|{m_name}|{l_id}|{loc}"

        def get_val(key, hl7_alias=None):
            val = item.get(key)
            if val is None or val == "" or str(val).lower() == 'null':
                if hl7_alias: return find_hl7_val(raw, hl7_alias)
            try: return float(val) if val is not None else None
            except: return None

        wbc_val = get_val('wbc', 'WBC')
        rbc_val = get_val('rbc', 'RBC')
        hgb_val = get_val('hgb', 'HGB')
        
        if not wbc_val and not rbc_val and not hgb_val:
            continue
            
        record_patient_id = str(item.get('patient_name') or item.get('patient_id') or "").strip()
        if not record_patient_id:
            continue

        if composite_id not in project_cache:
            try:
                machine = LabMachine.objects.get(composite_identity=composite_id)
                machine.last_synced_at = timezone.now()
                machine.save(update_fields=['last_synced_at'])
                project_cache[composite_id] = machine.project_id
                machine_cache[composite_id] = machine
            except LabMachine.DoesNotExist:
                try:
                    machine = LabMachine.objects.create(
                        project=None,
                        machine_id=m_id, machine_name=m_name,
                        lab_id=l_id, location=loc,
                        composite_identity=composite_id,
                        last_synced_at=timezone.now()
                    )
                    project_cache[composite_id] = None
                    machine_cache[composite_id] = machine
                except: project_cache[composite_id] = None 
            except: project_cache[composite_id] = None

        if composite_id in machine_cache:
            if composite_id not in batch_stats:
                batch_stats[composite_id] = {"machine": machine_cache[composite_id], "count": 0}
            batch_stats[composite_id]["count"] += 1

        obj = LabMachineData(
            project_id=project_cache[composite_id],
            machine_id=m_id, machine_name=m_name, lab_id=l_id, location=loc,
            sample_id=item.get('sample_id'),
            patient_id=record_patient_id, 
            patient_name=item.get('patient_name'),
            wbc=wbc_val, rbc=rbc_val, hgb=hgb_val,
            hct=get_val('hct', 'HCT'), plt=get_val('plt', 'PLT'),
            lym_pct=get_val('lym_pct', 'LYM%'), lym_abs=get_val('lym_abs', 'LYM#'),
            mid_pct=get_val('mid_pct', 'MID%'), mid_abs=get_val('mid_abs', 'MID#'),
            gran_pct=get_val('gran_pct', 'GRAN%'), gran_abs=get_val('gran_abs', 'GRAN#'),
            mcv=get_val('mcv', 'MCV'), mch=get_val('mch', 'MCH'), mchc=get_val('mchc', 'MCHC'),
            rdw_cv=get_val('rdw_cv', 'RDW-CV'), rdw_sd=get_val('rdw_sd', 'RDW-SD'),
            mpv=get_val('mpv', 'MPV'), pct=get_val('pct', 'PCT'), 
            p_lcr=get_val('p_lcr', 'P-LCR'), p_lcc=get_val('p_lcc', 'P-LCC'),
            pdw_sd=get_val('pdw_sd', 'PDW-SD'), pdw_cv=get_val('pdw_cv', 'PDW-CV'),
            raw_data=raw,
            received_at_machine=item.get('received_at') or timezone.now(),
        )
        objects_to_create.append(obj)
    
    # Bulk Persistence
    LabMachineData.objects.bulk_create(objects_to_create, ignore_conflicts=True)
    
    # Audit trail creation
    try:
        audit_records = [
            LabSyncAudit(
                machine=stat["machine"],
                batch_size=stat["count"],
                success_count=stat["count"],
                is_success=True
            ) for stat in batch_stats.values()
        ]
        LabSyncAudit.objects.bulk_create(audit_records)
    except: pass

    return f"Processed batch of {len(results_batch)} records."
