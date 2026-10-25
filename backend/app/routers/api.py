"""Validated, filter-aware routes for the FlowLens frontend and OpenAPI clients."""
import json
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, UploadFile, Query
from fastapi.responses import Response
from fastapi.encoders import jsonable_encoder
from sqlalchemy import select, func
import pandas as pd
from ..database import Session
from ..models import Dataset, Event, Case, AnalysisCache, SlaRule
from ..schemas import Settings, Prediction, Simulation
from ..services import analysis, ingest, process_miner, bottleneck, delay, recommend
from ..services.report import report_pdf
from ..seed.generate_data import generate

router = APIRouter()

def clean(value: object) -> object:
    """Convert pandas timestamps and NumPy scalars to standard JSON values."""
    return json.loads(json.dumps(value,default=lambda v:v.isoformat() if hasattr(v,'isoformat') else v.item()))

def selected(dataset_id: int | None = None, process_type: str = '', department: str = '', start: date | None = None, end: date | None = None) -> dict:
    """Resolve a dataset and apply consistent case-cohort filters."""
    with Session() as session:
        dataset = session.get(Dataset,dataset_id) if dataset_id else session.scalars(select(Dataset).order_by(Dataset.id.desc())).first()
        if not dataset:
            raise HTTPException(404,'Load a sample dataset or upload a CSV to begin.')
    if start and end and start>end:
        raise HTTPException(422,'Start date must precede end date.')
    result = analysis.snapshot(dataset.id,process_type,department,str(start or ''),str(end or ''),json.dumps(analysis.get_settings(),sort_keys=True))
    if result['empty']:
        raise HTTPException(404,'No cases match these filters. Try a wider date range.')
    return {**result,'dataset':{'id':dataset.id,'name':dataset.name}}

@router.get('/datasets')
def datasets() -> list[dict]:
    """List dataset selectors and import audits."""
    with Session() as session:
        return [{'id':d.id,'name':d.name,'created_at':d.created_at,'quality':d.quality,
                 'cases':session.scalar(select(func.count()).select_from(Case).where(Case.dataset_id==d.id)),
                 **{key: list(session.scalars(select(column).where(Event.dataset_id==d.id).distinct().order_by(column)))
                    for key,column in [('process_types',Event.process_type),('departments',Event.department),('activities',Event.activity)]}}
                for d in session.scalars(select(Dataset).order_by(Dataset.id.desc()))]

@router.post('/datasets/seed')
def seed() -> dict:
    """Idempotently load the built-in six-month sample."""
    with Session() as session:
        existing = session.scalars(select(Dataset).where(Dataset.name=='Campus operations · Jan–Jun 2026')).first()
        if existing:
            return {'dataset_id':existing.id,'quality':existing.quality}
    frame, report = ingest.validate_csv(generate().to_csv(index=False))
    identifier = ingest.store_dataset(frame,report,'Campus operations · Jan–Jun 2026')
    analysis.invalidate()
    return {'dataset_id':identifier,'quality':report}

@router.post('/datasets/upload')
async def upload(file: UploadFile) -> dict:
    """Import UTF-8 CSV with capped size, detailed row reasons and atomic storage."""
    content = await file.read(25*1024*1024+1)
    if len(content)>25*1024*1024:
        raise HTTPException(413,'Maximum upload size is 25 MB.')
    try:
        frame,report = ingest.validate_csv(content.decode('utf-8-sig'))
    except UnicodeDecodeError:
        raise HTTPException(422,'Save the CSV using UTF-8 encoding.')
    identifier = ingest.store_dataset(frame,report,file.filename or 'Uploaded event log') if len(frame) else None
    analysis.invalidate()
    return {'dataset_id':identifier,'quality':report}

@router.get('/settings')
def settings() -> dict:
    """Get the active institution calendar and targets."""
    return analysis.get_settings()

@router.put('/settings')
def save_settings(payload: Settings) -> dict:
    """Persist settings and invalidate metrics/models immediately."""
    values = jsonable_encoder(payload)
    with Session.begin() as session:
        session.merge(AnalysisCache(key='settings',payload=values))
        for process,target in values['sla_rules'].items():
            session.merge(SlaRule(process_type=process,target_hours=target,activity_targets=values['activity_targets']))
    analysis.invalidate()
    analysis.model_snapshot.cache_clear()
    return values

@router.get('/analysis')
def combined(result: dict = Depends(selected)) -> dict:
    """Dashboard snapshot without raw events or heavyweight models."""
    return clean({key:value for key,value in result.items() if key not in ['data','cases','settings']})

@router.get('/overview')
def overview(result: dict = Depends(selected)) -> dict:
    """Key performance indicators for the active cohort."""
    return result['overview']

@router.get('/process/graph')
def graph(min_freq: float = Query(0,ge=0,le=100),result: dict = Depends(selected)) -> dict:
    """Directly-follows graph; min_freq is percent of maximum edge count."""
    return process_miner.graph(result['data'],min_freq)

@router.get('/process/variants')
@router.get('/process/conformance')
def variants(result: dict = Depends(selected)) -> dict:
    """Variant frequencies and alignment fitness."""
    return result['variants']

@router.get('/bottlenecks')
def rankings(dimension: str = Query('activity',pattern='^(activity|role|resource|edge)$'),result: dict = Depends(selected)) -> list:
    """Rank activities, roles, edges or anonymised resources."""
    return bottleneck.rank(result['data'],result['settings']['weights'],dimension)

