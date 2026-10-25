"""Bounded, invalidatable analysis snapshots shared by lightweight API routes."""
import hashlib
import json
from functools import lru_cache
import pandas as pd
from sqlalchemy import select
from ..database import Session
from ..models import Event, AnalysisCache
from ..config import DEFAULT_SETTINGS
from . import process_miner as miner, bottleneck, delay, recommend, prediction

def get_settings() -> dict:
    """Read persisted institution configuration or independent defaults."""
    with Session() as session:
        record = session.get(AnalysisCache,'settings')
        return record.payload if record else json.loads(json.dumps(DEFAULT_SETTINGS))

def invalidate() -> None:
    """Invalidate both raw-frame and computed snapshot caches after mutations."""
    raw.cache_clear()
    snapshot.cache_clear()

@lru_cache(maxsize=4)
def raw(dataset_id: int) -> pd.DataFrame:
    """Load indexed dataset events once; callers copy before modifying."""
    with Session() as session:
        return pd.read_sql(select(Event).where(Event.dataset_id==dataset_id),session.connection())

@lru_cache(maxsize=12)
def snapshot(dataset_id: int, process: str, department: str, start: str, end: str, settings_json: str) -> dict:
    """Compute shared analytical tables for one immutable filter/settings key."""
    settings = json.loads(settings_json)
    frame = raw(dataset_id).copy()
    if frame.empty:
        return {'empty':True}
    # Date filters apply to case arrival dates, preserving complete traces.
    for key,value in [('process_type',process),('department',department)]:
        if value:
            frame = frame[frame[key].eq(value)]
    arrivals = frame.groupby('case_id').start_time.min()
    mask = pd.Series(True,index=arrivals.index)
    if start:
        mask &= arrivals.ge(start)
    if end:
        mask &= arrivals.lt(end+'T23:59:59.999999')
    ids = arrivals.index[mask]
    frame = frame[frame.case_id.isin(ids)].copy()
    if frame.empty:
        return {'empty':True}
    if settings['anonymise']:
        frame['resource'] = frame.resource.map(lambda s:'Staff-'+hashlib.sha256(str(s).encode()).hexdigest()[:8])
    data = miner.prepare(frame,settings)
    cases = delay.case_metrics(data,settings)
    ranks = bottleneck.rank(data,settings['weights'])
    compliance = delay.sla(cases)
    variant = miner.variants(data,cases,settings)
    daily = delay.trend(cases)
    closed = cases[cases.status.ne('Open')]
    midpoint = cases.start.min()+(cases.start.max()-cases.start.min())/2
    previous = closed[closed.start.lt(midpoint)]
    recent = closed[closed.start.ge(midpoint)]
    change = float((recent.cycle.mean()/previous.cycle.mean()-1)*100) if len(previous) and len(recent) and previous.cycle.mean()>0 else 0
    overview = {'total_cases':len(cases),'events':len(data),'avg_cycle':float(closed.cycle.mean()) if len(closed) else 0,
                'breach_rate':compliance['breach_rate'],'slowest_step':ranks[0]['name'] if ranks else '—',
                'rework_rate':variant['rework_cases']/len(cases)*100,'open_cases':compliance['open'],
                'cycle_change':change,'start':str(cases.start.min().date()),'end':str(cases.start.max().date()),
                'total_wait':float(data.wait.sum()),'fitness':variant['fitness']}
    # ML is trained on demand; everyday dashboard visits remain inexpensive.
    return {'empty':False,'data':data,'cases':cases,'overview':overview,'bottlenecks':ranks,'sla':compliance,
            'trend':daily,'graph':miner.graph(data),'variants':variant,'heatmap':delay.heatmap(data),
            'recommendations':recommend.recommendations(data,cases,ranks,settings),'settings':settings}

@lru_cache(maxsize=4)
def model_snapshot(dataset_id: int, settings_json: str) -> tuple:
    """Cache model independently from UI filters to preserve validation sample size."""
    settings = json.loads(settings_json)
    data = miner.prepare(raw(dataset_id),settings)
    return prediction.train(data,delay.case_metrics(data,settings))
