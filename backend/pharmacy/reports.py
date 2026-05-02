from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, PageBreak
from reportlab.lib.units import inch
from io import BytesIO
from patients.report_theme import (
    NAVY, get_report_styles, create_main_bar, create_sub_header, 
    get_standard_table_style, draw_elite_border
)

def PageBorder(canvas, doc):
    draw_elite_border(canvas, doc, 
        footer_left="PHARMACY AUDIT & COMPLIANCE", 
        footer_center="Hospital Grade Consumption Audit | Powered by Bavya Health Service PVT Ltd.")

def generate_consumption_pdf_report(data):
    """
    Elite Admin Pass: Implementing the Pharmacy Consumption Audit Report using the 
    Hybrid Elite Design System to eliminate code redundancy and maintain brand parity.
    """
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=40, leftMargin=40, topMargin=30, bottomMargin=40)
    
    theme = get_report_styles()
    std_grid = get_standard_table_style()
    
    elements = []

    # --- 1. HEADER ---
    header_data = [[
        Paragraph(f"<font color='#1e3a8a' size=15><b>ADMINISTRATIVE AUDIT</b></font><br/><font size=7 color='#64748b'>Pharmacy & Inventory Intelligence<br/>Project: {data.get('project_id', 'GLOBAL')}</font>", theme['value']),
        Paragraph("<font size=18 color='#1e3a8a'><b>CONSUMPTION REPORT</b></font><br/><font size=7 color='#94a3b8'>PHARMACY DEPARTMENT</font>", theme['badge_green'])
    ]]
    elements.append(Table(header_data, colWidths=[3.1*inch, 3.5*inch]))
    elements.append(Spacer(1, 0.1 * inch))
    elements.append(Table([[""]], colWidths=[6.6*inch], rowHeights=[3], style=[('BACKGROUND', (0,0), (-1,-1), NAVY)]))
    elements.append(Spacer(1, 0.2 * inch))

    # --- 2. SUMMARY (KEEP SOLID BAR) ---
    elements.append(create_main_bar("CONSUMPTION SUMMARY"))
    elements.append(Spacer(1, 0.05 * inch))
    
    summary_data = [
        [Paragraph("TOTAL VISITS", theme['label_left']), Paragraph(str(data.get('total_visits', 0)), theme['value']), Paragraph("TOTAL PATIENTS", theme['label_left']), Paragraph(str(data.get('total_patients', 0)), theme['value'])],
        [Paragraph("GRAND TOTAL UNITS", theme['label_left']), Paragraph(str(data.get('grand_total_units', 0)), theme['value']), Paragraph("GRAND TOTAL COST", theme['label_left']), Paragraph(f"₹{data.get('grand_total_cost', 0):,.2f}", theme['value'])],
    ]
    sum_t = Table(summary_data, colWidths=[1.4*inch, 1.9*inch, 1.4*inch, 1.9*inch])
    sum_t.setStyle(std_grid)
    elements.append(sum_t)
    elements.append(Spacer(1, 0.3 * inch))

    # --- 3. DETAILED LOG (HYBRID MINIMALIST) ---
    elements.append(create_sub_header("DETAILED CONSUMPTION LOG"))
    elements.append(Spacer(1, 0.06 * inch))
    
    log_data = [[
        Paragraph("DATE", theme['label_left']), 
        Paragraph("PATIENT ID / NAME", theme['label_left']), 
        Paragraph("MEDICATION", theme['label_left']), 
        Paragraph("QTY", theme['label_center']), 
        Paragraph("COST", theme['label_center'])
    ]]
    
    for visit in data.get('items', []):
        for med in visit.get('medications', []):
            log_data.append([
                Paragraph(visit['visit_date'], theme['value']),
                Paragraph(f"<b>{visit['patient_id']}</b><br/>{visit['patient_name']}", theme['value']),
                Paragraph(med['name'], theme['value']),
                Paragraph(str(med['quantity']), theme['badge_green']),
                Paragraph(f"₹{med['total_cost']:,.2f}", theme['value'])
            ])

    log_t = Table(log_data, colWidths=[1.0*inch, 1.8*inch, 1.8*inch, 0.8*inch, 1.2*inch])
    log_t.setStyle(std_grid)
    elements.append(log_t)

    doc.build(elements, onFirstPage=PageBorder, onLaterPages=PageBorder)
    buffer.seek(0)
    return buffer
