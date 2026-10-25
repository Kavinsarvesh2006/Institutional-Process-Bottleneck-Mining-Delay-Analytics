"""Portable PDF with vector charts and evidence, generated entirely offline."""
from io import BytesIO
from xml.sax.saxutils import escape
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.graphics.shapes import Drawing, Rect, String, PolyLine

def report_pdf(result: dict, name: str) -> bytes:
    """Render two-page executive report for the exact active analysis filters."""
    output = BytesIO()
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name='Brand',fontName='Helvetica-Bold',fontSize=28,leading=34,textColor=colors.HexColor('#3730A3')))
    styles.add(ParagraphStyle(name='Sub',fontSize=10,leading=15,textColor=colors.HexColor('#64748B')))
    doc = SimpleDocTemplate(output,pagesize=(595,842),rightMargin=42,leftMargin=42,topMargin=40,bottomMargin=42)
    overview = result['overview']
    story = [Paragraph('FlowLens / Process intelligence',styles['Brand']),Spacer(1,9),
             Paragraph('V.S.B. Engineering College | AI &amp; Data Science',styles['Sub']),
             Paragraph('Institutional Process Bottleneck Mining &amp; Delay Analytics',styles['Sub']),Spacer(1,18),
             Paragraph(escape(name),styles['Heading2']),Paragraph(f"Arrival window: {overview['start']} to {overview['end']} | Queue clock: {'working hours' if result['settings']['working_hours'] else 'elapsed hours'}",styles['Sub']),Spacer(1,14)]
    table = Table([['Cases','Mean cycle','SLA breach','Open cases'],[f"{overview['total_cases']:,}",f"{overview['avg_cycle']:.1f} h",f"{overview['breach_rate']:.1f}%",str(overview['open_cases'])]],colWidths=[127]*4)
    table.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#EEF2FF')),('TEXTCOLOR',(0,0),(-1,-1),colors.HexColor('#27334A')),('FONTSIZE',(0,0),(-1,-1),11),('TOPPADDING',(0,0),(-1,-1),12),('BOTTOMPADDING',(0,0),(-1,-1),12)]))
    story.extend([table,Spacer(1,22),Paragraph('Where requests wait',styles['Heading2'])])
    drawing = Drawing(510,180)
    top = result['bottlenecks'][:5]
    peak = max((r['mean'] for r in top),default=1) or 1
    for i,row in enumerate(top):
        y = 150-i*30
        drawing.add(String(0,y+3,row['name'],fontSize=9,fontName='Helvetica',fillColor=colors.HexColor('#334155')))
        drawing.add(Rect(145,y,max(1,row['mean']/peak*290),14,fillColor=colors.HexColor('#3730A3') if i else colors.HexColor('#EA580C'),strokeColor=None))
        drawing.add(String(445,y+3,f"{row['mean']:.1f} h",fontSize=9,fontName='Helvetica'))
    story.extend([drawing,Paragraph('Arrival-cohort cycle trend (hours)',styles['Heading2'])])
    plot = Drawing(510,140)
    points = [r['moving'] for r in result['trend'] if r['moving'] is not None]
    if len(points)>1:
        scale = max(points) or 1
        coords = [coord for i,value in enumerate(points) for coord in (20+i/(len(points)-1)*475,20+value/scale*105)]
        plot.add(PolyLine(coords,strokeColor=colors.HexColor('#14B8A6'),strokeWidth=2))
        plot.add(String(0,128,f'{scale:.0f} h',fontSize=8,fontName='Helvetica'))
        plot.add(String(20,3,overview['start'],fontSize=8,fontName='Helvetica'))
        plot.add(String(440,3,overview['end'],fontSize=8,fontName='Helvetica'))
    story.extend([plot,PageBreak(),Paragraph('Prioritised action plan',styles['Brand']),Spacer(1,16)])
    for i,row in enumerate(result['recommendations'][:5]):
        story.extend([Paragraph(f'{i+1:02d}. '+escape(row['title']),styles['Heading2']),Paragraph(escape(row['action']),styles['BodyText']),Spacer(1,6),
                      Paragraph(escape(row['evidence']),styles['Sub']),Paragraph(f"50% queue reduction scenario: {row['impact']['saved_hours']:,.0f} total hours saved; {row['impact']['rescued']} SLA breaches avoided. Effort: {row['effort']}.",styles['Sub']),Spacer(1,15)])
    story.extend([Spacer(1,12),Paragraph('Method & limitations',styles['Heading2']),Paragraph('Queue time is the gap between one activity ending and the next starting. Service time is measured separately. Open cases are excluded from SLA rates. Scenario estimates hold other waits fixed and do not model capacity feedback. Associations are not proof of causation. Sample datasets are synthetic.',styles['Sub'])])
    def footer(canvas, document) -> None:
        """Number every report page."""
        canvas.setFont('Helvetica',8)
        canvas.setFillColor(colors.HexColor('#64748B'))
        canvas.drawString(42,24,'FLOWLENS / INSTITUTIONAL OPERATIONS')
        canvas.drawRightString(553,24,f'{document.page}')
    doc.build(story,onFirstPage=footer,onLaterPages=footer)
    return output.getvalue()
