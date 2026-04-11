from celery import shared_task
from django.utils import timezone
from django.utils.timezone import make_aware, is_naive
from .models import LabMachine, LabMachineData, LabSyncAudit
from django.core.mail import send_mail
from django.conf import settings
import json
import re

@shared_task
def check_machine_downtime():
    """
    Periodic Monitoring Task: Checks all active lab machines.
    If a machine hasn't sent data for longer than its specific threshold, triggers an alert.
    """
    # We fetch all active machines and check individually
    active_machines = LabMachine.objects.filter(is_active=True, last_synced_at__isnull=False)

    for machine in active_machines:
        threshold_dt = timezone.now() - timezone.timedelta(minutes=machine.downtime_threshold)
        
        if machine.last_synced_at < threshold_dt:
            # Avoid duplicate alerts (e.g., only alert once every hour of downtime)
            t_data = machine.telemetry_data or {}
            last_alert = t_data.get('last_downtime_alert')
            
            # Simple cooldown: 1 alert per hour per machine
            if last_alert:
                try:
                    last_alert_dt = timezone.datetime.fromisoformat(last_alert)
                    if timezone.now() < last_alert_dt + timezone.timedelta(hours=1):
                        continue
                except: pass

            if machine.alert_emails:
                recipients = [e.strip() for e in machine.alert_emails.split(',') if '@' in e]
                if recipients:
                    try:
                        send_mail(
                            subject=f"CRITICAL: Lab Station Offline - {machine.machine_name}",
                            message=f"System Alert: Laboratory machine '{machine.machine_name}' (ID: {machine.machine_id}) at {machine.location} has stopped reporting telemetry data.\n\nThreshold: {machine.downtime_threshold} minutes\nLast Sync Detected: {machine.last_synced_at}\n\nPlease check the local sync agent connectivity.",
                            from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', 'emr-alerts@hospital.com'),
                            recipient_list=recipients,
                            fail_silently=True
                        )
                        # Update telemetry to record alert sent
                        t_data['last_downtime_alert'] = timezone.now().isoformat()
                        t_data['service_status'] = 'Critical'
                        machine.telemetry_data = t_data
                        machine.save(update_fields=['telemetry_data'])
                    except: pass

@shared_task
def process_sync_batch(results_batch, forced_project_id=None, machine_pk=None):
    """
    Background Task: Processes 1000+ pulses without blocking the EMR UI.
    Performs HL7 extraction, identity matching, and bulk database persistence.
    """
    if not results_batch:
        return
        
    # Pre-resolve machine if PK is provided
    pre_machine = None
    if machine_pk:
        try:
            pre_machine = LabMachine.objects.get(pk=machine_pk)
            pre_machine.last_synced_at = timezone.now()
            pre_machine.save(update_fields=['last_synced_at'])
        except: pass
        
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
                if forced_project_id:
                    # SECURE AUTO-PROVISIONING: Gateway Authorized via Project Master Key
                    machine = LabMachine.objects.create(
                        composite_identity=composite_id,
                        machine_id=m_id,
                        machine_name=m_name,
                        lab_id=l_id,
                        location=loc,
                        project_id=forced_project_id,
                        is_active=True,
                        last_synced_at=timezone.now()
                    )
                    project_cache[composite_id] = forced_project_id
                    machine_cache[composite_id] = machine
                else:
                    # Drop only if unauthorized directly / orphaned
                    project_cache[composite_id] = None
                    machine_cache[composite_id] = None
                    print(f"SECURITY ALERT: Dropping data for un-registered machine: {composite_id}")
            except Exception as e:
                project_cache[composite_id] = None
                print(f"ERROR: Cache resolution failed: {e}")

        if not machine_cache.get(composite_id):
            # Skip records from unregistered machines
            continue

        m_obj = machine_cache[composite_id]
        if composite_id not in batch_stats:
            batch_stats[composite_id] = {
                "machine": m_obj, 
                "count": 0,
                "success": 0,
                "failed": 0,
                "errors": []
            }
        batch_stats[composite_id]["count"] += 1
            
        # Increment Telemetry (Result Count)
        t_data = m_obj.telemetry_data or {}
        t_data['total_records'] = t_data.get('total_records', 0) + 1
        m_obj.telemetry_data = t_data
        # We will save these later in bulk or individually
        # To avoid excessive DB hits, we can save at the end of the loop per machine

        try:
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
            if composite_id in batch_stats:
                batch_stats[composite_id]["success"] += 1
        except Exception as e:
            if composite_id in batch_stats:
                batch_stats[composite_id]["failed"] += 1
                batch_stats[composite_id]["errors"].append(f"Patient {record_patient_id}: {str(e)}")

    # Update machine telemetry (counts and timestamps)
    for stat in batch_stats.values():
        m = stat["machine"]
        m.save(update_fields=['telemetry_data', 'last_synced_at'])

    # Bulk Persistence
    LabMachineData.objects.bulk_create(objects_to_create, ignore_conflicts=True)
    
    # Audit trail creation
    try:
        audit_records = [
            LabSyncAudit(
                machine=stat["machine"],
                batch_size=stat["count"],
                success_count=stat["success"],
                failed_count=stat["failed"],
                status_msg="\n".join(stat["errors"][:10]), # Log first 10 errors
                is_success=(stat["failed"] == 0)
            ) for stat in batch_stats.values()
        ]
        LabSyncAudit.objects.bulk_create(audit_records)
    except: pass

    return f"Processed batch of {len(results_batch)} records."