@router.get('/bottlenecks/resources')
def resources(result: dict = Depends(selected)) -> list:
    """Resource queue and service comparison."""
    return bottleneck.rank(result['data'],result['settings']['weights'],'resource')

@router.get('/delays/sla')
def sla(result: dict = Depends(selected)) -> dict:
    """SLA breakdowns including role and monthly case-presence groups."""
    out = dict(result['sla'])
    closed = result['cases'].query("status != 'Open'")
    presence = result['data'][['case_id','role']].drop_duplicates().merge(closed[['case_id','breached']],on='case_id')
    out['by_role'] = presence.groupby('role').breached.mean().mul(100).rename('breach').reset_index().to_dict('records')
    out['by_month'] = closed.groupby(closed.start.dt.strftime('%Y-%m')).breached.mean().mul(100).rename('breach').reset_index().to_dict('records')
    return out

@router.get('/delays/trend')
def trend(result: dict = Depends(selected)) -> list:
    """Daily arrival-cohort trend and rolling change flags."""
    return result['trend']

@router.get('/delays/heatmap')
def heatmap(result: dict = Depends(selected)) -> list:
    """Weekday/hour queue distributions."""
    return result['heatmap']

@router.get('/delays/root-cause')
def causes(result: dict = Depends(selected)) -> list:
    """Chi-square associations with per-case factor deduplication."""
    return delay.root_causes(result['data'],result['cases'])

@router.get('/workload/queue')
def queue(result: dict = Depends(selected)) -> dict:
    """Daily noon queue counts and observed utilisation proxies."""
    return delay.queue(result['data'])

@router.get('/cases')
def cases(search: str = '', page: int = Query(1,ge=1), page_size: int = Query(20,ge=1,le=100), result: dict = Depends(selected)) -> dict:
    """Search and paginate complete case summaries."""
    frame = result['cases']
    frame = frame[frame.case_id.str.contains(search,case=False,regex=False)].sort_values('start',ascending=False)
    columns = ['case_id','process_type','department','start','end','cycle','sla','status','breached','delay']
    return clean({'total':len(frame),'page':page,'items':frame.iloc[(page-1)*page_size:page*page_size][columns].to_dict('records')})

@router.get('/cases/{case_id}')
def case_detail(case_id: str,result: dict = Depends(selected)) -> dict:
    """Observed activity timeline with incoming queues and service intervals."""
    events = result['data'][result['data'].case_id.eq(case_id)]
    if events.empty:
        raise HTTPException(404,'Case not found within active filters.')
    record = result['cases'][result['cases'].case_id.eq(case_id)].iloc[0]
    frame = events[['activity','start_time','end_time','role','resource','outcome','wait','service','raw_wait']].copy()
    frame['offset'] = (events.start_time-record.start).dt.total_seconds()/3600
    if result['settings']['working_hours']:
        frame['offset'] -= (events.raw_wait-events.wait).cumsum()
    return clean({'case_id':case_id,'cycle':record.cycle,'sla':record.sla,'status':record.status,'breached':bool(record.breached),
                  'events':frame.astype(object).where(pd.notna(frame),None).to_dict('records')})

@router.get('/predict/metrics')
def metrics(result: dict = Depends(selected)) -> dict:
    """Chronological validation metrics for the whole selected dataset."""
    _, report = analysis.model_snapshot(result['dataset']['id'],json.dumps(result['settings'],sort_keys=True))
    return report

@router.post('/predict')
def predict(payload: Prediction,result: dict = Depends(selected)) -> dict:
    """Predict SLA risk only from first-two-step observable features."""
    model,report = analysis.model_snapshot(result['dataset']['id'],json.dumps(result['settings'],sort_keys=True))
    if model is None:
        raise HTTPException(422,report['reason'])
    raw = analysis.raw(result['dataset']['id'])
    if payload.process_type not in raw.process_type.unique() or payload.department not in raw.department.unique():
        raise HTTPException(422,'Choose a process and department present in this dataset.')
    probability = float(model.predict_proba(pd.DataFrame([payload.model_dump()]))[0,1])
    return {'probability':probability,'risk':'High' if probability>=.65 else 'Moderate' if probability>=.35 else 'Low','metrics':report}

@router.post('/simulate')
def simulate(payload: Simulation,result: dict = Depends(selected)) -> dict:
    """Estimate the effect of reducing one activity queue."""
    try:
        return recommend.simulate(result['data'],result['cases'],payload.activity,payload.reduction)
    except ValueError as error:
        raise HTTPException(422,str(error))

@router.get('/recommendations')
def recommendations(result: dict = Depends(selected)) -> list:
    """Prioritised evidence and 30/50% queue-reduction scenarios."""
    return result['recommendations']

@router.get('/export/csv')
def export_csv(result: dict = Depends(selected)) -> Response:
    """Export filtered case metrics with spreadsheet formula injection protection."""
    frame = result['cases'][['case_id','process_type','department','status','cycle','sla','breached']].copy()
    for col in frame.select_dtypes(include='object'):
        frame[col] = frame[col].map(lambda s:"'"+s if isinstance(s,str) and s.startswith(('=','+','-','@','\t','\r')) else s)
    return Response(frame.to_csv(index=False),media_type='text/csv',headers={'Content-Disposition':'attachment; filename=flowlens-cases.csv'})

@router.get('/export/report')
def export_report(result: dict = Depends(selected)) -> Response:
    """Download executive PDF with vector charts and action evidence."""
    return Response(report_pdf(result,result['dataset']['name']),media_type='application/pdf',headers={'Content-Disposition':'attachment; filename=flowlens-report.pdf'})
