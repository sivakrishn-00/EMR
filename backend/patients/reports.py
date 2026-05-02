from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.lib.units import inch
from io import BytesIO
from .dossier_manager import dossier_manager
from .models import Patient
# Import Centralized Theme
from .report_theme import (
    NAVY, HEADER_BLUE, BORDER_MAIN, get_report_styles, 
    create_main_bar, create_sub_header, get_standard_table_style, draw_elite_border
)

def to_str(val, default='N/A'):
    if val is None or val == "": return default
    return str(val)

def PageBorder(canvas, doc):
    draw_elite_border(canvas, doc, 
        footer_left="ELECTRONIC MEDICAL RECORDS", 
        footer_center="Patient Clinical Report | Powered by Bavya Health Service PVT Ltd.")

def generate_patient_pdf_report(patient_id, visit_date_str=None):
    """
    Elite Refactored Pass: Using the Centralized Theme Engine to eliminate redundancy.
    Maintains the Hybrid Elite layout with synchronized alignment and bold typography.
    """
    dossier = dossier_manager.get_dossier(patient_id)
    if not dossier:
        dossier_manager.sync_dossier(patient_id)
        dossier = dossier_manager.get_dossier(patient_id)
    
    try:
        patient = Patient.objects.get(patient_id=patient_id)
        project_name = patient.project.name if patient.project else "Global Healthcare Hub"
        project_color = patient.project.primary_color if patient.project and patient.project.primary_color else '#1e3a8a'
    except:
        project_name = "N/A"
        project_color = '#1e3a8a'

    theme_color = colors.HexColor(project_color)
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=40, leftMargin=40, topMargin=30, bottomMargin=40)
    doc.patient_id = patient_id
    doc.theme_color = theme_color # Store for PageBorder

    # Helper for PageBorder closure
    def BorderWrapper(canvas, doc):
        draw_elite_border(canvas, doc, 
            footer_left="ELECTRONIC MEDICAL RECORDS", 
            footer_center="Patient Clinical Report | Powered by Bavya Health Service PVT Ltd.",
            theme_color=doc.theme_color)
    
    # Load Centralized Styles
    theme = get_report_styles(theme_color)
    std_grid = get_standard_table_style()
    
    elements = []

    # --- 1. HEADER ---
    header_data = [[
        Paragraph(f"<font color='{project_color}' size=15><b>{project_name.upper()}</b></font><br/><font size=7 color='#64748b'>Certified Healthcare & Diagnostic Clinic<br/>Official Medical Documentation System</font>", getSampleStyleSheet()['Normal']),
        Paragraph(f"<font size=20 color='{project_color}'><b>CLINICAL REPORT</b></font><br/><font size=7 color='#94a3b8'>ELECTRONIC MEDICAL RECORD</font>", ParagraphStyle('RH', alignment=2, leading=18))
    ]]
    elements.append(Table(header_data, colWidths=[3.1*inch, 3.5*inch]))
    elements.append(Spacer(1, 0.1 * inch))
    elements.append(Table([[""]], colWidths=[6.6*inch], rowHeights=[3], style=[('BACKGROUND', (0,0), (-1,-1), theme_color)]))
    elements.append(Spacer(1, 0.2 * inch))

    # --- 2. PATIENT DETAILS ---
    elements.append(create_main_bar("PATIENT DETAILS", theme_color))
    elements.append(Spacer(1, 0.05 * inch))
    
    meta = dossier.get('registry_metadata', {})
    id_data = [
        [Paragraph("FULL LEGAL NAME", theme['label_left']), Paragraph(to_str(dossier.get('full_name')), theme['value']), Paragraph("PATIENT UID", theme['label_left']), Paragraph(to_str(patient_id), theme['value'])],
        [Paragraph("GENDER", theme['label_left']), Paragraph(to_str(meta.get('gender')), theme['value']), Paragraph("AADHAR / CARD NO", theme['label_left']), Paragraph(to_str(patient.id_proof_number), theme['value'])],
        [Paragraph("DATE OF BIRTH", theme['label_left']), Paragraph(to_str(meta.get('dob')), theme['value']), Paragraph("CONTACT LINK", theme['label_left']), Paragraph(to_str(meta.get('phone')), theme['value'])],
    ]
    id_t = Table(id_data, colWidths=[1.4*inch, 1.9*inch, 1.4*inch, 1.9*inch])
    id_t.setStyle(TableStyle([
        ('GRID', (0,0), (-1,-1), 0.5, BORDER_MAIN),
        ('BACKGROUND', (0,0), (0,-1), HEADER_BLUE),
        ('BACKGROUND', (2,0), (2,-1), HEADER_BLUE),
        ('PADDING', (0,0), (-1,-1), 10),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    elements.append(id_t)
    elements.append(Spacer(1, 0.2 * inch))

    # --- 3. SESSION ---
    visits = dossier.get('visit_history', [])
    if visit_date_str:
        visits = [v for v in visits if v['visit_date'].startswith(visit_date_str)]

    for v in visits:
        v_date = to_str(v['visit_date'])[:10]
        vitals = v.get('vitals', {}) or {}
        consult = v.get('consultation', {}) or {}

        elements.append(create_main_bar(f"DIAGNOSTIC VISIT DATE: {v_date}", theme_color))
        elements.append(Spacer(1, 0.1 * inch))

        # --- SIDE-BY-SIDE DASHBOARD ---
        
        hist_title = create_sub_header("PERSONAL & FAMILY HISTORY", theme_color)
        hist_data = [
            [Paragraph("SMOKING", theme['label_left']), Paragraph(to_str(vitals.get('smoking')), theme['value'])],
            [Paragraph("ALCOHOL", theme['label_left']), Paragraph(to_str(vitals.get('alcohol')), theme['value'])],
            [Paragraph("ACTIVITY", theme['label_left']), Paragraph(to_str(vitals.get('physical_activity')), theme['value'])],
            [Paragraph("DIET", theme['label_left']), Paragraph(to_str(vitals.get('food_habit')), theme['value'])],
            [Paragraph("FAMILY DM", theme['label_left']), Paragraph(to_str(vitals.get('family_dm')), theme['value'])],
            [Paragraph("FAMILY HTN", theme['label_left']), Paragraph(to_str(vitals.get('family_htn')), theme['value'])],
            [Paragraph("FAMILY CVS", theme['label_left']), Paragraph(to_str(vitals.get('family_cvs')), theme['value'])],
            [Paragraph("FAMILY TB", theme['label_left']), Paragraph(to_str(vitals.get('family_tb')), theme['value'])],
        ]
        hist_t = Table(hist_data, colWidths=[1.4*inch, 1.85*inch])
        hist_t.setStyle(std_grid)
        elements.append(Spacer(1, 0.2 * inch))

        sys_title = create_sub_header("SYSTEMIC EXAMINATION REVIEW", theme_color)
        sys_data = [
            [Paragraph("RESPIRATORY", theme['label_left']), Paragraph(to_str(vitals.get('sys_respiratory'), 'NAD'), theme['badge_green'])],
            [Paragraph("C.V.S SYSTEM", theme['label_left']), Paragraph(to_str(vitals.get('sys_cvs'), 'NAD'), theme['badge_green'])],
            [Paragraph("C.N.S SYSTEM", theme['label_left']), Paragraph(to_str(vitals.get('sys_cns'), 'NAD'), theme['badge_green'])],
            [Paragraph("G.I.S SYSTEM", theme['label_left']), Paragraph(to_str(vitals.get('sys_gis'), 'NAD'), theme['badge_green'])],
            [Paragraph("M.S.S SYSTEM", theme['label_left']), Paragraph(to_str(vitals.get('sys_mss'), 'NAD'), theme['badge_green'])],
            [Paragraph("G.U.S SYSTEM", theme['label_left']), Paragraph(to_str(vitals.get('sys_gus'), 'NAD'), theme['badge_green'])],
        ]
        sys_t = Table(sys_data, colWidths=[1.6*inch, 1.65*inch])
        sys_t.setStyle(std_grid)

        side_by_side = [[[hist_title, Spacer(1, 0.04*inch), hist_t], [sys_title, Spacer(1, 0.04*inch), sys_t]]]
        sbs_t = Table(side_by_side, colWidths=[3.3*inch, 3.3*inch])
        sbs_t.setStyle(TableStyle([('VALIGN', (0,0), (-1,-1), 'TOP'), ('LEFTPADDING', (0,0), (-1,-1), 0), ('RIGHTPADDING', (0,0), (-1,-1), 0)]))
        elements.append(sbs_t)
        elements.append(Spacer(1, 0.2 * inch))

        # C. VITALS
        elements.append(create_sub_header("PHYSIOLOGICAL VITALS & STATS", theme_color))
        elements.append(Spacer(1, 0.04 * inch))
        vit_data = [
            [Paragraph("TEMP", theme['label_center']), Paragraph("BP (SYS/DIA)", theme['label_center']), Paragraph("HEART RATE", theme['label_center']), Paragraph("OXYGEN (SPO2)", theme['label_center']), Paragraph("BMI", theme['label_center'])],
            [Paragraph(f"<b>{vitals.get('temperature_c', '--')}°C</b>", theme['badge_green']), Paragraph(f"<b>{vitals.get('blood_pressure_sys', '--')}/{vitals.get('blood_pressure_dia', '--')}</b>", theme['badge_green']), Paragraph(f"<b>{vitals.get('heart_rate', '--')} BPM</b>", theme['badge_green']), Paragraph(f"<b>{vitals.get('spo2', '--')}%</b>", theme['badge_green']), Paragraph(f"<b>{vitals.get('bmi', '--')}</b>", theme['badge_green'])]
        ]
        vitt = Table(vit_data, colWidths=[1.32*inch]*5)
        vitt.setStyle(std_grid)
        elements.append(vitt)
        elements.append(Spacer(1, 0.2 * inch))

        # D. LABS
        elements.append(create_sub_header("DIAGNOSTIC LAB INVESTIGATIONS", theme_color))
        elements.append(Spacer(1, 0.04 * inch))
        lab_data = [[Paragraph("INVESTIGATION PARAMETER", theme['label_left']), Paragraph("RESULT VALUE", theme['label_center']), Paragraph("REFERENCE RANGE", theme['label_center'])]]
        for lr in v.get('lab_requests', []):
            res = lr.get('result', {}) or {}; tn = lr.get('test_name') or lr.get('test_master_details', {}).get('name', 'Unknown')
            if res and res.get('values'):
                lab_data.append([Paragraph(f"<b>{tn.upper()}</b>", ParagraphStyle('P', parent=theme['value'], textColor=NAVY)), Paragraph("", theme['badge_green']), Paragraph("", theme['value'])])
                for sn, sv in res['values'].items():
                    ref = "--"; is_alert = False; match = next((s for s in lr.get('test_master_details', {}).get('sub_tests', []) if s['name'] == sn), None)
                    if match:
                        ref = f"{match.get('biological_range', '--')} {match.get('units', '')}";
                        try:
                            val = float(sv); 
                            if ' - ' in match.get('biological_range', ''):
                                l, h = map(float, match['biological_range'].split(' - '));
                                if val < l or val > h: is_alert = True
                        except: pass
                    lab_data.append([Paragraph(f"{sn}", theme['value']), Paragraph(to_str(sv), theme['alert_red'] if is_alert else theme['badge_green']), Paragraph(ref, ParagraphStyle('R', parent=theme['value'], alignment=1))])
            else:
                lab_data.append([Paragraph(tn, theme['value']), Paragraph(to_str(res.get('value', 'Pending')), theme['badge_green']), Paragraph("--", ParagraphStyle('R', parent=theme['value'], alignment=1))])
        labt = Table(lab_data, colWidths=[3.2*inch, 1.4*inch, 2.0*inch])
        labt.setStyle(std_grid)
        elements.append(labt)
        elements.append(Spacer(1, 0.2 * inch))

        # E. MEDS
        elements.append(create_sub_header("PHARMACY & PRESCRIPTIONS", theme_color))
        elements.append(Spacer(1, 0.04 * inch))
        med_data = [[Paragraph("MEDICATION", theme['label_left']), Paragraph("DOSAGE", theme['label_center']), Paragraph("FREQUENCY", theme['label_center']), Paragraph("DURATION", theme['label_center'])]]
        for m in v.get('prescriptions', []):
            med_data.append([Paragraph(f"<b>{to_str(m.get('medication_name'))}</b>", theme['value']), Paragraph(to_str(m.get('dosage')), theme['badge_green']), Paragraph(to_str(m.get('frequency')), theme['badge_green']), Paragraph(to_str(m.get('duration')), theme['badge_green'])])
        medt = Table(med_data, colWidths=[3.1*inch, 1.1*inch, 1.2*inch, 1.2*inch])
        medt.setStyle(std_grid)
        elements.append(medt)
        elements.append(Spacer(1, 0.2 * inch))

        # F. ASSESSMENT
        elements.append(create_sub_header("FINAL ASSESSMENT & PLAN", theme_color))
        elements.append(Spacer(1, 0.04 * inch))
        conc_data = [[Paragraph(f"<b>DIAGNOSIS:</b> {to_str(v.get('diagnosis') or consult.get('diagnosis'), 'General Review')}<br/><br/><b>PLAN:</b> {to_str(consult.get('plan') or consult.get('advice'))}", theme['value'])]]
        conct = Table(conc_data, colWidths=[6.6*inch])
        conct.setStyle(TableStyle([('GRID', (0,0), (-1,-1), 0.5, BORDER_MAIN), ('PADDING', (0,0), (-1,-1), 15), ('VALIGN', (0,0), (-1,-1), 'MIDDLE')]))
        elements.append(conct)
        elements.append(PageBreak())

    doc.build(elements, onFirstPage=BorderWrapper, onLaterPages=BorderWrapper)
    buffer.seek(0)
    return buffer
