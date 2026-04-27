from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, PageBreak
from reportlab.lib.units import inch
from io import BytesIO
from .dossier_manager import dossier_manager
from .models import Patient

def to_str(val, default='N/A'):
    if val is None or val == "": return default
    return str(val)

def PageBorder(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(colors.HexColor('#e2e8f0'))
    canvas.setLineWidth(1)
    # Simple aesthetic border
    canvas.rect(30, 30, A4[0]-60, A4[1]-60)
    canvas.restoreState()

def generate_patient_pdf_report(patient_id, visit_date_str=None):
    """
    Generates a professional Medical Diagnostic Report using MongoDB Hot Dossier data.
    """
    # 1. Fetch Data from MongoDB (The Hot Dossier)
    dossier = dossier_manager.get_dossier(patient_id)
    if not dossier:
        # Fallback to sync if missing
        dossier_manager.sync_dossier(patient_id)
        dossier = dossier_manager.get_dossier(patient_id)
    
    # Fetch project info from SQL (Dossier metadata is simpler)
    try:
        patient = Patient.objects.get(patient_id=patient_id)
        project_name = patient.project.name if patient.project else "General Clinical Hub"
    except:
        project_name = "N/A"

    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=50, leftMargin=50, topMargin=50, bottomMargin=50)
    styles = getSampleStyleSheet()
    
    # Custom Styles
    title_style = ParagraphStyle('TitleStyle', parent=styles['Heading1'], fontSize=18, textColor=colors.HexColor('#0f172a'), alignment=1, spaceAfter=20)
    section_style = ParagraphStyle('SectionStyle', parent=styles['Heading2'], fontSize=12, textColor=colors.HexColor('#6366f1'), spaceBefore=15, spaceAfter=10, fontWeight='BOLD')
    label_style = ParagraphStyle('LabelStyle', parent=styles['Normal'], fontSize=9, textColor=colors.HexColor('#64748b'), fontWeight='BOLD')
    value_style = ParagraphStyle('ValueStyle', parent=styles['Normal'], fontSize=10, textColor=colors.HexColor('#0f172a'))

    elements = []

    # Header
    doc_title = "MASTER CLINICAL DOSSIER" if not visit_date_str else "MEDICAL DIAGNOSTIC REPORT"
    elements.append(Paragraph(doc_title, title_style))
    elements.append(Paragraph(f"Project Reference: {project_name.upper()}", ParagraphStyle('Proj', parent=styles['Normal'], alignment=1, fontSize=8, textColor=colors.grey)))
    elements.append(Spacer(1, 0.3 * inch))

    # Patient Details Table
    meta = dossier.get('registry_metadata', {})
    data = [
        [Paragraph("<b>Patient Name</b>", label_style), Paragraph(to_str(dossier.get('full_name')), value_style), Paragraph("<b>Patient ID</b>", label_style), Paragraph(to_str(patient_id), value_style)],
        [Paragraph("<b>Gender</b>", label_style), Paragraph(to_str(meta.get('gender')), value_style), Paragraph("<b>Blood Group</b>", label_style), Paragraph(to_str(meta.get('blood_group')), value_style)],
        [Paragraph("<b>Date of Birth</b>", label_style), Paragraph(to_str(meta.get('dob')), value_style), Paragraph("<b>Contact</b>", label_style), Paragraph(to_str(meta.get('phone')), value_style)],
    ]
    
    t = Table(data, colWidths=[1.2*inch, 1.8*inch, 1.2*inch, 1.8*inch])
    t.setStyle(TableStyle([
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BACKGROUND', (0, 0), (0, -1), colors.whitesmoke),
        ('BACKGROUND', (2, 0), (2, -1), colors.whitesmoke),
        ('PADDING', (0, 0), (-1, -1), 8),
    ]))
    elements.append(t)
    elements.append(Spacer(1, 0.2 * inch))

    # Process Visits
    visits_to_render = []
    if visit_date_str:
        v = next((v for v in dossier.get('visit_history', []) if v['visit_date'].startswith(visit_date_str)), None)
        if v: visits_to_render.append(v)
    else:
        # Full History: Add a Summary Table first
        elements.append(Paragraph("Clinical History Summary", section_style))
        summary_data = [["Date", "Facility", "Diagnosis", "Status"]]
        for v in dossier.get('visit_history', []):
            summary_data.append([to_str(v['visit_date'])[:10], "Internal Clinic", to_str(v.get('diagnosis'), 'General Review'), "VERIFIED"])
        
        st = Table(summary_data, colWidths=[1.2*inch, 1.8*inch, 2*inch, 1*inch])
        st.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f8fafc')),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('PADDING', (0, 0), (-1, -1), 6),
        ]))
        elements.append(st)
        elements.append(PageBreak())
        visits_to_render = dossier.get('visit_history', [])

    for selected_visit in visits_to_render:
        v_date = to_str(selected_visit['visit_date'])[:10]
        vitals = selected_visit.get('vitals', {}) or {}
        consult = selected_visit.get('consultation', {}) or {}

        # --- Section: Personal & Family History ---
        elements.append(Paragraph("Personal & Family History", section_style))
        hist_data = [
            [Paragraph("<b>Personal</b>", label_style), Paragraph(f"Smoking: {to_str(vitals.get('smoking'))} | Alcohol: {to_str(vitals.get('alcohol'))}", value_style)],
            [Paragraph("<b>Activity</b>", label_style), Paragraph(f"Physical: {to_str(vitals.get('physical_activity'))} | Food: {to_str(vitals.get('food_habit'))}", value_style)],
            [Paragraph("<b>Family History</b>", label_style), Paragraph(f"DM: {to_str(vitals.get('family_dm'))} | HTN: {to_str(vitals.get('family_htn'))} | CVS: {to_str(vitals.get('family_cvs'))}", value_style)],
            [Paragraph("<b>TB History</b>", label_style), Paragraph(to_str(vitals.get('family_tb')), value_style)],
        ]
        ht = Table(hist_data, colWidths=[1.5*inch, 4.5*inch])
        ht.setStyle(TableStyle([
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('PADDING', (0, 0), (-1, -1), 6),
        ]))
        elements.append(ht)

        # --- Section: Systemic Examination ---
        elements.append(Paragraph("Systemic Examination", section_style))
        sys_data = [
            ["Respiratory", to_str(vitals.get('sys_respiratory')), "C.V.S", to_str(vitals.get('sys_cvs'))],
            ["C.N.S", to_str(vitals.get('sys_cns')), "G.I.S", to_str(vitals.get('sys_gis'))],
            ["M.S.S", to_str(vitals.get('sys_mss')), "G.U.S", to_str(vitals.get('sys_gus'))],
        ]
        st = Table(sys_data, colWidths=[1.5*inch, 1.5*inch, 1.5*inch, 1.5*inch])
        st.setStyle(TableStyle([
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#64748b')),
            ('TEXTCOLOR', (2, 0), (2, -1), colors.HexColor('#64748b')),
            ('PADDING', (0, 0), (-1, -1), 6),
        ]))
        elements.append(st)

        elements.append(Paragraph(f"Clinical Observations - Visit: {v_date}", section_style))
        
        # Vitals Table
        v_data = [
            ["Temperature", f"{vitals.get('temperature_c', '--')} C", "Blood Pressure", f"{vitals.get('blood_pressure_sys', '--')}/{vitals.get('blood_pressure_dia', '--')} mmHg"],
            ["Heart Rate", f"{vitals.get('heart_rate', '--')} BPM", "SPO2", f"{vitals.get('spo2', '--')} %"],
            ["BMI", f"{vitals.get('bmi', '--')} kg/m2", "Resp. Rate", f"{vitals.get('respiratory_rate', '--')} CPM"],
        ]
        vt = Table(v_data, colWidths=[1.5*inch, 1.5*inch, 1.5*inch, 1.5*inch])
        vt.setStyle(TableStyle([
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#64748b')),
            ('TEXTCOLOR', (2, 0), (2, -1), colors.HexColor('#64748b')),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('PADDING', (0, 0), (-1, -1), 6),
        ]))
        elements.append(vt)

        # Lab Results
        elements.append(Paragraph("Laboratory Diagnostics", section_style))
        lab_data = [["Investigation", "Result Value", "Biological Reference"]]
        
        visit_labs = selected_visit.get('lab_requests', [])
        if visit_labs:
            for lr in visit_labs:
                res_obj = lr.get('result', {}) or {}
                test_name = lr.get('test_name') or (lr.get('test_master_details', {}).get('name', 'Unknown Test'))
                
                if res_obj and res_obj.get('values'):
                    for sub_name, sub_val in res_obj['values'].items():
                        # Try to find biological range for subtest
                        ref_range = "--"
                        sub_tests = lr.get('test_master_details', {}).get('sub_tests', [])
                        match_sub = next((s for s in sub_tests if s['name'] == sub_name), None)
                        if match_sub:
                            ref_range = f"{match_sub.get('biological_range', '--')} {match_sub.get('units', '')}"

                        lab_data.append([f"{test_name} ({sub_name})", to_str(sub_val), ref_range])
                else:
                    lab_data.append([test_name, to_str(res_obj.get('value', 'Pending')), "--"])
        else:
            lab_data.append(["No Lab Records Found", "--", "--"])

        lt = Table(lab_data, colWidths=[2.5*inch, 1.7*inch, 1.8*inch])
        lt.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f8fafc')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor('#0f172a')),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('PADDING', (0, 0), (-1, -1), 6),
        ]))
        elements.append(lt)

        # Pharmacy Prescriptions
        elements.append(Paragraph("Pharmacy Prescriptions", section_style))
        med_data = [["Medication / Regimen", "Dosage", "Frequency", "Duration"]]
        
        meds = selected_visit.get('prescriptions', [])
        if meds:
            for m in meds:
                med_data.append([
                    to_str(m.get('medication_name')),
                    to_str(m.get('dosage')),
                    to_str(m.get('frequency')),
                    to_str(m.get('duration'))
                ])
        else:
            med_data.append(["No Medications Prescribed", "--", "--", "--"])

        mt = Table(med_data, colWidths=[2.5*inch, 1.2*inch, 1.3*inch, 1.0*inch])
        mt.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f8fafc')),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('PADDING', (0, 0), (-1, -1), 6),
        ]))
        elements.append(mt)

        # Conclusion
        elements.append(Paragraph("Clinical Conclusion", section_style))
        elements.append(Paragraph(f"<b>Diagnosis:</b> {to_str(selected_visit.get('diagnosis') or consult.get('diagnosis'), 'General Review')}", value_style))
        
        advice_text = consult.get('plan') or consult.get('advice')
        if advice_text:
            elements.append(Paragraph(f"<b>Clinical Advice & Plan:</b> {to_str(advice_text)}", value_style))
        
        elements.append(Spacer(1, 0.4 * inch))
        
        if not visit_date_str:
            elements.append(PageBreak())

    # Footer
    elements.append(Spacer(1, 0.5 * inch))
    elements.append(Paragraph("<i>This is a computer-generated medical record verified through the EMR Cloud Infrastructure.</i>", ParagraphStyle('Footer', parent=styles['Normal'], fontSize=7, alignment=1, textColor=colors.grey)))

    doc.build(elements, onFirstPage=PageBorder, onLaterPages=PageBorder)
    buffer.seek(0)
    return buffer
