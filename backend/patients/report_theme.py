from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import Table, TableStyle, Paragraph

# --- 1. GLOBAL COLORS & TOKENS ---
NAVY = colors.HexColor('#1e3a8a')
HEADER_BLUE = colors.HexColor('#eff6ff')
TEXT_BASE = colors.HexColor('#0f172a')
TEXT_SUB = colors.HexColor('#64748b')
BORDER_MAIN = colors.HexColor('#e2e8f0')

def get_report_styles(theme_color=NAVY):
    """Centralized Typography for all Elite Reports"""
    styles = getSampleStyleSheet()
    return {
        'main_bar': ParagraphStyle('MainBarTitle', fontName='Helvetica-Bold', fontSize=9, textColor=colors.white, leftIndent=12, letterSpacing=0.8),
        'sub_header': ParagraphStyle('SubSecTitle', fontName='Helvetica-Bold', fontSize=9, textColor=theme_color, letterSpacing=0.6, leftIndent=0),
        'label_left': ParagraphStyle('LabLeft', fontSize=7, textColor=TEXT_SUB, fontWeight='BOLD', textTransform='UPPERCASE', letterSpacing=0.6, alignment=0),
        'label_center': ParagraphStyle('LabCenter', fontSize=7, textColor=TEXT_SUB, fontWeight='BOLD', textTransform='UPPERCASE', letterSpacing=0.6, alignment=1),
        'value': ParagraphStyle('ValStyle', fontSize=9, textColor=TEXT_BASE, leading=14),
        'badge_green': ParagraphStyle('BadgeStyle', fontSize=8, textColor=colors.HexColor('#059669'), fontWeight='BOLD', alignment=1),
        'alert_red': ParagraphStyle('AlertStyle', fontSize=8, textColor=colors.HexColor('#dc2626'), fontWeight='BOLD', alignment=1),
        'footer_text': ParagraphStyle('Footer', fontSize=6, textColor=colors.HexColor('#94a3b8'), alignment=1)
    }

# --- 2. REUSABLE COMPONENTS ---

def create_main_bar(text, theme_color=NAVY):
    """Elite Signature: Solid Navy/Primary Bar"""
    theme = get_report_styles(theme_color)
    return Table([[Paragraph(text.upper(), theme['main_bar'])]], 
                colWidths=[6.6*inch], rowHeights=[22],
                style=[('BACKGROUND', (0,0), (-1,-1), theme_color),
                       ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
                       ('ROUNDEDCORNERS', [4, 4, 4, 4])])

def create_sub_header(text, theme_color=NAVY):
    """Elite Signature: Typography-based divider with accent line"""
    theme = get_report_styles(theme_color)
    return Table([[Paragraph(text.upper(), theme['sub_header']), ""]], 
                colWidths=[3*inch, 3.6*inch],
                style=[('LINEBELOW', (0,0), (0,0), 1.5, theme_color),
                       ('BOTTOMPADDING', (0,0), (-1,-1), 4)])

def get_standard_table_style():
    """Elite Grid styling for all data tables"""
    return TableStyle([
        ('GRID', (0,0), (-1,-1), 0.5, BORDER_MAIN),
        ('BACKGROUND', (0,0), (-1,0), HEADER_BLUE),
        ('PADDING', (0,0), (-1,-1), 8),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ])

def draw_elite_border(canvas, doc, footer_left="", footer_center="", theme_color=NAVY):
    """Universal Elite Border & Footer System"""
    from reportlab.lib.pagesizes import A4
    canvas.saveState()
    # Signature Side Accent (Project Specific Color)
    canvas.setStrokeColor(theme_color)
    canvas.setLineWidth(3)
    canvas.line(30, 40, 30, 800)

    # Footer Layout
    canvas.setFont('Helvetica-Bold', 7)
    canvas.setFillColor(theme_color)
    canvas.drawString(40, 15, footer_left)
    
    canvas.setFont('Helvetica', 6)
    canvas.setFillColor(TEXT_SUB)
    canvas.drawCentredString(A4[0]/2, 15, footer_center)
    
    canvas.setFont('Helvetica-Bold', 7)
    canvas.setFillColor(theme_color)
    canvas.drawRightString(A4[0]-35, 15, f"Page {doc.page} | ID: {getattr(doc, 'patient_id', 'ADMIN')}")
    canvas.restoreState()
